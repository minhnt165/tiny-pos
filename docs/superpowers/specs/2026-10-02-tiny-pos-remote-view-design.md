# Tiny POS – Giai đoạn 10: Xem từ xa qua Firebase (0.14.0)

Ngày: 2026-10-02

Nền tảng giữ nguyên như `2026-09-29-tiny-pos-phase1-design.md`; nội dung và công thức của Tổng quan
như `2026-10-01-tiny-pos-overview-design.md`; `BackupService`, bộ lập lịch `backup-scheduler.ts`
và thẻ Sao lưu trong Cài đặt như `2026-10-01-tiny-pos-phase5-ops-design.md`. Tài liệu này chỉ mô tả
phần thêm mới.

## 1. Mục tiêu

Chủ tiệm ra khỏi tiệm (đi lấy hàng, về quê, nằm viện) vẫn mở điện thoại xem được tình hình quầy
hôm nay, không cần ở cùng mạng Wi‑Fi nhà:

1. "Hôm nay bán được bao nhiêu, lời bao nhiêu, bao nhiêu hóa đơn?"
2. "Có gì cần lo không?" – hàng sắp hết, khách nợ lâu, nợ nhà cung cấp, kiểm kê dở, sao lưu lỗi.
3. "Số này mới hay cũ?" – biết máy quầy đang gửi hay đã tắt / mất mạng.

Tiêu chí thành công:

- Trên điện thoại ở mạng khác, trang xem hiện **đúng** nội dung trang *Tổng quan* của máy quầy, trễ
  tối đa khoảng một phút sau khi có chứng từ mới; khi máy quầy tắt thì số cũ vẫn hiện kèm cảnh báo.
- Chỉ email được chủ tiệm cho phép mới đọc được; tài khoản Google khác đăng nhập xong bị từ chối
  với câu hướng dẫn rõ ràng.
- Máy quầy **không bao giờ** bị chậm, lỗi hay chặn bán hàng vì mất Internet hoặc Firebase lỗi.
- Nằm trong gói miễn phí của Firebase; máy tiệm không cài tính năng này thì không khác gì 0.13.0.
- Không đổi schema, không migration.

## 2. Phạm vi

Trong phạm vi: service `remote-sync.ts` + bộ lập lịch đẩy; API `GET/PUT /api/remote`,
`POST /api/remote/push`; thẻ *Xem từ xa* trong Cài đặt (công tắc, danh sách email, QR, trạng thái,
Gửi ngay); workspace mới `remote/` (trang xem chỉ đọc, đăng nhập Google, Firebase Hosting +
Firestore rules); hướng dẫn cài một tiệm trong README; version 0.14.0; CLAUDE.md.

Ngoài phạm vi: xem chi tiết hóa đơn / khách / sản phẩm từ xa, báo cáo theo khoảng ngày từ xa, nhiều
tiệm trong một tài khoản, thông báo đẩy (push notification), đẩy ảnh sản phẩm, đồng bộ hai chiều hay
bán hàng từ xa, đăng nhập cho app máy quầy, đường hầm vào máy quầy (Cloudflare Tunnel / Tailscale),
sao lưu `.db` lên mây, tự động hóa bước tạo project Firebase.

## 3. Quyết định đã chốt

| Vấn đề | Chọn | Lý do |
|---|---|---|
| Hướng dữ liệu | **Một chiều**: máy quầy ghi Firestore, không bao giờ đọc về | Sổ cái với bất biến chặt (movement, mã chứng từ theo ngày) không chịu được đồng bộ hai chiều khi mất mạng; máy quầy là nguồn sự thật duy nhất |
| Nội dung đẩy | Đúng object `Overview` của `GET /api/overview` (kể cả `backup`), bọc thêm `storeName`, `updatedAt`, `appVersion` | Dùng lại toàn bộ công thức và giới hạn dòng đã có; vài KB mỗi lần |
| Firebase thuộc ai | Một project Firebase **mỗi tiệm**, tạo bằng tài khoản Google của chủ tiệm | Dữ liệu doanh thu của tiệm nằm trong tài khoản của chính họ; không có máy chủ chung của người làm phần mềm; đường dẫn Firestore không cần mã tiệm |
| Kho dữ liệu | Firestore, tài liệu `remote/overview` và `remote/access` | `onSnapshot` cho điện thoại tự cập nhật; rules đọc được tài liệu khác (`get()`) để phân quyền theo dữ liệu |
| Phân quyền | Rules: đã đăng nhập Google, email đã xác minh, email nằm trong `remote/access.emails`; trình duyệt không ghi được gì | Chủ tiệm sửa danh sách email trong Cài đặt là có hiệu lực ngay, không deploy lại rules |
| Khi nào đẩy | Vòng 60 s theo mẫu `backup-scheduler.ts`: mtime `.db`/`-wal` mới hơn lần đẩy trước **hoặc** ngày địa phương đã đổi; đẩy ngay khi khởi động, khi bật, khi bấm *Gửi ngay* | Không móc vào từng service bán/nhập/thu nợ; qua nửa đêm "hôm nay" đổi dù DB không đổi |
| Lỗi đẩy | Bắt hết trong `tick`, ghi `lastError`, lần sau thử lại; không ném, không log dồn | Giống sao lưu tự động; máy quầy không được chết vì Internet |
| Bí mật | Khóa service account ở `data/remote/service-account.json`, **ngoài DB**; cấu hình web lấy từ `/__/firebase/init.json` của Hosting | Bản sao lưu `.db` (có thể chép lên Drive) không chứa khóa; một bản build `remote/` dùng cho mọi tiệm |
| Cấu hình tính năng | Khóa `remoteEnabled`, `remoteEmails` trong bảng `settings`, chỉ `remote-sync.ts` đọc ghi; API riêng `/api/remote` | Không đụng `settingsInputSchema` (PUT cả object, giá trị chuỗi); cùng cách `internalBarcodeSeq` của tem |
| `firebase-admin` | Phụ thuộc của `server`, `import()` động khi lần đầu cần | Máy không bật tính năng không tốn thời gian khởi động và bộ nhớ |
| Trang xem | Workspace `remote/` riêng, **không import component từ `client/`** | Khối Tổng quan của client gắn router, `useOverview`, ảnh `/images`; tách để hai app độc lập, chấp nhận trùng phần trình bày (công thức và kiểu vẫn từ `shared`) |
| Build gốc | `npm run build` và `scripts/install.cmd` **không** build `remote/`; `npm run typecheck` gốc gồm `remote/` qua workspaces | Máy quầy không cần trang xem; bước cài trên máy tiệm không phụ thuộc Firebase |
| Ảnh sản phẩm | Vẫn gửi tên file nhưng trang xem hiện chữ cái đầu | Ảnh nằm ở `data/images` của máy quầy; đẩy ảnh ngoài phạm vi |
| Tắt tính năng | Server xóa `remote/overview`, giữ `remote/access`, dừng đẩy | Tắt là dữ liệu rời khỏi Google ngay; bật lại không phải nhập lại email |

## 4. Dữ liệu

### Firestore

```
remote/overview   { storeName: string, updatedAt: string (ISO), appVersion: string, data: Overview }
remote/access     { emails: string[] }
```

- `remote/overview` ghi đè toàn bộ bằng `set` (không `update`, không merge) để không sót trường cũ.
- `remote/access` ghi mỗi khi `PUT /api/remote` đổi danh sách và khi bật (để chắc tài liệu tồn tại trước
  khi điện thoại đọc).
- Firestore không nhận `undefined`; `Overview` hiện không có trường `undefined` (chỉ `null`), nhưng
  service vẫn `JSON.parse(JSON.stringify(...))` trước khi ghi để chắc chắn.

### Rules (`remote/firestore.rules`)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /remote/overview {
      allow read: if request.auth != null
        && request.auth.token.email_verified == true
        && request.auth.token.email in get(/databases/$(database)/documents/remote/access).data.emails;
      allow write: if false;
    }
    match /remote/access { allow read, write: if false; }
    match /{document=**} { allow read, write: if false; }
  }
}
```

Admin SDK bỏ qua rules nên server ghi được. Email trong `remote/access` lưu chữ thường; token Google
cũng trả email chữ thường.

### Bảng `settings` (không đổi schema)

| Khóa | Giá trị |
|---|---|
| `remoteEnabled` | `'0'` / `'1'`, mặc định tắt |
| `remoteEmails` | JSON mảng chuỗi, mặc định `[]` |

### Shared (`shared/src/schemas/remote.ts`, `types.ts`)

```ts
export const REMOTE_MAX_EMAILS = 5;
export const remoteConfigInputSchema = z.object({
  enabled: z.boolean(),
  emails: z.array(z.string().trim().toLowerCase().email('Email không hợp lệ')).max(REMOTE_MAX_EMAILS),
});
export type RemoteConfigInput = z.output<typeof remoteConfigInputSchema>;

export interface RemoteStatus {
  configured: boolean;        // có file khóa
  projectId: string | null;   // từ file khóa
  url: string | null;         // https://<projectId>.web.app
  enabled: boolean;
  emails: string[];
  lastPushAt: string | null;
  lastError: string | null;
}

/** Tài liệu remote/overview; dùng chung server (ghi) và remote (đọc). */
export interface RemoteOverviewDoc {
  storeName: string;
  updatedAt: string;
  appVersion: string;
  data: Overview;
}
export const REMOTE_STALE_MS = 10 * 60_000;
```

Email trùng sau chuẩn hóa thì bỏ bớt (`[...new Set(emails)]`) trong service.

## 5. Server

### `services/remote-sync.ts`

```ts
export interface RemoteWriter {
  setOverview(doc: RemoteOverviewDoc): Promise<void>;
  deleteOverview(): Promise<void>;
  setAccess(emails: string[]): Promise<void>;
}
export interface RemoteSyncOpts {
  db: Db;
  keyFile: string;                       // data/remote/service-account.json
  dbFile: string;                        // để so mtime (.db và -wal)
  backups?: BackupService;               // ghép `backup` như routes/overview.ts
  appVersion: string;
  /** Mặc định tạo writer thật từ firebase-admin; test truyền writer giả. */
  writer?: (keyFile: string) => Promise<RemoteWriter>;
  intervalMs?: number;                   // mặc định 60_000
  clock?: Clock;
  log?: (s: string) => void;
}
export interface RemoteSync {
  status(): RemoteStatus;
  save(input: RemoteConfigInput): Promise<RemoteStatus>;   // lưu settings; bật → setAccess + push; tắt → deleteOverview
  push(): Promise<RemoteStatus>;                           // đẩy ngay, bỏ qua điều kiện mtime/ngày; ném lỗi để route trả 502
  tick(now?: Date): Promise<void>;                         // vòng lặp: kiểm điều kiện rồi push, nuốt lỗi vào lastError
  start(): void;
  stop(): void;
}
export function createRemoteSync(o: RemoteSyncOpts): RemoteSync
```

- `configured` = `fs.existsSync(keyFile)` kiểm **mỗi lần** `status()`; `projectId` đọc `project_id` từ file
  (cache theo mtime file). File hỏng → `configured: false`, `lastError` "File khóa không đọc được".
- `writer` mặc định: `const admin = await import('firebase-admin/app')` + `firestore`; `initializeApp({ credential:
  cert(json) })` một lần; `setOverview` = `doc('remote/overview').set(doc)`, v.v. Khởi tạo lỗi (file sai định
  dạng) → ném lỗi có message tiếng Việt.
- `buildDoc()`: `{ storeName: getSettings(db).storeName, updatedAt: clock.now.toISOString(), appVersion, data: { ...overview(db, clock), backup } }`
  với `backup` tính giống `backupSummary` trong `routes/overview.ts` (chuyển hàm đó vào `services/overview.ts`
  để dùng chung, route gọi lại).
- `tick`: không bật hoặc chưa `configured` → thoát. Điều kiện đẩy: chưa đẩy lần nào trong phiên, hoặc mtime `.db`
  / `-wal` > `lastPushMs`, hoặc `localDate(now) !== localDate(lastPushAt)`. Đẩy xong ghi `lastPushAt`, xóa
  `lastError`. Lỗi → `lastError = message`, log một dòng; không ném.
- `save`: validate đã làm ở route; ghi hai khóa settings trong một transaction; sau đó nếu `enabled`:
  `setAccess` rồi `push` (lỗi → `lastError`, vẫn trả 200 vì cấu hình đã lưu; client hiện lỗi màu đỏ);
  nếu tắt: `deleteOverview` (lỗi → `lastError`). Bật khi chưa `configured` → 400 "Chưa có file khóa Firebase".
- `push` khi chưa bật → 400 "Xem từ xa đang tắt".
- `lastPushAt`, `lastError` giữ trong bộ nhớ (như `lastAutoAt`/`lastError` của sao lưu), mất khi khởi động
  lại: chấp nhận, vì khởi động là đẩy ngay.
- `start()`: `void tick()` rồi `setInterval(..., intervalMs).unref()`; chỉ `index.ts` gọi.

### Route `routes/remote.ts`

```
GET  /api/remote        → 200 RemoteStatus
PUT  /api/remote        body RemoteConfigInput → 200 RemoteStatus | 400
POST /api/remote/push   → 200 RemoteStatus | 400 (đang tắt) | 502 "Không gửi được: <lý do>"
```

`apiRouter` nhận `deps.remote?: RemoteSync`; không có (test `createApp` không truyền) → `GET` trả
`{ configured: false, enabled: false, emails: [], … }` và `PUT`/`POST` trả 503 "Chưa cấu hình xem từ xa", giống cách
`backups` là phụ thuộc tùy chọn.

### `index.ts`

Tạo `createRemoteSync({ db, keyFile: path.join(dataDir, 'remote', 'service-account.json'), dbFile, backups,
appVersion })` với `appVersion` đọc từ `package.json` gốc (server hiện chưa có hằng version; đọc file một lần như
`client/vite.config.ts` đang làm), truyền vào `createApp` → `apiRouter`, gọi `start()` trong callback `listen`
ngay sau bộ lập lịch sao lưu. `mkdirSync(data/remote)` khi khởi động để người cài biết chép file vào đâu.

## 6. Client (thẻ *Xem từ xa* trong Cài đặt)

`pages/settings/RemoteCard.tsx`, đặt sau `BackupCard`. `api/remote.ts`: `useRemoteStatus()` (khóa
`['remote']`, `refetchInterval` 30 s khi tab mở để thấy `lastPushAt` chạy), `useSaveRemote()`,
`usePushRemote()`; mutation xong `setQueryData(['remote'], data)`.

Trạng thái thẻ:

- **Chưa có file khóa** (`configured: false`): tiêu đề *Xem từ xa*, một đoạn "Chưa cài đặt Firebase cho tiệm này.
  Cần file `data\remote\service-account.json` trên máy quầy – xem README." Công tắc và các nút bị khóa. Nếu
  `lastError` (file hỏng) hiện thêm dòng `destructive`.
- **Đã có file khóa**: công tắc *Bật xem từ xa* (`Switch`); danh sách email (mỗi dòng email + nút xóa; ô nhập +
  nút *Thêm*, validate bằng `remoteConfigInputSchema` phía client trước khi gửi, tối đa 5, hết chỗ thì khóa ô);
  địa chỉ trang `url` dạng link mở tab mới và **mã QR** vẽ bằng `qrcode` (như `TransferQr`) để chủ tiệm quét;
  dòng trạng thái: "Gửi lần cuối 14:32" (giờ địa phương dạng `HH:mm` như cột giờ ở trang Hóa đơn), hoặc
  "Chưa gửi lần nào", hoặc `lastError` màu `destructive` kèm "Sẽ tự thử lại mỗi phút"; nút *Gửi ngay* (khóa khi
  đang tắt hoặc đang gửi).
- Bật/tắt công tắc và thêm/xóa email đều gọi `PUT` ngay (không nút Lưu riêng), `toast` lỗi nếu 400/502.
- Bật mà danh sách email rỗng: cho phép (server vẫn đẩy), nhưng thẻ hiện dòng `warning` "Chưa có email nào được
  xem" để chủ tiệm biết vì sao điện thoại bị từ chối.

Không thêm mục menu, không đổi Tổng quan của máy quầy.

## 7. Trang xem (`remote/`)

### Cấu trúc

```
remote/
  package.json        dev / build / typecheck / deploy ("firebase deploy --only hosting,firestore:rules")
  vite.config.ts      Tailwind v4 plugin, alias @, __APP_VERSION__ từ package.json gốc
  firebase.json       hosting.public = dist, rewrites ** → /index.html, firestore.rules
  firestore.rules
  .firebaserc         KHÔNG đưa vào git (project mỗi tiệm); README hướng dẫn `firebase use`
  index.html, public/manifest.webmanifest, public/icon-*.png
  src/
    main.tsx, App.tsx
    firebase.ts       initFirebase(): fetch('/__/firebase/init.json') → fallback import.meta.env.VITE_FIREBASE_CONFIG
    auth.ts           useUser(), signIn() (popup, lỗi popup-blocked → redirect), signOut()
    overview.ts       useRemoteOverview(): onSnapshot('remote/overview') → { doc, status: 'loading'|'denied'|'missing'|'ok', error }
    components/ui/    shadcn: card, button, badge, skeleton (+ sonner nếu cần toast)
    blocks/           Header, TodayStats, Alerts, WeekTable, RecentOrders, LowStock, DebtList, BackupLine
```

Phụ thuộc: `react`, `react-dom`, `firebase`, `@tiny-pos/shared`, `lucide-react`, `tailwindcss`,
`@tailwindcss/vite`, `radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`; dev:
`vite`, `@vitejs/plugin-react`, `typescript`, `firebase-tools`. Không react-router, không TanStack Query
(một tài liệu, một listener).

### Màn hình (một trang, một cột, ưu tiên điện thoại)

- **Chưa đăng nhập**: logo chữ, tên "Tiny POS – Xem từ xa", nút *Đăng nhập bằng Google*.
- **Bị từ chối** (`permission-denied`): "Tài khoản *x@gmail.com* chưa được cấp quyền xem. Thêm email này trong
  Cài đặt → Xem từ xa trên máy quầy." + nút *Đăng xuất*.
- **Chưa có tài liệu**: "Máy quầy chưa gửi số liệu lần nào. Trên máy quầy vào Cài đặt → Xem từ xa → Gửi ngay."
- **Có dữ liệu**: đầu trang `storeName`, dòng "Cập nhật lúc HH:mm" (kèm ngày nếu khác hôm nay của điện thoại),
  nút đăng xuất. `Date.now() − Date.parse(updatedAt) > REMOTE_STALE_MS` → dòng này màu `warning`: "Máy quầy chưa
  gửi số mới từ HH:mm, có thể đang tắt hoặc mất mạng." (tính lại mỗi 30 s bằng `setInterval`, không chỉ khi có
  snapshot). Sau đó các khối theo thứ tự Tổng quan: Hôm nay (doanh thu, lãi, số hóa đơn, tiền mặt / CK / ghi nợ /
  thu nợ), Cần chú ý (cùng câu chữ với `AlertsCard`: sắp hết, hết hàng, nợ lâu, nợ NCC, kiểm kê dở, sao lưu lỗi;
  không có gì thì "Mọi thứ ổn"), 7 ngày (bảng ngày / doanh thu / lãi / đơn), Hóa đơn gần nhất (mã, giờ, tổng,
  gạch ngang nếu hủy), Hàng sắp hết (chữ cái đầu, tên, tồn / tối thiểu), Khách nợ (tên, số nợ, badge *Nợ lâu*),
  Nợ NCC, Sao lưu (bản gần nhất, lỗi nếu có).
- Chữ số tiền bằng `formatMoney` của `shared`; ngày `formatDateVn`. Chỉ đọc: không link, không nút hành động.
- Theo `prefers-color-scheme`; token màu đặt lại trong `remote/src/index.css` theo cùng bảng với client.
- Mất mạng ở điện thoại: Firestore SDK giữ cache, `onSnapshot` vẫn trả bản cuối với `fromCache`; trang hiện
  thêm "Điện thoại đang ngoại tuyến" cạnh dòng cập nhật.

### Hosting

`/__/firebase/init.json` chỉ có trên Hosting; dev local đọc `VITE_FIREBASE_CONFIG` trong `remote/.env.local`
(không vào git). Domain `*.web.app` được Firebase Auth cho phép sẵn; dev `localhost` cũng được cho phép mặc định.

## 8. Lỗi

| Tình huống | Hành vi |
|---|---|
| Máy quầy mất Internet | `tick` lỗi → `lastError` "Không kết nối được Firebase", thử lại sau 60 s; điện thoại thấy cảnh báo cũ sau 10 phút |
| File khóa sai / project bị xóa | `lastError` với message của SDK; thẻ Cài đặt hiện đỏ; *Gửi ngay* trả 502 kèm lý do |
| Bật khi chưa có file khóa | 400 "Chưa có file khóa Firebase" |
| Email sai định dạng / quá 5 | 400 từ zod, client chặn trước |
| Điện thoại đăng nhập email không trong danh sách | Firestore `permission-denied` → màn *Bị từ chối* |
| Chủ tiệm xóa email đang xem | Listener nhận `permission-denied` ở snapshot kế tiếp → màn *Bị từ chối* |
| Server khởi động lại | `lastPushAt` mất, đẩy ngay lúc khởi động nên điện thoại có bản mới trong vài giây |
| `remote/` deploy nhưng máy quầy chưa bật | Màn *Chưa có tài liệu* (rules cho đọc tài liệu không tồn tại nếu email hợp lệ) |

Vượt hạn mức miễn phí của Firestore không xảy ra với một tiệm (≤ 1.440 ghi/ngày); không xử lý riêng.

## 9. Kiểm thử

### Server (`services/remote-sync.test.ts`, `routes/remote-api.test.ts`)

Writer giả ghi vào mảng; `keyFile` trỏ file tạm trong thư mục test (có / không có / hỏng); `dbFile` là file tạm
để `utimesSync` đổi mtime; `Clock` cố định.

- `status()` khi không có file → `configured: false`; có file → `projectId`, `url` đúng; file hỏng → `lastError`.
- `tick` lần đầu đẩy; lần hai không đổi gì → không đẩy; đổi mtime `-wal` → đẩy; cùng mtime nhưng ngày địa phương
  đổi → đẩy.
- Tài liệu đẩy: `data` bằng `overview(db)` + `backup`, `storeName` theo settings, `updatedAt` theo `Clock`.
- Writer ném → `lastError` có message, `tick` không ném, lần sau writer ổn → `lastError` null.
- `save` bật: lưu settings, gọi `setAccess` với email chuẩn hóa (trim, chữ thường, bỏ trùng) rồi `setOverview`;
  tắt: gọi `deleteOverview`; bật khi không có file → 400.
- Không bật → `tick` không gọi writer; `push` → 400.
- Route: `GET` khi không truyền `remote` → `configured: false`; `PUT` 400 với email sai / quá 5; `POST /push` trả
  502 khi writer ném.

### Client

Không có test tự động; kiểm bằng `browser-verify` ba trạng thái của thẻ (chưa có file khóa, đã có và tắt, đã có và
bật với lỗi) bằng cách chặn `/api/remote` trả dữ liệu giả, không ghi DB dev.

### `remote/`

Kiểm tay với project Firebase thử của người triển khai: đăng nhập đúng email → thấy số; email khác → bị từ chối;
xóa email trong Cài đặt khi đang mở → chuyển sang bị từ chối; tắt Wi‑Fi điện thoại → dòng ngoại tuyến; dừng server
10 phút → dòng cảnh báo cũ; cỡ điện thoại và máy tính; sáng / tối. Rules kiểm bằng thử thật, không viết test rules.

## 10. Cài một tiệm (ghi vào README)

1. Vào console.firebase.google.com bằng tài khoản Google của chủ tiệm, tạo project (tắt Analytics).
2. *Firestore Database* → tạo, chế độ production, vùng `asia-southeast1`.
3. *Authentication* → *Sign-in method* → bật *Google*.
4. *Project settings* → *Service accounts* → *Generate new private key*; chép file thành
   `data\remote\service-account.json` trên máy quầy.
5. Trên máy người triển khai: `npm install`, `npx firebase login` (một lần), `cd remote && npx firebase use <project-id>`,
   `npm run deploy -w remote`. Mạng công ty chặn TLS thì đặt `NODE_EXTRA_CA_CERTS` như mọi lệnh khác.
6. Trên máy quầy: Cài đặt → Xem từ xa → thêm email chủ tiệm → bật → *Gửi ngay*; chủ tiệm quét QR, đăng nhập Google,
   *Thêm vào màn hình chính*.

Không cần khởi động lại server sau khi chép file khóa. Gỡ: tắt công tắc (xóa tài liệu trên Firestore), xóa file
khóa; xóa project Firebase nếu muốn sạch hẳn.

## 11. Phiên bản và tài liệu

- `package.json` gốc, `client`, `server`, `shared`, `remote` → `0.14.0`.
- README: mục *Xem từ xa* (làm gì, không làm gì, bước cài ở trên, lưu ý dữ liệu nằm trên Google).
- CLAUDE.md: thêm 0.14.0 vào danh sách đã xong, bảng lệnh thêm `npm run deploy -w remote`, bất biến mới: "**Xem từ
  xa** chỉ một chiều qua `services/remote-sync.ts`: server ghi Firestore, không đọc về; khóa ở `data/remote/`,
  không trong DB; `remote/` không import từ `client/`; `npm run build` gốc không build `remote/`."
- `.gitignore`: `remote/.firebaserc`, `remote/.env.local`, `remote/.firebase/`.
