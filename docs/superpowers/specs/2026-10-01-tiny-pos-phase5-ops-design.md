# Tiny POS – Giai đoạn 5: Sao lưu và cài đặt trên Windows (0.9.0)

Ngày: 2026-10-01

Nền tảng giữ nguyên như `2026-09-29-tiny-pos-phase1-design.md`; trang Cài đặt (bảng `settings`
key/value, `getSettings`/`saveSettings`) như spec giai đoạn 2; `downloadFile`, `express.raw` cho body
nhị phân như `2026-09-30-tiny-pos-excel-design.md`. Tài liệu này chỉ mô tả phần thêm mới.

## 1. Mục tiêu

Chủ tiệm không mất sổ sách và không cần người biết máy tính để bật phần mềm mỗi ngày:

1. **Sao lưu tự động**: mở máy là có bản sao, máy chạy liên tục thì mỗi ngày thêm một bản; có thể
   chép thêm sang USB hoặc thư mục đồng bộ cloud (OneDrive, Google Drive) đã cài sẵn trên máy.
2. **Tự khôi phục** từ một bản sao trong danh sách hoặc từ file mang từ máy khác sang, bằng vài cú bấm
   trong Cài đặt, không phải dừng server hay chép file tay.
3. **Cài một lần**: chạy `install.cmd`, từ đó bật máy là phần mềm tự chạy, trên Desktop có biểu tượng
   mở màn hình bán hàng, điện thoại trong nhà vào được.

Tiêu chí thành công:

- Lần đầu chạy là có bản sao trong `data/backups/`; sau đó mỗi ngày tối đa một bản tự động, chỉ khi
  DB có thay đổi so với bản gần nhất (bán hàng rồi sang ngày mới → trong 15 phút có bản mới; nghỉ bán
  nhiều ngày → không sinh thêm bản).
- Khôi phục từ bản sao: dữ liệu hiện tại được tự sao lưu trước; khôi phục xong mọi trang hiện đúng dữ
  liệu của bản sao mà không tải lại server; bản sao hỏng thì DB hiện tại không đổi.
- Bản sao từ phiên bản phần mềm cũ hơn khôi phục được; từ phiên bản mới hơn bị từ chối rõ lý do.
- `install.cmd` chạy trên máy Windows 11 có sẵn Node: đăng xuất/đăng nhập lại là server chạy, Desktop
  có "Tiny POS", điện thoại cùng mạng mở được `http://<IP>:3000`.
- Không thêm thư viện ở client; không đổi schema, không có migration.

## 2. Phạm vi

Trong phạm vi: service sao lưu/khôi phục + lịch tự động ở server; API `/api/backups`; thẻ *Sao lưu*
trong Cài đặt; thư mục `scripts/` (cài, gỡ, chạy, dừng, cập nhật, mở app); bỏ hướng dẫn pm2; README;
version 0.9.0.

Ngoài phạm vi: đẩy lên cloud qua API (Google Drive, Dropbox…), mã hóa bản sao, chọn giờ sao lưu, sao
lưu sau mỗi chứng từ, đóng gói `.exe`/cài Node tự động, tự cập nhật phiên bản, chạy như dịch vụ
Windows, trang Tổng quan, đăng nhập.

## 3. Quyết định đã chốt

| Vấn đề | Chọn | Lý do |
|---|---|---|
| Nơi lưu | `data/backups/` trong máy + một "thư mục chép thêm" tùy chọn | Người dùng chọn; USB/thư mục cloud đã có sẵn trên máy, không cần tài khoản trong app |
| Lịch | Khi server khởi động + mỗi ngày một lần nếu DB có thay đổi | Người dùng chọn; không cần Task Scheduler |
| Phát hiện thay đổi | So mtime của `grocery.db` và `grocery.db-wal` với thời điểm bản `auto` gần nhất | Không cần middleware đếm request ghi; thừa một bản sau checkpoint cũng vô hại |
| Cách tạo bản sao | API backup trực tuyến của better-sqlite3 (`db.$client.backup`) ra file `.part`, kiểm `quick_check`, rồi đổi tên | An toàn với WAL khi đang bán hàng; file dở dang không bao giờ lọt vào danh sách |
| Cách khôi phục | `ATTACH` bản sao, trong một transaction xóa sạch từng bảng rồi `INSERT … SELECT` các cột chung | Người dùng chọn; không cần khởi động lại tiến trình; test được bằng DB `:memory:` |
| Phiên bản bản sao | Số migration trong bản sao ≤ số migration hiện tại thì nhận; lớn hơn thì từ chối | Cột mới của schema hiện tại nhận giá trị mặc định (migration đã buộc có default); dữ liệu "từ tương lai" không hiểu được |
| Trước khi khôi phục | Luôn tạo bản `before-restore` | Bấm nhầm vẫn quay lại được |
| Giữ bao nhiêu | 30 bản `auto` gần nhất (cả hai nơi); `manual` và `before-restore` không tự xóa | Tự động không phình vô hạn; bản người dùng chủ động tạo thì người dùng tự xóa |
| Thư mục chép thêm | Lưu khóa `backupExtraDir` trong bảng `settings`, endpoint riêng, không nằm trong form Cài đặt | Thẻ Sao lưu có hành động riêng (sao lưu, khôi phục), không đi chung nút *Lưu* của form |
| Thư mục chép thêm lỗi | Chỉ cảnh báo trên thẻ, bản ở `data/backups/` vẫn tính là thành công | USB rút ra không được làm hỏng sao lưu chính |
| File tải lên để khôi phục | Ghi vào `data/tmp/`, kiểm, khôi phục, xóa | Không để file lạ lẫn vào danh sách bản sao |
| Chạy cùng Windows | Shortcut trong thư mục Startup của người dùng | Người dùng chọn; không cần admin, dễ gỡ |
| Cửa sổ server | Ẩn, log ra `data/server.log` (ghi đè mỗi lần chạy) | Chủ tiệm không cần thấy console; log để người sửa máy đọc |
| Biểu tượng Desktop | `open.vbs`: bảo đảm server đang chạy rồi mở Chrome/Edge chế độ `--app` + `--kiosk-printing` | Một biểu tượng làm cả hai việc; không gặp lỗi "không kết nối được" lúc server chưa lên |
| Tường lửa | Thêm rule cổng 3000 qua một lần hỏi UAC trong `install` | Server chạy ẩn nên Windows không hiện hộp hỏi cho phép; không có rule thì điện thoại không vào được |
| pm2 | Bỏ `ecosystem.config.cjs` và mục pm2 trong README | pm2 không có trong dependency, `pm2 startup` không chạy trên Windows; script thay thế |
| Routes khi test | `createApp(db, { backups })`: không truyền thì không mount `/api/backups` | Test route khác không phải tạo thư mục; test sao lưu tự tạo thư mục tạm |

## 4. Màn hình

Trang *Cài đặt* thêm thẻ **Sao lưu** (`pages/settings/BackupCard.tsx`) đặt sau các thẻ cài đặt
cửa hàng và trước thẻ phiên bản. Thẻ nằm **trong** `<form id="settings-form">` (để không thụt lề lại cả trang),
nên mọi nút trong thẻ đặt `type="button"` (nút shadcn mặc định là `submit`) và Enter trong ô thư mục chép thêm
chỉ lưu thư mục, không gửi form.

Nội dung thẻ, từ trên xuống:

1. `SectionTitle` "Sao lưu dữ liệu" + mô tả ngắn: "Tự sao lưu khi mở phần mềm và mỗi ngày một lần
   vào thư mục `<dir>`. Giữ 30 bản tự động gần nhất."
2. Dòng trạng thái: "Bản tự động gần nhất: 09:31 01/10/2026" (hoặc "chưa có"). Nếu `lastError` →
   dòng đỏ (`text-destructive`) "Sao lưu tự động lỗi: …". Nếu `extraError` → dòng vàng (`warning`)
   "Không chép được sang `<extraDir>`: … (USB chưa cắm?)".
3. Nút **Sao lưu ngay** (icon `DatabaseBackup`), đang chạy thì khóa, nhãn "Đang sao lưu…"; xong toast
   xanh "Đã sao lưu" và danh sách cập nhật.
4. Ô **Thư mục chép thêm** (`TextField`, placeholder `D:\sao-luu` hoặc
   `C:\Users\<tên>\OneDrive\TinyPOS`) + nút **Lưu thư mục** cạnh ô; hint: "Để trống nếu không
   chép thêm. Nên là USB hoặc thư mục OneDrive/Google Drive để máy hỏng vẫn còn dữ liệu." Lưu lỗi
   (không tồn tại / không ghi được) → toast đỏ nguyên văn lỗi server.
5. Danh sách bản sao (`Table` của shadcn trong thẻ): cột **Thời điểm** (`HH:mm dd/mm/yyyy`),
   **Loại** (`Badge`: *Tự động* / *Thủ công* / *Trước khôi phục*), **Dung lượng** (`x,x MB`), menu
   `MoreHorizontal` với *Tải về* (`Download`), *Khôi phục* (`History`), *Xóa* (`Trash2`, chữ đỏ).
   Mới nhất ở trên. Mặc định hiện 8 dòng, nút "Hiện tất cả (N)" để mở hết. Chưa có bản nào →
   `EmptyState` nhỏ "Chưa có bản sao lưu". Điện thoại: ẩn cột Dung lượng.
6. Nút **Khôi phục từ file…** (`Upload`, `variant="outline"`): `<input type="file" accept=".db">`
   ẩn; chọn file xong hỏi xác nhận như khôi phục.

Xác nhận khôi phục (`useConfirm`, `destructive`): tiêu đề "Khôi phục dữ liệu từ bản lúc 09:31
01/10/2026?" (file tải lên: "…từ file `<tên>`?"), mô tả "Toàn bộ dữ liệu hiện tại (hóa đơn, tồn kho,
công nợ, cài đặt…) sẽ bị thay bằng dữ liệu trong bản sao. Bản hiện tại được tự sao lưu trước khi
thay.", nút "Khôi phục". Đang khôi phục: khóa cả thẻ (`fieldset disabled` hoặc `aria-busy`). Xong:
toast xanh "Đã khôi phục. Bản trước khi khôi phục được giữ trong danh sách.", vô hiệu **toàn bộ**
cache TanStack Query (`queryClient.invalidateQueries()`) để mọi trang tải lại. Lỗi → toast đỏ
nguyên văn; dữ liệu không đổi.

Xác nhận xóa: "Xóa bản sao lúc …?" nút "Xóa", destructive.

## 5. Server

### 5.1 `services/backups.ts` – `createBackupService(db, opts)`

```ts
interface BackupOpts { dir: string; tmpDir: string; keepAuto?: number /* 30 */; clock?: Clock }
interface BackupService {
  status(): BackupStatus;                       // đọc thư mục mỗi lần gọi, không cache danh sách
  create(kind: BackupKind): Promise<BackupItem>;
  remove(name: string): void;
  filePath(name: string): string;               // kiểm tên hợp lệ + tồn tại, trả đường dẫn để sendFile
  restore(name: string): Promise<RestoreResult>;
  restoreUpload(buf: Buffer): Promise<RestoreResult>;
  getExtraDir(): string;  setExtraDir(dir: string): void;
  lastAutoAt(): string | null;                  // từ trạng thái trong bộ nhớ hoặc file auto mới nhất
  noteAutoError(message: string | null): void;  // scheduler ghi lỗi để thẻ hiển thị
}
```

- Tên file: `grocery-YYYYMMDD-HHMMSS-<kind>.db`, `kind ∈ auto | manual | before-restore`, giờ địa
  phương theo `Clock`; trùng tên trong cùng giây → thêm hậu tố `-2`, `-3`. Regex hợp lệ
  (`BACKUP_NAME_RE`): `^grocery-\d{8}-\d{6}-(auto|manual|before-restore)(-\d+)?\.db$`; mọi tên nhận
  từ API phải khớp regex, nhờ đó không thể chứa dấu phân cách đường dẫn (`../`).
- `create(kind)`: `await db.$client.backup(path.join(dir, name + '.part'))` → mở file `.part` chế độ
  `readonly`, `pragma quick_check` phải là `ok`, đóng → `rename` thành tên thật → nếu có `extraDir`:
  `copyFile` sang đó cùng tên, rồi dọn `auto` ở đó; lỗi ở bước chép thêm ghi vào `extraError` (chuỗi
  tiếng Việt, kèm `code` của Node nếu có), không ném. Dọn `auto` ở `dir`: giữ `keepAuto` file mới nhất
  theo tên (tên chứa thời điểm nên sắp theo tên là theo thời gian). `quick_check` lỗi → xóa `.part`,
  ném `Error('Bản sao vừa tạo bị hỏng, chưa lưu')`.
- Mọi thao tác `create`/`restore*` nối đuôi qua một mutex (promise chain) để không chạy chồng; `remove`
  và `status` không cần. Bên trong, `restoreFromFile` gọi bản không khóa của `create` (ví dụ
  `createUnlocked`) để không tự chờ chính mình.
- `status()`: liệt kê `dir`, bỏ file không khớp regex, `createdAt` = mtime ISO, `size` = byte, mới
  nhất trước; kèm `dir`, `extraDir`, `extraError`, `lastAutoAt`, `lastError`.
- `extraDir` đọc/ghi bảng `settings` khóa `backupExtraDir` trực tiếp (không qua
  `settingsInputSchema`, schema đó bỏ qua khóa lạ nên trang Cài đặt không thấy). `setExtraDir('')`
  xóa khóa. `setExtraDir(dir)` kiểm: `statSync` là thư mục (không → `BadRequestError('Thư mục không
  tồn tại')`), ghi thử một file `.tiny-pos-write-test` rồi xóa (lỗi → `BadRequestError('Không ghi
  được vào thư mục')`). Lưu xong đặt `extraError = null`.
- `restore(name)` = `restoreFromFile(filePath(name))`; `restoreUpload(buf)`: `buf.length === 0` →
  400 "Chưa có file"; ghi `tmpDir/upload-<timestamp>.db`, `restoreFromFile`, `finally` xóa file.
- `restoreFromFile(file)`:
  1. **Kiểm**: mở `new Database(file, { readonly: true, fileMustExist: true })`; mở lỗi hoặc
     `quick_check ≠ ok` → 400 "File không phải dữ liệu Tiny POS hoặc đã hỏng"; thiếu bảng
     `__drizzle_migrations` hoặc `products` → 400 "File không phải dữ liệu Tiny POS"; `count(*)` của
     `__drizzle_migrations` trong file > trong DB hiện tại → 400 "Bản sao từ phiên bản mới hơn, hãy cập
     nhật phần mềm rồi khôi phục lại". Đóng.
  2. `await create('before-restore')`.
  3. `sqlite = db.$client`; `sqlite.pragma('foreign_keys = OFF')`; `ATTACH DATABASE ? AS src`.
     Trong `sqlite.transaction(() => …)()`: lấy `tables` = tên bảng của `main` không bắt đầu bằng
     `sqlite_` và ≠ `__drizzle_migrations`; với từng bảng: `DELETE FROM main."t"`; nếu `src` có bảng
     đó: `cols` = giao của `pragma table_info` hai bên → `INSERT INTO main."t"(cols) SELECT cols FROM
     src."t"`. Rồi `DELETE FROM main.sqlite_sequence` và `INSERT INTO main.sqlite_sequence SELECT name,
     seq FROM src.sqlite_sequence WHERE name IN (tables)` (nếu `src` có `sqlite_sequence`). Cuối
     transaction `pragma foreign_key_check` phải rỗng, không rỗng → ném → rollback.
     `finally`: `DETACH DATABASE src`, `pragma foreign_keys = ON`.
  4. Trả `{ restoredFrom: name | 'upload', beforeRestore: BackupItem }`.
  Bảng có ở `main` mà không có ở `src` (schema mới hơn bản sao) bị xóa trống: đúng với trạng thái
  bản sao. Khóa `backupExtraDir` trong bản sao cũng được khôi phục; thư mục đó không tồn tại trên máy
  mới thì lần sao lưu sau sẽ hiện cảnh báo.
- `remove(name)`: `filePath(name)` rồi `unlink`; cũng xóa file cùng tên ở `extraDir` nếu có (lỗi bỏ
  qua).

### 5.2 `services/backup-scheduler.ts` – `startBackupScheduler(opts)`

```ts
interface SchedulerOpts { service: BackupService; dbFile: string; intervalMs?: number /* 15 phút */; clock?: Clock; log?: (s: string) => void }
// trả { tick(now?: Date): Promise<void>; stop(): void }
```

- Khởi động: gọi `tick()` ngay (chưa từng có bản `auto` thì đây là bản đầu tiên), rồi
  `setInterval(tick, intervalMs)`, timer `unref()` để không giữ tiến trình.
- `tick(now)`: `today = localDate(now, tz)`; `last = service.lastAutoAt()`. Bỏ qua nếu `last` cùng
  ngày địa phương với `today`. Bỏ qua nếu `last` tồn tại và mtime của `dbFile` lẫn `dbFile + '-wal'`
  (file không có thì bỏ) đều ≤ `last`. Còn lại: `await service.create('auto')`; thành công →
  `noteAutoError(null)`; lỗi → `noteAutoError(message)` + `log`.
- Chỉ `index.ts` gọi; `createApp` không gọi nên test không có timer. Test gọi `tick(now)` tay.

### 5.3 Routes `routes/backups.ts`, mount `/api/backups` khi `createApp` nhận `backups`

| Method | Path | Việc |
|---|---|---|
| GET | `/` | `BackupStatus` |
| POST | `/` | `create('manual')` → `BackupItem` (201) |
| PUT | `/extra-dir` | body `{ extraDir }` (`backupExtraDirSchema`) → `setExtraDir` → `BackupStatus` |
| GET | `/:name/download` | `res.download(filePath(name), name)` |
| POST | `/:name/restore` | `restore(name)` → `RestoreResult` |
| POST | `/restore-upload` | `express.raw({ type: () => true, limit: '200mb' })` → `restoreUpload(buf)` |
| DELETE | `/:name` | `remove(name)` → 204 |

Khai báo `/extra-dir` và `/restore-upload` trước các route `/:name…`.

`createApp(db, { clientDist, backups })`; `apiRouter(db, { backups })`. `index.ts`: tạo service với
`dir = data/backups`, `tmpDir = data/tmp`, truyền vào `createApp`, sau `listen` gọi
`startBackupScheduler({ service, dbFile })`, log một dòng "Sao lưu: <dir>".

### 5.4 Shared

- `shared/src/types.ts`: `BackupKind`, `BackupItem { name; kind; createdAt; size }`, `BackupStatus {
  dir; extraDir; extraError: string | null; lastAutoAt: string | null; lastError: string | null; items:
  BackupItem[] }`, `RestoreResult { restoredFrom: string; beforeRestore: BackupItem }`.
- `shared/src/schemas/backups.ts`: `backupExtraDirSchema = z.object({ extraDir: z.string().trim().max(260) })`;
  `BACKUP_NAME_RE` dùng chung server (kiểm tên) và client (không cần, nhưng để một chỗ).

## 6. Client

- `api/backups.ts`: `useBackups` (`['backups']`, `refetchInterval` 60 s khi thẻ đang hiện để thấy bản
  tự động mới), `useCreateBackup`, `useSaveExtraDir`, `useDeleteBackup`, `useRestoreBackup` (nhận
  `name`), `useRestoreUpload` (nhận `File`, gửi `body: file`). Hai mutation khôi phục `onSuccess`:
  `qc.invalidateQueries()` không tham số. Các mutation còn lại `invalidateQueries({ queryKey:
  ['backups'] })`.
- Tải về: `downloadFile('/backups/<name>/download')` (đã có, lấy tên từ `Content-Disposition`).
- `pages/settings/BackupCard.tsx` như mục 4; `SettingsPage.tsx` chỉ thêm import và `<BackupCard />` trước thẻ
  "Thông tin phần mềm", không đổi dòng nào khác.
- Định dạng dung lượng: hàm nhỏ trong `BackupCard` (`< 1 MB → "x KB"`, còn lại `"x,x MB"`), không
  thêm vào shared.

## 7. Scripts (`scripts/`, mọi file có comment tiếng Việt ở đầu)

| File | Việc |
|---|---|
| `install.cmd` | Nhấp đúp được: gọi `powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1`, `pause` cuối |
| `install.ps1` | (1) `node --version` ≥ 20, không có → in link nodejs.org, dừng. (2) `npm install` (nếu có `.certs/corp-root.pem` thì đặt `NODE_EXTRA_CA_CERTS`), `npm run build`. (3) Shortcut `Tiny POS.lnk` trong `shell:startup` và trên Desktop, cả hai trỏ `wscript.exe "<repo>\scripts\open.vbs"`, icon lấy từ trình duyệt tìm được. (4) Rule tường lửa "Tiny POS" TCP 3000 inbound: chưa có thì `Start-Process netsh -Verb RunAs -Wait`; người dùng từ chối UAC → in "Điện thoại sẽ không vào được; chạy lại install hoặc tự mở cổng 3000". (5) Chạy `open.vbs` luôn. (6) In IP LAN để gõ trên điện thoại. Mỗi bước in `[1/6] …` tiếng Việt |
| `uninstall.cmd` + `uninstall.ps1` | `stop.cmd`, xóa hai shortcut, xóa rule tường lửa (UAC), in "Dữ liệu vẫn ở `data/`, muốn xóa thì xóa thư mục đó" |
| `start.cmd` | `cd /d "%~dp0.."`; cổng 3000 đang `LISTENING` (netstat) → in "Đang chạy rồi", thoát 0; không thì `node server\dist\index.js > data\server.log 2>&1` (tạo `data/` trước nếu chưa có) |
| `start-hidden.vbs` | `WScript.Shell.Run "cmd /c start.cmd", 0, False` |
| `open.vbs` | Thử `GET http://localhost:3000/api/settings` bằng `MSXML2.XMLHTTP`; lỗi → chạy `start-hidden.vbs`; lặp thử tối đa 30 lần cách 1 s; vẫn lỗi → `MsgBox` "Không bật được Tiny POS, xem data\server.log". Được → mở trình duyệt: Chrome (`%ProgramFiles%`, `%ProgramFiles(x86)%`, `%LocalAppData%`) rồi Edge, với `--app=http://localhost:3000 --kiosk-printing`; không có cả hai → mở `http://localhost:3000` bằng trình duyệt mặc định |
| `stop.cmd` | Tìm PID đang `LISTENING` cổng 3000 qua netstat, `taskkill /PID … /F`; không có → in "Không chạy" |
| `update.cmd` | `stop.cmd` → `git pull` → `npm install` → `npm run build` → `open.vbs`; `pause` cuối. Dành cho người cập nhật máy tiệm |

Xóa `ecosystem.config.cjs`. `.gitignore` không đổi (`data/` đã bị bỏ qua, nên `data/backups`,
`data/tmp`, `data/server.log` cũng vậy).

## 8. Lỗi

| Tình huống | Server | Người dùng thấy |
|---|---|---|
| Tên bản sao sai regex | 400 "Tên bản sao không hợp lệ" | toast đỏ |
| Bản sao không còn trên đĩa | 404 "Không tìm thấy bản sao" | toast đỏ, danh sách tải lại |
| `quick_check` của bản vừa tạo lỗi | 500 "Bản sao vừa tạo bị hỏng, chưa lưu" | toast đỏ |
| Thư mục chép thêm không tồn tại / không ghi được | 400 như mục 5.1 | toast đỏ ở nút Lưu thư mục |
| Chép thêm lỗi lúc sao lưu | 201 bình thường, `extraError` có nội dung | dòng vàng trên thẻ |
| File khôi phục không phải SQLite / hỏng / thiếu bảng | 400 như mục 5.1 bước 1 | toast đỏ, dữ liệu không đổi |
| Bản sao từ phiên bản mới hơn | 400 "Bản sao từ phiên bản mới hơn…" | toast đỏ |
| `foreign_key_check` không rỗng | rollback, 400 "Bản sao có dữ liệu không nhất quán, không khôi phục" | toast đỏ, dữ liệu không đổi, bản `before-restore` vẫn còn |
| Sao lưu tự động lỗi | log console + `lastError` | dòng đỏ trên thẻ |
| Upload rỗng / quá 200 MB | 400 "Chưa có file" / 413 của express | toast đỏ |

## 9. Kiểm thử

Vitest `server/src/services/backups.test.ts` (DB `:memory:` qua `createTestDb()`, thư mục tạm
`fs.mkdtempSync` xóa ở `afterEach`, `Clock` cố định):

- `create('manual')` tạo đúng tên theo giờ địa phương, `status().items[0]` khớp (kind, size > 0),
  không còn file `.part`; file mở được bằng better-sqlite3 và có đủ số dòng `products` như DB nguồn.
- Tạo 32 bản `auto` → còn 30 file auto mới nhất; bản `manual`/`before-restore` không bị xóa.
- `setExtraDir` với thư mục có thật → sao lưu xong file có ở cả hai nơi; thư mục không tồn tại →
  `BadRequestError`; đặt rồi xóa thư mục (giả lập rút USB) → sao lưu vẫn thành công, `extraError`
  có nội dung; đặt lại thư mục hợp lệ → `extraError` null.
- `restore`: DB A có 3 sản phẩm + 1 đơn → sao lưu → thêm 2 sản phẩm, hủy đơn → `restore(name)` → về
  đúng 3 sản phẩm, đơn `done`, `sqlite_sequence` của `products` bằng trước khi sao lưu (thêm sản phẩm
  mới nhận id tiếp theo đúng); có bản `before-restore` chứa 5 sản phẩm.
- Bản sao thiếu bảng (giả lập schema cũ: tạo file SQLite tay với `__drizzle_migrations` 1 dòng và
  `products` thiếu cột `min_stock`) → khôi phục được, cột thiếu nhận mặc định, bảng không có trong bản
  sao bị trống.
- Bản sao có nhiều migration hơn → 400 đúng thông điệp; file text rác → 400; file SQLite không có
  `products` → 400; trong mọi trường hợp lỗi, DB hiện tại không đổi và **không** tạo
  `before-restore` (kiểm xảy ra trước).
- Bản sao vi phạm FK (sửa tay `order_items.product_id` trỏ id không có) → rollback, DB không đổi,
  `before-restore` đã tạo.
- `restoreUpload(buffer)` tương đương `restore`, xóa file tạm sau khi xong (kể cả khi lỗi).
- Tên có `..` hoặc `/` → `BadRequestError`.

`server/src/services/backup-scheduler.test.ts`: `tick` lần đầu tạo bản `auto`; `tick` cùng ngày
không tạo thêm; sang ngày (Clock) nhưng mtime DB cũ hơn bản gần nhất → không tạo; sang ngày và chạm
mtime (`utimesSync`) → tạo; `create` ném → `lastError` có nội dung, `tick` sau thành công thì
`lastError` null.

`server/src/routes/backups-api.test.ts`: `createApp(db, { backups })` với thư mục tạm: GET hình đúng;
POST tạo; PUT extra-dir 400 khi thư mục không có; download có `Content-Disposition` đúng tên; restore
trả `beforeRestore`; DELETE 204; tên sai → 400; `createApp(db)` không có `backups` → `/api/backups` 404.

Trình duyệt (skill `browser-verify`, chặn request ghi, GET danh sách bản sao có thể stub): thẻ hiện
đúng trạng thái, 8 dòng + "Hiện tất cả"; menu dòng; hộp xác nhận khôi phục đúng chữ; cỡ điện thoại
không cuộn ngang; bấm *Sao lưu ngay* thấy request POST `/api/backups` bị chặn (không ghi DB dev).

Scripts: chạy tay trên máy dev (`install.cmd` rồi `uninstall.cmd`), ghi kết quả vào README mục kiểm
thử thủ công; không có test tự động.

## 10. Phiên bản và tài liệu

- `package.json` gốc: `0.9.0`.
- `README.md`: mục "Chạy thật" viết lại theo `scripts/` (bỏ pm2), thêm mục "Sao lưu và khôi phục"
  (ở đâu, bao lâu, cách chép sang USB/cloud, cách khôi phục, cách mang sang máy mới), thêm "Kiểm thử
  thủ công – Sao lưu & cài đặt 0.9.0".
- `CLAUDE.md`: thêm 0.9.0 vào "Đã xong"; bất biến mới: *Sao lưu/khôi phục chỉ qua
  `services/backups.ts`: không chép đè `data/grocery.db` khi server đang chạy; khôi phục luôn tạo bản
  `before-restore` trước và chạy trong một transaction.* Lệnh mới: `scripts/install.cmd`,
  `scripts/update.cmd`.
