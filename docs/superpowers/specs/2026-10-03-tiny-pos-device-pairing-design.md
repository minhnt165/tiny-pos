# Tiny POS – Ghép thiết bị (0.16.0)

Ngày: 2026-10-03

Nền tảng giữ nguyên như `2026-09-29-tiny-pos-phase1-design.md`; sao lưu/khôi phục như
`2026-10-01-tiny-pos-phase5-ops-design.md`; Xem từ xa như `2026-10-02-tiny-pos-remote-view-design.md`.
Tài liệu này chỉ mô tả phần thêm mới.

## 1. Mục tiêu

Hiện nay ai vào được Wi‑Fi của tiệm là dùng được toàn bộ phần mềm qua `http://<IP máy quầy>:3000`:
tải bản sao `.db`, khôi phục, hủy đơn. Tiệm không có nhân viên, chỉ chủ tiệm và người nhà dùng, nên
không cần tài khoản hay phân quyền; chỉ cần **máy lạ trong mạng không dùng được**.

Không làm màn đăng nhập tên/mật khẩu: chủ tiệm không rành máy, app chạy offline nên không có cách
lấy lại mật khẩu; bị khóa ngoài phần mềm giữa giờ bán là lỗi nặng nhất có thể xảy ra, và đăng nhập
không chặn được thêm gì so với cách dưới đây.

Cách làm: **tin máy quầy, ghép điện thoại một lần**.

1. Máy quầy (trình duyệt mở `localhost`) luôn dùng được, không phải làm gì.
2. Điện thoại/máy khác trong LAN lần đầu mở thấy màn "chưa được ghép". Trên máy quầy bấm *Ghép
   điện thoại*, điện thoại quét QR (hoặc gõ mã 6 số) là xong, từ đó không hỏi lại.
3. Máy quầy xem danh sách thiết bị đã ghép, đổi tên, gỡ (mất điện thoại, đổi người).

Tiêu chí thành công:

- Máy trong LAN chưa ghép gọi bất kỳ API hay ảnh sản phẩm nào đều nhận 401; sau khi ghép thì dùng
  như cũ; bị gỡ thì chuyển ngay về màn ghép.
- Máy quầy không bao giờ bị chặn, kể cả khi DB không có thiết bị nào, server vừa cài, hay khôi phục
  bản sao cũ.
- Không đụng Xem từ xa, cửa sổ in tem, `--kiosk-printing`, service worker.
- Cập nhật xong là có hiệu lực ngay, không có công tắc bật/tắt.

## 2. Phạm vi

Trong phạm vi: bảng `devices` + migration `0007`; `services/devices.ts`; middleware `deviceGate`
trong `createApp`; API `/api/device` (mọi máy) và `/api/devices` (chỉ máy quầy); `copyTables` bỏ
qua `devices`; client: `DeviceGate` bọc app, `PairScreen`, trang `/pair`, thẻ *Thiết bị* trong Cài
đặt, tách `UrlQr` dùng chung; README, CLAUDE.md, version 0.16.0.

Ngoài phạm vi: tài khoản/mật khẩu, phân quyền, mã PIN cho thao tác nhạy cảm, HTTPS trong LAN, giới
hạn theo IP/MAC, nhật ký truy cập, ghép từ điện thoại đã ghép sang điện thoại khác, công tắc tắt
tính năng, bất kỳ thay đổi nào ở `remote/`.

## 3. Quyết định đã chốt

| Vấn đề | Chọn | Lý do |
|---|---|---|
| Hình thức | Ghép thiết bị bằng QR/mã 6 số, không đăng nhập | Không có gì để quên; máy quầy không thể bị khóa ngoài |
| Bật khi nào | Ngay sau cập nhật, không công tắc | Không có trạng thái "quên bật"; điện thoại đang dùng ghép lại một lần |
| Nhận ra máy quầy | `remoteAddress` là loopback **và** header `Host` là `localhost`/`127.0.0.1`/`[::1]` | Địa chỉ TCP không giả được từ máy khác; kiểm `Host` chặn DNS rebinding từ trang web lạ mở trên máy quầy |
| Lưu quyền | Bảng `devices` trong DB, cookie giữ token gốc, DB giữ SHA‑256 | Gỡ được từng máy, thấy máy nào đang được phép; test bằng `createTestDb()` như các service khác |
| Khôi phục bản sao | `copyTables` bỏ qua bảng `devices` | Khôi phục bản cũ không được làm sống lại điện thoại đã gỡ |
| Mã ghép | 6 chữ số, giữ trong bộ nhớ server, 5 phút, một mã duy nhất, dùng một lần, sai 5 lần thì hủy | Không cần bảng; server khởi động lại là mã mất, tạo lại được ngay |
| Ai ghép/gỡ | Chỉ máy quầy | Điện thoại bị cầm nhầm không cấp quyền cho máy khác được |
| Cookie | `tp_device`, `HttpOnly`, `SameSite=Lax`, `Path=/`, 10 năm, không `Secure` | App chạy HTTP trong LAN; `Lax` chặn request ghi từ trang khác; tự đọc cookie, không thêm thư viện |
| Lần dùng cuối | Cột `last_seen_on` (ngày địa phương), chỉ ghi khi sang ngày mới | Mỗi lần ghi DB làm Xem từ xa đẩy lại; mỗi thiết bị ghi tối đa một lần/ngày |
| Tên thiết bị | Mặc định từ User‑Agent ("iPhone · Safari"), đổi được trên máy quầy | Đủ để chủ tiệm nhận ra máy nào |
| Gỡ | Xóa hẳn dòng | Không phải chứng từ, không cần lịch sử |
| File giao diện | JS/CSS/HTML/manifest/sw vẫn mở với mọi máy | Không chứa dữ liệu; cần để hiện màn ghép |
| Mất mạng/server tắt | Client vẫn render app, không hiện màn ghép | Không bắt ghép chỉ vì không gọi được server |

## 4. Dữ liệu

### 4.1 Bảng `devices` (migration `0007`)

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | integer PK autoincrement | |
| `name` | text not null | Tên hiển thị |
| `token_hash` | text not null, unique | SHA‑256 hex của token gốc |
| `created_at` | text not null, default ISO now | Như các bảng khác |
| `last_seen_on` | text | Ngày địa phương `YYYY-MM-DD` lần dùng gần nhất; null nếu chưa dùng sau khi ghép |

Token gốc: 32 byte ngẫu nhiên (`crypto.randomBytes`), mã hóa base64url, chỉ nằm trong cookie của
điện thoại và trả về một lần trong phản hồi ghép. Không bao giờ ghi DB, không log.

### 4.2 Mã ghép (bộ nhớ, không DB)

```ts
interface Pairing { code: string; expiresAt: number; failures: number }
```

Một `Pairing | null` trong `DevicesService`. `startPairing()` ghi đè mã cũ. Mã gồm 6 chữ số từ
`crypto.randomInt(0, 1_000_000)` đệm số 0.

### 4.3 Kiểu dùng chung (`shared/src/types.ts`, schema zod trong `shared/src/schemas/`)

```ts
type DeviceStatus =
  | { kind: 'counter' }                       // máy quầy
  | { kind: 'paired'; device: { id: number; name: string } }
  | { kind: 'unpaired' };

interface Device { id: number; name: string; createdAt: string; lastSeenOn: string | null }
interface PairingInfo { code: string; url: string; expiresAt: string }

pairInputSchema   = { code: string 6 chữ số }
deviceNameSchema  = { name: string 1–50 ký tự, trim }
```

Hằng: `PAIRING_TTL_MS = 5 phút`, `PAIRING_MAX_FAILURES = 5`, `DEVICE_COOKIE = 'tp_device'`.

## 5. Server

### 5.1 Nhận ra máy quầy

```ts
/** Request từ chính máy quầy: địa chỉ loopback và Host là localhost (chặn DNS rebinding). */
export function isCounterRequest(req: Request): boolean
```

- `req.socket.remoteAddress` ∈ {`127.0.0.1`, `::1`, `::ffff:127.0.0.1`}.
- `req.headers.host` bỏ phần cổng ∈ {`localhost`, `127.0.0.1`, `[::1]`}.

Cửa sổ in tem và cửa sổ quầy đều mở `http://localhost:3000` nên là máy quầy. Mở chính máy quầy bằng
IP LAN thì bị coi là máy khác; biểu tượng Tiny POS luôn mở `localhost` nên không ảnh hưởng.

`createApp` nhận thêm `opts.isCounter?: (req) => boolean` để test giả request từ LAN; mặc định là
`isCounterRequest`.

### 5.2 `services/devices.ts`

```ts
export function createDevicesService(db: Db, opts: { lanUrl: () => string; clock?: Clock }): DevicesService

interface DevicesService {
  startPairing(): PairingInfo;                      // mã mới, ghi đè mã cũ
  pair(code: string, userAgent: string | undefined): { token: string; device: Device };
  verify(token: string): Device | null;             // băm, tra DB; ghi last_seen_on nếu sang ngày mới
  list(): Device[];
  rename(id: number, name: string): Device;
  revoke(id: number): void;
}
```

- `pair`: không có mã hoặc hết hạn → `BadRequestError('Chưa có mã ghép đang mở, hãy tạo mã trên máy quầy')`.
  Sai mã → `failures++`; chưa đủ 5 → `BadRequestError('Mã không đúng, còn N lần thử')`; đủ 5 → hủy mã,
  `BadRequestError('Mã đã hết hiệu lực, tạo mã mới trên máy quầy')`. Đúng mã → tạo token, insert,
  hủy mã, trả `{ token, device }`.
- `verify`: `last_seen_on` khác ngày địa phương hôm nay (theo `resolveClock`) thì update; bằng thì
  không chạm DB.
- `rename`/`revoke` id không có → `NotFoundError('Không tìm thấy thiết bị')`.
- Tên mặc định từ User‑Agent: hệ ("iPhone", "iPad", "Android", "Windows", "Mac") + " · " + trình
  duyệt ("Safari", "Chrome", "Edge", "Firefox"); không nhận ra thì "Thiết bị". Hàm thuần `deviceNameFromUa`
  có test riêng, không cần thư viện.
- `lanUrl()` trả `http://<IP LAN>:<port>`; `index.ts` truyền hàm dùng cùng cách tìm IP đang in lúc
  khởi động (gọi lại mỗi lần để IP đổi thì QR vẫn đúng). Không tìm được IP LAN thì `url` là
  `http://localhost:<port>/pair?...` và client vẫn hiện mã số.

### 5.3 Middleware `deviceGate`

```ts
export function deviceGate(devices: DevicesService, isCounter: (req) => boolean): RequestHandler
```

Gắn trong `createApp` **trước** `/api` và `/images`:

1. `isCounter(req)` → `req.device = { kind: 'counter' }`, next.
2. Đường dẫn `/api/device` (GET) và `/api/device/pair` (POST) → next (route tự xử lý).
3. Cookie `tp_device` có và `verify(token)` ra thiết bị → `req.device = { kind: 'paired', device }`, next.
4. Còn lại → `401 { error: 'Thiết bị chưa được ghép', code: 'DEVICE_NOT_PAIRED' }`.

Static `client/dist` và SPA fallback không qua gate.

Guard `counterOnly`: `req.device.kind !== 'counter'` → `403 { error: 'Chỉ thao tác được trên máy quầy' }`.

### 5.4 Route

| Method | Đường dẫn | Ai | Việc |
|---|---|---|---|
| GET | `/api/device` | mọi máy | Trả `DeviceStatus` của request này |
| POST | `/api/device/pair` | mọi máy | Body `pairInputSchema`; gọi `pair(code, ua)`; đặt cookie; trả `201 { device }` |
| POST | `/api/devices/pairing` | máy quầy | `startPairing()` → `PairingInfo` |
| GET | `/api/devices` | máy quầy | `list()` |
| PATCH | `/api/devices/:id` | máy quầy | Body `deviceNameSchema` → `rename` |
| DELETE | `/api/devices/:id` | máy quầy | `revoke` → 204 |

Cookie đặt bằng `res.cookie` của Express: `httpOnly: true, sameSite: 'lax', path: '/', maxAge: 10 năm`.
Đọc cookie bằng hàm nhỏ `readCookie(header, name)` trong `middleware/device-gate.ts` (tách theo `;`,
decode URI), không thêm `cookie-parser`.

### 5.5 Khôi phục bản sao

`copyTables` trong `services/backups.ts`: thêm `devices` vào danh sách bảng bỏ qua (giữ nguyên
`main.devices`, không xóa, không chép từ `src`). Bản sao vẫn chứa bảng `devices` của lúc sao lưu
(không hại: `token_hash` không dùng lại được nếu không có token gốc).

### 5.6 `index.ts`

Tạo `devices = createDevicesService(db, { lanUrl })`, truyền vào `createApp(db, { …, devices })`.
`lanUrl` dùng lại đoạn tìm IPv4 không `internal` hiện có (tách thành hàm `lanAddress()`).

## 6. Client

Mọi lời gọi API của client đều qua `api()` trong `api/client.ts` (không còn `fetch` trực tiếp), nên
xử lý 401 đặt một chỗ.

### 6.1 `api/device.ts`

`useDevice()` (`GET /api/device`, `staleTime: Infinity`, `retry: false`), `usePair()`,
`useDevices()`, `useStartPairing()`, `useRenameDevice()`, `useRevokeDevice()`.

### 6.2 `DeviceGate` (`components/DeviceGate.tsx`)

`App.tsx` bọc toàn bộ (kể cả `/pos`, `/labels/print`) trong `DeviceGate`:

- `useDevice()` đang tải → `Skeleton` giữa màn hình.
- Lỗi mạng (không có `status`) hoặc 5xx → render app như thường.
- `kind: 'unpaired'` → `PairScreen` thay cho cả app.
- Khác → render con.

Bị gỡ giữa chừng: `main.tsx` tạo `QueryClient` với `QueryCache`/`MutationCache` `onError`; gặp
`ApiError` có `status === 401` thì `queryClient.setQueryData(['device'], { kind: 'unpaired' })` →
`DeviceGate` chuyển sang `PairScreen` ngay. Đường dẫn `/pair` được xử lý trong `DeviceGate`
trước khi tới router: đã ghép rồi mà mở `/pair` thì chuyển về `/`.

### 6.3 `PairScreen` (`pages/pair/PairScreen.tsx`)

`Card` giữa màn hình, tối đa 24rem, icon `Smartphone`:

- Tiêu đề **"Điện thoại này chưa được ghép"**.
- Hướng dẫn: "Trên máy quầy mở *Cài đặt → Thiết bị → Ghép điện thoại*, rồi quét mã QR bằng camera
  hoặc gõ mã 6 số vào đây."
- Ô 6 số bằng `input-otp` (`npx shadcn@latest add input-otp` trong `client/`), `inputMode="numeric"`,
  tự gửi khi đủ 6 số; nút **Ghép** cho trường hợp dán.
- Lỗi hiện dưới ô nhập (`text-destructive`), nguyên văn từ server.
- Thành công: `queryClient.setQueryData(['device'], { kind: 'paired', device })`, `invalidateQueries()`
  toàn bộ; đang ở `/pair` thì `navigate('/', { replace: true })`.

### 6.4 Trang `/pair?code=…`

Cùng component `PairScreen` với prop `autoCode`: có `code` hợp lệ (6 chữ số) thì gửi ngay, hiện
"Đang ghép…"; lỗi thì về dạng nhập tay kèm thông báo lỗi. Thêm `/pair` vào `navigateFallbackDenylist`
không cần vì là trang SPA bình thường.

### 6.5 Thẻ *Thiết bị* trong Cài đặt (`pages/settings/DevicesCard.tsx`)

Đặt sau `RemoteCard`. Mọi nút `type="button"` vì nằm trong form cài đặt chung.

**Máy quầy** (`device.kind === 'counter'`):

- `SectionTitle` "Thiết bị" + mô tả "Điện thoại trong nhà phải ghép một lần mới dùng được."
- Danh sách `useDevices()`: mỗi dòng tên (`font-medium`), dòng phụ "Ghép dd/mm/yyyy · Dùng lần cuối
  hôm nay | dd/mm | chưa dùng", `DropdownMenu` ⋯ với *Đổi tên* (`Dialog` một ô `TextField`) và
  *Gỡ* (`useConfirm`: "Gỡ *iPhone · Safari*? Điện thoại này phải ghép lại mới dùng được.").
- Rỗng: "Chưa có điện thoại nào được ghép."
- Nút **Ghép điện thoại** (`Plus`) → `useStartPairing()` rồi mở `PairDialog`:
  - `UrlQr url={info.url}` (tách từ `RemoteCard.tsx` sang `components/UrlQr.tsx`; `RemoteCard` chỉ
    bỏ hàm cục bộ và thêm import).
  - Mã 6 số `font-mono text-4xl tracking-[0.3em]`, chia "123 456".
  - Đếm ngược "Còn m:ss" từ `expiresAt`; về 0 → chữ "Mã đã hết hạn" + nút *Tạo mã mới*.
  - Khi mở: `useDevices` với `refetchInterval: 2000`; danh sách dài thêm → toast
    `Đã ghép ${tên}` và đóng hộp thoại.
  - Đóng tay: không hủy mã trên server (hết hạn tự nhiên sau 5 phút).

**Điện thoại đã ghép**: chỉ dòng "Thiết bị này: **iPhone · Safari**. Thêm hoặc gỡ thiết bị trên máy quầy."

### 6.6 Không đổi

`PosShell`, `LabelPrintPage`, `pos-window.ts`, service worker (API không được cache nên 401 không bị
giữ), `RemoteCard` ngoài việc import `UrlQr`.

## 7. Trường hợp đặc biệt và lỗi

| Tình huống | Hành vi |
|---|---|
| Máy quầy đổi IP | Cookie gắn theo host nên điện thoại phải ghép lại. README dặn đặt IP cố định cho máy quầy trong router (DHCP reservation); cũng giúp link đã lưu trên điện thoại không hỏng |
| Điện thoại xóa dữ liệu trình duyệt / iPhone chạy app ngoài màn hình chính (kho cookie riêng) | Ghép lại; dòng cũ còn trong danh sách, gỡ được nhờ "Dùng lần cuối" |
| Server khởi động lại khi đang mở hộp thoại ghép | Mã mất; điện thoại báo "Chưa có mã ghép đang mở"; hộp thoại hết đếm ngược có nút *Tạo mã mới* |
| Máy quầy nhiều card mạng (VPN, Hyper‑V) | QR có thể chứa sai IP (giống dòng LAN server đang in); gõ mã số vẫn được. Không xử lý thêm |
| Khôi phục bản sao | Danh sách thiết bị giữ nguyên |
| 127.0.0.1 nhưng `Host` lạ | Coi là máy khác (401/403) |
| Request từ LAN tới `/api/devices/*` kèm cookie hợp lệ | 403 "Chỉ thao tác được trên máy quầy" |
| Cookie có nhưng thiết bị đã bị gỡ | 401; client chuyển về `PairScreen` ngay ở request kế tiếp |
| Mất mạng / server tắt khi mở app | Render app, các trang tự báo lỗi như hiện tại |
| Gõ sai 5 lần | Mã hủy; máy quầy phải tạo mã mới |

## 8. Kiểm thử

### 8.1 `services/devices.test.ts` (Clock cố định)

- `startPairing` trả mã 6 chữ số, `expiresAt` = now + 5 phút; gọi lại thì mã cũ không dùng được.
- `pair` đúng mã → thiết bị tạo, token verify được, mã không dùng lại được.
- Hết hạn (clock +5 phút 1 giây) → lỗi "Chưa có mã ghép đang mở".
- Sai 4 lần còn báo "còn N lần", lần 5 hủy mã; sau đó đúng mã cũng lỗi.
- `verify` token sai/rỗng → null; đúng → thiết bị; `last_seen_on` ghi lần đầu, cùng ngày không đổi
  (so sánh số dòng ghi qua `sqlite.prepare('select changes()')` hoặc giá trị không đổi), sang ngày
  thì cập nhật.
- `rename`, `revoke`; id lạ → NotFoundError.
- `deviceNameFromUa`: vài UA mẫu iPhone Safari, Android Chrome, Windows Edge, rỗng → "Thiết bị".

### 8.2 `routes/devices-api.test.ts`

Dùng `createApp(db, { devices, isCounter })` với `isCounter` đọc header thử nghiệm
`x-test-counter: 1` để giả hai phía từ cùng supertest/fetch:

- Máy khác chưa ghép: `GET /api/products` → 401 `code: DEVICE_NOT_PAIRED`; `GET /images/x.jpg` → 401;
  `GET /api/device` → `{ kind: 'unpaired' }`; `GET /` → 200 (HTML vẫn mở, nếu test có `clientDist`
  giả).
- Máy quầy: `POST /api/devices/pairing` → 200 có `code`, `url`; `GET /api/device` → `counter`.
- Máy khác: `POST /api/device/pair` sai mã → 400; đúng mã → 201, header `Set-Cookie` có `tp_device`,
  `HttpOnly`, `SameSite=Lax`; gọi lại `GET /api/products` kèm cookie → 200; `GET /api/device` → `paired`.
- Máy khác kèm cookie: `GET /api/devices` → 403.
- Máy quầy `DELETE /api/devices/:id` → 204; máy khác với cookie cũ → 401.
- `isCounterRequest` thật: test đơn vị với object giả `{ socket: { remoteAddress }, headers: { host } }`:
  `127.0.0.1` + `localhost:3000` → true; `127.0.0.1` + `evil.com` → false; `192.168.1.5` + `localhost` → false.
- Test API hiện có không đổi: gọi từ 127.0.0.1 với `Host: 127.0.0.1:<port>` là máy quầy.

### 8.3 `services/backups.test.ts`

Thêm case: có 1 thiết bị → sao lưu → gỡ thiết bị, ghép thiết bị khác → khôi phục bản sao → danh sách
thiết bị vẫn là trạng thái sau khi gỡ/ghép, không phải lúc sao lưu.

### 8.4 Trình duyệt (skill `browser-verify`, server production với `DB_FILE` tạm, cổng riêng)

1. Mở `http://localhost:<port>` → vào thẳng app; Cài đặt có thẻ *Thiết bị* trống, nút *Ghép điện thoại*.
2. Cỡ điện thoại, mở `http://<IP LAN>:<port>` → `PairScreen`; gõ mã sai → "còn 4 lần"; gõ đúng →
   vào app; hộp thoại trên máy quầy tự đóng, toast "Đã ghép …".
3. Mở lại `http://<IP LAN>:<port>/pair?code=<mã mới>` ở hồ sơ trình duyệt khác → tự ghép, về `/`.
4. Máy quầy *Gỡ* → điện thoại thao tác tiếp thấy `PairScreen` ngay.
5. Đợi mã hết hạn (hoặc chỉnh đồng hồ test) → hộp thoại hiện *Tạo mã mới*.
6. `/pos` và `/labels/print` trên `localhost` vẫn mở, in tem vẫn chạy.

## 9. Phiên bản và tài liệu

- Version 0.16.0 ở `package.json` gốc và 4 workspace (`npm version` không dùng vì workspaces; sửa tay
  như các lần trước).
- README: mục *Ghép thiết bị* (cách ghép, dặn IP cố định, ghép lại khi nào) và *Kiểm thử thủ công –
  Ghép thiết bị 0.16.0* theo §8.4.
- CLAUDE.md: thêm 0.16.0 vào "Đã xong"; thêm bất biến: *Quyền truy cập LAN chỉ qua `deviceGate`
  (`middleware/device-gate.ts`); máy quầy = loopback + `Host` localhost; token chỉ ở cookie, DB giữ
  SHA‑256; `copyTables` không đụng `devices`; `remote/` không liên quan.* Migration DB dev lên `0007`.
- Thứ tự với 0.15.0 (Cửa sổ quầy, đang dở trong cây làm việc): kiểm trên trình duyệt và commit
  0.15.0 trước, rồi mới code 0.16.0 để diff hai đợt không lẫn nhau. Spec này commit riêng, chỉ
  `git add` đúng file spec.
