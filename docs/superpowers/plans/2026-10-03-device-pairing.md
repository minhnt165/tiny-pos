# Ghép thiết bị (0.16.0) – Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Máy trong LAN chưa ghép không gọi được API hay ảnh sản phẩm; điện thoại ghép một lần bằng QR/mã 6 số do máy quầy tạo; máy quầy (`localhost`) luôn dùng được và quản lý danh sách thiết bị trong Cài đặt.

**Architecture:** Middleware `deviceGate` đặt trước `/api` và `/images` trong `createApp`. Request được phân loại: máy quầy (địa chỉ loopback + `Host` localhost), thiết bị đã ghép (cookie `tp_device` khớp SHA‑256 trong bảng `devices`), hoặc chưa ghép (401, trừ `GET /api/device` và `POST /api/device/pair`). `services/devices.ts` giữ mã ghép trong bộ nhớ và ghi bảng `devices` (migration `0007`). `copyTables` khi khôi phục bỏ qua bảng này. Ở client, `DeviceGate` bọc `<App />` và hiện `PairScreen` khi chưa ghép; 401 ở bất kỳ query/mutation nào chuyển ngay sang màn ghép; thẻ *Thiết bị* trong Cài đặt có hộp thoại ghép với QR, mã và đếm ngược.

**Tech Stack:** TypeScript ESM, Express 5, drizzle-orm + better-sqlite3, vitest, zod 4, `node:crypto`; React 19 + TanStack Query 5 + react-router 7 + shadcn/ui (`input-otp` mới) + lucide-react, `qrcode` (đã có).

**Spec:** `docs/superpowers/specs/2026-10-03-tiny-pos-device-pairing-design.md`

## Global Constraints

- Text UI, thông báo lỗi API, comment code, commit message: **tiếng Việt**.
- **Không format lại file có sẵn**: diff chỉ chứa dòng cần đổi; không chạy prettier/eslint lên file cũ; theo phong cách xung quanh (2 space, nháy đơn, có `;`, dòng ≤ ~130 ký tự). Thêm tên vào dòng import có sẵn được, không sắp xếp lại import. File shadcn sinh ra (`ui/input-otp.tsx`) giữ nguyên như CLI sinh.
- **Git**: làm trên `master`. Task 0 là một commit riêng (đợt 0.15.0). Task 1–7 **không commit từng task**; cả đợt 0.16.0 là **một commit** ở Task 7: `feat: ghép thiết bị 0.16.0 – máy quầy luôn dùng được, điện thoại trong LAN ghép một lần bằng QR/mã 6 số, thẻ Thiết bị trong Cài đặt`.
- **Không có công tắc bật/tắt**; không tài khoản, mật khẩu, phân quyền hay PIN.
- Máy quầy = `req.socket.remoteAddress` ∈ {`127.0.0.1`, `::1`, `::ffff:127.0.0.1`} **và** `Host` (bỏ cổng, chữ thường) ∈ {`localhost`, `127.0.0.1`, `[::1]`}.
- Mã ghép: 6 chữ số, `PAIRING_TTL_MS` = 5 phút, `PAIRING_MAX_FAILURES` = 5; giữ trong bộ nhớ; chỉ một mã; dùng một lần.
- Cookie `tp_device` (`DEVICE_COOKIE`): `HttpOnly`, `SameSite=Lax`, `Path=/`, `maxAge` 10 năm, **không** `Secure`. Token 32 byte base64url, DB chỉ giữ SHA‑256 hex. Không log token.
- `last_seen_on` (ngày địa phương) chỉ ghi khi khác ngày hôm nay.
- `copyTables` **không** đụng bảng `devices` (cả dữ liệu lẫn `sqlite_sequence`).
- Thông báo lỗi nguyên văn: `'Thiết bị chưa được ghép'` (401, kèm `code: 'DEVICE_NOT_PAIRED'`), `'Chỉ thao tác được trên máy quầy'` (403), `'Chưa có mã ghép đang mở, hãy tạo mã trên máy quầy'`, `` `Mã không đúng, còn ${n} lần thử` ``, `'Mã đã hết hiệu lực, tạo mã mới trên máy quầy'`, `'Không tìm thấy thiết bị'` (404).
- Không đụng `remote/`, `remote-sync.ts`, `label-window.ts`, `PosShell`, service worker.
- UI dùng component có sẵn (`Card`, `Button`, `Dialog`, `DropdownMenu`, `Skeleton`, `TextField`, `SectionTitle`, `useConfirm`), icon lucide, màu từ token (`text-destructive`, `text-warning`, `text-muted-foreground`, `bg-primary/10`). Không viết mã màu.
- Mạng công ty chặn TLS: `npx shadcn`/`npm install` cần `NODE_EXTRA_CA_CERTS=<repo>/.certs/corp-root.pem`; **không bao giờ** tắt kiểm tra TLS.
- Không dùng/kill cổng 5173/5174. Kiểm trên trình duyệt **không ghi** vào `data/grocery.db`: chạy server build với `DB_FILE` tạm trong scratchpad, cổng riêng (3099).
- Chạy test/typecheck từ **gốc repo** (`npm test`, `npm run typecheck`) để `shared` được build trước. Một file server: `npm run build -w shared` rồi `cd server && npx vitest run <file>`.

## Review Focus

1. **Mã dán hoặc gõ có khoảng trắng** (`"123 456"`, `" 123456 "`, mã đọc qua điện thoại) → vẫn ghép được: schema bỏ khoảng trắng, ô OTP có `pasteTransformer`. Test schema ở Task 1.
2. **Cookie hỏng hoặc lạ** (`tp_device=%E0%A4%A`, `tp_device=`, nhiều cookie khác, cookie tên gần giống `xtp_device`) → 401 sạch, không bao giờ 500. Test `readCookie` và API ở Task 3.
3. **Header `Host` viết hoa, IPv6, thiếu, hoặc giả** (`LOCALHOST:3000`, `[::1]:3000`, không có `Host`, `localhost.evil.com`) → phân loại đúng máy quầy hay máy khác. Bảng test `isCounterRequest` ở Task 3.
4. **Khôi phục bản sao cũ rồi ghép máy mới** → thiết bị đã gỡ không sống lại; id mới không trùng id của thiết bị đã gỡ (`sqlite_sequence` của `devices` giữ nguyên). Test ở Task 4.
5. **Đổi tên thành toàn khoảng trắng hoặc dài hơn 50 ký tự** → 400 có nhãn "Tên", tên cũ giữ nguyên. Test schema ở Task 1 và API ở Task 3.

---

## Cấu trúc file

| File | Việc |
|---|---|
| `shared/src/schemas/device.ts` (mới) + `device.test.ts` (mới) | Hằng `PAIRING_TTL_MS`, `PAIRING_MAX_FAILURES`, `DEVICE_COOKIE`; `pairInputSchema`, `deviceNameSchema` |
| `shared/src/types.ts`, `schemas/common.ts`, `index.ts` (sửa) | `Device`, `DeviceStatus`, `PairingInfo`; nhãn `code`; export |
| `server/src/db/schema.ts` (sửa) + `server/drizzle/0007_*.sql` (sinh) | Bảng `devices` |
| `server/src/services/devices.ts` (mới) + `devices.test.ts` (mới) | `createDevicesService`, `deviceNameFromUa` |
| `server/src/middleware/device-gate.ts` (mới) | `isCounterRequest`, `readCookie`, `deviceGate`, `counterOnly` |
| `server/src/routes/devices.ts` (mới) + `devices-api.test.ts` (mới) | `deviceRouter` (`/api/device`), `devicesRouter` (`/api/devices`) |
| `server/src/routes/index.ts`, `app.ts`, `index.ts` (sửa) | Nối gate và router; `lanAddress()` |
| `server/src/services/backups.ts` (sửa) + `backups.test.ts` (sửa) | `copyTables` bỏ qua `devices` |
| `client/src/components/ui/input-otp.tsx` (sinh bằng shadcn) | Ô mã 6 số |
| `client/src/api/device.ts` (mới) | Hook `useDevice`, `useDevices`, `usePair`, `useStartPairing`, `useRenameDevice`, `useRevokeDevice` |
| `client/src/components/DeviceGate.tsx` (mới), `pages/pair/PairScreen.tsx` (mới) | Chặn ở gốc app, màn ghép, `/pair?code=` |
| `client/src/main.tsx` (sửa) | Bắt 401 chung, bọc `<DeviceGate>` |
| `client/src/components/UrlQr.tsx` (mới), `pages/settings/RemoteCard.tsx` (sửa) | Tách QR dùng chung |
| `client/src/pages/settings/DevicesCard.tsx`, `PairDialog.tsx`, `RenameDeviceDialog.tsx` (mới), `SettingsPage.tsx` (sửa) | Thẻ *Thiết bị* |
| `package.json` ×5, `package-lock.json`, `README.md`, `CLAUDE.md`, `.claude/rules/database.md` (sửa) | 0.16.0, tài liệu |

---

### Task 0: Hoàn tất và commit 0.15.0 (Cửa sổ quầy)

Cây làm việc đang có các thay đổi 0.15.0 chưa commit (`PosShell.tsx`, `pos-window.ts`, `App.tsx`, `router.tsx`, `SellPage.tsx`, `CheckoutPanel.tsx`, `AppShell.tsx`, `ui-prefs.ts`, `AppearanceCard.tsx`, version 0.15.0, `CLAUDE.md`). Phải commit trước để diff 0.16.0 không lẫn vào.

**Files:**
- Modify: `README.md` (thêm mục 0.15.0)

- [ ] **Step 1: Đọc diff 0.15.0**

Run: `git diff` và `git status --short`
Mục đích: biết chính xác những gì cần kiểm (route `/pos`, nút *Cửa sổ quầy* trên Bán hàng, tùy chọn `startPos` trong Giao diện, thanh Thanh toán điện thoại bám `--bottom-nav`).

- [ ] **Step 2: Kiểm trên trình duyệt bằng skill `browser-verify`**

Kiểm:
- `/pos` hiện Bán hàng không có sidebar hay thanh dưới; nút *Quản lý* về `/overview`.
- Nút *Cửa sổ quầy* trên Bán hàng mở cửa sổ `/pos`; cửa sổ cũ chuyển sang Tổng quan.
- *Cài đặt → Giao diện*: bật "mở vào cửa sổ quầy" thì `/` vào `/pos`.
- Cỡ điện thoại: thanh Thanh toán ở `/sell` nằm trên thanh dưới, ở `/pos` bám đáy.

Sửa lỗi nếu có, theo đúng phong cách xung quanh.

- [ ] **Step 3: Thêm mục 0.15.0 vào README**

Trong `README.md`, mục *Chạy thật (production)*, thêm một gạch đầu dòng ngay sau dòng *Trang Tổng quan*:

```markdown
- Cửa sổ quầy: trên *Bán hàng* bấm *Cửa sổ quầy* → mở cửa sổ chỉ có màn bán hàng (không menu), vẫn in không hỏi; nút *Quản lý* quay về màn có menu. Muốn bật máy là vào thẳng cửa sổ quầy: *Cài đặt → Giao diện (trên máy này)* → bật *Mở vào cửa sổ quầy*.
```

Thêm vào cuối file:

```markdown
## Kiểm thử thủ công – Cửa sổ quầy 0.15.0

1. *Bán hàng* → *Cửa sổ quầy* → cửa sổ mới chỉ có thanh trên với tên tiệm, ngày, nút *Quản lý*; cửa sổ cũ chuyển sang *Tổng quan*. Giỏ hàng đang dở vẫn còn ở cửa sổ mới.
2. Bán một đơn tiền mặt trong cửa sổ quầy → hóa đơn in thẳng, không hỏi.
3. *Cài đặt → Giao diện* bật *Mở vào cửa sổ quầy* → mở `http://localhost:3000` vào thẳng `/pos`; tắt thì về *Bán hàng* có menu.
4. Điện thoại: `/pos` thanh *Thanh toán* bám sát đáy; `/sell` thanh *Thanh toán* nằm trên thanh dưới.
```

Đọc lại nhãn thật trong `AppearanceCard.tsx` và `SellPage.tsx` rồi sửa chữ in nghiêng cho khớp từng chữ.

- [ ] **Step 4: Chạy skill `check`**

Run: skill `check` (typecheck, test, build client, soát diff không format lại file cũ).
Expected: typecheck exit 0; shared 152 + server 252 test pass; build OK; `git diff --stat` không có file cũ đổi số dòng bất thường.

- [ ] **Step 5: Commit 0.15.0**

```bash
git add CLAUDE.md README.md package.json package-lock.json client/package.json server/package.json shared/package.json remote/package.json client/src/App.tsx client/src/router.tsx client/src/components/layout/AppShell.tsx client/src/components/layout/PosShell.tsx client/src/lib/ui-prefs.ts client/src/lib/pos-window.ts client/src/pages/sell/CheckoutPanel.tsx client/src/pages/sell/SellPage.tsx client/src/pages/settings/AppearanceCard.tsx
git commit -m "feat(client): cửa sổ quầy 0.15.0 – route /pos chỉ có Bán hàng, nút Cửa sổ quầy mở cùng hồ sơ trình duyệt để vẫn in không hỏi, tùy chọn mở vào /pos theo máy

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected: `git status --short` sạch, trừ những file Step 1 cho thấy không thuộc 0.15.0 (nếu có thì hỏi người dùng, không tự commit).

---

### Task 1: Kiểu và schema dùng chung (`shared`)

**Files:**
- Create: `shared/src/schemas/device.ts`
- Create: `shared/src/schemas/device.test.ts`
- Modify: `shared/src/types.ts` (thêm vào cuối file)
- Modify: `shared/src/schemas/common.ts` (thêm một dòng trong `FIELD_LABELS`)
- Modify: `shared/src/index.ts` (thêm một dòng export)

**Interfaces:**
- Produces:
  - `PAIRING_TTL_MS: number` (300000), `PAIRING_MAX_FAILURES: number` (5), `DEVICE_COOKIE: 'tp_device'`
  - `pairInputSchema` → `PairInput = { code: string }` (đã bỏ khoảng trắng, đúng 6 chữ số)
  - `deviceNameSchema` → `DeviceNameInput = { name: string }` (trim, 1–50)
  - `interface Device { id: number; name: string; createdAt: string; lastSeenOn: string | null }`
  - `type DeviceStatus = { kind: 'counter' } | { kind: 'paired'; device: { id: number; name: string } } | { kind: 'unpaired' }`
  - `interface PairingInfo { code: string; url: string; expiresAt: string }`

- [ ] **Step 1: Viết test schema (đỏ)**

`shared/src/schemas/device.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { deviceNameSchema, pairInputSchema } from './device.js';

describe('pairInputSchema', () => {
  it('bỏ khoảng trắng: "123 456", " 123456 "', () => {
    expect(pairInputSchema.parse({ code: '123 456' })).toEqual({ code: '123456' });
    expect(pairInputSchema.parse({ code: ' 123456 ' }).code).toBe('123456');
  });

  it('không đúng 6 chữ số → lỗi tại code', () => {
    for (const code of ['12345', '1234567', '12a456', ''])
      expect(pairInputSchema.safeParse({ code }).error?.issues[0]?.path).toEqual(['code']);
  });
});

describe('deviceNameSchema', () => {
  it('trim; rỗng hoặc dài hơn 50 ký tự → lỗi', () => {
    expect(deviceNameSchema.parse({ name: '  Máy chị Lan ' }).name).toBe('Máy chị Lan');
    expect(deviceNameSchema.safeParse({ name: '   ' }).success).toBe(false);
    expect(deviceNameSchema.safeParse({ name: 'x'.repeat(51) }).success).toBe(false);
    expect(deviceNameSchema.safeParse({ name: 'x'.repeat(50) }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `cd shared && npx vitest run src/schemas/device.test.ts`
Expected: FAIL, `Failed to resolve import "./device.js"`.

- [ ] **Step 3: Viết schema**

`shared/src/schemas/device.ts`:

```ts
import { z } from 'zod';

/** Mã ghép hết hạn sau khoảng này kể từ lúc máy quầy tạo. */
export const PAIRING_TTL_MS = 5 * 60_000;
/** Gõ sai đủ số lần này thì mã bị hủy, máy quầy phải tạo mã mới. */
export const PAIRING_MAX_FAILURES = 5;
/** Tên cookie giữ token của thiết bị đã ghép (HttpOnly, server đặt). */
export const DEVICE_COOKIE = 'tp_device';

/** POST /api/device/pair. Bỏ mọi khoảng trắng trước khi kiểm để "123 456" (dán, đọc qua điện thoại) vẫn hợp lệ. */
export const pairInputSchema = z.object({
  code: z
    .string()
    .transform((s) => s.replace(/\s/g, ''))
    .pipe(z.string().regex(/^\d{6}$/, 'gồm 6 chữ số')),
});
export type PairInput = z.output<typeof pairInputSchema>;

/** PATCH /api/devices/:id. */
export const deviceNameSchema = z.object({ name: z.string().trim().min(1).max(50) });
export type DeviceNameInput = z.output<typeof deviceNameSchema>;
```

- [ ] **Step 4: Thêm kiểu, nhãn, export**

Cuối `shared/src/types.ts`:

```ts

/** Thiết bị trong LAN đã ghép (GET /api/devices, chỉ máy quầy). `lastSeenOn` = ngày địa phương YYYY-MM-DD, null nếu chưa dùng. */
export interface Device {
  id: number;
  name: string;
  createdAt: string;
  lastSeenOn: string | null;
}

/** GET /api/device: máy đang gọi là máy quầy, thiết bị đã ghép, hay chưa ghép. */
export type DeviceStatus = { kind: 'counter' } | { kind: 'paired'; device: { id: number; name: string } } | { kind: 'unpaired' };

/** POST /api/devices/pairing: mã 6 số, link cho QR (`http://<IP LAN>:<cổng>/pair?code=…`), giờ hết hạn ISO. */
export interface PairingInfo {
  code: string;
  url: string;
  expiresAt: string;
}
```

Trong `shared/src/schemas/common.ts`, thêm vào object `FIELD_LABELS` ngay sau dòng `barcode: 'Mã vạch',`:

```ts
  code: 'Mã ghép',
```

(Đã kiểm: không schema nào khác có trường `code`, nên nhãn này không đổi thông báo lỗi chỗ khác.)

Trong `shared/src/index.ts`, ngay sau dòng `export * from './schemas/remote.js';`:

```ts
export * from './schemas/device.js';
```

- [ ] **Step 5: Chạy test, xác nhận xanh**

Run: `cd shared && npx vitest run src/schemas/device.test.ts`
Expected: PASS 3 test.

Run (gốc repo): `npm run build -w shared`
Expected: exit 0.

---

### Task 2: Bảng `devices` và `services/devices.ts`

**Files:**
- Modify: `server/src/db/schema.ts` (thêm bảng cuối file)
- Create (sinh): `server/drizzle/0007_<tên ngẫu nhiên>.sql`, `server/drizzle/meta/0007_snapshot.json`, sửa `meta/_journal.json`
- Create: `server/src/services/devices.ts`
- Create: `server/src/services/devices.test.ts`

**Interfaces:**
- Consumes: `PAIRING_TTL_MS`, `PAIRING_MAX_FAILURES`, `Device`, `PairingInfo`, `localDate` từ `@tiny-pos/shared`; `Clock`, `resolveClock` từ `./daily-code.js`; `BadRequestError`, `NotFoundError` từ `../errors.js`.
- Produces:
  - `devices` (drizzle table) trong `db/schema.ts`
  - `export function deviceNameFromUa(ua: string | undefined): string`
  - `export interface DevicesService { startPairing(): PairingInfo; pair(code: string, userAgent: string | undefined): { token: string; device: Device }; verify(token: string): Device | null; list(): Device[]; rename(id: number, name: string): Device; revoke(id: number): void }`
  - `export function createDevicesService(db: Db, opts: { lanUrl: () => string; clock?: Clock }): DevicesService`

- [ ] **Step 1: Thêm bảng vào schema**

Cuối `server/src/db/schema.ts`:

```ts

/** Điện thoại/máy trong LAN đã ghép (máy quầy không cần). Chỉ đổi qua services/devices.ts; khôi phục bản sao không đụng bảng này. */
export const devices = sqliteTable('devices', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  tokenHash: text('token_hash').notNull().unique(), // SHA-256 hex của token trong cookie
  createdAt: createdAt(),
  lastSeenOn: text('last_seen_on'), // ngày địa phương YYYY-MM-DD lần dùng gần nhất
});
```

- [ ] **Step 2: Sinh migration và soát SQL**

Dùng skill `migration`, hoặc chạy (gốc repo): `npm run db:generate`
Expected: file mới `server/drizzle/0007_*.sql` có đúng nội dung dưới (tên index có thể khác):

```sql
CREATE TABLE `devices` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`last_seen_on` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `devices_token_hash_unique` ON `devices` (`token_hash`);
```

Đây là bảng mới nên chạy an toàn trên DB đang có dữ liệu; không sửa tay. `git status` phải chỉ thấy file `0007_*.sql`, `0007_snapshot.json`, `_journal.json` đổi trong `server/drizzle/`.

- [ ] **Step 3: Viết test service (đỏ)**

`server/src/services/devices.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../db/test-db.js';
import type { Db } from '../db/connection.js';
import { NotFoundError } from '../errors.js';
import type { Clock } from './daily-code.js';
import { createDevicesService, deviceNameFromUa, type DevicesService } from './devices.js';

const T0 = new Date('2026-10-03T02:00:00.000Z'); // 09:00 giờ VN
const UA_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
let db: Db;
let clock: Clock;
let svc: DevicesService;
/** Dời đồng hồ đi `ms` kể từ T0 (service đọc clock.now mỗi lần gọi). */
const at = (ms: number) => {
  clock.now = new Date(T0.getTime() + ms);
};
const changes = () => (db.$client.prepare('select total_changes() as n').get() as { n: number }).n;
const pairOne = (ua: string | undefined = UA_IPHONE) => svc.pair(svc.startPairing().code, ua);

beforeEach(() => {
  db = createTestDb();
  clock = { now: T0, tzOffsetMin: 420 };
  svc = createDevicesService(db, { lanUrl: () => 'http://192.168.1.5:3000', clock });
});

describe('devices: mã ghép', () => {
  it('startPairing: 6 chữ số, hết hạn sau 5 phút, url LAN', () => {
    const p = svc.startPairing();
    expect(p.code).toMatch(/^\d{6}$/);
    expect(p.expiresAt).toBe('2026-10-03T02:05:00.000Z');
    expect(p.url).toBe(`http://192.168.1.5:3000/pair?code=${p.code}`);
  });

  it('đúng mã → thiết bị mới, token verify được; mã không dùng lại được', () => {
    const { code } = svc.startPairing();
    const { token, device } = svc.pair(code, UA_IPHONE);
    expect(device).toMatchObject({ name: 'iPhone · Safari', lastSeenOn: null });
    expect(token).toMatch(/^[\w-]{43}$/);
    expect(svc.verify(token)?.id).toBe(device.id);
    expect(() => svc.pair(code, UA_IPHONE)).toThrow('Chưa có mã ghép đang mở, hãy tạo mã trên máy quầy');
  });

  it('DB chỉ giữ SHA-256 của token', () => {
    const { token } = pairOne();
    const row = db.$client.prepare('select token_hash from devices').get() as { token_hash: string };
    expect(row.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.token_hash).not.toContain(token);
  });

  it('tạo mã mới → mã cũ thành mã sai', () => {
    const a = svc.startPairing().code;
    let b = svc.startPairing().code;
    while (b === a) b = svc.startPairing().code; // tránh trùng ngẫu nhiên 1/1.000.000
    expect(() => svc.pair(a, undefined)).toThrow(/^Mã không đúng/);
    expect(svc.pair(b, undefined).device.id).toBeGreaterThan(0);
  });

  it('4 phút 59 giây vẫn ghép được; đúng 5 phút thì hết hạn', () => {
    const { code } = svc.startPairing();
    at(5 * 60_000 - 1000);
    expect(svc.pair(code, undefined).device.id).toBeGreaterThan(0);
    const next = svc.startPairing(); // tạo lúc T0 + 4:59
    at(5 * 60_000 - 1000 + 5 * 60_000);
    expect(() => svc.pair(next.code, undefined)).toThrow('Chưa có mã ghép đang mở, hãy tạo mã trên máy quầy');
  });

  it('sai 5 lần → hủy mã; đúng mã sau đó cũng lỗi', () => {
    const { code } = svc.startPairing();
    const wrong = code === '000000' ? '111111' : '000000';
    for (const left of [4, 3, 2, 1]) expect(() => svc.pair(wrong, undefined)).toThrow(`Mã không đúng, còn ${left} lần thử`);
    expect(() => svc.pair(wrong, undefined)).toThrow('Mã đã hết hiệu lực, tạo mã mới trên máy quầy');
    expect(() => svc.pair(code, undefined)).toThrow('Chưa có mã ghép đang mở, hãy tạo mã trên máy quầy');
  });
});

describe('devices: verify, đổi tên, gỡ', () => {
  it('token sai/rỗng → null', () => {
    pairOne();
    expect(svc.verify('')).toBeNull();
    expect(svc.verify('x'.repeat(43))).toBeNull();
  });

  it('last_seen_on: ghi lần đầu, cùng ngày không ghi DB, sang ngày thì cập nhật', () => {
    const { token } = pairOne();
    expect(svc.verify(token)?.lastSeenOn).toBe('2026-10-03');
    const before = changes();
    at(10 * 3600_000); // 19:00 cùng ngày giờ VN
    expect(svc.verify(token)?.lastSeenOn).toBe('2026-10-03');
    expect(changes()).toBe(before);
    at(15 * 3600_000); // 00:00 ngày 04/10 giờ VN
    expect(svc.verify(token)?.lastSeenOn).toBe('2026-10-04');
    expect(svc.list()[0]!.lastSeenOn).toBe('2026-10-04');
  });

  it('list theo thứ tự ghép; rename, revoke; id lạ → 404', () => {
    const a = pairOne();
    const b = pairOne(undefined);
    expect(svc.list().map((d) => d.id)).toEqual([a.device.id, b.device.id]);
    expect(svc.rename(a.device.id, 'Máy chị Lan').name).toBe('Máy chị Lan');
    svc.revoke(a.device.id);
    expect(svc.verify(a.token)).toBeNull();
    expect(svc.list().map((d) => d.id)).toEqual([b.device.id]);
    expect(() => svc.rename(a.device.id, 'x')).toThrow(NotFoundError);
    expect(() => svc.revoke(a.device.id)).toThrow('Không tìm thấy thiết bị');
  });
});

describe('deviceNameFromUa', () => {
  it.each([
    [UA_IPHONE, 'iPhone · Safari'],
    ['Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36', 'Android · Chrome'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0', 'Windows · Edge'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1', 'iPhone · Chrome'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15', 'Mac · Safari'],
    ['Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0', 'Android · Firefox'],
    ['node', 'Thiết bị'],
    [undefined, 'Thiết bị'],
  ])('%s → %s', (ua, name) => expect(deviceNameFromUa(ua)).toBe(name));
});
```

- [ ] **Step 4: Chạy test, xác nhận đỏ**

Run: `cd server && npx vitest run src/services/devices.test.ts`
Expected: FAIL, `Failed to resolve import "./devices.js"`.

- [ ] **Step 5: Viết service**

`server/src/services/devices.ts`:

```ts
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { PAIRING_MAX_FAILURES, PAIRING_TTL_MS, localDate, type Device, type PairingInfo } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { devices } from '../db/schema.js';
import { BadRequestError, NotFoundError } from '../errors.js';
import { resolveClock, type Clock } from './daily-code.js';

export interface DevicesService {
  /** Mã 6 số mới, ghi đè mã cũ (mỗi lúc chỉ một mã). */
  startPairing(): PairingInfo;
  /** Đúng mã → tạo thiết bị, trả token gốc một lần để route đặt cookie. */
  pair(code: string, userAgent: string | undefined): { token: string; device: Device };
  /** Token trong cookie → thiết bị; ghi last_seen_on khi sang ngày mới. */
  verify(token: string): Device | null;
  list(): Device[];
  rename(id: number, name: string): Device;
  revoke(id: number): void;
}

const NO_PAIRING = 'Chưa có mã ghép đang mở, hãy tạo mã trên máy quầy';
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const toDevice = (r: typeof devices.$inferSelect): Device => ({ id: r.id, name: r.name, createdAt: r.createdAt, lastSeenOn: r.lastSeenOn });

/** "iPhone · Safari" từ User-Agent để chủ tiệm nhận ra máy; không nhận ra thì "Thiết bị". iPhone kiểm trước Mac vì UA iPhone có "like Mac OS X". */
export function deviceNameFromUa(ua: string | undefined): string {
  const s = ua ?? '';
  const os = /iPhone/.test(s)
    ? 'iPhone'
    : /iPad/.test(s)
      ? 'iPad'
      : /Android/.test(s)
        ? 'Android'
        : /Windows/.test(s)
          ? 'Windows'
          : /Macintosh|Mac OS X/.test(s)
            ? 'Mac'
            : null;
  const browser = /Edg(A|iOS)?\//.test(s)
    ? 'Edge'
    : /Firefox\/|FxiOS\//.test(s)
      ? 'Firefox'
      : /Chrome\/|CriOS\//.test(s)
        ? 'Chrome'
        : /Safari\//.test(s)
          ? 'Safari'
          : null;
  if (os && browser) return `${os} · ${browser}`;
  return os ?? browser ?? 'Thiết bị';
}

/**
 * Ghép thiết bị trong LAN. Mã ghép chỉ ở bộ nhớ (server khởi động lại là mất, máy quầy tạo lại);
 * token gốc chỉ nằm trong cookie của thiết bị, DB giữ SHA-256.
 */
export function createDevicesService(db: Db, opts: { lanUrl: () => string; clock?: Clock }): DevicesService {
  let pairing: { code: string; expiresAt: number; failures: number } | null = null;
  const clock = () => resolveClock(opts.clock);
  const row = (id: number) => {
    const r = db.select().from(devices).where(eq(devices.id, id)).get();
    if (!r) throw new NotFoundError('Không tìm thấy thiết bị');
    return r;
  };

  return {
    startPairing() {
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      pairing = { code, expiresAt: clock().now.getTime() + PAIRING_TTL_MS, failures: 0 };
      return { code, url: `${opts.lanUrl()}/pair?code=${code}`, expiresAt: new Date(pairing.expiresAt).toISOString() };
    },

    pair(code, userAgent) {
      const p = pairing;
      if (!p || clock().now.getTime() >= p.expiresAt) {
        pairing = null;
        throw new BadRequestError(NO_PAIRING);
      }
      if (code !== p.code) {
        p.failures++;
        const left = PAIRING_MAX_FAILURES - p.failures;
        if (left > 0) throw new BadRequestError(`Mã không đúng, còn ${left} lần thử`);
        pairing = null;
        throw new BadRequestError('Mã đã hết hiệu lực, tạo mã mới trên máy quầy');
      }
      pairing = null;
      const token = randomBytes(32).toString('base64url');
      const r = db.insert(devices).values({ name: deviceNameFromUa(userAgent), tokenHash: hash(token) }).returning().get();
      return { token, device: toDevice(r) };
    },

    verify(token) {
      if (!token) return null;
      const r = db.select().from(devices).where(eq(devices.tokenHash, hash(token))).get();
      if (!r) return null;
      const { now, tz } = clock();
      const day = localDate(now, tz);
      // Mỗi lần ghi DB làm Xem từ xa đẩy lại → chỉ ghi khi sang ngày mới
      if (r.lastSeenOn !== day) {
        db.update(devices).set({ lastSeenOn: day }).where(eq(devices.id, r.id)).run();
        r.lastSeenOn = day;
      }
      return toDevice(r);
    },

    list: () => db.select().from(devices).orderBy(devices.id).all().map(toDevice),

    rename(id, name) {
      row(id);
      return toDevice(db.update(devices).set({ name }).where(eq(devices.id, id)).returning().get()!);
    },

    revoke(id) {
      row(id);
      db.delete(devices).where(eq(devices.id, id)).run();
    },
  };
}
```

- [ ] **Step 6: Chạy test, xác nhận xanh**

Run: `cd server && npx vitest run src/services/devices.test.ts`
Expected: PASS tất cả (6 + 3 + 8 trường hợp UA).

---

### Task 3: Middleware `deviceGate`, route, nối vào app

**Files:**
- Create: `server/src/middleware/device-gate.ts`
- Create: `server/src/routes/devices.ts`
- Create: `server/src/routes/devices-api.test.ts`
- Modify: `server/src/routes/index.ts` (import, kiểu `deps`, 2 dòng `r.use`)
- Modify: `server/src/app.ts` (import, kiểu `opts`, 2 dòng gate, truyền `devices` vào `apiRouter`)
- Modify: `server/src/index.ts` (`lanAddress()`, tạo `devices`, truyền vào `createApp`)

**Interfaces:**
- Consumes: `DevicesService`, `createDevicesService` (Task 2); `DEVICE_COOKIE`, `DeviceStatus`, `pairInputSchema`, `deviceNameSchema`, `PairInput`, `DeviceNameInput` (Task 1).
- Produces:
  - `export type IsCounter = (req: Request) => boolean`
  - `export const isCounterRequest: IsCounter`
  - `export function readCookie(header: string | undefined, name: string): string | undefined`
  - `export function deviceGate(devices: DevicesService, isCounter: IsCounter): RequestHandler` — đặt `res.locals['device']: DeviceStatus`
  - `export const counterOnly: RequestHandler`
  - `export function deviceRouter(devices: DevicesService): Router`, `export function devicesRouter(devices: DevicesService): Router`
  - `createApp(db, opts)` nhận thêm `devices?: DevicesService; isCounter?: IsCounter`; không truyền `devices` thì tự tạo (gate luôn bật, kể cả trong test cũ).
  - API: `GET /api/device` → `DeviceStatus`; `POST /api/device/pair` `{ code }` → `201 { device: Device }` + cookie; `POST /api/devices/pairing` → `PairingInfo`; `GET /api/devices` → `Device[]`; `PATCH /api/devices/:id` `{ name }` → `Device`; `DELETE /api/devices/:id` → 204.

- [ ] **Step 1: Viết test API (đỏ)**

`server/src/routes/devices-api.test.ts`:

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import type { Request } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from '../db/test-db.js';
import { createApp } from '../app.js';
import { isCounterRequest, readCookie } from '../middleware/device-gate.js';
import { createDevicesService } from '../services/devices.js';

let server: Server;
let base: string;
let root: string;
beforeAll(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'tiny-pos-dev-'));
  const imagesDir = path.join(root, 'images');
  fs.mkdirSync(imagesDir);
  fs.writeFileSync(path.join(imagesDir, 'p1-1.jpg'), 'x');
  const db = createTestDb();
  const devices = createDevicesService(db, { lanUrl: () => 'http://192.168.1.5:3000' });
  // Giả hai phía từ cùng một tiến trình: có header x-test-counter = máy quầy, không có = máy khác trong LAN
  server = createApp(db, { devices, imagesDir, isCounter: (req) => req.headers['x-test-counter'] === '1' }).listen(0);
  await new Promise((r) => server.once('listening', r));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});
afterAll(() => {
  server.close();
  fs.rmSync(root, { recursive: true, force: true });
});

const call = async (method: string, p: string, o: { body?: unknown; counter?: boolean; cookie?: string } = {}) => {
  const headers: Record<string, string> = {};
  if (o.body !== undefined) headers['content-type'] = 'application/json';
  if (o.counter) headers['x-test-counter'] = '1';
  if (o.cookie) headers['cookie'] = o.cookie;
  const res = await fetch(base + p, { method, headers, body: o.body === undefined ? undefined : JSON.stringify(o.body) });
  const text = await res.text();
  const json = text && res.headers.get('content-type')?.includes('application/json') ? JSON.parse(text) : null;
  return { status: res.status, json, setCookie: res.headers.get('set-cookie') };
};
/** "tp_device=abc; Max-Age=…; Path=/; HttpOnly" → "tp_device=abc". */
const cookieOf = (setCookie: string | null) => setCookie!.split(';')[0]!;
const pairNew = async () => {
  const { json } = await call('POST', '/api/devices/pairing', { counter: true });
  const r = await call('POST', '/api/device/pair', { body: { code: json.code } });
  return { ...r, cookie: cookieOf(r.setCookie) };
};

describe('API ghép thiết bị', () => {
  it('máy chưa ghép: API và ảnh 401, trạng thái unpaired', async () => {
    const p = await call('GET', '/api/products');
    expect(p.status).toBe(401);
    expect(p.json).toEqual({ error: 'Thiết bị chưa được ghép', code: 'DEVICE_NOT_PAIRED' });
    expect((await call('GET', '/images/p1-1.jpg')).status).toBe(401);
    expect((await call('GET', '/api/device')).json).toEqual({ kind: 'unpaired' });
  });

  it('máy quầy: dùng được mọi thứ, tạo mã ghép có url LAN', async () => {
    expect((await call('GET', '/api/device', { counter: true })).json).toEqual({ kind: 'counter' });
    expect((await call('GET', '/api/products', { counter: true })).status).toBe(200);
    expect((await call('GET', '/images/p1-1.jpg', { counter: true })).status).toBe(200);
    const { status, json } = await call('POST', '/api/devices/pairing', { counter: true });
    expect(status).toBe(200);
    expect(json.code).toMatch(/^\d{6}$/);
    expect(json.url).toBe(`http://192.168.1.5:3000/pair?code=${json.code}`);
  });

  it('ghép: sai mã 400; sai định dạng 400 có nhãn; mã có khoảng trắng vẫn được; cookie HttpOnly Lax 10 năm', async () => {
    const { json } = await call('POST', '/api/devices/pairing', { counter: true });
    const wrong = json.code === '000000' ? '111111' : '000000';
    const bad = await call('POST', '/api/device/pair', { body: { code: wrong } });
    expect(bad.status).toBe(400);
    expect(bad.json.error).toBe('Mã không đúng, còn 4 lần thử');
    expect((await call('POST', '/api/device/pair', { body: { code: '12ab' } })).json.error).toMatch(/^Mã ghép:/);
    const spaced = `${json.code.slice(0, 3)} ${json.code.slice(3)}`;
    const ok = await call('POST', '/api/device/pair', { body: { code: spaced } });
    expect(ok.status).toBe(201);
    expect(ok.json.device).toMatchObject({ name: 'Thiết bị', lastSeenOn: null }); // UA của fetch Node là "node"
    expect(ok.setCookie).toMatch(/^tp_device=[\w-]{43};/);
    expect(ok.setCookie).toMatch(/HttpOnly/);
    expect(ok.setCookie).toMatch(/SameSite=Lax/);
    expect(ok.setCookie).toMatch(/Max-Age=315360000/);
    expect(ok.setCookie).not.toMatch(/Secure/);
    const cookie = cookieOf(ok.setCookie);
    expect((await call('GET', '/api/products', { cookie })).status).toBe(200);
    expect((await call('GET', '/images/p1-1.jpg', { cookie })).status).toBe(200);
    expect((await call('GET', '/api/device', { cookie })).json).toEqual({ kind: 'paired', device: { id: ok.json.device.id, name: 'Thiết bị' } });
  });

  it('thiết bị đã ghép không quản lý thiết bị được (403)', async () => {
    const { cookie } = await pairNew();
    for (const [m, p] of [
      ['GET', '/api/devices'],
      ['POST', '/api/devices/pairing'],
      ['PATCH', '/api/devices/1'],
      ['DELETE', '/api/devices/1'],
    ] as const) {
      const r = await call(m, p, { cookie, body: m === 'PATCH' ? { name: 'X' } : undefined });
      expect(r.status).toBe(403);
      expect(r.json.error).toBe('Chỉ thao tác được trên máy quầy');
    }
  });

  it('máy quầy đổi tên, gỡ; tên rỗng 400; cookie của máy đã gỡ → 401', async () => {
    const { cookie, json } = await pairNew();
    const id = json.device.id as number;
    expect((await call('PATCH', `/api/devices/${id}`, { counter: true, body: { name: '  Điện thoại chị Lan ' } })).json.name).toBe('Điện thoại chị Lan');
    const blank = await call('PATCH', `/api/devices/${id}`, { counter: true, body: { name: '   ' } });
    expect(blank.status).toBe(400);
    expect(blank.json.error).toMatch(/^Tên:/);
    const list = (await call('GET', '/api/devices', { counter: true })).json as { id: number; name: string }[];
    expect(list.find((d) => d.id === id)?.name).toBe('Điện thoại chị Lan');
    expect((await call('DELETE', `/api/devices/${id}`, { counter: true })).status).toBe(204);
    expect((await call('DELETE', `/api/devices/${id}`, { counter: true })).status).toBe(404);
    expect((await call('GET', '/api/products', { cookie })).status).toBe(401);
    expect((await call('GET', '/api/device', { cookie })).json).toEqual({ kind: 'unpaired' });
  });

  it('cookie rác / hỏng / tên gần giống → 401, không 500', async () => {
    for (const cookie of ['tp_device=abc', 'tp_device=%E0%A4%A', 'a=1; b=2', 'tp_device=', 'xtp_device=abc'])
      expect((await call('GET', '/api/products', { cookie })).status).toBe(401);
  });
});

describe('isCounterRequest', () => {
  const req = (remoteAddress: string | undefined, host: string | undefined) =>
    ({ socket: { remoteAddress }, headers: { host } }) as unknown as Request;
  it.each([
    ['127.0.0.1', 'localhost:3000', true],
    ['::1', '[::1]:3000', true],
    ['::ffff:127.0.0.1', '127.0.0.1:3000', true],
    ['127.0.0.1', 'LOCALHOST:3000', true],
    ['127.0.0.1', 'localhost', true],
    ['127.0.0.1', 'evil.com', false],
    ['127.0.0.1', 'localhost.evil.com:3000', false],
    ['127.0.0.1', undefined, false],
    ['192.168.1.7', 'localhost:3000', false],
    [undefined, 'localhost:3000', false],
  ])('%s + Host %s → %s', (addr, host, expected) => expect(isCounterRequest(req(addr, host))).toBe(expected));
});

describe('readCookie', () => {
  it('đúng tên giữa nhiều cookie, decode; hỏng hoặc không có → undefined', () => {
    expect(readCookie('a=1; tp_device=x%2By; b=2', 'tp_device')).toBe('x+y');
    expect(readCookie('xtp_device=1', 'tp_device')).toBeUndefined();
    expect(readCookie('tp_device=%E0%A4%A', 'tp_device')).toBeUndefined();
    expect(readCookie(undefined, 'tp_device')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `cd server && npx vitest run src/routes/devices-api.test.ts`
Expected: FAIL, `Failed to resolve import "../middleware/device-gate.js"`.

- [ ] **Step 3: Viết middleware**

`server/src/middleware/device-gate.ts`:

```ts
import type { Request, RequestHandler } from 'express';
import { DEVICE_COOKIE, type DeviceStatus } from '@tiny-pos/shared';
import { HttpError } from '../errors.js';
import type { DevicesService } from '../services/devices.js';

export type IsCounter = (req: Request) => boolean;

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
/** Máy chưa ghép vẫn gọi được: hỏi trạng thái và gửi mã ghép. */
const PUBLIC = new Set(['/api/device', '/api/device/pair']);

/** Host bỏ cổng, chữ thường: "LOCALHOST:3000" → "localhost", "[::1]:3000" → "[::1]". */
function hostName(host: string | undefined): string {
  const h = (host ?? '').toLowerCase();
  return h.startsWith('[') ? h.slice(0, h.indexOf(']') + 1) : h.split(':')[0]!;
}

/** Request từ chính máy quầy: địa chỉ loopback (không giả được qua TCP) và Host là localhost (chặn DNS rebinding). */
export const isCounterRequest: IsCounter = (req) =>
  LOOPBACK.has(req.socket.remoteAddress ?? '') && LOCAL_HOSTS.has(hostName(req.headers.host));

/** Giá trị cookie `name` trong header Cookie; mã hóa hỏng thì coi như không có. */
export function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0 || part.slice(0, i).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** Đặt trước /api và /images: máy quầy và thiết bị đã ghép đi tiếp, còn lại 401 (trừ PUBLIC). Ghi `res.locals.device`. */
export function deviceGate(devices: DevicesService, isCounter: IsCounter): RequestHandler {
  return (req, res, next) => {
    let status: DeviceStatus;
    if (isCounter(req)) status = { kind: 'counter' };
    else {
      const d = devices.verify(readCookie(req.headers.cookie, DEVICE_COOKIE) ?? '');
      status = d ? { kind: 'paired', device: { id: d.id, name: d.name } } : { kind: 'unpaired' };
    }
    res.locals['device'] = status;
    if (status.kind !== 'unpaired' || PUBLIC.has(req.originalUrl.split('?')[0]!)) return next();
    res.status(401).json({ error: 'Thiết bị chưa được ghép', code: 'DEVICE_NOT_PAIRED' });
  };
}

/** Chỉ máy quầy: tạo mã ghép, xem, đổi tên, gỡ thiết bị. */
export const counterOnly: RequestHandler = (_req, res, next) =>
  next((res.locals['device'] as DeviceStatus | undefined)?.kind === 'counter' ? undefined : new HttpError(403, 'Chỉ thao tác được trên máy quầy'));
```

- [ ] **Step 4: Viết route**

`server/src/routes/devices.ts`:

```ts
import { Router } from 'express';
import { DEVICE_COOKIE, deviceNameSchema, pairInputSchema, type DeviceNameInput, type DeviceStatus, type PairInput } from '@tiny-pos/shared';
import { counterOnly } from '../middleware/device-gate.js';
import { intParam, validateBody } from '../middleware/validate.js';
import type { DevicesService } from '../services/devices.js';

const TEN_YEARS_MS = 10 * 365 * 24 * 3600 * 1000;

/** /api/device: máy đang gọi hỏi trạng thái và gửi mã ghép (mở cả cho máy chưa ghép, xem deviceGate). */
export function deviceRouter(devices: DevicesService): Router {
  const r = Router();
  r.get('/', (_req, res) => res.json(res.locals['device'] as DeviceStatus));
  r.post('/pair', validateBody(pairInputSchema), (req, res) => {
    const { token, device } = devices.pair((req.body as PairInput).code, req.headers['user-agent']);
    // Không Secure: app chạy HTTP trong LAN; Lax chặn trang khác gửi request ghi kèm cookie
    res.cookie(DEVICE_COOKIE, token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: TEN_YEARS_MS });
    res.status(201).json({ device });
  });
  return r;
}

/** /api/devices: chỉ máy quầy – tạo mã ghép, danh sách, đổi tên, gỡ. */
export function devicesRouter(devices: DevicesService): Router {
  const r = Router();
  r.use(counterOnly);
  r.post('/pairing', (_req, res) => res.json(devices.startPairing()));
  r.get('/', (_req, res) => res.json(devices.list()));
  r.patch('/:id', validateBody(deviceNameSchema), (req, res) => res.json(devices.rename(intParam(req, 'id'), (req.body as DeviceNameInput).name)));
  r.delete('/:id', (req, res) => {
    devices.revoke(intParam(req, 'id'));
    res.status(204).end();
  });
  return r;
}
```

- [ ] **Step 5: Nối vào `routes/index.ts`**

Thêm import, ngay sau dòng `import { remoteRouter } from './remote.js';`:

```ts
import { deviceRouter, devicesRouter } from './devices.js';
```

Ngay sau dòng `import type { RemoteSync } from '../services/remote-sync.js';`:

```ts
import type { DevicesService } from '../services/devices.js';
```

Sửa chữ ký `apiRouter`: thêm `devices?: DevicesService` vào cuối kiểu `deps`, tức thay `remote?: RemoteSync }` bằng `remote?: RemoteSync; devices?: DevicesService }` trên cùng dòng đó.

Ngay sau dòng `r.use('/remote', remoteRouter(deps.remote));`:

```ts
  if (deps.devices) {
    r.use('/device', deviceRouter(deps.devices));
    r.use('/devices', devicesRouter(deps.devices));
  }
```

- [ ] **Step 6: Nối vào `app.ts`**

Thêm import, ngay sau dòng `import { errorHandler } from './middleware/error.js';`:

```ts
import { deviceGate, isCounterRequest, type IsCounter } from './middleware/device-gate.js';
```

Ngay sau dòng `import type { BackupService } from './services/backups.js';`:

```ts
import { createDevicesService, type DevicesService } from './services/devices.js';
```

Trong kiểu `opts` của `createApp`, thêm `devices?: DevicesService; isCounter?: IsCounter` sau `remote?: RemoteSync` (cùng dòng).

Ngay sau dòng `app.disable('x-powered-by');`:

```ts
  // Ghép thiết bị: test/không truyền thì tự tạo để gate luôn bật; máy quầy (localhost) luôn qua
  const devices = opts.devices ?? createDevicesService(db, { lanUrl: () => 'http://localhost:3000' });
  app.use(['/api', '/images'], deviceGate(devices, opts.isCounter ?? isCounterRequest));
```

Trên dòng `app.use('/api', apiRouter(db, { … remote: opts.remote }));` thay `remote: opts.remote }` bằng `remote: opts.remote, devices }`.

(Gate đặt trước `express.json` để máy chưa ghép không được parse body.)

- [ ] **Step 7: Nối vào `index.ts`**

Ngay sau dòng `const port = Number(process.env['PORT'] ?? 3000);`:

```ts
/** IPv4 LAN đầu tiên của máy (bỏ loopback); không có mạng thì undefined. Gọi lại mỗi lần để IP đổi thì QR ghép vẫn đúng. */
const lanAddress = () =>
  Object.values(os.networkInterfaces())
    .flat()
    .find((i) => i && i.family === 'IPv4' && !i.internal)?.address;
```

Ngay trước dòng `const app = createApp(db, …`:

```ts
const devices = createDevicesService(db, { lanUrl: () => `http://${lanAddress() ?? 'localhost'}:${port}` });
```

Trên dòng `const app = createApp(db, { … remote });` thay `remote });` bằng `remote, devices });`.

Trong callback `app.listen`, thay ba dòng:

```ts
  const lan = Object.values(os.networkInterfaces())
    .flat()
    .find((i) => i && i.family === 'IPv4' && !i.internal)?.address;
```

bằng:

```ts
  const lan = lanAddress();
```

Thêm import ngay sau dòng `import { createRemoteSync } from './services/remote-sync.js';`:

```ts
import { createDevicesService } from './services/devices.js';
```

- [ ] **Step 8: Chạy test, xác nhận xanh; test API cũ không đổi**

Run: `cd server && npx vitest run src/routes/devices-api.test.ts`
Expected: PASS tất cả.

Run (gốc repo): `npm test`
Expected: mọi test cũ vẫn PASS (gọi từ 127.0.0.1 với `Host: 127.0.0.1:<cổng>` là máy quầy), cộng test mới.

Run (gốc repo): `npm run typecheck`
Expected: exit 0.

---

### Task 4: Khôi phục bản sao không đụng bảng `devices`

**Files:**
- Modify: `server/src/services/backups.ts:199-229` (`copyTables`)
- Modify: `server/src/services/backups.test.ts` (thêm import, một test trong `describe('backups: khôi phục')`)

**Interfaces:**
- Consumes: `createDevicesService` (Task 2).
- Produces: hành vi: sau `restore`, `devices` và dòng `sqlite_sequence` của nó giữ nguyên như trước khi khôi phục.

- [ ] **Step 1: Viết test (đỏ)**

Trong `server/src/services/backups.test.ts`, thêm import ngay sau dòng `import { createBackupService, type BackupService } from './backups.js';`:

```ts
import { createDevicesService } from './devices.js';
```

Thêm test cuối `describe('backups: khôi phục', …)` (trước `});` đóng describe đó):

```ts

  it('khôi phục không đụng danh sách thiết bị: máy đã gỡ không sống lại, id mới không trùng', async () => {
    const devs = createDevicesService(db, { lanUrl: () => 'http://192.168.1.5:3000' });
    const pairOne = (ua: string) => devs.pair(devs.startPairing().code, ua).device;
    const a = pairOne('iPhone Safari/604.1');
    product('Coca', '1');
    const snap = await svc.create('manual');

    devs.revoke(a.id);
    const b = pairOne('Android Chrome/129.0');
    await svc.restore(snap.name);

    expect(devs.list().map((d) => d.id)).toEqual([b.id]);
    expect(listProducts(db, { includeInactive: true }).map((p) => p.name)).toEqual(['Coca']);
    // sqlite_sequence của devices giữ nguyên → thiết bị mới không nhận lại id của máy đã gỡ
    expect(pairOne('Windows Edg/129.0').id).toBeGreaterThan(b.id);
  });
```

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `cd server && npx vitest run src/services/backups.test.ts`
Expected: FAIL ở test mới: danh sách là `[a.id]` (bản sao chép đè) thay vì `[b.id]`.

- [ ] **Step 3: Sửa `copyTables`**

Trong `server/src/services/backups.ts`, ngay trên dòng `/** Chép toàn bộ bảng từ file vào DB đang mở trong một transaction; cột chỉ có ở DB hiện tại nhận mặc định. */`:

```ts
  /** Bảng thuộc máy hiện tại, không thuộc bản sao: khôi phục bản cũ không được làm sống lại thiết bị đã gỡ. */
  const KEEP_TABLES = new Set(['devices']);

```

Thay dòng:

```ts
          const tables = tableNames('main');
```

bằng:

```ts
          const tables = tableNames('main').filter((t) => !KEEP_TABLES.has(t));
```

Thay khối:

```ts
          if (hasTable('main', 'sqlite_sequence')) {
            sqlite.prepare('delete from main.sqlite_sequence').run();
            if (hasTable('src', 'sqlite_sequence')) {
              const list = tables.map((t) => `'${t}'`).join(', ');
              sqlite.prepare(`insert into main.sqlite_sequence (name, seq) select name, seq from src.sqlite_sequence where name in (${list})`).run();
            }
          }
```

bằng:

```ts
          if (hasTable('main', 'sqlite_sequence')) {
            const list = tables.map((t) => `'${t}'`).join(', ');
            sqlite.prepare(`delete from main.sqlite_sequence where name in (${list})`).run();
            if (hasTable('src', 'sqlite_sequence')) {
              sqlite.prepare(`insert into main.sqlite_sequence (name, seq) select name, seq from src.sqlite_sequence where name in (${list})`).run();
            }
          }
```

- [ ] **Step 4: Chạy test, xác nhận xanh**

Run: `cd server && npx vitest run src/services/backups.test.ts`
Expected: PASS tất cả, kể cả test cũ "giữ sqlite_sequence" và "bản sao schema cũ (thiếu bảng)". Bản sao từ 0.15.0 không có bảng `devices`; bảng này vốn bị lọc khỏi `tables` nên không bị xóa.

---

### Task 5: Client – chặn ở gốc app, màn ghép, trang `/pair`

**Files:**
- Create (sinh): `client/src/components/ui/input-otp.tsx` (+ `input-otp` trong `client/package.json`, `package-lock.json`)
- Create: `client/src/api/device.ts`
- Create: `client/src/components/DeviceGate.tsx`
- Create: `client/src/pages/pair/PairScreen.tsx`
- Modify: `client/src/main.tsx`

**Interfaces:**
- Consumes: `Device`, `DeviceStatus`, `PairingInfo` (Task 1); API Task 3; `ApiError`, `api` từ `@/api/client`.
- Produces:
  - `DEVICE_KEY = ['device']`
  - `useDevice(): UseQueryResult<DeviceStatus>`
  - `useDevices(enabled: boolean, poll?: number | false): UseQueryResult<Device[]>`
  - `usePair(): UseMutationResult<{ device: Device }, Error, string>`
  - `useStartPairing(): UseMutationResult<PairingInfo, Error, void>`
  - `useRenameDevice(): UseMutationResult<Device, Error, { id: number; name: string }>`
  - `useRevokeDevice(): UseMutationResult<void, Error, number>`
  - `DeviceGate({ children })`, `PairScreen({ autoCode }: { autoCode: string | null })`

- [ ] **Step 1: Thêm component shadcn `input-otp`**

Run (trong `client/`, PowerShell):
`$env:NODE_EXTRA_CA_CERTS = "<repo>\.certs\corp-root.pem"; npx shadcn@latest add input-otp`
Expected: tạo `client/src/components/ui/input-otp.tsx` (export `InputOTP`, `InputOTPGroup`, `InputOTPSlot`, `InputOTPSeparator`), thêm `input-otp` vào `client/package.json`. `git status` không được thấy file `ui/*` cũ nào bị sửa; nếu CLI hỏi ghi đè thì trả lời **No**.

- [ ] **Step 2: Hook API**

`client/src/api/device.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Device, DeviceStatus, PairingInfo } from '@tiny-pos/shared';
import { api } from './client';

export const DEVICE_KEY = ['device'];
const LIST_KEY = ['devices'];

/** Máy này là máy quầy / đã ghép / chưa ghép. Hỏi một lần; 401 ở bất kỳ đâu đặt lại thành chưa ghép (main.tsx). */
export const useDevice = () => useQuery({ queryKey: DEVICE_KEY, queryFn: () => api<DeviceStatus>('/device'), staleTime: Infinity, retry: false });

/** Danh sách thiết bị (chỉ máy quầy mới gọi được); `poll` = ms hỏi lại khi đang mở hộp thoại ghép. */
export const useDevices = (enabled: boolean, poll: number | false = false) =>
  useQuery({ queryKey: LIST_KEY, queryFn: () => api<Device[]>('/devices'), enabled, refetchInterval: poll });

/** Gửi mã ghép; thành công thì máy này thành "đã ghép" và tải lại mọi dữ liệu đang lỗi 401. */
export function usePair() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api<{ device: Device }>('/device/pair', { json: { code } }),
    onSuccess: ({ device }) => {
      qc.setQueryData<DeviceStatus>(DEVICE_KEY, { kind: 'paired', device: { id: device.id, name: device.name } });
      void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== DEVICE_KEY[0] });
    },
  });
}

export const useStartPairing = () => useMutation({ mutationFn: () => api<PairingInfo>('/devices/pairing', { method: 'POST' }) });

export function useRenameDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => api<Device>(`/devices/${id}`, { method: 'PATCH', json: { name } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST_KEY }),
  });
}

export function useRevokeDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/devices/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST_KEY }),
  });
}
```

- [ ] **Step 3: `PairScreen`**

`client/src/pages/pair/PairScreen.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { Smartphone } from 'lucide-react';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { usePair } from '@/api/device';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from '@/components/ui/input-otp';

const SIX_DIGITS = /^\d{6}$/;
const slot = 'size-12 text-xl';

/**
 * Thay cả app khi máy trong LAN chưa ghép. `autoCode` = mã từ link QR (/pair?code=…): hợp lệ thì gửi ngay.
 * Ghép xong DeviceGate tự render app (và chuyển /pair về /).
 */
export function PairScreen({ autoCode }: { autoCode: string | null }) {
  const pair = usePair();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  // StrictMode chạy effect hai lần: chỉ gửi mã từ link một lần
  const sentAuto = useRef(false);

  const submit = (c: string) => {
    setError(undefined);
    pair.mutate(c, {
      onError: (e) => {
        setError(e.message);
        setCode('');
      },
    });
  };

  useEffect(() => {
    if (sentAuto.current || !autoCode || !SIX_DIGITS.test(autoCode)) return;
    sentAuto.current = true;
    submit(autoCode);
  }, [autoCode]);

  return (
    <div className="grid min-h-svh place-items-center p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-5 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Smartphone className="size-7" />
          </div>
          <div className="space-y-2">
            <h1 className="font-heading text-xl font-semibold">Điện thoại này chưa được ghép</h1>
            <p className="text-sm text-muted-foreground">
              Trên máy quầy mở <span className="font-medium text-foreground">Cài đặt → Thiết bị → Ghép điện thoại</span>, rồi quét mã QR bằng camera
              hoặc gõ mã 6 số vào đây.
            </p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <InputOTP
              maxLength={6}
              pattern={REGEXP_ONLY_DIGITS}
              pasteTransformer={(t) => t.replace(/\D/g, '')}
              inputMode="numeric"
              autoFocus
              value={code}
              disabled={pair.isPending}
              aria-invalid={!!error}
              onChange={(v) => {
                setCode(v);
                setError(undefined);
              }}
              onComplete={submit}
            >
              <InputOTPGroup>
                {[0, 1, 2].map((i) => (
                  <InputOTPSlot key={i} index={i} className={slot} />
                ))}
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup>
                {[3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} className={slot} />
                ))}
              </InputOTPGroup>
            </InputOTP>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="h-11 w-full text-base" disabled={code.length !== 6 || pair.isPending} onClick={() => submit(code)}>
              {pair.isPending ? 'Đang ghép…' : 'Ghép'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

Nếu `InputOTP` bản vừa sinh không nhận `pasteTransformer` (phiên bản `input-otp` cũ), bỏ prop đó và đổi `onChange` thành `setCode(v.replace(/\D/g, '').slice(0, 6))`.

- [ ] **Step 4: `DeviceGate`**

`client/src/components/DeviceGate.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useDevice } from '@/api/device';
import { Skeleton } from '@/components/ui/skeleton';
import { PairScreen } from '@/pages/pair/PairScreen';

/**
 * Máy trong LAN chưa ghép → màn ghép thay cả app (kể cả /pos, /labels/print). Máy quầy / đã ghép → render bình thường.
 * Không gọi được server (mất mạng, 5xx) → vẫn render app để các trang tự báo lỗi, không bắt ghép.
 */
export function DeviceGate({ children }: { children: ReactNode }) {
  const { pathname, search } = useLocation();
  const { data, isPending } = useDevice();
  if (isPending)
    return (
      <div className="grid min-h-svh place-items-center p-4">
        <Skeleton className="h-40 w-full max-w-sm rounded-xl" />
      </div>
    );
  if (data?.kind === 'unpaired') return <PairScreen autoCode={pathname === '/pair' ? new URLSearchParams(search).get('code') : null} />;
  if (pathname === '/pair') return <Navigate to="/" replace />;
  return children;
}
```

- [ ] **Step 5: Sửa `main.tsx`**

Thay dòng import `import { QueryClient, QueryClientProvider } from '@tanstack/react-query';` bằng:

```ts
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import { DEVICE_KEY } from '@/api/device';
import { DeviceGate } from '@/components/DeviceGate';
```

Thay dòng:

```ts
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 5_000 } } });
```

bằng:

```ts
/** 401 ở bất kỳ lời gọi nào = thiết bị bị gỡ / chưa ghép → DeviceGate hiện màn ghép ngay. */
const onApiError = (e: Error) => {
  if (e instanceof ApiError && e.status === 401) queryClient.setQueryData(DEVICE_KEY, { kind: 'unpaired' });
};
const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onApiError }),
  mutationCache: new MutationCache({ onError: onApiError }),
  defaultOptions: { queries: { retry: 1, staleTime: 5_000 } },
});
```

Thay dòng `                <App />` bằng:

```tsx
                <DeviceGate>
                  <App />
                </DeviceGate>
```

- [ ] **Step 6: Typecheck và build**

Run (gốc repo): `npm run typecheck`
Expected: exit 0.

Run (gốc repo): `npm run build`
Expected: exit 0. Kiểm thật trên trình duyệt làm ở Task 7, sau khi có thẻ Thiết bị để tạo mã.

---

### Task 6: Client – thẻ *Thiết bị* trong Cài đặt

**Files:**
- Create: `client/src/components/UrlQr.tsx`
- Modify: `client/src/pages/settings/RemoteCard.tsx` (bỏ hàm `UrlQr` cục bộ + import `qrcode`/`useEffect`, thêm import, thêm `alt`)
- Create: `client/src/pages/settings/PairDialog.tsx`
- Create: `client/src/pages/settings/RenameDeviceDialog.tsx`
- Create: `client/src/pages/settings/DevicesCard.tsx`
- Modify: `client/src/pages/settings/SettingsPage.tsx` (1 import, 1 dòng JSX)

**Interfaces:**
- Consumes: hook Task 5 (`useDevice`, `useDevices`, `useStartPairing`, `useRenameDevice`, `useRevokeDevice`); `Device`, `PairingInfo`; `useConfirm` (`{ title, description?, confirmText?, destructive? } → Promise<boolean>`); `today()` từ `@/lib/today`.
- Produces: `UrlQr({ url, alt? })`, `DevicesCard()`, `PairDialog({ open, onOpenChange, devices })`, `RenameDeviceDialog({ device, onClose })`.

- [ ] **Step 1: Tách `UrlQr`**

`client/src/components/UrlQr.tsx`:

```tsx
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** Mã QR của một địa chỉ để quét bằng điện thoại thay vì gõ. */
export function UrlQr({ url, alt = 'Mã QR' }: { url: string; alt?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { margin: 1, width: 240 })
      .then((u) => alive && setSrc(u))
      .catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
  }, [url]);
  return src ? <img src={src} alt={alt} className="size-40 rounded-lg border bg-white p-1" /> : <div className="size-40 animate-pulse rounded-lg bg-muted" />;
}
```

(`bg-white` giữ nguyên như bản gốc: nền QR phải trắng cả ở chế độ tối để camera đọc được.)

Trong `client/src/pages/settings/RemoteCard.tsx`:
- Xóa nguyên khối từ dòng `/** Mã QR của địa chỉ trang xem để chủ tiệm quét bằng điện thoại thay vì gõ. */` đến hết hàm `UrlQr` (dấu `}` đóng hàm và dòng trống sau nó).
- Xóa dòng `import QRCode from 'qrcode';`.
- Dòng `import { useEffect, useState, type KeyboardEvent } from 'react';` thành `import { useState, type KeyboardEvent } from 'react';`. Trước khi bỏ, chạy `grep -n useEffect client/src/pages/settings/RemoteCard.tsx` để chắc chỉ còn dòng import dùng tới.
- Ngay sau dòng `import { SectionTitle, TextField } from '@/components/TextField';` thêm `import { UrlQr } from '@/components/UrlQr';`.
- `<UrlQr url={data.url} />` thành `<UrlQr url={data.url} alt="Mã QR địa chỉ trang xem" />`.

- [ ] **Step 2: `RenameDeviceDialog`**

`client/src/pages/settings/RenameDeviceDialog.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Device } from '@tiny-pos/shared';
import { useRenameDevice } from '@/api/device';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/** Đổi tên thiết bị. Không dùng <form> vì thẻ nằm trong form cài đặt chung: Enter ở ô tên chỉ lưu tên. */
export function RenameDeviceDialog({ device, onClose }: { device: Device | null; onClose: () => void }) {
  const rename = useRenameDevice();
  const [name, setName] = useState('');
  useEffect(() => {
    if (device) setName(device.name);
  }, [device]);

  const save = () => {
    if (!device || !name.trim()) return;
    rename.mutate(
      { id: device.id, name: name.trim() },
      {
        onSuccess: () => {
          toast.success('Đã đổi tên');
          onClose();
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <Dialog open={!!device} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Đổi tên thiết bị</DialogTitle>
        </DialogHeader>
        <TextField
          id="device-name"
          label="Tên"
          maxLength={50}
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            save();
          }}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button type="button" disabled={!name.trim() || rename.isPending} onClick={save}>
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: `PairDialog`**

`client/src/pages/settings/PairDialog.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import type { Device, PairingInfo } from '@tiny-pos/shared';
import { useStartPairing } from '@/api/device';
import { UrlQr } from '@/components/UrlQr';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Danh sách thiết bị đang được hỏi lại mỗi 2 giây (DevicesCard); có máy mới thì báo và tự đóng. */
  devices: Device[] | undefined;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Hộp thoại ghép: tạo mã khi mở, QR + mã 6 số + đếm ngược; đóng tay không hủy mã (tự hết hạn sau 5 phút). */
export function PairDialog({ open, onOpenChange, devices }: Props) {
  const start = useStartPairing();
  const [info, setInfo] = useState<PairingInfo | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Id thiết bị có sẵn lúc mở: id mới xuất hiện = vừa ghép xong
  const known = useRef<Set<number> | null>(null);
  // StrictMode chạy effect hai lần: mỗi lần mở chỉ tạo một mã (mã thứ hai làm mã đầu thành sai)
  const started = useRef(false);

  const newCode = () => start.mutate(undefined, { onSuccess: setInfo, onError: (e) => toast.error(e.message) });

  useEffect(() => {
    if (!open) {
      started.current = false;
      known.current = null;
      setInfo(null);
      return;
    }
    if (started.current) return;
    started.current = true;
    known.current = devices ? new Set(devices.map((d) => d.id)) : null;
    newCode();
  }, [open]);

  useEffect(() => {
    if (!open || !devices) return;
    if (!known.current) {
      known.current = new Set(devices.map((d) => d.id));
      return;
    }
    const added = devices.find((d) => !known.current!.has(d.id));
    if (!added) return;
    toast.success(`Đã ghép ${added.name}`);
    onOpenChange(false);
  }, [devices, open]);

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open]);

  const left = info ? Math.max(0, Math.ceil((Date.parse(info.expiresAt) - now) / 1000)) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ghép điện thoại</DialogTitle>
          <DialogDescription>Điện thoại bắt Wi‑Fi của tiệm rồi mở camera quét mã; hoặc mở địa chỉ máy quầy và gõ mã 6 số.</DialogDescription>
        </DialogHeader>
        {!info ? (
          <Skeleton className="mx-auto size-40" />
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <UrlQr url={info.url} alt="Mã QR ghép điện thoại" />
            <p className="font-mono text-4xl font-semibold tracking-[0.3em]">
              {info.code.slice(0, 3)} {info.code.slice(3)}
            </p>
            {left > 0 ? <p className="text-sm text-muted-foreground">Còn {mmss(left)}</p> : <p className="text-sm text-warning">Mã đã hết hạn</p>}
            <p className="break-all text-xs text-muted-foreground">{info.url.split('/pair')[0]}</p>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={start.isPending} onClick={newCode}>
            <RefreshCw data-icon="inline-start" />
            Tạo mã mới
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Xong
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: `DevicesCard`**

`client/src/pages/settings/DevicesCard.tsx`:

```tsx
import { useState } from 'react';
import { MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Device } from '@tiny-pos/shared';
import { useDevice, useDevices, useRevokeDevice } from '@/api/device';
import { useConfirm } from '@/components/ConfirmDialog';
import { SectionTitle } from '@/components/TextField';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { today } from '@/lib/today';
import { PairDialog } from './PairDialog';
import { RenameDeviceDialog } from './RenameDeviceDialog';

const dmy = (iso: string) => new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
/** last_seen_on (YYYY-MM-DD giờ địa phương) → "hôm nay" / "dd/mm" / "chưa dùng". */
const seen = (d: string | null) => (!d ? 'chưa dùng' : d === today() ? 'hôm nay' : `${d.slice(8, 10)}/${d.slice(5, 7)}`);

/**
 * Thẻ Thiết bị trong Cài đặt. Máy quầy: danh sách, ghép, đổi tên, gỡ. Điện thoại đã ghép: chỉ hiện tên máy này.
 * Nằm trong form cài đặt chung nên mọi nút là type="button".
 */
export function DevicesCard() {
  const { data: me } = useDevice();
  const counter = me?.kind === 'counter';
  const [pairing, setPairing] = useState(false);
  const [renaming, setRenaming] = useState<Device | null>(null);
  const { data: list } = useDevices(counter, pairing ? 2000 : false);
  const revoke = useRevokeDevice();
  const confirm = useConfirm();

  if (me?.kind === 'paired')
    return (
      <Card>
        <CardContent className="space-y-2">
          <SectionTitle>Thiết bị</SectionTitle>
          <p className="text-sm">
            Thiết bị này: <span className="font-medium">{me.device.name}</span>. Thêm hoặc gỡ thiết bị trên máy quầy.
          </p>
        </CardContent>
      </Card>
    );
  if (!counter) return null;

  const remove = async (d: Device) => {
    const ok = await confirm({ title: `Gỡ ${d.name}?`, description: 'Điện thoại này phải ghép lại mới dùng được.', confirmText: 'Gỡ', destructive: true });
    if (!ok) return;
    revoke.mutate(d.id, { onSuccess: () => toast.success(`Đã gỡ ${d.name}`), onError: (e) => toast.error(e.message) });
  };

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <SectionTitle>Thiết bị</SectionTitle>
            <p className="text-sm text-muted-foreground">Điện thoại trong nhà phải ghép một lần mới dùng được. Máy quầy này luôn dùng được.</p>
          </div>
          <Button type="button" className="h-11 text-base" onClick={() => setPairing(true)}>
            <Plus data-icon="inline-start" />
            Ghép điện thoại
          </Button>
        </div>
        {!list?.length ? (
          <p className="text-sm text-muted-foreground">Chưa có điện thoại nào được ghép.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {list.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{d.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Ghép {dmy(d.createdAt)} · Dùng lần cuối {seen(d.lastSeenOn)}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Thao tác với ${d.name}`}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setRenaming(d)}>
                      <Pencil />
                      Đổi tên
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onSelect={() => void remove(d)}>
                      <Trash2 />
                      Gỡ
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )}
        <PairDialog open={pairing} onOpenChange={setPairing} devices={list} />
        <RenameDeviceDialog device={renaming} onClose={() => setRenaming(null)} />
      </CardContent>
    </Card>
  );
}
```

Đã kiểm: `DropdownMenuItem` có `variant="destructive"`. Mở hộp thoại từ `onSelect` theo đúng mẫu `client/src/pages/products/ProductTable.tsx:67` (menu ⋯ → *Lịch sử tồn*). Khi kiểm trên trình duyệt ở Task 7, đóng hộp đổi tên xong phải bấm được tiếp trên trang (không bị kẹt `pointer-events: none` trên `body`).

- [ ] **Step 5: Gắn vào `SettingsPage`**

Ngay sau dòng `import { BackupCard } from './BackupCard';` thêm:

```ts
import { DevicesCard } from './DevicesCard';
```

Ngay sau dòng `      <RemoteCard />` thêm:

```tsx
      <DevicesCard />
```

- [ ] **Step 6: Typecheck và build**

Run (gốc repo): `npm run typecheck` rồi `npm run build`
Expected: cả hai exit 0.

---

### Task 7: Kiểm trên trình duyệt, phiên bản, tài liệu, commit

**Files:**
- Modify: `package.json`, `client/package.json`, `server/package.json`, `shared/package.json`, `remote/package.json` (`"version": "0.16.0"`), `package-lock.json`
- Modify: `README.md`, `CLAUDE.md`, `.claude/rules/database.md`

- [ ] **Step 1: Lên version 0.16.0**

Ở 5 file `package.json`, sửa dòng `"version": "0.15.0",` thành `"version": "0.16.0",`. Rồi chạy (gốc repo, có `NODE_EXTRA_CA_CERTS`): `npm install --no-audit --no-fund` để `package-lock.json` cập nhật version các workspace.
Expected: `git diff package-lock.json` chỉ có các dòng version của 5 workspace và phần `input-otp` (đã thêm ở Task 5).

- [ ] **Step 2: Build và chạy server với DB tạm**

Run (gốc repo): `npm run build`
Rồi chạy nền: `DB_FILE=<scratchpad>/pair/grocery.db PORT=3099 node server/dist/index.js`
Expected: log in `LAN: http://<IP>:3099`; ghi lại IP đó.

- [ ] **Step 3: Kiểm trên trình duyệt (skill `browser-verify`, nhưng trỏ tới server 3099 ở trên; được phép ghi vì là DB tạm)**

1. Cỡ máy tính, `http://localhost:3099/settings`: vào thẳng app; thẻ *Thiết bị* ghi "Chưa có điện thoại nào được ghép" và có nút *Ghép điện thoại*.
2. Bấm *Ghép điện thoại*: hộp thoại có QR, mã `123 456`, "Còn 4:5x" đếm lùi, địa chỉ `http://<IP>:3099`. Ghi lại mã.
3. Hồ sơ trình duyệt thứ hai (context mới), cỡ điện thoại 390×844, `http://<IP>:3099/`: hiện `PairScreen`, không có sidebar hay thanh dưới, không cuộn ngang. Gõ sai `000000` → dòng đỏ "Mã không đúng, còn 4 lần thử", ô trống lại. Gõ đúng mã → vào app (Bán hàng). Trong khoảng 2 giây, hộp thoại ở máy quầy tự đóng và toast "Đã ghép …".
4. Máy quầy: danh sách có 1 dòng "… · Dùng lần cuối hôm nay". *Đổi tên* → "Điện thoại thử" → Enter → dòng đổi tên; nhấn Enter trong hộp đổi tên **không** lưu form cài đặt (không có toast "Đã lưu cài đặt").
5. Điện thoại: *Cài đặt* (qua *Thêm*) → thẻ *Thiết bị* chỉ ghi "Thiết bị này: Điện thoại thử…", không có nút ghép.
6. Máy quầy tạo mã mới; context thứ ba mở `http://<IP>:3099/pair?code=<mã>` → tự ghép, URL thành `/` (hoặc `/sell`), không còn `/pair`.
7. Máy quầy *Gỡ* "Điện thoại thử" → xác nhận. Ở context điện thoại bấm sang trang khác → hiện ngay `PairScreen`.
8. Trên `localhost`: `/pos` vẫn mở được.
9. Đổi giao diện tối ở máy quầy, mở lại hộp thoại ghép: QR vẫn nền trắng, chữ mã đọc rõ.

Chụp màn hình bước 2, 3 (cỡ điện thoại) và 4. Dừng server 3099 (chỉ kill đúng PID nghe cổng 3099), xóa thư mục DB tạm.

- [ ] **Step 4: README**

Trong mục *Chạy thật (production)*, thêm ngay sau gạch đầu dòng *Điện thoại cùng Wi-Fi*:

```markdown
- Ghép thiết bị: điện thoại (hay máy khác) trong Wi‑Fi lần đầu mở sẽ thấy màn *Điện thoại này chưa được ghép*. Trên máy quầy vào *Cài đặt → Thiết bị → Ghép điện thoại*, điện thoại quét mã QR (hoặc gõ mã 6 số, hết hạn sau 5 phút) là xong, từ đó không hỏi lại. Máy quầy luôn dùng được, không cần ghép. Mất điện thoại hay không dùng nữa: *Thiết bị* → ⋯ → *Gỡ*.
- **Giữ IP cố định cho máy quầy** (trong trang quản lý router: DHCP reservation / IP tĩnh theo MAC). Trình duyệt gắn việc ghép với đúng địa chỉ `http://<IP>:3000`; IP đổi thì điện thoại phải ghép lại và link đã lưu trên màn hình chính cũng hỏng.
- iPhone: app đã *Thêm vào màn hình chính* có bộ nhớ riêng với Safari, nên ghép lại một lần trong app đó bằng cách gõ mã 6 số.
```

Sửa dòng lưu ý `- Chỉ dùng trong mạng nhà. Không mở cổng 3000 ra Internet vì chưa có đăng nhập.` thành:

```markdown
- Chỉ dùng trong mạng nhà. Không mở cổng 3000 ra Internet: máy lạ trong Wi‑Fi đã bị chặn nhờ ghép thiết bị, nhưng app chạy HTTP thường, không có đăng nhập.
```

Cuối file thêm:

```markdown
## Kiểm thử thủ công – Ghép thiết bị 0.16.0

1. Máy quầy mở biểu tượng Tiny POS → dùng bình thường, không hỏi gì. *Cài đặt → Thiết bị*: "Chưa có điện thoại nào được ghép".
2. Điện thoại cùng Wi‑Fi mở `http://<IP máy>:3000` → màn *Điện thoại này chưa được ghép*.
3. Máy quầy *Ghép điện thoại* → QR, mã 6 số, đếm lùi 5 phút. Điện thoại gõ sai → "Mã không đúng, còn 4 lần thử"; sai 5 lần → "Mã đã hết hiệu lực…", máy quầy *Tạo mã mới*.
4. Điện thoại quét QR bằng camera → mở app, đã ghép; hộp thoại ở máy quầy tự đóng, báo "Đã ghép iPhone · Safari". Tắt mở lại trình duyệt điện thoại → không hỏi lại.
5. Máy quầy *Đổi tên* thành "Điện thoại chị Lan". Điện thoại vào *Cài đặt* → thẻ *Thiết bị* ghi đúng tên đó, không có nút ghép hay gỡ.
6. Máy quầy *Gỡ* → điện thoại bấm bất kỳ đâu → về màn ghép.
7. Sao lưu ngay → ghép thêm một máy → khôi phục bản vừa sao → danh sách thiết bị vẫn có máy vừa ghép.
8. Máy tính khác trong Wi‑Fi (chưa ghép) mở `http://<IP máy>:3000/api/products` → `{"error":"Thiết bị chưa được ghép",…}`.
```

- [ ] **Step 5: CLAUDE.md và rule database**

Trong `CLAUDE.md`, đoạn *Đã xong*, nối vào cuối câu (trước dấu `.` kết thúc đoạn, sau phần `…thanh Thanh toán điện thoại bám `--bottom-nav`)`):

```markdown
, Ghép thiết bị 0.16.0 (`middleware/device-gate.ts` chặn `/api` và `/images` với máy trong LAN chưa ghép; máy quầy = loopback + `Host` localhost; `services/devices.ts` mã 6 số trong bộ nhớ 5 phút, bảng `devices` giữ SHA‑256 token, cookie `tp_device`; `copyTables` bỏ qua `devices`; client `DeviceGate` + `PairScreen` + `/pair?code=`, thẻ *Thiết bị* trong Cài đặt)
```

Trong *Bất biến nghiệp vụ*, thêm gạch đầu dòng sau dòng **Xem từ xa**:

```markdown
- **Quyền truy cập trong LAN** chỉ qua `deviceGate` (`middleware/device-gate.ts`): máy quầy = `remoteAddress` loopback **và** `Host` là `localhost`/`127.0.0.1`/`[::1]`; máy khác cần cookie `tp_device` khớp bảng `devices` (DB chỉ giữ SHA‑256, không log token); chỉ máy quầy tạo mã/đổi tên/gỡ thiết bị; khôi phục bản sao không đụng bảng `devices`; không có công tắc tắt.
```

Sửa `DB dev đã chạy tới \`0006\`` thành `DB dev đã chạy tới \`0007\``.

Trong `.claude/rules/database.md`: `(\`0000\`–\`0006\`)` thành `(\`0000\`–\`0007\`)`, `tiếp theo là \`0007\`` thành `tiếp theo là \`0008\``. Thêm câu cuối mục *Migration và khôi phục bản sao cũ*: `Bảng thuộc máy chứ không thuộc dữ liệu tiệm (hiện có \`devices\`) nằm trong \`KEEP_TABLES\` của \`copyTables\`, khôi phục không xóa hay chép đè.`

- [ ] **Step 6: Chạy skill `check`**

Run: skill `check`.
Expected: typecheck exit 0; toàn bộ test pass (152 + 3 ở shared; 252 + test mới ở server); build OK. `git diff --stat` chỉ có các file trong *Cấu trúc file*; các file cũ (`app.ts`, `index.ts`, `routes/index.ts`, `backups.ts`, `main.tsx`, `RemoteCard.tsx`, `SettingsPage.tsx`, `schema.ts`, `common.ts`, `types.ts`) mỗi file đổi số dòng nhỏ đúng như các bước trên; hunk nào chỉ là format thì hoàn tác.

- [ ] **Step 7: Commit một lần**

```bash
git add shared/src server/src server/drizzle client/src client/package.json package.json package-lock.json server/package.json shared/package.json remote/package.json README.md CLAUDE.md .claude/rules/database.md
git status --short   # không còn file nào của đợt này chưa add; không có file lạ
git commit -m "feat: ghép thiết bị 0.16.0 – máy quầy luôn dùng được, điện thoại trong LAN ghép một lần bằng QR/mã 6 số, thẻ Thiết bị trong Cài đặt

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
