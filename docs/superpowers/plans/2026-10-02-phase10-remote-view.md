# Giai đoạn 10 – Xem từ xa qua Firebase (0.14.0) – Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chủ tiệm ở ngoài tiệm mở điện thoại (mạng khác) đăng nhập Google là thấy đúng nội dung trang *Tổng quan* của máy quầy, trễ ≤ ~1 phút, kèm cảnh báo khi máy quầy ngừng gửi; chỉ email được phép mới xem được; máy quầy không bao giờ bị chặn vì mất Internet.

**Architecture:** Một chiều. Server tiny-pos có `services/remote-sync.ts`: vòng 60 s theo mẫu `backup-scheduler.ts`, khi DB đổi (mtime `.db`/`-wal`) hoặc sang ngày mới thì tính `overview(db)` + `backupSummary` và `set` đè tài liệu Firestore `remote/overview` bằng Firebase Admin SDK (khóa ở `data/remote/service-account.json`, `import()` động). Danh sách email được xem ghi ở `remote/access`; rules Firestore chỉ cho email trong đó đọc `remote/overview`. Workspace mới `remote/` là trang React nhỏ trên Firebase Hosting: đăng nhập Google, `onSnapshot` tài liệu, vẽ lại 8 khối Tổng quan chỉ đọc. Cấu hình tính năng lưu hai khóa trong bảng `settings`, API riêng `/api/remote`, thẻ *Xem từ xa* trong Cài đặt.

**Tech Stack:** TypeScript ESM, Express 5, drizzle-orm + better-sqlite3, vitest, zod 4, `firebase-admin` (server), React 19 + Vite 7 + Tailwind v4 + shadcn/ui + lucide-react (client và `remote/`), SDK web `firebase` (auth + firestore), `firebase-tools` (deploy), `qrcode` (đã có ở client).

**Spec:** `docs/superpowers/specs/2026-10-02-tiny-pos-remote-view-design.md`

## Global Constraints

- Text UI, thông báo lỗi API, comment code, commit message: **tiếng Việt**.
- **Không format lại file có sẵn**: diff chỉ chứa dòng cần đổi; không chạy prettier/eslint lên file cũ; theo phong cách xung quanh (2 space, nháy đơn, có `;`, dòng ≤ ~130 ký tự). Thêm tên vào dòng import có sẵn là được, không sắp xếp lại import. File shadcn copy sang `remote/` giữ nguyên nội dung gốc (nháy kép, không `;`).
- **Git**: làm trên `master`, **không commit từng task**; cả đợt là **một commit** ở Task 8: `feat: xem từ xa 0.14.0 – đẩy Tổng quan lên Firestore một chiều, thẻ Xem từ xa trong Cài đặt, trang remote/ đăng nhập Google trên Firebase Hosting`.
- **Không đổi schema, không migration.** Cấu hình lưu bằng hai khóa `remoteEnabled` (`'0'`/`'1'`) và `remoteEmails` (JSON mảng) trong bảng `settings`, chỉ `remote-sync.ts` đọc ghi. **Không** sửa `settingsInputSchema`.
- **Một chiều**: server chỉ `set`/`delete` Firestore, không đọc. Trang xem không ghi gì. Mọi bất biến tồn kho / công nợ / chứng từ không chạm.
- Tài liệu Firestore: `remote/overview` = `{ storeName, updatedAt (ISO), appVersion, data: Overview }` ghi đè bằng `set` (không merge), `remote/access` = `{ emails: string[] }`. Email lưu **trim + chữ thường + bỏ trùng**, tối đa `REMOTE_MAX_EMAILS` = 5.
- Đẩy khi: chưa đẩy lần nào trong phiên, hoặc mtime `.db`/`-wal` > thời điểm đẩy trước, hoặc ngày địa phương đổi. Mỗi lệnh Firestore có **timeout 30 s**; không chạy chồng (`busy`). Lỗi → `lastError`, không ném ra ngoài `tick`.
- Khóa Firebase ở `data/remote/service-account.json`, **không** vào DB, không vào git; `remote/.firebaserc`, `remote/.env.local`, `remote/.firebase/` vào `.gitignore`.
- `firebase-admin` chỉ `import()` động trong `services/remote-writer.ts`; test không bao giờ tải nó (tiêm `RemoteWriter` giả).
- `remote/` **không import** gì từ `client/`; `npm run build` gốc và `scripts/install.cmd` **không** build `remote/`; `npm run typecheck` gốc gồm `remote/`.
- UI client dùng component có sẵn (`Card`, `Switch`, `Button`, `Badge`, `TextField`, `SectionTitle`), icon lucide, màu từ token (`text-warning`, `text-destructive`, `text-success`). Không mã màu trong trang.
- Mạng công ty chặn TLS: lệnh npm/npx cần `NODE_EXTRA_CA_CERTS=<repo>/.certs/corp-root.pem`; **không bao giờ** tắt kiểm tra TLS.
- Không dùng/kill cổng 5173/5174. Kiểm trên trình duyệt **không ghi** vào `data/grocery.db` (skill `browser-verify`).
- Chạy test/typecheck từ **gốc repo** (`npm test`, `npm run typecheck`) để `shared` được build trước. Một file server: `npm run build -w shared` (nếu vừa sửa shared) rồi `cd server && npx vitest run <file>`.

## Review Focus

1. **Máy quầy mất Internet, Admin SDK treo thay vì lỗi ngay** → lệnh Firestore quá 30 s thành lỗi "Không kết nối được Firebase (quá 30 giây)", `tick` kế tiếp không chạy chồng lên lệnh đang treo → test timeout + test `busy` ở Task 3.
2. **Khôi phục bản sao lưu có danh sách email khác** (settings đổi mà không qua `PUT /api/remote`) → lần đẩy kế tiếp ghi lại `remote/access` vì JSON email khác lần đã đồng bộ → test "emails đổi trong DB → setAccess lại" ở Task 3.
3. **Chủ tiệm gõ email trên điện thoại có hoa, có khoảng trắng, gõ hai lần** (`" ChuTiem@Gmail.com "`) → lưu một bản `chutiem@gmail.com`, khớp email trong token Google → test chuẩn hóa + bỏ trùng ở Task 1.
4. **Đổi file khóa sang project khác khi server đang chạy** → `status()` trả `projectId`/`url` mới, writer cũ được đóng và writer mới tạo từ file mới, không ghi nhầm project cũ → test "mtime file khóa đổi → factory gọi lại, close writer cũ" ở Task 3.
5. **Bật tính năng khi danh sách email rỗng** → server vẫn đẩy và ghi `remote/access` = `[]` (không ai đọc được, không lỗi); thẻ Cài đặt hiện dòng `warning` để chủ tiệm hiểu vì sao điện thoại bị từ chối → test `save({enabled:true, emails:[]})` ở Task 3, kiểm dòng cảnh báo bằng trình duyệt ở Task 5.

---

## Cấu trúc file

| File | Việc |
|---|---|
| `shared/src/schemas/remote.ts` (mới) + `remote.test.ts` (mới) | `REMOTE_MAX_EMAILS`, `REMOTE_STALE_MS`, `remoteConfigInputSchema`, `RemoteConfigInput` |
| `shared/src/types.ts`, `schemas/common.ts`, `index.ts` (sửa) | `RemoteStatus`, `RemoteOverviewDoc`, nhãn `emails`, export |
| `server/src/services/overview.ts` (sửa), `routes/overview.ts` (sửa) | chuyển `backupSummary` vào service, export |
| `server/src/services/remote-sync.ts` (mới) + `remote-sync.test.ts` (mới) | `RemoteWriter`, `createRemoteSync`: status / save / push / tick / start / stop |
| `server/src/services/remote-writer.ts` (mới) | `createFirebaseWriter` – writer thật bằng `firebase-admin` (import động) |
| `server/src/routes/remote.ts` (mới) + `remote-api.test.ts` (mới) | `GET/PUT /api/remote`, `POST /api/remote/push` |
| `server/src/routes/index.ts`, `app.ts`, `index.ts` (sửa) | nối `remote` như `backups` |
| `client/src/api/remote.ts` (mới) | `useRemoteStatus`, `useSaveRemote`, `usePushRemote` |
| `client/src/pages/settings/RemoteCard.tsx` (mới), `SettingsPage.tsx` (sửa) | thẻ *Xem từ xa* |
| `remote/` (mới, workspace) | `package.json`, `tsconfig.json`, `vite.config.ts`, `firebase.json`, `firestore.rules`, `index.html`, `public/`, `src/` |
| `package.json` gốc, `.gitignore`, `README.md`, `CLAUDE.md`, 4 `package.json` workspace (sửa) | workspace mới, version 0.14.0, tài liệu |

---

### Task 1: Shared – schema và kiểu dữ liệu xem từ xa

**Files:**
- Create: `shared/src/schemas/remote.ts`
- Create: `shared/src/schemas/remote.test.ts`
- Modify: `shared/src/types.ts` (cuối file)
- Modify: `shared/src/schemas/common.ts` (`FIELD_LABELS`)
- Modify: `shared/src/index.ts` (thêm một dòng export)

**Interfaces:**
- Produces: `REMOTE_MAX_EMAILS: 5`, `REMOTE_STALE_MS: 600000`, `remoteConfigInputSchema` (zod; output `{ enabled: boolean; emails: string[] }` đã trim/chữ thường/bỏ trùng), `RemoteConfigInput`, `RemoteStatus`, `RemoteOverviewDoc` – mọi task sau dùng đúng tên này.

- [ ] **Step 1: Viết test schema**

`shared/src/schemas/remote.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { REMOTE_MAX_EMAILS, remoteConfigInputSchema } from './remote.js';

describe('remoteConfigInputSchema', () => {
  it('trim, chữ thường, bỏ trùng', () => {
    const r = remoteConfigInputSchema.parse({ enabled: true, emails: [' ChuTiem@Gmail.com ', 'chutiem@gmail.com', 'Vo@Example.vn'] });
    expect(r).toEqual({ enabled: true, emails: ['chutiem@gmail.com', 'vo@example.vn'] });
  });

  it('danh sách rỗng hợp lệ (bật mà chưa ai được xem)', () => {
    expect(remoteConfigInputSchema.parse({ enabled: true, emails: [] })).toEqual({ enabled: true, emails: [] });
  });

  it('email sai định dạng → lỗi tại emails', () => {
    const r = remoteConfigInputSchema.safeParse({ enabled: false, emails: ['khong-phai-email'] });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.path).toEqual(['emails']);
      expect(r.error.issues[0]?.message).toBe('có địa chỉ không hợp lệ');
    }
  });

  it(`quá ${REMOTE_MAX_EMAILS} email → lỗi`, () => {
    const emails = Array.from({ length: REMOTE_MAX_EMAILS + 1 }, (_, i) => `a${i}@x.vn`);
    expect(remoteConfigInputSchema.safeParse({ enabled: true, emails }).success).toBe(false);
  });

  it('thiếu enabled → lỗi', () => {
    expect(remoteConfigInputSchema.safeParse({ emails: [] }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `cd shared && npx vitest run src/schemas/remote.test.ts`
Expected: FAIL – `Cannot find module './remote.js'`.

- [ ] **Step 3: Viết schema**

`shared/src/schemas/remote.ts`:

```ts
import { z } from 'zod';

/** Số email tối đa được xem từ xa (một tiệm: chủ và vài người nhà). */
export const REMOTE_MAX_EMAILS = 5;
/** Quá khoảng này chưa có bản đẩy mới thì trang xem cảnh báo máy quầy có thể đang tắt / mất mạng. */
export const REMOTE_STALE_MS = 10 * 60_000;

const email = z.email();

/**
 * PUT /api/remote. Email trim + chữ thường (token Google trả chữ thường), trùng sau chuẩn hóa thì bỏ bớt.
 * Kiểm định dạng ở mức mảng để lỗi nằm ở path `emails` (có nhãn), không phải `emails.0`.
 */
export const remoteConfigInputSchema = z.object({
  enabled: z.boolean(),
  emails: z
    .array(z.string().trim().toLowerCase())
    .max(REMOTE_MAX_EMAILS, `tối đa ${REMOTE_MAX_EMAILS} email`)
    .refine((a) => a.every((e) => email.safeParse(e).success), 'có địa chỉ không hợp lệ')
    .transform((a) => [...new Set(a)]),
});
export type RemoteConfigInput = z.output<typeof remoteConfigInputSchema>;
```

- [ ] **Step 4: Thêm kiểu vào `shared/src/types.ts`** (thêm vào cuối file, sau kiểu cuối cùng hiện có)

```ts

/** Trạng thái Xem từ xa (GET /api/remote). `configured` = có file khóa data/remote/service-account.json. */
export interface RemoteStatus {
  configured: boolean;
  /** `project_id` trong file khóa; null khi chưa có / file hỏng. */
  projectId: string | null;
  /** https://<projectId>.web.app */
  url: string | null;
  enabled: boolean;
  emails: string[];
  /** Lần đẩy thành công gần nhất trong phiên server; null khi chưa đẩy. */
  lastPushAt: string | null;
  lastError: string | null;
}

/** Tài liệu Firestore remote/overview: server ghi, trang remote/ đọc. */
export interface RemoteOverviewDoc {
  storeName: string;
  /** ISO, theo đồng hồ server lúc đẩy. */
  updatedAt: string;
  appVersion: string;
  data: Overview;
}
```

- [ ] **Step 5: Nhãn trường và export**

Trong `shared/src/schemas/common.ts`, tìm object `FIELD_LABELS` và thêm một dòng (giữ thứ tự/định dạng của các dòng xung quanh):

```ts
  emails: 'Email được xem',
```

Trong `shared/src/index.ts`, sau dòng `export * from './schemas/label.js';` thêm:

```ts
export * from './schemas/remote.js';
```

- [ ] **Step 6: Chạy test, typecheck shared**

Run: `cd shared && npx vitest run src/schemas/remote.test.ts && npm run typecheck`
Expected: 5 test PASS; typecheck không lỗi.

- [ ] **Step 7: Build shared để server/client thấy kiểu mới**

Run: `npm run build -w shared`
Expected: không lỗi, `shared/dist/schemas/remote.js` tồn tại.

---

### Task 2: Server – chuyển `backupSummary` vào service Tổng quan

**Files:**
- Modify: `server/src/services/overview.ts`
- Modify: `server/src/routes/overview.ts`

**Interfaces:**
- Produces: `backupSummary(backups: BackupService): OverviewBackup` export từ `services/overview.ts` – Task 3 dùng.

- [ ] **Step 1: Thêm hàm vào `services/overview.ts`**

Thêm import (thêm vào dòng import type từ `@tiny-pos/shared` hiện có: `type OverviewBackup,`) và import type `BackupService`:

```ts
import type { BackupService } from './backups.js';
```

Thêm hàm ngay trước `export function overview(`:

```ts
/** Phần sao lưu của Tổng quan: bản mới nhất bất kỳ loại nào + lỗi gần nhất. Route và remote-sync dùng chung. */
export function backupSummary(backups: BackupService): OverviewBackup {
  const s = backups.status();
  return { lastBackupAt: s.items[0]?.createdAt ?? null, lastAutoAt: s.lastAutoAt, lastError: s.lastError, extraError: s.extraError };
}
```

- [ ] **Step 2: Route dùng lại**

`server/src/routes/overview.ts` thành:

```ts
import { Router } from 'express';
import type { Db } from '../db/connection.js';
import type { BackupService } from '../services/backups.js';
import { backupSummary, overview } from '../services/overview.js';

/** Tổng quan chỉ đọc, không query; `backup` null khi server không cấu hình sao lưu (test). */
export function overviewRouter(db: Db, backups?: BackupService): Router {
  const r = Router();
  r.get('/', (_req, res) => res.json({ ...overview(db), backup: backups ? backupSummary(backups) : null }));
  return r;
}
```

- [ ] **Step 3: Chạy test overview**

Run: `cd server && npx vitest run src/routes/overview-api.test.ts src/services/overview.test.ts`
Expected: PASS như trước.

---

### Task 3: Server – `services/remote-sync.ts` và writer thật

**Files:**
- Create: `server/src/services/remote-sync.ts`
- Create: `server/src/services/remote-sync.test.ts`
- Create: `server/src/services/remote-writer.ts`
- Modify: `server/package.json` (thêm `firebase-admin`)

**Interfaces:**
- Consumes: `overview`, `backupSummary` (Task 2); `getSettings` (`services/settings.ts`); `resolveClock`, `Clock` (`services/daily-code.ts`); `BadRequestError`, `HttpError` (`errors.ts`); kiểu Task 1.
- Produces:
  ```ts
  export interface RemoteWriter {
    setOverview(doc: RemoteOverviewDoc): Promise<void>;
    deleteOverview(): Promise<void>;
    setAccess(emails: string[]): Promise<void>;
    close?(): Promise<void>;
  }
  export type RemoteWriterFactory = (keyFile: string) => Promise<RemoteWriter>;
  export interface RemoteSync {
    status(): RemoteStatus;
    save(input: RemoteConfigInput): Promise<RemoteStatus>;
    push(): Promise<RemoteStatus>;
    tick(now?: Date): Promise<void>;
    start(): void;
    stop(): void;
  }
  export function createRemoteSync(o: RemoteSyncOpts): RemoteSync;
  export function createFirebaseWriter(keyFile: string): Promise<RemoteWriter>;  // remote-writer.ts
  ```

- [ ] **Step 1: Cài `firebase-admin` cho server**

Run (từ gốc repo): `npm install firebase-admin -w server`
Expected: `server/package.json` có `"firebase-admin"` trong `dependencies`; `package-lock.json` đổi. Lỗi TLS → đặt `NODE_EXTRA_CA_CERTS` rồi chạy lại.

- [ ] **Step 2: Viết test service**

`server/src/services/remote-sync.test.ts`:

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RemoteOverviewDoc } from '@tiny-pos/shared';
import { createTestDb } from '../db/test-db.js';
import type { Db } from '../db/connection.js';
import { HttpError } from '../errors.js';
import { createRemoteSync, type RemoteSync, type RemoteWriter } from './remote-sync.js';
import { saveSettings, getSettings } from './settings.js';

const NOW = new Date('2026-10-02T03:00:00Z'); // 10:00 giờ VN
const TZ = 420;
const DAY = 86_400_000;

interface Fake extends RemoteWriter {
  overviews: RemoteOverviewDoc[];
  access: string[][];
  deletes: number;
  closes: number;
  fail: Error | null;
  hang: boolean;
}
function fakeWriter(): Fake {
  const f: Fake = {
    overviews: [],
    access: [],
    deletes: 0,
    closes: 0,
    fail: null,
    hang: false,
    async setOverview(doc) {
      if (f.hang) return new Promise(() => undefined);
      if (f.fail) throw f.fail;
      f.overviews.push(doc);
    },
    async deleteOverview() {
      if (f.fail) throw f.fail;
      f.deletes++;
    },
    async setAccess(emails) {
      if (f.fail) throw f.fail;
      f.access.push(emails);
    },
    async close() {
      f.closes++;
    },
  };
  return f;
}

let root: string;
let db: Db;
let keyFile: string;
let dbFile: string;
let writer: Fake;
let factoryCalls = 0;
const touch = (file: string, at: Date) => fs.utimesSync(file, at, at);
const writeKey = (projectId = 'tiem-abc') => fs.writeFileSync(keyFile, JSON.stringify({ type: 'service_account', project_id: projectId }));

function make(over: Partial<Parameters<typeof createRemoteSync>[0]> = {}): RemoteSync {
  return createRemoteSync({
    db,
    keyFile,
    dbFile,
    appVersion: '0.14.0',
    writer: async () => {
      factoryCalls++;
      return writer;
    },
    clock: { now: NOW, tzOffsetMin: TZ },
    timeoutMs: 50,
    log: () => undefined,
    ...over,
  });
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'tiny-pos-remote-'));
  keyFile = path.join(root, 'service-account.json');
  dbFile = path.join(root, 'grocery.db');
  fs.writeFileSync(dbFile, '');
  touch(dbFile, new Date(NOW.getTime() - 60_000));
  db = createTestDb();
  writer = fakeWriter();
  factoryCalls = 0;
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('status', () => {
  it('chưa có file khóa → configured false, tắt, không email', () => {
    expect(make().status()).toEqual({ configured: false, projectId: null, url: null, enabled: false, emails: [], lastPushAt: null, lastError: null });
  });

  it('có file khóa → projectId và url; file hỏng → configured false + lastError', () => {
    writeKey('tiem-xyz');
    expect(make().status()).toMatchObject({ configured: true, projectId: 'tiem-xyz', url: 'https://tiem-xyz.web.app' });
    fs.writeFileSync(keyFile, '{ hong');
    touch(keyFile, new Date(NOW.getTime() + 1000));
    expect(make().status()).toMatchObject({ configured: false, projectId: null, lastError: 'File khóa Firebase không đọc được' });
    fs.writeFileSync(keyFile, JSON.stringify({ type: 'service_account' }));
    touch(keyFile, new Date(NOW.getTime() + 2000));
    expect(make().status()).toMatchObject({ configured: false, lastError: 'File khóa Firebase không đúng định dạng (thiếu project_id)' });
  });

  it('kiểm file mỗi lần gọi: chép file vào sau khi khởi động là nhận', () => {
    const s = make();
    expect(s.status().configured).toBe(false);
    writeKey();
    expect(s.status().configured).toBe(true);
  });
});

describe('save', () => {
  it('bật khi chưa có file khóa → 400', async () => {
    await expect(make().save({ enabled: true, emails: [] })).rejects.toMatchObject({ status: 400, message: 'Chưa có file khóa Firebase' });
  });

  it('bật: lưu settings, ghi access rồi overview; status phản ánh', async () => {
    writeKey();
    const s = make();
    const st = await s.save({ enabled: true, emails: ['a@x.vn', 'b@x.vn'] });
    expect(writer.access).toEqual([['a@x.vn', 'b@x.vn']]);
    expect(writer.overviews).toHaveLength(1);
    expect(st).toMatchObject({ enabled: true, emails: ['a@x.vn', 'b@x.vn'], lastPushAt: NOW.toISOString(), lastError: null });
    // Lưu vào bảng settings, service khác tạo lại vẫn đọc được
    expect(make().status()).toMatchObject({ enabled: true, emails: ['a@x.vn', 'b@x.vn'] });
  });

  it('bật với email rỗng: vẫn đẩy, access = []', async () => {
    writeKey();
    await make().save({ enabled: true, emails: [] });
    expect(writer.access).toEqual([[]]);
    expect(writer.overviews).toHaveLength(1);
  });

  it('tắt: xóa overview, giữ email; tick sau đó không đẩy', async () => {
    writeKey();
    const s = make();
    await s.save({ enabled: true, emails: ['a@x.vn'] });
    const st = await s.save({ enabled: false, emails: ['a@x.vn'] });
    expect(writer.deletes).toBe(1);
    expect(st).toMatchObject({ enabled: false, emails: ['a@x.vn'] });
    await s.tick(new Date(NOW.getTime() + 60_000));
    expect(writer.overviews).toHaveLength(1);
  });

  it('bật nhưng Firebase lỗi: vẫn lưu cấu hình, trả 200 với lastError', async () => {
    writeKey();
    writer.fail = new Error('getaddrinfo ENOTFOUND firestore.googleapis.com');
    const st = await make().save({ enabled: true, emails: ['a@x.vn'] });
    expect(st).toMatchObject({ enabled: true, lastError: 'Không kết nối được Firebase', lastPushAt: null });
  });
});

describe('tick', () => {
  it('không bật → không gọi writer, không tạo writer', async () => {
    writeKey();
    await make().tick();
    expect(factoryCalls).toBe(0);
  });

  it('lần đầu đẩy kèm access; DB không đổi cùng ngày → không đẩy; WAL đổi → đẩy; sang ngày → đẩy', async () => {
    writeKey();
    const s = make();
    await s.save({ enabled: true, emails: ['a@x.vn'] });
    writer.overviews = [];
    writer.access = [];
    const s2 = make(); // phiên mới (server khởi động lại): chưa đẩy lần nào → đẩy ngay và ghi lại access
    await s2.tick(NOW);
    expect(writer.overviews).toHaveLength(1);
    expect(writer.access).toEqual([['a@x.vn']]);

    await s2.tick(new Date(NOW.getTime() + 60_000));
    expect(writer.overviews).toHaveLength(1);

    fs.writeFileSync(`${dbFile}-wal`, '');
    touch(`${dbFile}-wal`, new Date(NOW.getTime() + 30_000));
    await s2.tick(new Date(NOW.getTime() + 60_000));
    expect(writer.overviews).toHaveLength(2);
    expect(writer.access).toHaveLength(1); // email không đổi thì không ghi lại

    touch(`${dbFile}-wal`, new Date(NOW.getTime() - 60_000));
    touch(dbFile, new Date(NOW.getTime() - 60_000));
    await s2.tick(new Date(NOW.getTime() + DAY));
    expect(writer.overviews).toHaveLength(3);
    expect(writer.overviews[2]?.data.today).toBe('2026-10-03');
  });

  it('tài liệu: storeName từ settings, updatedAt theo clock, appVersion, data = overview + backup null', async () => {
    writeKey();
    saveSettings(db, { ...getSettings(db), storeName: 'Tạp hóa Cô Ba' });
    const s = make();
    await s.save({ enabled: true, emails: [] });
    const doc = writer.overviews[0]!;
    expect(doc.storeName).toBe('Tạp hóa Cô Ba');
    expect(doc.updatedAt).toBe(NOW.toISOString());
    expect(doc.appVersion).toBe('0.14.0');
    expect(doc.data.today).toBe('2026-10-02');
    expect(doc.data.week.rows).toHaveLength(7);
    expect(doc.data.backup).toBeNull();
    expect(JSON.stringify(doc)).not.toContain('undefined');
  });

  it('writer lỗi → lastError, không ném; lần sau ổn → hết lỗi', async () => {
    writeKey();
    const s = make();
    await s.save({ enabled: true, emails: [] });
    writer.fail = new Error('7 PERMISSION_DENIED: Missing or insufficient permissions');
    touch(dbFile, new Date(NOW.getTime() + 10_000));
    await s.tick(new Date(NOW.getTime() + 60_000));
    expect(s.status().lastError).toBe('Lỗi Firebase: 7 PERMISSION_DENIED: Missing or insufficient permissions');
    writer.fail = null;
    await s.tick(new Date(NOW.getTime() + 120_000));
    expect(s.status().lastError).toBeNull();
    expect(s.status().lastPushAt).toBe(new Date(NOW.getTime() + 120_000).toISOString());
  });

  it('lệnh treo quá timeout → lỗi "quá N giây"; tick chồng khi đang bận thì bỏ qua', async () => {
    writeKey();
    const s = make();
    await s.save({ enabled: true, emails: [] });
    writer.hang = true;
    touch(dbFile, new Date(NOW.getTime() + 10_000));
    const first = s.tick(new Date(NOW.getTime() + 60_000));
    await s.tick(new Date(NOW.getTime() + 61_000)); // đang bận → về ngay
    await first;
    expect(s.status().lastError).toBe('Không kết nối được Firebase (quá 0 giây)');
  });

  it('email đổi trong DB (khôi phục bản sao) → lần đẩy sau ghi lại access', async () => {
    writeKey();
    const s = make();
    await s.save({ enabled: true, emails: ['a@x.vn'] });
    // Giả lập khôi phục: ghi thẳng khóa settings bằng service khác
    await make().save({ enabled: true, emails: ['b@x.vn'] });
    writer.access = [];
    touch(dbFile, new Date(NOW.getTime() + 10_000));
    await s.tick(new Date(NOW.getTime() + 60_000));
    expect(writer.access).toEqual([['b@x.vn']]);
  });

  it('file khóa đổi (mtime) → đóng writer cũ, tạo writer mới, status đổi project', async () => {
    writeKey('tiem-1');
    const s = make();
    await s.save({ enabled: true, emails: [] });
    expect(factoryCalls).toBe(1);
    writeKey('tiem-2');
    touch(keyFile, new Date(NOW.getTime() + 5000));
    touch(dbFile, new Date(NOW.getTime() + 10_000));
    await s.tick(new Date(NOW.getTime() + 60_000));
    expect(factoryCalls).toBe(2);
    expect(writer.closes).toBe(1);
    expect(s.status().projectId).toBe('tiem-2');
  });
});

describe('push', () => {
  it('đang tắt → 400; chưa có file → 400; writer lỗi → 502 kèm lý do', async () => {
    const s = make();
    await expect(s.push()).rejects.toMatchObject({ status: 400, message: 'Xem từ xa đang tắt' });
    writeKey();
    await s.save({ enabled: true, emails: [] });
    fs.rmSync(keyFile);
    await expect(s.push()).rejects.toMatchObject({ status: 400, message: 'Chưa có file khóa Firebase' });
    writeKey();
    writer.fail = new Error('14 UNAVAILABLE: No connection established');
    const err = await s.push().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect(err).toMatchObject({ status: 502, message: 'Không gửi được: Không kết nối được Firebase' });
    expect(s.status().lastError).toBe('Không kết nối được Firebase');
  });

  it('thành công → status mới, bỏ qua điều kiện mtime', async () => {
    writeKey();
    const s = make();
    await s.save({ enabled: true, emails: [] });
    const st = await s.push();
    expect(writer.overviews).toHaveLength(2);
    expect(st.lastError).toBeNull();
  });
});
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `cd server && npx vitest run src/services/remote-sync.test.ts`
Expected: FAIL – `Cannot find module './remote-sync.js'`.

- [ ] **Step 4: Viết `services/remote-sync.ts`**

```ts
import fs from 'node:fs';
import { inArray } from 'drizzle-orm';
import { localDate, type RemoteConfigInput, type RemoteOverviewDoc, type RemoteStatus } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { settings } from '../db/schema.js';
import { BadRequestError, HttpError } from '../errors.js';
import type { BackupService } from './backups.js';
import { resolveClock, type Clock } from './daily-code.js';
import { backupSummary, overview } from './overview.js';
import { getSettings } from './settings.js';

/** Phần ghi Firestore, tách ra để test tiêm bản giả; bản thật ở remote-writer.ts. */
export interface RemoteWriter {
  setOverview(doc: RemoteOverviewDoc): Promise<void>;
  deleteOverview(): Promise<void>;
  setAccess(emails: string[]): Promise<void>;
  /** Đóng kết nối khi đổi file khóa. */
  close?(): Promise<void>;
}
export type RemoteWriterFactory = (keyFile: string) => Promise<RemoteWriter>;

export interface RemoteSyncOpts {
  db: Db;
  /** data/remote/service-account.json */
  keyFile: string;
  /** grocery.db, để so mtime (kèm -wal). */
  dbFile: string;
  backups?: BackupService;
  appVersion: string;
  writer: RemoteWriterFactory;
  /** Mặc định 60 s. */
  intervalMs?: number;
  /** Mỗi lệnh Firestore; mặc định 30 s. SDK offline có thể treo rất lâu thay vì lỗi. */
  timeoutMs?: number;
  clock?: Clock;
  log?: (s: string) => void;
}

export interface RemoteSync {
  status(): RemoteStatus;
  /** Lưu cấu hình; bật → ghi access + đẩy ngay; tắt → xóa tài liệu. Lỗi Firebase vào lastError, không ném. */
  save(input: RemoteConfigInput): Promise<RemoteStatus>;
  /** Đẩy ngay (nút Gửi ngay), bỏ qua điều kiện mtime/ngày. 400 nếu tắt/chưa có khóa, 502 nếu Firebase lỗi. */
  push(): Promise<RemoteStatus>;
  /** Vòng lặp: kiểm điều kiện rồi đẩy; nuốt mọi lỗi vào lastError. */
  tick(now?: Date): Promise<void>;
  start(): void;
  stop(): void;
}

const ENABLED_KEY = 'remoteEnabled';
const EMAILS_KEY = 'remoteEmails';
const NO_KEY = 'Chưa có file khóa Firebase';

const mtime = (file: string): number => {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return 0;
  }
};

interface KeyInfo {
  projectId: string | null;
  error: string | null;
  mtime: number;
}
/** Đọc project_id từ file khóa; không có file → không lỗi (chỉ là chưa cài). */
function readKey(keyFile: string): KeyInfo {
  const at = mtime(keyFile);
  if (!at) return { projectId: null, error: null, mtime: 0 };
  try {
    const json = JSON.parse(fs.readFileSync(keyFile, 'utf8')) as { project_id?: unknown };
    if (typeof json.project_id !== 'string' || !json.project_id)
      return { projectId: null, error: 'File khóa Firebase không đúng định dạng (thiếu project_id)', mtime: at };
    return { projectId: json.project_id, error: null, mtime: at };
  } catch {
    return { projectId: null, error: 'File khóa Firebase không đọc được', mtime: at };
  }
}

interface Config {
  enabled: boolean;
  emails: string[];
}
function readConfig(db: Db): Config {
  const rows = db.select().from(settings).where(inArray(settings.key, [ENABLED_KEY, EMAILS_KEY])).all();
  const raw = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  let emails: string[] = [];
  try {
    const parsed: unknown = JSON.parse(raw[EMAILS_KEY] ?? '[]');
    if (Array.isArray(parsed)) emails = parsed.filter((e): e is string => typeof e === 'string');
  } catch {
    /* giá trị hỏng coi như rỗng */
  }
  return { enabled: raw[ENABLED_KEY] === '1', emails };
}
function writeConfig(db: Db, c: Config): void {
  db.transaction((tx) => {
    for (const [key, value] of [
      [ENABLED_KEY, c.enabled ? '1' : '0'],
      [EMAILS_KEY, JSON.stringify(c.emails)],
    ] as const) {
      tx.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } }).run();
    }
  });
}

class TimeoutError extends Error {}
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new TimeoutError(`Không kết nối được Firebase (quá ${Math.round(ms / 1000)} giây)`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** Lỗi mạng (gRPC UNAVAILABLE/DEADLINE, DNS, TCP) thành một câu tiếng Việt; còn lại giữ message SDK để biết đường sửa. */
function describeError(e: unknown): string {
  if (e instanceof TimeoutError) return e.message;
  const message = e instanceof Error ? e.message : String(e);
  if (/UNAVAILABLE|DEADLINE_EXCEEDED|ENOTFOUND|ECONN|EAI_AGAIN|ETIMEDOUT|getaddrinfo/i.test(message)) return 'Không kết nối được Firebase';
  return `Lỗi Firebase: ${message}`;
}

export function createRemoteSync(o: RemoteSyncOpts): RemoteSync {
  const log = o.log ?? console.log;
  const timeoutMs = o.timeoutMs ?? 30_000;
  let lastPushAt: string | null = null;
  let lastError: string | null = null;
  let busy = false;
  let writer: RemoteWriter | null = null;
  let writerMtime = 0;
  /** JSON danh sách email đã ghi lên remote/access bằng writer hiện tại; null = chưa ghi. */
  let syncedAccess: string | null = null;

  const getWriter = async (): Promise<RemoteWriter> => {
    const key = readKey(o.keyFile);
    if (!key.projectId) throw new Error(key.error ?? NO_KEY);
    if (writer && writerMtime === key.mtime) return writer;
    if (writer) await writer.close?.().catch(() => undefined);
    writer = await o.writer(o.keyFile);
    writerMtime = key.mtime;
    syncedAccess = null;
    return writer;
  };

  const buildDoc = (at: Date): RemoteOverviewDoc => {
    const clock: Clock = { ...o.clock, now: at };
    const data = { ...overview(o.db, clock), backup: o.backups ? backupSummary(o.backups) : null };
    // Firestore không nhận undefined; Overview hiện chỉ có null nhưng chặn cho chắc
    return { storeName: getSettings(o.db).storeName, updatedAt: at.toISOString(), appVersion: o.appVersion, data: JSON.parse(JSON.stringify(data)) };
  };

  /** Đẩy thật: access (nếu đổi) rồi overview. Ném lỗi để nơi gọi quyết định. */
  const doPush = async (at: Date): Promise<void> => {
    busy = true;
    try {
      const w = await getWriter();
      const emails = readConfig(o.db).emails;
      const accessJson = JSON.stringify(emails);
      if (accessJson !== syncedAccess) {
        await withTimeout(w.setAccess(emails), timeoutMs);
        syncedAccess = accessJson;
      }
      await withTimeout(w.setOverview(buildDoc(at)), timeoutMs);
      lastPushAt = at.toISOString();
      lastError = null;
    } finally {
      busy = false;
    }
  };

  const status = (): RemoteStatus => {
    const key = readKey(o.keyFile);
    const c = readConfig(o.db);
    return {
      configured: key.projectId !== null,
      projectId: key.projectId,
      url: key.projectId ? `https://${key.projectId}.web.app` : null,
      enabled: c.enabled,
      emails: c.emails,
      lastPushAt,
      lastError: lastError ?? key.error,
    };
  };

  const tick = async (now?: Date): Promise<void> => {
    // Mọi lỗi bắt ở đây: tick chạy trong setInterval, reject sẽ thành unhandled rejection làm chết server
    try {
      if (busy) return;
      if (!readConfig(o.db).enabled) return;
      if (!readKey(o.keyFile).projectId) return; // status() đã báo lỗi file; không log mỗi phút
      const { now: at, tz } = resolveClock({ ...o.clock, ...(now ? { now } : {}) });
      if (lastPushAt !== null) {
        const lastMs = Date.parse(lastPushAt);
        const changed = mtime(o.dbFile) > lastMs || mtime(`${o.dbFile}-wal`) > lastMs;
        if (!changed && localDate(new Date(lastPushAt), tz) === localDate(at, tz)) return;
      }
      await doPush(at);
    } catch (e) {
      lastError = describeError(e);
      log(`Xem từ xa lỗi: ${lastError}`);
    }
  };

  let timer: NodeJS.Timeout | undefined;
  return {
    status,
    tick,
    async save(input) {
      const key = readKey(o.keyFile);
      if (input.enabled && !key.projectId) throw new BadRequestError(key.error ?? NO_KEY);
      writeConfig(o.db, { enabled: input.enabled, emails: input.emails });
      const { now } = resolveClock(o.clock);
      try {
        if (input.enabled) await doPush(now);
        else if (key.projectId) {
          const w = await getWriter();
          await withTimeout(w.deleteOverview(), timeoutMs);
          lastError = null;
        }
      } catch (e) {
        lastError = describeError(e);
      }
      return status();
    },
    async push() {
      if (!readConfig(o.db).enabled) throw new BadRequestError('Xem từ xa đang tắt');
      const key = readKey(o.keyFile);
      if (!key.projectId) throw new BadRequestError(key.error ?? NO_KEY);
      if (busy) throw new HttpError(409, 'Đang gửi, thử lại sau ít giây');
      try {
        await doPush(resolveClock(o.clock).now);
      } catch (e) {
        lastError = describeError(e);
        throw new HttpError(502, `Không gửi được: ${lastError}`);
      }
      return status();
    },
    start() {
      void tick();
      timer = setInterval(() => void tick(), o.intervalMs ?? 60_000);
      timer.unref();
    },
    stop() {
      clearInterval(timer);
    },
  };
}
```

- [ ] **Step 5: Chạy test**

Run: `cd server && npx vitest run src/services/remote-sync.test.ts`
Expected: tất cả PASS. Nếu test timeout "quá 0 giây" lệch: `timeoutMs: 50` → `Math.round(0.05)` = 0, đúng chuỗi kỳ vọng.

- [ ] **Step 6: Viết writer thật `services/remote-writer.ts`**

```ts
import fs from 'node:fs';
import type { ServiceAccount } from 'firebase-admin/app';
import type { RemoteWriter } from './remote-sync.js';

/**
 * Writer thật bằng firebase-admin, import động để máy không bật tính năng không tải SDK lúc khởi động.
 * Mỗi lần gọi tạo app riêng (tên theo thời gian) nên đổi file khóa không đụng app cũ; close() xóa app.
 */
export async function createFirebaseWriter(keyFile: string): Promise<RemoteWriter> {
  const { initializeApp, cert, deleteApp } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const key = JSON.parse(fs.readFileSync(keyFile, 'utf8')) as ServiceAccount;
  const app = initializeApp({ credential: cert(key) }, `remote-${Date.now()}`);
  const store = getFirestore(app);
  const overviewRef = store.doc('remote/overview');
  const accessRef = store.doc('remote/access');
  return {
    async setOverview(doc) {
      await overviewRef.set(doc);
    },
    async deleteOverview() {
      await overviewRef.delete();
    },
    async setAccess(emails) {
      await accessRef.set({ emails });
    },
    close: () => deleteApp(app),
  };
}
```

- [ ] **Step 7: Typecheck server**

Run: `cd server && npm run typecheck`
Expected: không lỗi. Nếu `cert(key)` báo kiểu: `firebase-admin` 12+/13+ `cert` nhận `string | ServiceAccount`; giữ cast `as ServiceAccount`.

---

### Task 4: Server – route `/api/remote` và nối vào app

**Files:**
- Create: `server/src/routes/remote.ts`
- Create: `server/src/routes/remote-api.test.ts`
- Modify: `server/src/routes/index.ts`
- Modify: `server/src/app.ts`
- Modify: `server/src/index.ts`

**Interfaces:**
- Consumes: `RemoteSync`, `createRemoteSync`, `createFirebaseWriter` (Task 3); `remoteConfigInputSchema` (Task 1); `validateBody` (`middleware/validate.ts`).
- Produces: `GET /api/remote → RemoteStatus`; `PUT /api/remote` body `RemoteConfigInput → RemoteStatus`; `POST /api/remote/push → RemoteStatus`. `createApp(db, { remote })`.

- [ ] **Step 1: Viết test API**

`server/src/routes/remote-api.test.ts`:

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RemoteOverviewDoc } from '@tiny-pos/shared';
import { createTestDb } from '../db/test-db.js';
import { createApp } from '../app.js';
import { createRemoteSync, type RemoteWriter } from '../services/remote-sync.js';

let server: Server;
let base: string;
let bare: Server;
let bareBase: string;
let root: string;
let keyFile: string;
let fail: Error | null = null;
const overviews: RemoteOverviewDoc[] = [];
const writer: RemoteWriter = {
  async setOverview(doc) {
    if (fail) throw fail;
    overviews.push(doc);
  },
  async deleteOverview() {},
  async setAccess() {},
};

const listen = async (s: Server) => {
  await new Promise((r) => s.once('listening', r));
  const addr = s.address();
  return `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
};

beforeAll(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'tiny-pos-rapi-'));
  keyFile = path.join(root, 'service-account.json');
  const dbFile = path.join(root, 'grocery.db');
  fs.writeFileSync(dbFile, '');
  const db = createTestDb();
  const remote = createRemoteSync({ db, keyFile, dbFile, appVersion: '0.14.0', writer: async () => writer, timeoutMs: 100, log: () => undefined });
  server = createApp(db, { remote }).listen(0);
  base = await listen(server);
  bare = createApp(createTestDb()).listen(0);
  bareBase = await listen(bare);
});
afterAll(() => {
  server.close();
  bare.close();
  fs.rmSync(root, { recursive: true, force: true });
});

const call = async (b: string, method: string, p: string, body?: unknown) => {
  const res = await fetch(b + p, { method, headers: body !== undefined ? { 'content-type': 'application/json' } : {}, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
};

describe('API xem từ xa', () => {
  it('không truyền remote (test createApp): GET trả chưa cấu hình, PUT/POST 503', async () => {
    expect((await call(bareBase, 'GET', '/api/remote')).json).toEqual({
      configured: false, projectId: null, url: null, enabled: false, emails: [], lastPushAt: null, lastError: null,
    });
    expect(await call(bareBase, 'PUT', '/api/remote', { enabled: false, emails: [] })).toMatchObject({ status: 503, json: { error: 'Chưa cấu hình xem từ xa' } });
    expect((await call(bareBase, 'POST', '/api/remote/push')).status).toBe(503);
  });

  it('GET chưa có khóa; PUT bật → 400; PUT email sai → 400 có nhãn; quá 5 → 400', async () => {
    expect((await call(base, 'GET', '/api/remote')).json).toMatchObject({ configured: false, enabled: false });
    expect(await call(base, 'PUT', '/api/remote', { enabled: true, emails: [] })).toMatchObject({ status: 400, json: { error: 'Chưa có file khóa Firebase' } });
    const bad = await call(base, 'PUT', '/api/remote', { enabled: false, emails: ['x'] });
    expect(bad.status).toBe(400);
    expect(bad.json.error).toBe('Email được xem: có địa chỉ không hợp lệ');
    const many = await call(base, 'PUT', '/api/remote', { enabled: false, emails: ['a@x.vn', 'b@x.vn', 'c@x.vn', 'd@x.vn', 'e@x.vn', 'f@x.vn'] });
    expect(many.status).toBe(400);
  });

  it('có khóa: PUT bật → 200 đã đẩy; POST push → 200; writer lỗi → 502; PUT tắt → push 400', async () => {
    fs.writeFileSync(keyFile, JSON.stringify({ project_id: 'tiem-api' }));
    const on = await call(base, 'PUT', '/api/remote', { enabled: true, emails: [' A@X.vn '] });
    expect(on.status).toBe(200);
    expect(on.json).toMatchObject({ configured: true, url: 'https://tiem-api.web.app', enabled: true, emails: ['a@x.vn'], lastError: null });
    expect(on.json.lastPushAt).toBeTruthy();
    expect(overviews).toHaveLength(1);

    expect((await call(base, 'POST', '/api/remote/push')).status).toBe(200);
    expect(overviews).toHaveLength(2);

    fail = new Error('14 UNAVAILABLE');
    expect(await call(base, 'POST', '/api/remote/push')).toMatchObject({ status: 502, json: { error: 'Không gửi được: Không kết nối được Firebase' } });
    fail = null;

    expect((await call(base, 'PUT', '/api/remote', { enabled: false, emails: ['a@x.vn'] })).json).toMatchObject({ enabled: false });
    expect(await call(base, 'POST', '/api/remote/push')).toMatchObject({ status: 400, json: { error: 'Xem từ xa đang tắt' } });
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `cd server && npx vitest run src/routes/remote-api.test.ts`
Expected: FAIL – `createApp` không nhận `remote` (lỗi TS) hoặc 404.

- [ ] **Step 3: Viết route `routes/remote.ts`**

```ts
import { Router } from 'express';
import { remoteConfigInputSchema, type RemoteConfigInput, type RemoteStatus } from '@tiny-pos/shared';
import { HttpError } from '../errors.js';
import { validateBody } from '../middleware/validate.js';
import type { RemoteSync } from '../services/remote-sync.js';

const NOT_CONFIGURED: RemoteStatus = { configured: false, projectId: null, url: null, enabled: false, emails: [], lastPushAt: null, lastError: null };

/** Xem từ xa; `remote` là phụ thuộc tùy chọn (test createApp không truyền) → GET báo chưa cấu hình, ghi 503. */
export function remoteRouter(remote?: RemoteSync): Router {
  const r = Router();
  r.get('/', (_req, res) => res.json(remote ? remote.status() : NOT_CONFIGURED));
  r.use((_req, _res, next) => next(remote ? undefined : new HttpError(503, 'Chưa cấu hình xem từ xa')));
  r.put('/', validateBody(remoteConfigInputSchema), async (req, res) => res.json(await remote!.save(req.body as RemoteConfigInput)));
  r.post('/push', async (_req, res) => res.json(await remote!.push()));
  return r;
}
```

- [ ] **Step 4: Nối vào `routes/index.ts`, `app.ts`, `index.ts`**

`server/src/routes/index.ts`: thêm import và tham số, thêm một dòng `use` (đặt sau dòng `/overview`):

```ts
import { remoteRouter } from './remote.js';
import type { RemoteSync } from '../services/remote-sync.js';
```

```ts
export function apiRouter(db: Db, deps: { backups?: BackupService; labels?: LabelDeps; images?: ImageDeps; remote?: RemoteSync } = {}): Router {
```

```ts
  r.use('/remote', remoteRouter(deps.remote));
```

`server/src/app.ts`: thêm `import type { RemoteSync } from './services/remote-sync.js';`, mở rộng kiểu `opts` thêm `remote?: RemoteSync`, và truyền `remote: opts.remote` vào object gọi `apiRouter` (cùng dòng với `images: ...`).

`server/src/index.ts`:

```ts
import { createFirebaseWriter } from './services/remote-writer.js';
import { createRemoteSync } from './services/remote-sync.js';
```

Sau dòng tạo `backups`:

```ts
// Version duy nhất ở package.json gốc (client cũng đọc từ đó lúc build); ghi vào tài liệu xem từ xa
const { version: appVersion } = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as { version: string };
const remoteDir = path.join(dataDir, 'remote');
fs.mkdirSync(remoteDir, { recursive: true }); // để người cài biết chép file khóa vào đâu
const remote = createRemoteSync({ db, keyFile: path.join(remoteDir, 'service-account.json'), dbFile, backups, appVersion, writer: createFirebaseWriter });
```

Thêm `remote` vào object truyền `createApp` (`{ clientDist: ..., backups, labels, imagesDir, remote }`). Trong callback `listen`, sau `createBackupScheduler(...).start();` thêm:

```ts
  remote.start();
```

- [ ] **Step 5: Chạy test API và toàn bộ server**

Run: `cd server && npx vitest run src/routes/remote-api.test.ts && npm run typecheck && npx vitest run`
Expected: PASS hết. Nếu test "PUT email sai" trả `emails: có địa chỉ…` thay vì nhãn: kiểm `FIELD_LABELS` Task 1 Step 5 và đã `npm run build -w shared`.

- [ ] **Step 6: Chạy server dev kiểm nhanh**

Run: `npm run dev` (nền), rồi `curl -s http://localhost:3000/api/remote`
Expected: `{"configured":false,...}`; thư mục `data/remote/` được tạo. Tắt dev server sau khi xem (chỉ tắt tiến trình mình bật).

---

### Task 5: Client – thẻ *Xem từ xa* trong Cài đặt

**Files:**
- Create: `client/src/api/remote.ts`
- Create: `client/src/pages/settings/RemoteCard.tsx`
- Modify: `client/src/pages/settings/SettingsPage.tsx` (import + một dòng sau `<BackupCard />`)

**Interfaces:**
- Consumes: `RemoteStatus`, `RemoteConfigInput`, `REMOTE_MAX_EMAILS` (Task 1); API Task 4; `api` (`@/api/client`); `qrcode` (đã có).
- Produces: `useRemoteStatus()`, `useSaveRemote()`, `usePushRemote()`; component `RemoteCard`.

- [ ] **Step 1: Hook API `client/src/api/remote.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RemoteConfigInput, RemoteStatus } from '@tiny-pos/shared';
import { api } from './client';

const KEY = ['remote'];

/** Tải lại mỗi 30 giây khi thẻ đang mở để thấy "Gửi lần cuối" chạy. */
export const useRemoteStatus = () => useQuery({ queryKey: KEY, queryFn: () => api<RemoteStatus>('/remote'), refetchInterval: 30_000 });

export function useSaveRemote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RemoteConfigInput) => api<RemoteStatus>('/remote', { method: 'PUT', json: input }),
    onSuccess: (s) => qc.setQueryData(KEY, s),
  });
}

export function usePushRemote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<RemoteStatus>('/remote/push', { method: 'POST' }),
    onSuccess: (s) => qc.setQueryData(KEY, s),
  });
}
```

- [ ] **Step 2: Thẻ `RemoteCard.tsx`**

```tsx
import { useEffect, useState, type KeyboardEvent } from 'react';
import { ExternalLink, Plus, Send, Smartphone, X } from 'lucide-react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { z } from 'zod';
import { REMOTE_MAX_EMAILS, type RemoteStatus } from '@tiny-pos/shared';
import { usePushRemote, useRemoteStatus, useSaveRemote } from '@/api/remote';
import { SectionTitle, TextField } from '@/components/TextField';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

const KEY_PATH = 'data\\remote\\service-account.json';
const when = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
const emailSchema = z.email();

/** Mã QR của địa chỉ trang xem để chủ tiệm quét bằng điện thoại thay vì gõ. */
function UrlQr({ url }: { url: string }) {
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
  return src ? <img src={src} alt="Mã QR địa chỉ trang xem" className="size-40 rounded-lg border bg-white p-1" /> : <div className="size-40 animate-pulse rounded-lg bg-muted" />;
}

/** Dòng trạng thái gửi: lỗi đỏ (kèm nhắc tự thử lại), chưa gửi, hoặc giờ gửi gần nhất. */
function PushStatus({ s }: { s: RemoteStatus }) {
  if (s.lastError) return <p className="text-sm text-destructive">{s.lastError}. Sẽ tự thử lại mỗi phút.</p>;
  if (!s.enabled) return <p className="text-sm text-muted-foreground">Đang tắt: điện thoại không xem được.</p>;
  if (!s.lastPushAt) return <p className="text-sm text-muted-foreground">Chưa gửi lần nào.</p>;
  return (
    <p className="text-sm">
      Gửi lần cuối: <span className="font-medium">{when(s.lastPushAt)}</span>
    </p>
  );
}

/**
 * Thẻ Xem từ xa trong Cài đặt. Nằm trong form cài đặt chung nên mọi nút là type="button" và Enter ở ô email chỉ thêm email.
 * Bật/tắt và thêm/xóa email đều gọi PUT ngay, không có nút Lưu riêng.
 */
export function RemoteCard() {
  const { data } = useRemoteStatus();
  const save = useSaveRemote();
  const push = usePushRemote();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const fail = (e: Error) => toast.error(e.message);

  if (!data) return null;
  const emails = data.emails;
  const full = emails.length >= REMOTE_MAX_EMAILS;

  const put = (next: { enabled: boolean; emails: string[] }, done?: string) =>
    save.mutate(next, { onSuccess: () => done && toast.success(done), onError: fail });
  const addEmail = () => {
    const v = email.trim().toLowerCase();
    if (!emailSchema.safeParse(v).success) return setEmailError('Email không hợp lệ');
    if (emails.includes(v)) return setEmailError('Email này đã có');
    setEmailError(undefined);
    setEmail('');
    put({ enabled: data.enabled, emails: [...emails, v] });
  };
  const onEmailKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    addEmail();
  };

  return (
    <Card>
      <CardContent className="space-y-4">
        <div>
          <SectionTitle>Xem từ xa</SectionTitle>
          <p className="text-sm text-muted-foreground">
            Gửi trang Tổng quan lên Firebase mỗi phút để chủ tiệm mở điện thoại xem được khi không ở tiệm. Chỉ xem, không bán hàng; chỉ email trong danh
            sách mới xem được.
          </p>
        </div>
        {!data.configured ? (
          <div className="space-y-1 text-sm">
            <p>
              Chưa cài đặt Firebase cho tiệm này. Cần file <span className="font-mono">{KEY_PATH}</span> trên máy quầy – xem mục <em>Xem từ xa</em> trong README.
            </p>
            {data.lastError && <p className="text-destructive">{data.lastError}</p>}
          </div>
        ) : (
          <fieldset disabled={save.isPending} className="space-y-4">
            <label className="flex items-center justify-between gap-4">
              <span>
                <span className="block font-medium">Bật xem từ xa</span>
                <span className="text-sm text-muted-foreground">Project Firebase: {data.projectId}</span>
              </span>
              <Switch checked={data.enabled} onCheckedChange={(v) => put({ enabled: v, emails }, v ? 'Đã bật xem từ xa' : 'Đã tắt xem từ xa')} />
            </label>
            <div className="space-y-2">
              <p className="font-medium">Email được xem</p>
              {emails.length === 0 ? (
                <p className={`text-sm ${data.enabled ? 'text-warning' : 'text-muted-foreground'}`}>
                  Chưa có email nào được xem{data.enabled ? ': điện thoại đăng nhập sẽ bị từ chối' : ''}.
                </p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {emails.map((e) => (
                    <li key={e} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="truncate">{e}</span>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Xóa ${e}`} onClick={() => put({ enabled: data.enabled, emails: emails.filter((x) => x !== e) })}>
                        <X />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-end gap-2">
                <TextField
                  id="st-remote-email"
                  label="Thêm email Google"
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  className="flex-1"
                  placeholder="chutiem@gmail.com"
                  value={email}
                  error={emailError}
                  disabled={full}
                  hint={full ? `Tối đa ${REMOTE_MAX_EMAILS} email` : undefined}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError(undefined);
                  }}
                  onKeyDown={onEmailKey}
                />
                <Button type="button" variant="outline" className="h-11" disabled={full || !email.trim()} onClick={addEmail}>
                  <Plus data-icon="inline-start" />
                  Thêm
                </Button>
              </div>
            </div>
            {data.url && (
              <div className="flex flex-wrap items-start gap-4">
                <UrlQr url={data.url} />
                <div className="space-y-2 text-sm">
                  <p className="flex items-center gap-2 font-medium">
                    <Smartphone className="size-4" />
                    Quét mã bằng điện thoại để mở trang xem
                  </p>
                  <a href={data.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 break-all text-primary underline">
                    {data.url}
                    <ExternalLink className="size-3.5" />
                  </a>
                  <p className="text-muted-foreground">Trên điện thoại chọn "Thêm vào màn hình chính" để mở như một ứng dụng.</p>
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-11 text-base"
                disabled={!data.enabled || push.isPending}
                onClick={() => push.mutate(undefined, { onSuccess: () => toast.success('Đã gửi'), onError: fail })}
              >
                <Send data-icon="inline-start" />
                {push.isPending ? 'Đang gửi…' : 'Gửi ngay'}
              </Button>
              <PushStatus s={data} />
            </div>
          </fieldset>
        )}
      </CardContent>
    </Card>
  );
}
```

Kiểm `TextField` nhận `error`, `className`, `disabled` (xem `client/src/components/TextField.tsx` dòng 19: `{ id, label, hint, suffix, leading, error, className, ...props }` – `disabled`, `type`, `inputMode`, `autoComplete`, `placeholder` đi qua `...props`). Kiểm `Button` có `size="icon-sm"` trong `client/src/components/ui/button.tsx`; không có thì dùng `size="icon"`.

- [ ] **Step 3: Gắn vào `SettingsPage.tsx`**

Thêm import sau `import { BackupCard } from './BackupCard';`:

```ts
import { RemoteCard } from './RemoteCard';
```

Tìm `<BackupCard />` trong JSX, thêm ngay dòng dưới:

```tsx
      <RemoteCard />
```

- [ ] **Step 4: Typecheck client**

Run: `cd client && npm run typecheck`
Expected: không lỗi.

- [ ] **Step 5: Kiểm bằng trình duyệt (skill `browser-verify`), không ghi DB dev**

Chạy `npm run dev`. Theo skill `browser-verify`, chặn mọi request ghi và stub `GET /api/remote` lần lượt ba trạng thái, chụp màn hình trang `/settings` ở cỡ điện thoại 390px và máy tính:

1. `{ configured: false, projectId: null, url: null, enabled: false, emails: [], lastPushAt: null, lastError: null }` → thấy dòng "Chưa cài đặt Firebase…" kèm đường dẫn file, không có công tắc.
2. `{ configured: true, projectId: 'tiem-abc', url: 'https://tiem-abc.web.app', enabled: false, emails: ['chutiem@gmail.com'], lastPushAt: null, lastError: null }` → công tắc tắt, một email có nút xóa, QR vẽ ra, link đúng, nút *Gửi ngay* bị khóa, dòng "Đang tắt".
3. `{ ...như 2, enabled: true, emails: [], lastPushAt: '2026-10-02T07:32:00Z', lastError: 'Không kết nối được Firebase' }` → dòng `warning` "Chưa có email nào được xem: điện thoại đăng nhập sẽ bị từ chối.", dòng đỏ lỗi "…Sẽ tự thử lại mỗi phút.", nút *Gửi ngay* bật.

Gõ `abc` vào ô email bấm *Thêm* → lỗi "Email không hợp lệ" ngay dưới ô, không có request. Gõ email hợp lệ, Enter → có `PUT /api/remote` (bị chặn bởi browser-verify, chỉ xem payload `{ enabled, emails: [...] }` chữ thường). Sửa lỗi hiển thị nếu có, tắt dev server của mình.

---

### Task 6: Workspace `remote/` – khung app, Firebase, đăng nhập, lắng nghe tài liệu

**Files:**
- Create: `remote/package.json`, `remote/tsconfig.json`, `remote/vite.config.ts`, `remote/firebase.json`, `remote/firestore.rules`, `remote/index.html`, `remote/public/manifest.webmanifest`, `remote/public/icon.svg`, `remote/.env.example`
- Create: `remote/src/main.tsx`, `remote/src/App.tsx`, `remote/src/index.css`, `remote/src/lib/utils.ts`, `remote/src/firebase.ts`, `remote/src/auth.ts`, `remote/src/overview.ts`
- Create (copy nguyên văn từ `client/src/components/ui/`): `remote/src/components/ui/button.tsx`, `card.tsx`, `badge.tsx`, `skeleton.tsx`, `table.tsx`
- Modify: `package.json` gốc (`workspaces`), `.gitignore`

**Interfaces:**
- Consumes: `RemoteOverviewDoc`, `REMOTE_STALE_MS` (Task 1).
- Produces: `useUser(): { user: User | null; ready: boolean }`, `signIn(): Promise<void>`, `signOutUser(): Promise<void>` (`auth.ts`); `useRemoteOverview(): { status: 'loading' | 'denied' | 'missing' | 'ok'; doc: RemoteOverviewDoc | null; fromCache: boolean }` (`overview.ts`); `initFirebase(): Promise<FirebaseApp>` (`firebase.ts`). Task 7 dựng khối hiển thị nhận `doc`.

- [ ] **Step 1: Khai báo workspace và gitignore**

`package.json` gốc: `"workspaces": ["shared", "server", "client", "remote"]`. **Không** sửa script `build` (không build `remote/`); `typecheck`/`test` dùng `--workspaces` nên tự gồm.

`.gitignore` thêm cuối:

```
remote/.firebaserc
remote/.env.local
remote/.firebase/
```

- [ ] **Step 2: `remote/package.json`**

```json
{
  "name": "@tiny-pos/remote",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host --port 5181 --strictPort",
    "build": "tsc -p tsconfig.json --noEmit && vite build",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "deploy": "npm run build && firebase deploy --only hosting,firestore:rules"
  },
  "dependencies": {
    "@fontsource-variable/geist": "^5.3.0",
    "@tiny-pos/shared": "*",
    "class-variance-authority": "^0.7.1",
    "cn": "^0.4.0",
    "firebase": "^12.0.0",
    "lucide-react": "^1.48.0",
    "radix-ui": "^1.6.7",
    "react": "^19.3.0",
    "react-dom": "^19.3.0",
    "shadcn": "^4.21.0",
    "tw-animate-css": "^1.4.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.0",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "@vitejs/plugin-react": "^5.0.0",
    "firebase-tools": "^14.0.0",
    "tailwindcss": "^4.1.0",
    "typescript": "^5.9.0",
    "vite": "^7.0.0"
  }
}
```

Run (gốc repo): `npm install`
Expected: cài xong, `node_modules/firebase` và `node_modules/.bin/firebase` có. Nếu `firebase@^12` hay `firebase-tools@^14` không tồn tại ở thời điểm cài, dùng `npm view firebase version` / `npm view firebase-tools version` lấy bản mới nhất và sửa caret theo bản đó.

- [ ] **Step 3: Cấu hình TS, Vite, Firebase, rules**

`remote/tsconfig.json`:

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "noEmit": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] },
    "types": ["vite/client", "node"]
  },
  "include": ["src", "vite.config.ts"]
}
```

`remote/vite.config.ts`:

```ts
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Version duy nhất ở package.json gốc, như client
const { version } = JSON.parse(readFileSync(path.resolve(import.meta.dirname, '../package.json'), 'utf8')) as { version: string };

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
});
```

`remote/src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
declare const __APP_VERSION__: string;
```

`remote/firebase.json`:

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  },
  "firestore": { "rules": "firestore.rules" }
}
```

`remote/firestore.rules`:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Chỉ email trong remote/access (server tiny-pos ghi) mới đọc được Tổng quan; trình duyệt không ghi được gì
    match /remote/overview {
      allow read: if request.auth != null
        && request.auth.token.email_verified == true
        && request.auth.token.email in get(/databases/$(database)/documents/remote/access).data.emails;
      allow write: if false;
    }
    match /remote/access {
      allow read, write: if false;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

`remote/.env.example` (vào git, hướng dẫn dev local):

```
# Dev local không có /__/firebase/init.json của Hosting: chép thành .env.local và dán web config của project (Project settings → Your apps)
VITE_FIREBASE_CONFIG={"apiKey":"...","authDomain":"<project>.firebaseapp.com","projectId":"<project>","appId":"..."}
```

- [ ] **Step 4: `index.html`, manifest, icon, CSS, utils**

`remote/index.html`:

```html
<!doctype html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#2563eb" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="icon" href="/icon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/icon.svg" />
    <title>Tạp hóa – Xem từ xa</title>
    <!-- Theo chế độ sáng/tối của điện thoại; đặt class trước khi vẽ để không nháy -->
    <script>
      if (matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.classList.add('dark');
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`remote/public/manifest.webmanifest`:

```json
{
  "name": "Tạp hóa – Xem từ xa",
  "short_name": "Tạp hóa",
  "lang": "vi",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#2563eb",
  "background_color": "#ffffff",
  "icons": [{ "src": "/icon.svg", "sizes": "any", "type": "image/svg+xml" }]
}
```

`remote/public/icon.svg`: chép `client/public/icon.svg`.

`remote/src/index.css`: chép nguyên `client/src/index.css` (token màu, `.dark`, `@theme inline`, `@layer base`). Các biến `--sidebar-*`, `data-density`, `data-font` không dùng cũng không sao; không sửa để hai app cùng bảng màu.

`remote/src/lib/utils.ts`:

```ts
export { cn } from "cn"
```

Copy nguyên văn 5 file `button.tsx`, `card.tsx`, `badge.tsx`, `skeleton.tsx`, `table.tsx` từ `client/src/components/ui/` sang `remote/src/components/ui/` (chúng chỉ import `react`, `cn`, `class-variance-authority`, `radix-ui`, `@/lib/utils`).

- [ ] **Step 5: `firebase.ts`, `auth.ts`, `overview.ts`**

`remote/src/firebase.ts`:

```ts
import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';

let app: Promise<FirebaseApp> | null = null;

/**
 * Trên Firebase Hosting, /__/firebase/init.json là web config của chính project đang host → một bản build dùng cho mọi tiệm.
 * Dev local không có file này → đọc VITE_FIREBASE_CONFIG (remote/.env.local).
 */
export function initFirebase(): Promise<FirebaseApp> {
  app ??= (async () => {
    let options: FirebaseOptions | null = null;
    try {
      const res = await fetch('/__/firebase/init.json');
      if (res.ok) options = (await res.json()) as FirebaseOptions;
    } catch {
      /* không phải Hosting */
    }
    if (!options) {
      const raw = import.meta.env['VITE_FIREBASE_CONFIG'] as string | undefined;
      if (!raw) throw new Error('Thiếu cấu hình Firebase: trang phải chạy trên Firebase Hosting hoặc có VITE_FIREBASE_CONFIG');
      options = JSON.parse(raw) as FirebaseOptions;
    }
    return initializeApp(options);
  })();
  return app;
}
```

`remote/src/auth.ts`:

```ts
import { useEffect, useState } from 'react';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut, type User } from 'firebase/auth';
import { initFirebase } from './firebase';

/** Người đang đăng nhập; ready=false khi Firebase chưa trả lời lần đầu (không hiện nút đăng nhập nháy). */
export function useUser(): { user: User | null; ready: boolean } {
  const [state, setState] = useState<{ user: User | null; ready: boolean }>({ user: null, ready: false });
  useEffect(() => {
    let off = () => undefined as void;
    void initFirebase().then((app) => {
      off = onAuthStateChanged(getAuth(app), (user) => setState({ user, ready: true }));
    });
    return () => off();
  }, []);
  return state;
}

/** Popup trước; điện thoại chặn popup thì chuyển sang redirect. */
export async function signIn(): Promise<void> {
  const auth = getAuth(await initFirebase());
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') await signInWithRedirect(auth, provider);
    else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') throw e;
  }
}

export async function signOutUser(): Promise<void> {
  await signOut(getAuth(await initFirebase()));
}
```

`remote/src/overview.ts`:

```ts
import { useEffect, useState } from 'react';
import { doc, getFirestore, onSnapshot } from 'firebase/firestore';
import type { RemoteOverviewDoc } from '@tiny-pos/shared';
import { initFirebase } from './firebase';

export type RemoteState =
  | { status: 'loading'; doc: null; fromCache: false }
  | { status: 'denied'; doc: null; fromCache: false }
  | { status: 'missing'; doc: null; fromCache: boolean }
  | { status: 'ok'; doc: RemoteOverviewDoc; fromCache: boolean };

/**
 * Lắng nghe remote/overview. Chỉ gọi khi đã đăng nhập (rules cần auth). permission-denied → 'denied' (email không trong danh sách,
 * kể cả khi bị xóa giữa chừng); tài liệu chưa có → 'missing' (máy quầy chưa đẩy). fromCache = điện thoại đang ngoại tuyến.
 */
export function useRemoteOverview(uid: string): RemoteState {
  const [state, setState] = useState<RemoteState>({ status: 'loading', doc: null, fromCache: false });
  useEffect(() => {
    setState({ status: 'loading', doc: null, fromCache: false });
    let off = () => undefined as void;
    void initFirebase().then((app) => {
      off = onSnapshot(
        doc(getFirestore(app), 'remote/overview'),
        { includeMetadataChanges: true },
        (snap) => {
          const fromCache = snap.metadata.fromCache;
          if (!snap.exists()) return setState({ status: 'missing', doc: null, fromCache });
          setState({ status: 'ok', doc: snap.data() as RemoteOverviewDoc, fromCache });
        },
        (err) => {
          if (err.code === 'permission-denied') setState({ status: 'denied', doc: null, fromCache: false });
          else console.error(err);
        },
      );
    });
    return () => off();
  }, [uid]);
  return state;
}
```

- [ ] **Step 6: `main.tsx` và `App.tsx` với 4 trạng thái (khối dữ liệu tạm là JSON thô, Task 7 thay)**

`remote/src/main.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Theo chế độ sáng/tối của máy, kể cả khi đổi lúc đang mở
const dark = matchMedia('(prefers-color-scheme: dark)');
dark.addEventListener('change', (e) => document.documentElement.classList.toggle('dark', e.matches));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

`remote/src/App.tsx`:

```tsx
import { LogIn, LogOut, ShieldX, Store } from 'lucide-react';
import { signIn, signOutUser, useUser } from './auth';
import { useRemoteOverview } from './overview';
import { Button } from './components/ui/button';
import { Skeleton } from './components/ui/skeleton';

/** Màn giữa trang cho các trạng thái không có dữ liệu. */
function Centered({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">{children}</main>;
}

function Dashboard({ uid, email }: { uid: string; email: string }) {
  const state = useRemoteOverview(uid);
  if (state.status === 'loading')
    return (
      <main className="mx-auto max-w-3xl space-y-3 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </main>
    );
  if (state.status === 'denied')
    return (
      <Centered>
        <ShieldX className="size-12 text-destructive" />
        <h1 className="text-xl font-semibold">Chưa được cấp quyền xem</h1>
        <p className="text-muted-foreground">
          Tài khoản <span className="font-medium text-foreground">{email}</span> chưa có trong danh sách. Trên máy quầy vào Cài đặt → Xem từ xa và thêm email này.
        </p>
        <Button variant="outline" onClick={() => void signOutUser()}>
          <LogOut data-icon="inline-start" />
          Đăng xuất
        </Button>
      </Centered>
    );
  if (state.status === 'missing')
    return (
      <Centered>
        <Store className="size-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Máy quầy chưa gửi số liệu lần nào</h1>
        <p className="text-muted-foreground">Trên máy quầy vào Cài đặt → Xem từ xa → Gửi ngay. Trang này sẽ tự cập nhật.</p>
        <Button variant="outline" onClick={() => void signOutUser()}>
          <LogOut data-icon="inline-start" />
          Đăng xuất
        </Button>
      </Centered>
    );
  // Task 7 thay bằng các khối; tạm hiện JSON để kiểm luồng
  return <pre className="overflow-auto p-4 text-xs">{JSON.stringify(state.doc, null, 2)}</pre>;
}

export default function App() {
  const { user, ready } = useUser();
  if (!ready) return null;
  if (!user)
    return (
      <Centered>
        <Store className="size-12 text-primary" />
        <h1 className="text-2xl font-semibold">Tạp hóa – Xem từ xa</h1>
        <p className="text-muted-foreground">Đăng nhập bằng tài khoản Google đã được chủ tiệm cho phép.</p>
        <Button className="h-12 text-base" onClick={() => void signIn()}>
          <LogIn data-icon="inline-start" />
          Đăng nhập bằng Google
        </Button>
      </Centered>
    );
  return <Dashboard uid={user.uid} email={user.email ?? ''} />;
}
```

- [ ] **Step 7: Typecheck và build `remote/`**

Run: `npm run build -w shared && npm run typecheck -w remote && npm run build -w remote`
Expected: không lỗi; `remote/dist/index.html` có. `npm run typecheck` ở gốc cũng chạy qua `remote`.

- [ ] **Step 8: Kiểm luồng đăng nhập với project thử của người triển khai**

Tạo `remote/.env.local` từ `.env.example` với web config của project thử (đã bật Google sign-in; `localhost` được phép mặc định). `npm run dev -w remote` → mở `http://localhost:5181`: thấy nút đăng nhập; đăng nhập xong thấy "Máy quầy chưa gửi số liệu lần nào" (project trống) hoặc "Chưa được cấp quyền xem" nếu rules đã deploy và email không trong `remote/access`. Tắt dev server của mình. Không có project thử thì bỏ qua bước này và ghi rõ trong báo cáo.

---

### Task 7: `remote/` – các khối hiển thị Tổng quan

**Files:**
- Create: `remote/src/blocks/Header.tsx`, `TodayStats.tsx`, `Alerts.tsx`, `WeekTable.tsx`, `RecentOrders.tsx`, `LowStock.tsx`, `DebtList.tsx`, `BackupLine.tsx`, `remote/src/blocks/Panel.tsx`, `remote/src/blocks/format.ts`
- Modify: `remote/src/App.tsx` (thay `<pre>` bằng `<Dashboard>` thật)

**Interfaces:**
- Consumes: `RemoteOverviewDoc`, `Overview`, `ProfitReport`, `ProfitRow`, `OrderSummary`, `DebtPartyRow`, `OverdueCustomerRow`, `formatMoney`, `formatQty`, `formatDateVn`, `shiftDate`, `localDate`, `currentTzOffset`, `DEBT_OVERDUE_DAYS`, `BACKUP_STALE_DAYS`, `REMOTE_STALE_MS` từ `@tiny-pos/shared`; `RemoteState` Task 6.
- Produces: `<Blocks doc={RemoteOverviewDoc} fromCache={boolean} email={string} />` export từ `blocks/Header.tsx`… (App chỉ gọi một component `Dashboard` trong App.tsx như dưới).

- [ ] **Step 1: Hàm định dạng dùng chung `blocks/format.ts`**

```ts
import { currentTzOffset, formatDateVn, localDate } from '@tiny-pos/shared';

export const time = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
export const localDay = (iso: string) => localDate(new Date(iso), currentTzOffset());
/** "dd/mm" */
export const shortDay = (ymd: string) => formatDateVn(ymd).slice(0, 5);
export const METHOD_LABEL = { cash: 'Tiền mặt', transfer: 'Chuyển khoản', debt: 'Ghi nợ' } as const;

const TINTS = [
  'bg-blue-500/12 text-blue-700 dark:text-blue-300',
  'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
  'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  'bg-violet-500/12 text-violet-700 dark:text-violet-300',
  'bg-rose-500/12 text-rose-700 dark:text-rose-300',
  'bg-cyan-500/12 text-cyan-700 dark:text-cyan-300',
];
/** Màu ô chữ cái ổn định theo tên, cùng thuật toán với ProductAvatar của client. */
export function tintFor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length]!;
}
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter((w) => /^[\p{L}\p{N}]/u.test(w))
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}
```

- [ ] **Step 2: Khung khối `blocks/Panel.tsx`**

```tsx
import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';

/** Một khối: tiêu đề + số đếm bên phải + nội dung; không nút hành động vì trang chỉ đọc. */
export function Panel({ title, count, children }: { title: string; count?: string; children: ReactNode }) {
  return (
    <Card className="py-0">
      <CardContent className="px-0">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {count && <span className="text-sm text-muted-foreground">{count}</span>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="border-t px-4 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}
```

- [ ] **Step 3: `blocks/Header.tsx` – tên tiệm, cập nhật lúc, cảnh báo cũ, ngoại tuyến, đăng xuất**

```tsx
import { useEffect, useState } from 'react';
import { LogOut, WifiOff } from 'lucide-react';
import { REMOTE_STALE_MS, formatDateVn } from '@tiny-pos/shared';
import { Button } from '@/components/ui/button';
import { signOutUser } from '../auth';
import { localDay, time } from './format';

/** Cập nhật lúc HH:mm (kèm ngày nếu không phải hôm nay của điện thoại); quá REMOTE_STALE_MS thì cảnh báo máy quầy có thể tắt. Tính lại mỗi 30 s. */
export function Header({ storeName, updatedAt, fromCache }: { storeName: string; updatedAt: string; fromCache: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const stale = now - Date.parse(updatedAt) > REMOTE_STALE_MS;
  const day = localDay(updatedAt);
  const sameDay = day === localDay(new Date(now).toISOString());
  const at = sameDay ? time(updatedAt) : `${time(updatedAt)} ${formatDateVn(day)}`;
  return (
    <header className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold">{storeName}</h1>
        {stale ? (
          <p className="text-sm text-warning">Máy quầy chưa gửi số mới từ {at}, có thể đang tắt hoặc mất mạng.</p>
        ) : (
          <p className="text-sm text-muted-foreground">Cập nhật lúc {at}</p>
        )}
        {fromCache && (
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <WifiOff className="size-3.5" />
            Điện thoại đang ngoại tuyến, số đang hiện là bản đã tải.
          </p>
        )}
      </div>
      <Button variant="ghost" size="icon-lg" aria-label="Đăng xuất" title="Đăng xuất" onClick={() => void signOutUser()}>
        <LogOut />
      </Button>
    </header>
  );
}
```

- [ ] **Step 4: `blocks/TodayStats.tsx`** (cùng số liệu với client, không có link)

```tsx
import { formatMoney, type ProfitReport } from '@tiny-pos/shared';
import { cn } from '@/lib/utils';

type Tone = 'default' | 'success' | 'warning' | 'danger';
const tones: Record<Tone, string> = { default: '', success: 'text-success', warning: 'text-warning', danger: 'text-destructive' };
const percent = (profit: number, revenue: number) => (revenue > 0 ? `${((profit / revenue) * 100).toFixed(1).replace('.', ',')}% doanh thu` : undefined);
const tone = (n: number): Tone => (n > 0 ? 'success' : n < 0 ? 'danger' : 'default');
const signed = (n: number) => (n > 0 ? `+${formatMoney(n)}` : n < 0 ? `−${formatMoney(-n)}` : formatMoney(0));

function Stat({ label, value, hint, tone = 'default' }: { label: string; value: string; hint?: string; tone?: Tone }) {
  return (
    <div className="min-w-0 rounded-lg border bg-card px-4 py-3">
      <div className="truncate text-sm text-muted-foreground">{label}</div>
      <div className={cn('text-lg leading-tight font-semibold tracking-tight whitespace-nowrap tabular-nums sm:text-2xl', tones[tone])}>{value}</div>
      {hint && <div className="truncate text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

/** Hôm nay = rows[0], hôm qua = rows[1] của báo cáo 7 ngày (cùng công thức trang Tổng quan máy quầy). */
export function TodayStats({ week, outCount }: { week: ProfitReport; outCount: number }) {
  const t = week.rows[0];
  const y = week.rows[1];
  if (!t) return null;
  const collected = t.debtCollected.cash + t.debtCollected.transfer;
  const diff = y ? t.revenue - y.revenue : undefined;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label="Doanh thu hôm nay" value={formatMoney(t.revenue)} hint={t.orders ? `${t.orders} đơn` : 'Chưa có hóa đơn hôm nay'} />
      <Stat label="Lãi gộp" value={formatMoney(t.profit)} hint={percent(t.profit, t.revenue)} tone={tone(t.profit)} />
      <Stat label="Tiền mặt" value={formatMoney(t.cash)} hint="Gồm trả trước của đơn ghi nợ" />
      <Stat label="Chuyển khoản" value={formatMoney(t.transfer)} />
      <Stat label="Ghi nợ" value={formatMoney(t.debt)} hint="Phần khách còn thiếu" tone={t.debt ? 'danger' : 'default'} />
      <Stat label="Thu nợ" value={formatMoney(collected)} hint={`Tiền mặt ${formatMoney(t.debtCollected.cash)} · CK ${formatMoney(t.debtCollected.transfer)}`} tone={collected ? 'success' : 'default'} />
      <Stat label="So với hôm qua" value={diff === undefined ? '—' : signed(diff)} hint={y ? `Hôm qua ${formatMoney(y.revenue)}` : undefined} tone={tone(diff ?? 0)} />
      <Stat label="Hết hàng" value={`${outCount} mặt hàng`} tone={outCount ? 'danger' : 'default'} />
    </div>
  );
}
```

- [ ] **Step 5: `blocks/Alerts.tsx`** (cùng câu chữ và thứ tự với `buildAlerts` của client, bỏ nút)

```tsx
import { CircleCheck, ClipboardList, DatabaseBackup, PackageMinus, PackageX, TriangleAlert, Users, type LucideIcon } from 'lucide-react';
import { BACKUP_STALE_DAYS, DEBT_OVERDUE_DAYS, formatDateVn, formatMoney, shiftDate, type Overview } from '@tiny-pos/shared';
import { Card, CardContent } from '@/components/ui/card';
import { localDay } from './format';

type Tone = 'warning' | 'destructive';
interface Alert {
  key: string;
  icon: LucideIcon;
  text: string;
  tone: Tone;
}
const TONE: Record<Tone, string> = { warning: 'text-warning', destructive: 'text-destructive' };

/** Cùng thứ tự với AlertsCard trên máy quầy: sao lưu lỗi → sao lưu cũ → kiểm kê dở → hết hàng → sắp hết → nợ lâu. */
export function buildAlerts(o: Overview): Alert[] {
  const list: Alert[] = [];
  const b = o.backup;
  if (b?.lastError) list.push({ key: 'backup-error', icon: DatabaseBackup, text: `Sao lưu tự động gần nhất bị lỗi: ${b.lastError}`, tone: 'destructive' });
  if (b?.extraError) list.push({ key: 'backup-extra', icon: DatabaseBackup, text: `Không chép được bản sao sang thư mục thêm: ${b.extraError}`, tone: 'warning' });
  if (b && !b.lastBackupAt) list.push({ key: 'backup-none', icon: DatabaseBackup, text: 'Chưa có bản sao lưu nào', tone: 'warning' });
  else if (b?.lastBackupAt && localDay(b.lastBackupAt) < shiftDate(o.today, -BACKUP_STALE_DAYS))
    list.push({ key: 'backup-stale', icon: DatabaseBackup, text: `Chưa sao lưu từ ${formatDateVn(localDay(b.lastBackupAt))}`, tone: 'warning' });
  if (o.stocktake) list.push({ key: 'stocktake', icon: ClipboardList, text: `Kiểm kê ${o.stocktake.code} đang dở, đã đếm ${o.stocktake.itemCount} món`, tone: 'warning' });
  if (o.lowStock.outCount > 0) list.push({ key: 'out', icon: PackageX, text: `${o.lowStock.outCount} mặt hàng đã hết`, tone: 'destructive' });
  if (o.lowStock.count > 0) list.push({ key: 'low', icon: PackageMinus, text: `${o.lowStock.count} mặt hàng sắp hết`, tone: 'warning' });
  if (o.customers.overdueCount > 0)
    list.push({ key: 'overdue', icon: Users, text: `${o.customers.overdueCount} khách nợ quá ${DEBT_OVERDUE_DAYS} ngày chưa trả, tổng ${formatMoney(o.customers.overdueTotal)}`, tone: 'warning' });
  return list;
}

export function Alerts({ data }: { data: Overview }) {
  const alerts = buildAlerts(data);
  return (
    <Card className="py-0">
      <CardContent className="px-4 py-3">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <TriangleAlert className="size-4 text-muted-foreground" />
          Cần chú ý
        </h2>
        {alerts.length === 0 ? (
          <p className="flex items-center gap-2 py-1 text-sm text-success">
            <CircleCheck className="size-4 shrink-0" />
            Mọi thứ ổn: không có cảnh báo.
          </p>
        ) : (
          <ul className="divide-y">
            {alerts.map(({ key, icon: Icon, text, tone }) => (
              <li key={key} className="flex items-center gap-3 py-2">
                <Icon className={`size-5 shrink-0 ${TONE[tone]}`} />
                <span className="min-w-0 flex-1 text-sm">{text}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 6: `blocks/WeekTable.tsx`, `RecentOrders.tsx`, `LowStock.tsx`, `DebtList.tsx`, `BackupLine.tsx`**

`WeekTable.tsx`:

```tsx
import { formatMoney, shiftDate, type ProfitReport, type ProfitRow } from '@tiny-pos/shared';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Panel } from './Panel';
import { shortDay } from './format';

const CELL = 'px-3 py-2';
const MONEY = `${CELL} text-right tabular-nums`;

function dayLabel(period: string, today: string): string {
  if (period === today) return 'Hôm nay';
  if (period === shiftDate(today, -1)) return 'Hôm qua';
  return shortDay(period);
}

function Row({ r, label, total = false }: { r: ProfitRow; label: string; total?: boolean }) {
  const cls = total ? 'font-semibold' : '';
  return (
    <TableRow className={total ? 'bg-muted/40 hover:bg-muted/40' : undefined}>
      <TableCell className={`${CELL} ${cls}`}>{label}</TableCell>
      <TableCell className={`${MONEY} ${cls}`}>{r.orders}</TableCell>
      <TableCell className={`${MONEY} ${cls}`}>{formatMoney(r.revenue)}</TableCell>
      <TableCell className={`${MONEY} font-semibold ${r.profit < 0 ? 'text-destructive' : ''}`}>{formatMoney(r.profit)}</TableCell>
    </TableRow>
  );
}

/** 7 ngày gần đây, mới nhất trước, dòng tổng cuối. */
export function WeekTable({ week, today }: { week: ProfitReport; today: string }) {
  return (
    <Panel title="7 ngày gần đây">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className={CELL}>Ngày</TableHead>
            <TableHead className={`${CELL} text-right`}>Đơn</TableHead>
            <TableHead className={`${CELL} text-right`}>Doanh thu</TableHead>
            <TableHead className={`${CELL} text-right`}>Lãi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {week.rows.map((r) => (
            <Row key={r.period} r={r} label={dayLabel(r.period, today)} />
          ))}
          <Row r={week.total} label="Tổng 7 ngày" total />
        </TableBody>
      </Table>
    </Panel>
  );
}
```

`RecentOrders.tsx`:

```tsx
import { formatMoney, type OrderSummary } from '@tiny-pos/shared';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { EmptyLine, Panel } from './Panel';
import { METHOD_LABEL, time } from './format';

const CELL = 'px-3 py-2';

function payment(o: OrderSummary) {
  if (o.status === 'cancelled') return <Badge variant="secondary">Đã hủy</Badge>;
  if (o.paymentMethod === 'debt') return <Badge variant="outline">Ghi nợ · {o.customerName}</Badge>;
  return METHOD_LABEL[o.paymentMethod];
}

/** Hóa đơn hôm nay mới nhất trước, kể cả đơn hủy (gạch ngang). */
export function RecentOrders({ orders, count }: { orders: OrderSummary[]; count: number }) {
  return (
    <Panel title="Hóa đơn hôm nay" count={`${count} đơn`}>
      {orders.length === 0 ? (
        <EmptyLine>Chưa có hóa đơn hôm nay</EmptyLine>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className={CELL}>Mã</TableHead>
              <TableHead className={CELL}>Thanh toán</TableHead>
              <TableHead className={`${CELL} text-right`}>Tổng</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => (
              <TableRow key={o.id} className={cn(o.status === 'cancelled' && 'text-muted-foreground line-through')}>
                <TableCell className={CELL}>
                  <div className="font-medium">{o.code.slice(-4)}</div>
                  <div className="text-xs text-muted-foreground">{time(o.createdAt)}</div>
                </TableCell>
                <TableCell className={`${CELL} no-underline`}>{payment(o)}</TableCell>
                <TableCell className={`${CELL} text-right font-medium tabular-nums`}>{formatMoney(o.payable)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}
```

Kiểm `OrderSummary` có `createdAt` (xem `shared/src/types.ts` dòng 72–90); không có thì dùng trường ngày giờ tương ứng trong interface đó.

`LowStock.tsx`:

```tsx
import { formatQty, type Overview } from '@tiny-pos/shared';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { EmptyLine, Panel } from './Panel';
import { initials, tintFor } from './format';

const CELL = 'px-3 py-2';

/** Hàng dưới mức tối thiểu, thiếu nặng nhất trước; ảnh nằm ở máy quầy nên chỉ hiện chữ cái. */
export function LowStock({ low }: { low: Overview['lowStock'] }) {
  const more = low.count - low.items.length;
  return (
    <Panel title="Hàng sắp hết" count={`${low.count} mặt hàng`}>
      {low.items.length === 0 ? (
        <EmptyLine>Không có mặt hàng nào dưới mức tối thiểu</EmptyLine>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className={CELL}>Mặt hàng</TableHead>
              <TableHead className={`${CELL} text-right`}>Tồn</TableHead>
              <TableHead className={`${CELL} text-right`}>Tối thiểu</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {low.items.map((p) => (
              <TableRow key={p.productId}>
                <TableCell className={CELL}>
                  <div className="flex items-center gap-2">
                    <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg text-xs font-semibold', tintFor(p.name))} aria-hidden="true">
                      {initials(p.name) || '?'}
                    </span>
                    <span className="min-w-0 truncate font-medium">{p.name}</span>
                  </div>
                </TableCell>
                <TableCell className={cn(CELL, 'text-right tabular-nums whitespace-nowrap', p.stock <= 0 && 'font-semibold text-destructive')}>
                  {formatQty(p.stock)} {p.unit}
                </TableCell>
                <TableCell className={`${CELL} text-right tabular-nums whitespace-nowrap text-muted-foreground`}>
                  {formatQty(p.minStock)} {p.unit}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {more > 0 && <div className="border-t px-4 py-2 text-sm text-muted-foreground">và {more} mặt hàng nữa</div>}
    </Panel>
  );
}
```

`DebtList.tsx`:

```tsx
import { formatMoney, type DebtPartyRow, type OverdueCustomerRow } from '@tiny-pos/shared';
import { Badge } from '@/components/ui/badge';
import { EmptyLine, Panel } from './Panel';
import { shortDay, localDay } from './format';

type Row = DebtPartyRow & Partial<Pick<OverdueCustomerRow, 'lastPaymentAt' | 'owingSince' | 'overdue'>>;

/** "Nợ từ dd/mm · trả gần nhất dd/mm" cho khách nợ lâu, như DebtPanel máy quầy. */
function overdueHint(r: Row): string {
  const since = r.owingSince ?? r.lastPaymentAt;
  const from = since ? `Nợ từ ${shortDay(localDay(since))}` : 'Chưa có giao dịch';
  return r.lastPaymentAt ? `${from} · trả gần nhất ${shortDay(localDay(r.lastPaymentAt))}` : `${from} · chưa trả lần nào`;
}

/** Khách nợ / nợ NCC: tổng + số người ở đầu, danh sách nợ nhiều nhất; khách nợ lâu có badge và hint vàng. */
export function DebtList({ title, summary, rows, emptyTitle }: { title: string; summary: { total: number; count: number }; rows: Row[]; emptyTitle: string }) {
  const more = summary.count - rows.length;
  return (
    <Panel title={title} count={summary.count ? `${summary.count} người · ${formatMoney(summary.total)}` : undefined}>
      {rows.length === 0 ? (
        <EmptyLine>{emptyTitle}</EmptyLine>
      ) : (
        <ul className="divide-y border-t">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{r.name}</span>
                  {r.overdue && <Badge variant="outline" className="border-warning text-warning">Nợ lâu</Badge>}
                </div>
                {r.overdue ? <div className="text-xs text-warning">{overdueHint(r)}</div> : r.phone && <div className="text-xs text-muted-foreground">{r.phone}</div>}
              </div>
              <span className="shrink-0 font-semibold tabular-nums">{formatMoney(r.debt)}</span>
            </li>
          ))}
        </ul>
      )}
      {more > 0 && <div className="border-t px-4 py-2 text-sm text-muted-foreground">và {more} người nữa</div>}
    </Panel>
  );
}
```

`BackupLine.tsx`:

```tsx
import { DatabaseBackup } from 'lucide-react';
import type { OverviewBackup } from '@tiny-pos/shared';
import { Card, CardContent } from '@/components/ui/card';
import { localDay, shortDay, time } from './format';

/** Một dòng sao lưu; `backup` null (server không cấu hình) thì không hiện. */
export function BackupLine({ backup }: { backup: OverviewBackup | null }) {
  if (!backup) return null;
  const at = backup.lastBackupAt ? `${time(backup.lastBackupAt)} ${shortDay(localDay(backup.lastBackupAt))}` : 'chưa có';
  return (
    <Card className="py-0">
      <CardContent className="flex items-center gap-3 px-4 py-3 text-sm">
        <DatabaseBackup className="size-5 shrink-0 text-muted-foreground" />
        <span>
          Sao lưu gần nhất: <span className="font-medium">{at}</span>
        </span>
        {backup.lastError && <span className="ml-auto text-destructive">Lỗi: {backup.lastError}</span>}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 7: Ghép vào `App.tsx`**

Thay dòng `return <pre ...>` trong `Dashboard` bằng:

```tsx
  const { doc, fromCache } = state;
  const o = doc.data;
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4 pb-8">
      <Header storeName={doc.storeName} updatedAt={doc.updatedAt} fromCache={fromCache} />
      <TodayStats week={o.week} outCount={o.lowStock.outCount} />
      <Alerts data={o} />
      <WeekTable week={o.week} today={o.today} />
      <RecentOrders orders={o.recentOrders} count={o.week.rows[0]?.orders ?? 0} />
      <LowStock low={o.lowStock} />
      <DebtList title="Khách nợ" summary={o.customers} rows={o.customers.top} emptyTitle="Không ai đang nợ" />
      <DebtList title="Nợ nhà cung cấp" summary={o.suppliers} rows={o.suppliers.top} emptyTitle="Không nợ nhà cung cấp nào" />
      <BackupLine backup={o.backup} />
      <p className="text-center text-xs text-muted-foreground">Tiny POS {doc.appVersion} · trang xem {__APP_VERSION__}</p>
    </main>
  );
```

Thêm import ở đầu `App.tsx`:

```ts
import { Header } from './blocks/Header';
import { TodayStats } from './blocks/TodayStats';
import { Alerts } from './blocks/Alerts';
import { WeekTable } from './blocks/WeekTable';
import { RecentOrders } from './blocks/RecentOrders';
import { LowStock } from './blocks/LowStock';
import { DebtList } from './blocks/DebtList';
import { BackupLine } from './blocks/BackupLine';
```

- [ ] **Step 8: Typecheck, build**

Run: `npm run typecheck -w remote && npm run build -w remote`
Expected: không lỗi.

- [ ] **Step 9: Kiểm tay toàn luồng với project thử (nếu có)**

1. `cd remote && npx firebase use <project-thử>` (tạo `.firebaserc`, không vào git) → `npm run deploy -w remote`.
2. Máy dev: chép khóa service account của project thử vào `data/remote/service-account.json`, `npm run dev`, Cài đặt → Xem từ xa: thêm email mình, Bật, Gửi ngay → "Gửi lần cuối HH:mm".
3. Điện thoại (4G, không Wi‑Fi nhà) quét QR, đăng nhập → thấy đúng số của trang Tổng quan trên máy dev. Chụp màn hình sáng/tối.
4. Bán thử một đơn trên máy dev (DB dev của mình, không phải máy tiệm) → trong ≤ 1 phút điện thoại đổi số.
5. Xóa email mình trong Cài đặt → điện thoại chuyển sang "Chưa được cấp quyền xem". Thêm lại → quay về số liệu.
6. Tắt Wi‑Fi điện thoại → dòng "Điện thoại đang ngoại tuyến". Dừng server 10 phút (hoặc tạm sửa `REMOTE_STALE_MS` lúc dev rồi hoàn lại) → dòng vàng "chưa gửi số mới từ…".
7. Tắt công tắc → điện thoại "Máy quầy chưa gửi số liệu lần nào".

Không có project thử: bỏ qua, ghi rõ trong báo cáo cuối.

---

### Task 8: Tài liệu, version, kiểm toàn bộ, commit

**Files:**
- Modify: `package.json` gốc (`version`), `shared/package.json`, `server/package.json`, `client/package.json`, `remote/package.json` (`version`)
- Modify: `README.md`, `CLAUDE.md`

- [ ] **Step 1: Version 0.14.0**

Đổi `"version"` thành `"0.14.0"` ở `package.json` gốc và 4 workspace. Chỉ dòng đó.

- [ ] **Step 2: README – mục *Xem từ xa***

Thêm mục mới ngay sau mục `## Sao lưu và khôi phục` (trước `## Lệnh khác`):

```markdown
## Xem từ xa (0.14.0)

Chủ tiệm ở ngoài tiệm mở điện thoại xem được trang Tổng quan (doanh thu, lãi, hóa đơn hôm nay, hàng sắp hết, công nợ,
sao lưu). **Chỉ xem**, không bán hàng, không sửa gì. Máy quầy đẩy một bản tổng hợp (vài KB) lên Firebase của **chính
tiệm** mỗi khi có chứng từ mới (tối đa mỗi phút một lần); mất Internet thì tự thử lại, không ảnh hưởng bán hàng.
Dữ liệu này nằm trên máy chủ Google trong tài khoản của chủ tiệm; tắt tính năng trong Cài đặt là xóa ngay.

Cài cho một tiệm (người triển khai làm, một lần):

1. Vào https://console.firebase.google.com bằng tài khoản Google của chủ tiệm, tạo project (tắt Analytics).
2. *Firestore Database* → tạo, chế độ production, vùng `asia-southeast1`.
3. *Authentication* → *Sign-in method* → bật *Google*.
4. *Project settings* → *Service accounts* → *Generate new private key*; chép file thành
   `data\remote\service-account.json` trên máy quầy (thư mục `data\remote` được tạo sẵn khi server chạy).
   Không cần khởi động lại.
5. Trên máy của người triển khai: `npm install`, `npx firebase login` (một lần), `cd remote && npx firebase use <project-id>`,
   rồi `npm run deploy -w remote` (build + deploy Hosting và rules). Mạng công ty chặn TLS thì đặt `NODE_EXTRA_CA_CERTS`.
6. Trên máy quầy: Cài đặt → Xem từ xa → thêm email Google của chủ tiệm → bật → *Gửi ngay*. Chủ tiệm quét mã QR trên
   thẻ, đăng nhập Google, chọn *Thêm vào màn hình chính*.

Gỡ: tắt công tắc (xóa dữ liệu trên Firestore), xóa file khóa; xóa project Firebase nếu muốn sạch hẳn.
Dev trang xem tại máy mình: chép `remote/.env.example` thành `remote/.env.local`, dán web config, `npm run dev -w remote`
(cổng 5181).
```

Thêm mục kiểm thử thủ công ở cuối README:

```markdown
## Kiểm thử thủ công – Xem từ xa 0.14.0

1. Chưa có file khóa: Cài đặt → thẻ *Xem từ xa* chỉ hiện hướng dẫn, không có công tắc.
2. Chép file khóa vào `data\remote\` → tải lại Cài đặt: có công tắc, tên project, QR. Bật khi chưa có email → dòng vàng
   "Chưa có email nào được xem".
3. Thêm email ` ChuTiem@Gmail.com ` → hiện `chutiem@gmail.com`; thêm lần nữa → "Email này đã có"; `abc` → "Email không hợp lệ".
4. *Gửi ngay* → "Gửi lần cuối HH:mm". Rút mạng máy quầy, *Gửi ngay* → lỗi đỏ "Không gửi được: …"; cắm lại, chờ 1 phút → hết lỗi.
5. Điện thoại 4G quét QR, đăng nhập email trên → thấy đúng số Tổng quan; bán một đơn → ≤ 1 phút điện thoại đổi.
   Email khác → "Chưa được cấp quyền xem". Xóa email đang xem → điện thoại chuyển sang bị từ chối.
6. Tắt công tắc → điện thoại "Máy quầy chưa gửi số liệu lần nào". Tắt server 10 phút khi đang bật → dòng vàng "chưa gửi số mới từ…".
```

- [ ] **Step 3: CLAUDE.md**

Bảng *Lệnh*: thêm một dòng sau dòng `scripts\install.cmd`:

```markdown
| `npm run deploy -w remote` | build + deploy trang xem từ xa lên Firebase Hosting của project đang `firebase use` (không nằm trong `npm run build`) |
```

Dòng `npm run dev` không đổi (`remote/` không chạy cùng dev). Mục *Kiến trúc*: thêm gạch đầu dòng sau `client/`:

```markdown
- `remote/` – trang xem từ xa (React + Vite, không router/Query), chạy trên Firebase Hosting, đăng nhập Google, `onSnapshot` tài liệu Firestore `remote/overview`. Chỉ import từ `@tiny-pos/shared`, **không** từ `client/`; shadcn copy riêng trong `remote/src/components/ui`.
```

Đoạn *Đã xong*: thêm vào cuối câu (trước dấu chấm cuối):

```
, Xem từ xa 0.14.0 (`services/remote-sync.ts` đẩy `Overview` lên Firestore `remote/overview` một chiều theo mtime DB / sang ngày, `firebase-admin` import động trong `remote-writer.ts`, khóa `data/remote/service-account.json`, cấu hình `remoteEnabled`/`remoteEmails` trong bảng `settings`, API `/api/remote`, thẻ Xem từ xa trong Cài đặt có QR, workspace `remote/` trên Firebase Hosting với rules theo `remote/access`)
```

Mục *Bất biến nghiệp vụ*: thêm sau dòng **Ảnh sản phẩm**:

```markdown
- **Xem từ xa** chỉ một chiều qua `services/remote-sync.ts`: server `set`/`delete` Firestore, không bao giờ đọc về; mỗi lệnh có timeout, lỗi vào `lastError` không chặn bán hàng; khóa Firebase ở `data/remote/`, không trong DB; `remote/` không import từ `client/`; `npm run build` gốc không build `remote/`.
```

- [ ] **Step 4: Kiểm toàn bộ (skill `check`)**

Run (gốc repo): `npm run typecheck && npm test && npm run build -w client`
Expected: typecheck 4 workspace không lỗi; test shared + server PASS hết (kể cả 2 file mới); client build xong.

- [ ] **Step 5: Soát diff không format lại file cũ**

Run: `git status --short && git diff --stat`
Expected: file cũ chỉ đổi vài dòng mỗi file (`routes/overview.ts`, `routes/index.ts`, `app.ts`, `index.ts`, `services/overview.ts`, `SettingsPage.tsx`, `types.ts`, `common.ts`, `index.ts` shared, 5 `package.json`, `package-lock.json`, `.gitignore`, `README.md`, `CLAUDE.md`). File nào đổi nhiều bất thường thì `git diff <file>` kiểm; hunk chỉ là format thì hoàn tác. `remote/.firebaserc`, `remote/.env.local`, `data/` không được xuất hiện.

- [ ] **Step 6: Một commit cho cả đợt**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: xem từ xa 0.14.0 – đẩy Tổng quan lên Firestore một chiều, thẻ Xem từ xa trong Cài đặt, trang remote/ đăng nhập Google trên Firebase Hosting

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
)"
```

Kiểm `git status` sạch và `git log --oneline -1` đúng message.
