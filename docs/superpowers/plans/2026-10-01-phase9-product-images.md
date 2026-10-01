# Giai đoạn 9 – Ảnh sản phẩm (0.13.0) – Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mỗi sản phẩm gắn được một ảnh (chụp từ điện thoại hoặc chọn file), hiện thay ô chữ cái ở bảng/thẻ Sản phẩm, gợi ý tìm, Thêm nhanh, Tồn thấp; bấm xem to; ảnh được chép sang *Thư mục chép thêm* của sao lưu.

**Architecture:** Cột `products.image` (migration `0006`, nullable) giữ tên file; file nằm ở `data/images/` và được phục vụ tĩnh tại `/images/<tên>` với cache immutable (tên đổi mỗi lần thay ảnh). Trình duyệt thu nhỏ ảnh về JPEG ≤ 512px bằng canvas rồi `PUT` thân thô lên `/api/products/:id/image`; server (`services/product-images.ts`) chỉ kiểm tra JPEG/kích cỡ, ghi file rồi cập nhật cột. `ProductAvatar` nhận `image` và rơi về chữ cái khi không có/ảnh lỗi. Sao lưu `.db` không đổi; `copyExtra` chép thêm ảnh còn thiếu sang `<extra>/images/`.

**Tech Stack:** TypeScript ESM, Express 5 (`express.raw`, `express.static`), drizzle-orm + better-sqlite3, vitest, React 19 + TanStack Query 5, shadcn/ui, lucide-react. **Không thêm thư viện nào.**

**Spec:** `docs/superpowers/specs/2026-10-01-tiny-pos-product-images-design.md`

## Global Constraints

- Text UI, thông báo lỗi API, comment code, commit message: **tiếng Việt**.
- **Không format lại file có sẵn**: diff chỉ chứa dòng cần đổi; không chạy prettier/eslint; theo phong cách xung quanh (2 space, nháy đơn, có `;`, dòng ≤ ~130 ký tự). Thêm tên vào dòng import có sẵn là được, không sắp xếp lại import.
- **Git**: làm trên `master`, **không commit từng task**; cả đợt là **một commit** ở Task 7: `feat: ảnh sản phẩm 0.13.0 – chụp/chọn ảnh thu nhỏ ở trình duyệt, lưu data/images, hiện ở danh sách và gợi ý, chép sang thư mục sao lưu thêm`.
- Migration mới là `0006`, chỉ `ALTER TABLE products ADD image text` (nullable); không sửa `0000`–`0005`. Server dev khởi động lại sẽ tự chạy nó trên DB dev (thêm một cột rỗng): bình thường.
- Chỉ nhận **JPEG** (2 byte đầu `FF D8`), thân ≤ **1 MB** (`1_048_576` byte). Tên file `p<id>-<Date.now()>.jpg`. Ảnh chỉ đổi qua `services/product-images.ts`; `productInputSchema` **không** nhận `image`.
- Server **không** xử lý ảnh (không `sharp`, không `jimp`). Trình duyệt thu nhỏ: cạnh dài ≤ 512px, JPEG chất lượng 0.82, luôn vẽ lại kể cả ảnh nhỏ.
- `/images/*` phục vụ tĩnh `Cache-Control: public, max-age=31536000, immutable`; tên lạ → 404 rỗng, **không** trả `index.html`.
- Sao lưu/khôi phục `.db` giữ nguyên; chỉ `copyExtra` chép **thêm** ảnh thiếu, không xóa.
- UI dùng component có sẵn (`ProductAvatar`, `SectionTitle`, shadcn `Dialog`/`Button`), icon lucide-react (`Camera`, `Trash2`), màu từ token. Không mã màu trong trang.
- Mạng công ty chặn TLS: lệnh npm cần `NODE_EXTRA_CA_CERTS=<repo>/.certs/corp-root.pem`; **không bao giờ** tắt kiểm tra TLS.
- Không dùng/kill cổng 5173/5174; kiểm trên trình duyệt **không ghi** vào `data/grocery.db` (skill `browser-verify`: chặn request ghi, stub GET).
- Chạy test/typecheck từ **gốc repo** (`npm test`, `npm run typecheck`) để `shared` được build trước. Một file server: `npm run build -w shared` (nếu vừa sửa shared) rồi `cd server && npx vitest run <file>`.

## Review Focus

1. **Gửi lại ảnh cùng mili-giây / gọi `PUT` hai lần liên tiếp** → tên file mới không được xóa nhầm (chỉ xóa file cũ khi tên khác) → test "lưu hai lần cùng `now`" ở Task 2.
2. **Bản sao cũ có tên ảnh mà file không còn** (khôi phục, xóa tay) → `/images/<tên>` trả 404, không trả `index.html`; client `onError` rơi về chữ cái → test 404 ở Task 4, kiểm `onError` bằng trình duyệt ở Task 7.
3. **`updateProduct` sau khi có ảnh** (sửa tên/giá) → `image` không bị xóa dù `productInputSchema` không có trường này → test ở Task 2.
4. **Thư mục chép thêm là USB đã rút** → lỗi chép ảnh thành `extraError`, sao lưu chính vẫn thành công → test ở Task 3.
5. **Thêm sản phẩm mới kèm ảnh nhưng gửi ảnh lỗi** (server tắt giữa chừng, 503) → sản phẩm vẫn tạo, toast riêng, dialog vẫn đóng với sản phẩm vừa tạo → logic `flush` ở Task 6, kiểm bằng trình duyệt (chặn `PUT` → 403) ở Task 7.

---

## Cấu trúc file

| File | Việc |
|---|---|
| `server/src/db/schema.ts` (sửa) | cột `image` |
| `server/drizzle/0006_*.sql` + `meta/` (sinh) | migration |
| `shared/src/types.ts` (sửa) | `Product.image`, `LowStockRow.image` |
| `server/src/services/overview.ts` + `overview.test.ts` (sửa) | map `image` vào tồn thấp |
| `server/src/services/product-images.ts` (mới) + `product-images.test.ts` (mới) | `ImageDeps`, `NO_IMAGES`, `MAX_IMAGE_BYTES`, `saveProductImage`, `deleteProductImage`, `copyMissingImages` |
| `server/src/services/products.test.ts` (sửa) | `updateProduct` giữ `image` |
| `server/src/services/backups.ts` + `backups.test.ts` (sửa) | `imagesDir`, chép ảnh trong `copyExtra` |
| `server/src/routes/products.ts`, `routes/index.ts`, `app.ts`, `index.ts` (sửa) | `PUT`/`DELETE /:id/image`, `/images` tĩnh, nối `imagesDir` |
| `server/src/routes/product-images-api.test.ts` (mới) | API + tĩnh |
| `client/vite.config.ts` (sửa) | proxy `/images` |
| `client/src/lib/image-resize.ts` (mới) | `resizeImage` |
| `client/src/api/products.ts` (sửa) | `productImageUrl`, `useSaveProductImage`, `useDeleteProductImage` |
| `client/src/components/ProductAvatar.tsx` (sửa) | prop `image`, `onError` |
| `client/src/components/ProductImageDialog.tsx` (mới) | xem ảnh to |
| `client/src/pages/products/ProductTable.tsx`, `ProductCardList.tsx` (sửa) | `ProductAvatarButton`, dialog xem ảnh |
| `client/src/components/ProductSearch.tsx`, `pages/quick-add/QuickAddPage.tsx`, `pages/overview/LowStockList.tsx` (sửa) | truyền `image` |
| `client/src/pages/products/useProductImage.ts` (mới) | chọn/thu nhỏ/gửi/xóa ảnh, ảnh tạm khi thêm mới |
| `client/src/pages/products/ProductFormDialog.tsx` (sửa) | khối *Ảnh* |
| `client/src/pages/settings/BackupCard.tsx` (sửa) | ghi chú ảnh |
| `package.json`, `README.md`, `CLAUDE.md` (sửa) | 0.13.0, tài liệu |

---

### Task 1: Cột `image` – schema, migration 0006, types, tồn thấp

**Files:**
- Modify: `server/src/db/schema.ts` (bảng `products`, sau `isActive`)
- Create (sinh): `server/drizzle/0006_*.sql`, `server/drizzle/meta/0006_snapshot.json`, `meta/_journal.json`
- Modify: `shared/src/types.ts:8-24` (`Product`), `:397-403` (`LowStockRow`)
- Modify: `server/src/services/overview.ts:43`
- Modify: `server/src/services/overview.test.ts:92`

**Interfaces:**
- Produces: `products.image: text | null` (drizzle), `Product.image: string | null`, `LowStockRow.image: string | null`.

- [ ] **Step 1: Thêm cột vào schema**

Trong `server/src/db/schema.ts`, bảng `products`, thêm một dòng sau `isActive`:

```ts
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    /** Tên file ảnh trong data/images (p<id>-<ms>.jpg); null = chưa có. Chỉ đổi qua services/product-images.ts. */
    image: text('image'),
```

- [ ] **Step 2: Sinh migration**

Run: `npm run db:generate`
Expected: tạo `server/drizzle/0006_<tên>.sql` chứa đúng một câu:

```sql
ALTER TABLE `products` ADD `image` text;
```

và `_journal.json` có mục `idx: 6`. Mở file SQL xem đúng như trên (nullable, không `NOT NULL`), không sửa tay.

- [ ] **Step 3: Types ở shared**

`shared/src/types.ts`, trong `interface Product` thêm sau `isActive: boolean;`:

```ts
  /** Tên file ảnh (`/images/<image>`); null = chưa có. */
  image: string | null;
```

Trong `interface LowStockRow` thêm sau `name: string;`:

```ts
  image: string | null;
```

- [ ] **Step 4: Test tồn thấp có `image`**

`server/src/services/overview.test.ts:92` sửa dòng `toEqual` thành:

```ts
    expect(o.lowStock.items[0]).toEqual({ productId: expect.any(Number), name: 'Bánh', image: null, unit: 'gói', stock: 0, minStock: 4 });
```

Run: `npm run build -w shared && cd server && npx vitest run src/services/overview.test.ts`
Expected: FAIL – thiếu `image` trong object (và typecheck sẽ kêu `LowStockRow` thiếu `image`).

- [ ] **Step 5: Map `image` ở overview**

`server/src/services/overview.ts:43`:

```ts
    .map((p) => ({ productId: p.id, name: p.name, image: p.image, unit: p.unit, stock: p.stock, minStock: p.minStock }));
```

- [ ] **Step 6: Chạy test + typecheck**

Run: `cd server && npx vitest run src/services/overview.test.ts` → PASS.
Run (gốc repo): `npm run typecheck` → PASS cả 3 workspace (`Product` thêm trường bắt buộc nhưng mọi nơi tạo `Product` đều lấy từ `getTableColumns(products)` nên tự có).

### Task 2: Service `product-images.ts`

**Files:**
- Create: `server/src/services/product-images.ts`
- Create: `server/src/services/product-images.test.ts`
- Modify: `server/src/services/products.test.ts` (thêm 1 test)

**Interfaces:**
- Consumes: `getProduct(db, id)` (`services/products.ts`), `products` (schema), `BadRequestError`, `NotFoundError`, `HttpError` (`errors.ts`).
- Produces:

```ts
export interface ImageDeps { dir: string }
export const NO_IMAGES: ImageDeps;                       // dir '' → 503
export const MAX_IMAGE_BYTES = 1_048_576;
export function saveProductImage(db: Db, deps: ImageDeps, id: number, body: Buffer, now?: number): ProductWithUnits;
export function deleteProductImage(db: Db, deps: ImageDeps, id: number): void;
export function copyMissingImages(from: string, to: string): number;
```

- [ ] **Step 1: Viết test**

`server/src/services/product-images.test.ts`:

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { productInputSchema } from '@tiny-pos/shared';
import { createTestDb } from '../db/test-db.js';
import type { Db } from '../db/connection.js';
import { BadRequestError, HttpError, NotFoundError } from '../errors.js';
import { createProduct, getProduct, updateProduct } from './products.js';
import { copyMissingImages, deleteProductImage, MAX_IMAGE_BYTES, NO_IMAGES, saveProductImage } from './product-images.js';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]); // đầu file JPEG thật, phần sau không cần
let db: Db;
let root: string;
let deps: { dir: string };
const product = () => createProduct(db, productInputSchema.parse({ name: 'Sữa', sellPrice: 1000 }));
const files = () => fs.readdirSync(deps.dir).sort();

beforeEach(() => {
  db = createTestDb();
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'tiny-pos-images-'));
  deps = { dir: path.join(root, 'images') }; // chưa tồn tại: service phải tự tạo
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('saveProductImage', () => {
  it('ghi file p<id>-<now>.jpg, cập nhật image và updatedAt', () => {
    const p = product();
    const before = p.updatedAt;
    const saved = saveProductImage(db, deps, p.id, JPEG, 1700000000000);
    expect(saved.image).toBe(`p${p.id}-1700000000000.jpg`);
    expect(files()).toEqual([`p${p.id}-1700000000000.jpg`]);
    expect(fs.readFileSync(path.join(deps.dir, saved.image!))).toEqual(JPEG);
    expect(saved.updatedAt >= before).toBe(true);
    expect(getProduct(db, p.id).image).toBe(saved.image);
  });

  it('lưu lần hai → file cũ bị xóa, tên mới', () => {
    const p = product();
    saveProductImage(db, deps, p.id, JPEG, 1);
    const s = saveProductImage(db, deps, p.id, JPEG, 2);
    expect(s.image).toBe(`p${p.id}-2.jpg`);
    expect(files()).toEqual([`p${p.id}-2.jpg`]);
  });

  it('lưu hai lần cùng now → cùng tên, file vẫn còn (không tự xóa tên mới)', () => {
    const p = product();
    saveProductImage(db, deps, p.id, JPEG, 5);
    saveProductImage(db, deps, p.id, JPEG, 5);
    expect(files()).toEqual([`p${p.id}-5.jpg`]);
  });

  it('không phải JPEG → 400; quá 1 MB → 400; không ghi file', () => {
    const p = product();
    expect(() => saveProductImage(db, deps, p.id, Buffer.from('hello'))).toThrow(new BadRequestError('Ảnh phải là JPEG'));
    expect(() => saveProductImage(db, deps, p.id, Buffer.alloc(0))).toThrow(new BadRequestError('Ảnh phải là JPEG'));
    const big = Buffer.concat([JPEG, Buffer.alloc(MAX_IMAGE_BYTES)]);
    expect(() => saveProductImage(db, deps, p.id, big)).toThrow(new BadRequestError('Ảnh quá lớn (tối đa 1 MB)'));
    expect(fs.existsSync(deps.dir) ? files() : []).toEqual([]);
    expect(getProduct(db, p.id).image).toBeNull();
  });

  it('sản phẩm không có → 404; chưa cấu hình thư mục → 503', () => {
    expect(() => saveProductImage(db, deps, 999, JPEG)).toThrow(new NotFoundError('Không tìm thấy sản phẩm'));
    const p = product();
    expect(() => saveProductImage(db, NO_IMAGES, p.id, JPEG)).toThrow(new HttpError(503, 'Chưa cấu hình thư mục ảnh'));
  });
});

describe('deleteProductImage', () => {
  it('xóa → image null, file mất; xóa khi không có ảnh → không lỗi; 404 id lạ', () => {
    const p = product();
    saveProductImage(db, deps, p.id, JPEG, 1);
    deleteProductImage(db, deps, p.id);
    expect(getProduct(db, p.id).image).toBeNull();
    expect(files()).toEqual([]);
    expect(() => deleteProductImage(db, deps, p.id)).not.toThrow();
    expect(() => deleteProductImage(db, deps, 999)).toThrow(new NotFoundError('Không tìm thấy sản phẩm'));
  });
});

describe('copyMissingImages', () => {
  it('chép file thiếu, bỏ qua file đã có và file không phải .jpg; nguồn không có → 0', () => {
    const to = path.join(root, 'extra', 'images');
    expect(copyMissingImages(deps.dir, to)).toBe(0);
    fs.mkdirSync(deps.dir, { recursive: true });
    fs.writeFileSync(path.join(deps.dir, 'p1-1.jpg'), 'a');
    fs.writeFileSync(path.join(deps.dir, 'p2-1.jpg'), 'b');
    fs.writeFileSync(path.join(deps.dir, 'Thumbs.db'), 'x');
    expect(copyMissingImages(deps.dir, to)).toBe(2);
    expect(fs.readdirSync(to).sort()).toEqual(['p1-1.jpg', 'p2-1.jpg']);
    fs.writeFileSync(path.join(to, 'p1-1.jpg'), 'đã có, không ghi đè');
    fs.writeFileSync(path.join(deps.dir, 'p3-1.jpg'), 'c');
    expect(copyMissingImages(deps.dir, to)).toBe(1);
    expect(fs.readFileSync(path.join(to, 'p1-1.jpg'), 'utf8')).toBe('đã có, không ghi đè');
  });
});
```

Thêm vào `server/src/services/products.test.ts`, cuối `describe('products', …)`:

```ts
  it('updateProduct không làm mất image (schema input không có trường này)', () => {
    const p = createProduct(db, input({ name: 'Có ảnh' }));
    db.update(products).set({ image: 'p1-1.jpg' }).where(eq(products.id, p.id)).run();
    expect(updateProduct(db, p.id, input({ name: 'Đổi tên' })).image).toBe('p1-1.jpg');
  });
```

và thêm `products` vào dòng import schema (`import { products, stockMovements } from '../db/schema.js';`) + `import { eq } from 'drizzle-orm';` ở đầu file.

- [ ] **Step 2: Chạy test, thấy fail**

Run: `cd server && npx vitest run src/services/product-images.test.ts src/services/products.test.ts`
Expected: FAIL – `Cannot find module './product-images.js'`.

- [ ] **Step 3: Viết service**

`server/src/services/product-images.ts`:

```ts
import { eq, sql } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';
import type { ProductWithUnits } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { products } from '../db/schema.js';
import { BadRequestError, HttpError, NotFoundError } from '../errors.js';
import { getProduct } from './products.js';

/** Thư mục chứa ảnh (data/images). Server truyền vào, test dùng thư mục tạm. */
export interface ImageDeps {
  dir: string;
}

/** Không có thư mục ảnh (test API không cần ảnh): mọi thao tác ảnh trả 503. */
export const NO_IMAGES: ImageDeps = { dir: '' };

/** Trình duyệt đã thu nhỏ về ≤ 512px nên ảnh thật chỉ vài chục KB; 1 MB chặn gửi nhầm file gốc. */
export const MAX_IMAGE_BYTES = 1_048_576;

const isoNow = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

function requireDir(deps: ImageDeps): string {
  if (!deps.dir) throw new HttpError(503, 'Chưa cấu hình thư mục ảnh');
  fs.mkdirSync(deps.dir, { recursive: true });
  return deps.dir;
}

function currentImage(db: Db, id: number): string | null {
  const row = db.select({ image: products.image }).from(products).where(eq(products.id, id)).get();
  if (!row) throw new NotFoundError('Không tìm thấy sản phẩm');
  return row.image;
}

/** Xóa file ảnh cũ; lỗi (file đang bị khóa) chỉ ghi log, DB đã đúng rồi. */
function removeFile(dir: string, name: string | null): void {
  if (!name) return;
  try {
    fs.rmSync(path.join(dir, name), { force: true });
  } catch (e) {
    console.warn(`Không xóa được ảnh ${name}:`, e);
  }
}

/**
 * Lưu ảnh JPEG cho sản phẩm: ghi file `p<id>-<now>.jpg` trước, cập nhật DB sau (DB không bao giờ trỏ tới file chưa có),
 * rồi mới xóa file cũ. Tên có mốc thời gian để đổi ảnh là đổi URL (trình duyệt cache immutable).
 */
export function saveProductImage(db: Db, deps: ImageDeps, id: number, body: Buffer, now = Date.now()): ProductWithUnits {
  const dir = requireDir(deps);
  const old = currentImage(db, id);
  if (body.length < 2 || body[0] !== 0xff || body[1] !== 0xd8) throw new BadRequestError('Ảnh phải là JPEG');
  if (body.length > MAX_IMAGE_BYTES) throw new BadRequestError('Ảnh quá lớn (tối đa 1 MB)');
  const name = `p${id}-${now}.jpg`;
  fs.writeFileSync(path.join(dir, name), body);
  db.update(products).set({ image: name, updatedAt: isoNow }).where(eq(products.id, id)).run();
  if (old !== name) removeFile(dir, old);
  return getProduct(db, id);
}

export function deleteProductImage(db: Db, deps: ImageDeps, id: number): void {
  const dir = requireDir(deps);
  const old = currentImage(db, id);
  if (!old) return;
  db.update(products).set({ image: null, updatedAt: isoNow }).where(eq(products.id, id)).run();
  removeFile(dir, old);
}

/** Chép những ảnh `.jpg` ở `from` chưa có ở `to` (dùng cho Thư mục chép thêm của sao lưu). Không xóa, không ghi đè. */
export function copyMissingImages(from: string, to: string): number {
  if (!fs.existsSync(from)) return 0;
  fs.mkdirSync(to, { recursive: true });
  let n = 0;
  for (const name of fs.readdirSync(from)) {
    if (!name.endsWith('.jpg')) continue;
    const dest = path.join(to, name);
    if (fs.existsSync(dest)) continue;
    fs.copyFileSync(path.join(from, name), dest);
    n++;
  }
  return n;
}
```

- [ ] **Step 4: Chạy test, thấy pass**

Run: `cd server && npx vitest run src/services/product-images.test.ts src/services/products.test.ts`
Expected: PASS toàn bộ.

### Task 3: Sao lưu chép ảnh sang thư mục chép thêm

**Files:**
- Modify: `server/src/services/backups.ts:11-19` (`BackupOpts`), `:108-120` (`copyExtra`)
- Modify: `server/src/services/backups.test.ts` (thêm `describe`)

**Interfaces:**
- Consumes: `copyMissingImages(from, to)` (Task 2).
- Produces: `BackupOpts.imagesDir?: string`.

- [ ] **Step 1: Viết test**

Thêm vào cuối `server/src/services/backups.test.ts`:

```ts
describe('backups: ảnh sản phẩm sang thư mục chép thêm', () => {
  it('có imagesDir + extraDir → sau create, <extra>/images có đủ ảnh; chạy lại không lỗi', async () => {
    const images = path.join(root, 'images');
    fs.mkdirSync(images);
    fs.writeFileSync(path.join(images, 'p1-1.jpg'), 'a');
    const extra = path.join(root, 'usb');
    fs.mkdirSync(extra);
    const s = createBackupService(db, { dir: dir(), tmpDir: tmp(), imagesDir: images });
    s.setExtraDir(extra);
    await s.create('manual');
    expect(fs.readdirSync(path.join(extra, 'images'))).toEqual(['p1-1.jpg']);
    fs.writeFileSync(path.join(images, 'p2-1.jpg'), 'b');
    await s.create('manual');
    expect(fs.readdirSync(path.join(extra, 'images')).sort()).toEqual(['p1-1.jpg', 'p2-1.jpg']);
    expect(s.status().extraError).toBeNull();
  });

  it('imagesDir chưa tồn tại → sao lưu bình thường, không tạo <extra>/images', async () => {
    const extra = path.join(root, 'usb');
    fs.mkdirSync(extra);
    const s = createBackupService(db, { dir: dir(), tmpDir: tmp(), imagesDir: path.join(root, 'khong-co') });
    s.setExtraDir(extra);
    const m = await s.create('manual');
    expect(fs.existsSync(path.join(extra, m.name))).toBe(true);
    expect(fs.existsSync(path.join(extra, 'images'))).toBe(false);
    expect(s.status().extraError).toBeNull();
  });

  it('thư mục chép thêm biến mất sau khi đặt (USB rút) → extraError, bản sao chính vẫn tạo', async () => {
    const images = path.join(root, 'images');
    fs.mkdirSync(images);
    fs.writeFileSync(path.join(images, 'p1-1.jpg'), 'a');
    const extra = path.join(root, 'usb');
    fs.mkdirSync(extra);
    const s = createBackupService(db, { dir: dir(), tmpDir: tmp(), imagesDir: images });
    s.setExtraDir(extra);
    fs.rmSync(extra, { recursive: true, force: true });
    const m = await s.create('manual');
    expect(fs.existsSync(path.join(dir(), m.name))).toBe(true);
    expect(s.status().extraError).toMatch(/Không chép được sang/);
  });
});
```

Run: `cd server && npx vitest run src/services/backups.test.ts`
Expected: test 1 FAIL (không có `<extra>/images`), có thể lỗi TS vì `imagesDir` chưa có trong `BackupOpts`.

- [ ] **Step 2: Sửa `backups.ts`**

Thêm vào `BackupOpts` sau `tmpDir`:

```ts
  /** Thư mục ảnh sản phẩm (data/images); có thì chép thêm sang thư mục chép thêm cùng bản sao. */
  imagesDir?: string;
```

Thêm import: `import { copyMissingImages } from './product-images.js';`

Sửa `copyExtra` (giữ nguyên phần còn lại):

```ts
  /** Chép bản vừa tạo (và ảnh sản phẩm còn thiếu) sang thư mục thêm; lỗi chỉ ghi nhận (USB rút ra không được làm hỏng sao lưu chính). */
  const copyExtra = (name: string) => {
    const extra = getExtraDir();
    if (!extra) return;
    try {
      fs.copyFileSync(path.join(opts.dir, name), path.join(extra, name));
      pruneAuto(extra);
      if (opts.imagesDir) copyMissingImages(opts.imagesDir, path.join(extra, 'images'));
      extraError = null;
    } catch (e) {
```

- [ ] **Step 3: Chạy test**

Run: `cd server && npx vitest run src/services/backups.test.ts`
Expected: PASS (cả test cũ).

### Task 4: API ảnh, phục vụ tĩnh `/images`, nối dây server

**Files:**
- Modify: `server/src/routes/products.ts` (chữ ký `productsRouter`, 2 route)
- Modify: `server/src/routes/index.ts` (deps `images`)
- Modify: `server/src/app.ts` (`imagesDir`, static)
- Modify: `server/src/index.ts` (tạo `imagesDir`, truyền vào backups + app)
- Modify: `client/vite.config.ts:35` (proxy)
- Create: `server/src/routes/product-images-api.test.ts`

**Interfaces:**
- Consumes: `saveProductImage`, `deleteProductImage`, `NO_IMAGES`, `ImageDeps` (Task 2); `BackupOpts.imagesDir` (Task 3).
- Produces: `productsRouter(db, images: ImageDeps)`; `apiRouter(db, { backups?, labels?, images? })`; `createApp(db, { clientDist?, backups?, labels?, imagesDir? })`; `PUT /api/products/:id/image` (thân thô, 200 `ProductWithUnits`), `DELETE /api/products/:id/image` (204), `GET /images/<tên>`.

- [ ] **Step 1: Viết test API**

`server/src/routes/product-images-api.test.ts`:

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from '../db/test-db.js';
import { createApp } from '../app.js';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
let server: Server;
let base: string;
let root: string;
let imagesDir: string;

beforeAll(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'tiny-pos-images-api-'));
  imagesDir = path.join(root, 'images');
  // clientDist giả để SPA fallback bật: kiểm /images/<lạ> không được trả index.html
  const dist = path.join(root, 'dist');
  fs.mkdirSync(dist);
  fs.writeFileSync(path.join(dist, 'index.html'), '<html>spa</html>');
  server = createApp(createTestDb(), { clientDist: dist, imagesDir }).listen(0);
  await new Promise((r) => server.once('listening', r));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});
afterAll(() => {
  server.close();
  fs.rmSync(root, { recursive: true, force: true });
});

const raw = (method: string, p: string, body?: Buffer | string) =>
  fetch(base + p, { method, headers: body !== undefined ? { 'content-type': 'application/octet-stream' } : {}, body });

describe('API ảnh sản phẩm', () => {
  it('PUT ảnh → 200 có image, GET /images/<tên> → jpeg immutable; DELETE → 204 và 404 khi tải', async () => {
    const created = await fetch(`${base}/api/products`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Sữa', sellPrice: 1000 }),
    });
    const { id } = (await created.json()) as { id: number };
    const put = await raw('PUT', `/api/products/${id}/image`, JPEG);
    expect(put.status).toBe(200);
    const { image } = (await put.json()) as { image: string };
    expect(image).toMatch(new RegExp(`^p${id}-\\d+\\.jpg$`));
    const get = await fetch(`${base}/images/${image}`);
    expect(get.status).toBe(200);
    expect(get.headers.get('content-type')).toBe('image/jpeg');
    expect(get.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(Buffer.from(await get.arrayBuffer())).toEqual(JPEG);
    expect((await raw('DELETE', `/api/products/${id}/image`)).status).toBe(204);
    expect((await fetch(`${base}/images/${image}`)).status).toBe(404);
  });

  it('không phải JPEG → 400; quá 1 MB → 413; id lạ → 404; tên ảnh lạ → 404 rỗng, không phải index.html', async () => {
    const created = await fetch(`${base}/api/products`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Bánh', sellPrice: 1000 }),
    });
    const { id } = (await created.json()) as { id: number };
    const bad = await raw('PUT', `/api/products/${id}/image`, 'không phải ảnh');
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: 'Ảnh phải là JPEG' });
    const big = await raw('PUT', `/api/products/${id}/image`, Buffer.concat([JPEG, Buffer.alloc(1_100_000)]));
    expect(big.status).toBe(413);
    expect((await raw('PUT', '/api/products/999/image', JPEG)).status).toBe(404);
    const missing = await fetch(`${base}/images/p999-1.jpg`);
    expect(missing.status).toBe(404);
    expect(await missing.text()).toBe('');
    // SPA fallback vẫn hoạt động cho đường dẫn khác
    expect(await (await fetch(`${base}/products`)).text()).toBe('<html>spa</html>');
  });

  it('không cấu hình imagesDir → PUT trả 503', async () => {
    const s = createApp(createTestDb()).listen(0);
    await new Promise((r) => s.once('listening', r));
    const addr = s.address();
    const b = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
    try {
      const created = await fetch(`${b}/api/products`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'X', sellPrice: 1 }),
      });
      const { id } = (await created.json()) as { id: number };
      const res = await fetch(`${b}/api/products/${id}/image`, { method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body: JPEG });
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: 'Chưa cấu hình thư mục ảnh' });
    } finally {
      s.close();
    }
  });
});
```

Run: `cd server && npx vitest run src/routes/product-images-api.test.ts`
Expected: FAIL (lỗi TS `imagesDir` không có trong opts / 404 route).

- [ ] **Step 2: Route**

`server/src/routes/products.ts`: thêm import

```ts
import { deleteProductImage, saveProductImage, type ImageDeps } from '../services/product-images.js';
```

Đổi chữ ký: `export function productsRouter(db: Db, images: ImageDeps): Router {`

Thêm sau route `r.post('/:id/restore', …)`:

```ts
  // Ảnh JPEG đã thu nhỏ ở trình duyệt, gửi nguyên dạng nhị phân
  r.put('/:id/image', express.raw({ type: () => true, limit: '1mb' }), (req, res) =>
    res.json(saveProductImage(db, images, intParam(req, 'id'), Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0))),
  );
  r.delete('/:id/image', (req, res) => {
    deleteProductImage(db, images, intParam(req, 'id'));
    res.status(204).end();
  });
```

`server/src/routes/index.ts`: import `import { NO_IMAGES, type ImageDeps } from '../services/product-images.js';`, chữ ký
`deps: { backups?: BackupService; labels?: LabelDeps; images?: ImageDeps } = {}`, và
`r.use('/products', productsRouter(db, deps.images ?? NO_IMAGES));`.

- [ ] **Step 3: `app.ts`**

```ts
export function createApp(
  db: Db,
  opts: { clientDist?: string; backups?: BackupService; labels?: LabelDeps; imagesDir?: string } = {},
): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', apiRouter(db, { backups: opts.backups, labels: opts.labels, images: opts.imagesDir ? { dir: opts.imagesDir } : undefined }));

  // Ảnh sản phẩm: tên file đổi mỗi lần thay ảnh nên cache được vĩnh viễn; tên lạ → 404, không rơi xuống SPA fallback
  if (opts.imagesDir) {
    app.use('/images', express.static(opts.imagesDir, { immutable: true, maxAge: '1y', index: false }));
    app.use('/images', (_req, res) => res.status(404).end());
  }
```

(phần `clientDist` và `errorHandler` giữ nguyên bên dưới.)

- [ ] **Step 4: `index.ts`**

```ts
const dataDir = path.dirname(dbFile);
const imagesDir = path.join(dataDir, 'images');
fs.mkdirSync(imagesDir, { recursive: true });
const backups = createBackupService(db, { dir: path.join(dataDir, 'backups'), tmpDir: path.join(dataDir, 'tmp'), imagesDir });
```

thêm `import fs from 'node:fs';` lên đầu, và `createApp(db, { clientDist: …, backups, labels, imagesDir })`.

- [ ] **Step 5: Vite proxy**

`client/vite.config.ts:35`:

```ts
  server: { host: true, port: 5180, strictPort: true, proxy: { '/api': 'http://localhost:3000', '/images': 'http://localhost:3000' } },
```

- [ ] **Step 6: Chạy test + typecheck**

Run: `cd server && npx vitest run src/routes/product-images-api.test.ts src/routes/api.test.ts` → PASS.
Run (gốc): `npm run typecheck` → PASS. `npm test` → PASS toàn bộ.

### Task 5: Client – thu nhỏ ảnh, API hooks, `ProductAvatar` có ảnh, dialog xem to

**Files:**
- Create: `client/src/lib/image-resize.ts`
- Modify: `client/src/api/products.ts`
- Modify: `client/src/components/ProductAvatar.tsx`
- Create: `client/src/components/ProductImageDialog.tsx`
- Modify: `client/src/pages/products/ProductTable.tsx`, `ProductCardList.tsx`
- Modify: `client/src/components/ProductSearch.tsx:95`, `client/src/pages/quick-add/QuickAddPage.tsx:92`, `client/src/pages/overview/LowStockList.tsx:49`

**Interfaces:**
- Consumes: `Product.image`, `LowStockRow.image` (Task 1); `PUT`/`DELETE /products/:id/image` (Task 4).
- Produces:

```ts
// lib/image-resize.ts
export function resizeImage(file: Blob, max?: number, quality?: number): Promise<Blob>;   // ném Error('Không đọc được ảnh')
// api/products.ts
export const productImageUrl: (image: string | null | undefined) => string | null;
export function useSaveProductImage(): UseMutationResult<ProductWithUnits, Error, { id: number; file: Blob }>;
export function useDeleteProductImage(): UseMutationResult<void, Error, { id: number }>;
// components
ProductAvatar({ name, image?, className? })
ProductImageDialog({ product: { name: string; image: string | null } | null; onClose })
ProductAvatarButton({ p: Product; className?; onView: (p: Product) => void })   // export từ ProductTable.tsx
```

- [ ] **Step 1: `image-resize.ts`**

```ts
const FAIL = 'Không đọc được ảnh';

/**
 * Thu nhỏ ảnh về JPEG cạnh dài ≤ `max`, giữ chiều xoay theo EXIF (ảnh chụp dọc không bị nằm ngang).
 * Luôn vẽ lại kể cả ảnh đã nhỏ: chuẩn hóa JPEG và bỏ EXIF/GPS. Trình duyệt không hỗ trợ `imageOrientation` thì bỏ qua option.
 */
export async function resizeImage(file: Blob, max = 512, quality = 0.82): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(FAIL);
  }
  try {
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error(FAIL);
    // PNG trong suốt → nền trắng (JPEG không có trong suốt, mặc định sẽ ra đen)
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) throw new Error(FAIL);
    return blob;
  } finally {
    bitmap.close();
  }
}
```

- [ ] **Step 2: API hooks**

`client/src/api/products.ts`, thêm sau `useSetProductActive`:

```ts
/** URL ảnh phục vụ tĩnh; null khi chưa có ảnh. */
export const productImageUrl = (image: string | null | undefined): string | null => (image ? `/images/${image}` : null);

export function useSaveProductImage() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: ({ id, file }: { id: number; file: Blob }) => api<ProductWithUnits>(`/products/${id}/image`, { method: 'PUT', body: file }),
    onSuccess: invalidate,
  });
}

export function useDeleteProductImage() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: ({ id }: { id: number }) => api<void>(`/products/${id}/image`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}
```

`api()` đã gửi `body: Blob` với `application/octet-stream`, không cần sửa `client.ts`. `useInvalidateProducts` hiện chỉ làm mới `products`, `categories`, `reports`: thêm một dòng `void qc.invalidateQueries({ queryKey: ['overview'] });` để Tồn thấp ở Tổng quan thấy ảnh mới.

- [ ] **Step 3: `ProductAvatar` có ảnh**

Thay toàn bộ hàm `ProductAvatar` (giữ `TINTS`, `tintFor`, `initials`):

```tsx
/** Ảnh sản phẩm nếu có; không có hoặc tải lỗi thì ô chữ cái đầu nền nhạt. */
export function ProductAvatar({ name, image, className }: { name: string; image?: string | null; className?: string }) {
  // Tên ảnh tải lỗi (file không còn sau khi khôi phục bản sao cũ); đổi ảnh khác thì thử lại
  const [broken, setBroken] = useState<string | null>(null);
  const src = image && broken !== image ? productImageUrl(image) : null;
  return (
    <div
      className={cn(
        'grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg text-sm font-semibold',
        src ? 'bg-muted' : tintFor(name),
        className,
      )}
      aria-hidden="true"
    >
      {src ? <img src={src} alt="" loading="lazy" className="size-full object-cover" onError={() => setBroken(image)} /> : initials(name) || '?'}
    </div>
  );
}
```

Import thêm: `import { useState } from 'react';` và `import { productImageUrl } from '@/api/products';`.

- [ ] **Step 4: `ProductImageDialog.tsx`**

```tsx
import { productImageUrl } from '@/api/products';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Props {
  product: { name: string; image: string | null } | null;
  onClose: () => void;
}

/** Xem ảnh sản phẩm cỡ lớn (ảnh gốc 512px). */
export function ProductImageDialog({ product, onClose }: Props) {
  const src = productImageUrl(product?.image);
  return (
    <Dialog open={!!product && !!src} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{product?.name}</DialogTitle>
          <DialogDescription>Ảnh sản phẩm</DialogDescription>
        </DialogHeader>
        {src && <img src={src} alt={product?.name} className="mx-auto max-h-[70vh] rounded-lg object-contain" />}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: Bảng và thẻ Sản phẩm**

`ProductTable.tsx`: thêm export (sau `StockCell`):

```tsx
/** Avatar bấm được để xem ảnh to; chưa có ảnh thì chỉ là ô chữ cái. Dừng lan sự kiện để không mở form sửa của hàng. */
export function ProductAvatarButton({ p, className, onView }: { p: Product; className?: string; onView: (p: Product) => void }) {
  if (!p.image) return <ProductAvatar name={p.name} className={className} />;
  return (
    <button
      type="button"
      className="shrink-0 rounded-lg focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Xem ảnh ${p.name}`}
      title="Xem ảnh"
      onClick={(e) => {
        e.stopPropagation();
        onView(p);
      }}
    >
      <ProductAvatar name={p.name} image={p.image} className={className} />
    </button>
  );
}
```

Trong `ProductTable`: `const [viewing, setViewing] = useState<Product | null>(null);` (đã import `useState`), thay
`<ProductAvatar name={p.name} />` bằng `<ProductAvatarButton p={p} onView={setViewing} />`, và bọc return bằng fragment
để đặt dialog **ngoài** `<Table>` (sự kiện click trong portal lan theo cây React, không được nằm trong `TableRow`):

```tsx
  return (
    <>
      <Table>…</Table>
      <ProductImageDialog product={viewing} onClose={() => setViewing(null)} />
    </>
  );
```

Import: `import { ProductImageDialog } from '@/components/ProductImageDialog';`.

`ProductCardList.tsx`: tương tự – `useState`, `ProductAvatarButton` (import từ `./ProductTable` cùng `ProductMenu, StockCell`),
`<ProductAvatarButton p={p} className="size-12" onView={setViewing} />`, dialog đặt ngoài `<ul>` trong fragment.

- [ ] **Step 6: Ba chỗ còn lại chỉ truyền `image`**

- `ProductSearch.tsx:95`: `<ProductAvatar name={p.name} image={p.image} className="size-9 rounded-lg text-xs" />`
- `QuickAddPage.tsx:92`: `<ProductAvatar name={found.product.name} image={found.product.image} className="size-14 text-lg" />`
- `LowStockList.tsx:49`: `<ProductAvatar name={i.name} image={i.image} className="size-8 shrink-0" />`

- [ ] **Step 7: Typecheck**

Run (gốc): `npm run typecheck` → PASS.

### Task 6: Khối *Ảnh* trong form sản phẩm + ghi chú ở thẻ Sao lưu

**Files:**
- Create: `client/src/pages/products/useProductImage.ts`
- Modify: `client/src/pages/products/ProductFormDialog.tsx`
- Modify: `client/src/pages/settings/BackupCard.tsx:114-117`

**Interfaces:**
- Consumes: `resizeImage`, `useSaveProductImage`, `useDeleteProductImage`, `productImageUrl`, `ProductAvatar` (Task 5).
- Produces: `useProductImage(open, product)` → `{ preview, hasImage, busy, pick, remove, flush }`.

- [ ] **Step 1: Hook `useProductImage.ts`**

```ts
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { ProductWithUnits } from '@tiny-pos/shared';
import { productImageUrl, useDeleteProductImage, useSaveProductImage } from '@/api/products';
import { resizeImage } from '@/lib/image-resize';

/**
 * Ảnh trong form sản phẩm. Đang sửa: chọn là gửi ngay (giống đơn vị quy đổi). Đang thêm: giữ tạm, `flush` sau khi tạo xong.
 * `product` khi sửa lấy từ useProduct(id) nên sau khi lưu/xóa ảnh (invalidate) tự cập nhật.
 */
export function useProductImage(open: boolean, product: ProductWithUnits | null | undefined) {
  const [pending, setPending] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = useSaveProductImage();
  const del = useDeleteProductImage();
  const productId = product?.id ?? null;

  const clearPending = () => {
    setPending(null);
    setPreview((u) => {
      if (u) URL.revokeObjectURL(u);
      return null;
    });
  };
  useEffect(() => {
    clearPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, productId]);

  const pick = async (file: File) => {
    setBusy(true);
    try {
      const blob = await resizeImage(file);
      if (productId) {
        await save.mutateAsync({ id: productId, file: blob });
        toast.success('Đã lưu ảnh');
      } else {
        clearPending();
        setPending(blob);
        setPreview(URL.createObjectURL(blob));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không đọc được ảnh');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!productId) return clearPending();
    setBusy(true);
    try {
      await del.mutateAsync({ id: productId });
      toast.success('Đã xóa ảnh');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi');
    } finally {
      setBusy(false);
    }
  };

  /** Sau khi tạo sản phẩm mới: gửi ảnh đang giữ tạm. Lỗi thì sản phẩm vẫn đã tạo, báo riêng. */
  const flush = async (created: ProductWithUnits): Promise<ProductWithUnits> => {
    if (!pending) return created;
    try {
      return await save.mutateAsync({ id: created.id, file: pending });
    } catch (e) {
      toast.error(`Đã thêm sản phẩm nhưng chưa lưu được ảnh: ${e instanceof Error ? e.message : 'lỗi'}`);
      return created;
    }
  };

  return { preview: preview ?? productImageUrl(product?.image), hasImage: !!(preview ?? product?.image), busy, pick, remove, flush };
}
```

- [ ] **Step 2: Khối *Ảnh* trong `ProductFormDialog.tsx`**

Import thêm: `useRef` từ `react`; `Camera, Trash2` vào dòng lucide (`import { Camera, Check, ScanBarcode, Trash2 } from 'lucide-react';`); `import { ProductAvatar } from '@/components/ProductAvatar';`; `import { useProductImage } from './useProductImage';`.

Trong component, sau `const save = useSaveProduct();`:

```tsx
  const image = useProductImage(open, product);
  const fileRef = useRef<HTMLInputElement>(null);
```

Sửa `onSuccess` của `save.mutate` để gửi ảnh tạm khi thêm mới:

```tsx
        onSuccess: async (p) => {
          const final = product ? p : await image.flush(p);
          toast.success(product ? 'Đã lưu' : `Đã thêm "${final.name}"`);
          onSaved(final);
        },
```

Trong `<section className="mb-6">` *Thông tin*, ngay sau `<SectionTitle>Thông tin</SectionTitle>` và **trước** lưới 2 cột:

```tsx
            <div className="mb-4 flex items-center gap-4">
              {image.preview ? (
                <img src={image.preview} alt="" className="size-28 shrink-0 rounded-xl border object-cover" />
              ) : (
                <ProductAvatar name={form.name || '?'} className="size-28 rounded-xl text-3xl" />
              )}
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" disabled={image.busy} onClick={() => fileRef.current?.click()}>
                    <Camera data-icon="inline-start" />
                    {image.busy ? 'Đang xử lý…' : image.hasImage ? 'Đổi ảnh' : 'Chọn ảnh'}
                  </Button>
                  {image.hasImage && (
                    <Button type="button" variant="ghost" disabled={image.busy} onClick={() => void image.remove()}>
                      <Trash2 data-icon="inline-start" />
                      Xóa ảnh
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">Chụp bằng điện thoại hoặc chọn file; ảnh được thu nhỏ trước khi lưu.</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = ''; // chọn lại cùng file vẫn kích onChange
                    if (f) void image.pick(f);
                  }}
                />
              </div>
            </div>
```

Dùng `preview` của hook (object URL khi thêm mới, `/images/…` khi sửa) cho `<img>`; `ProductAvatar` chỉ hiện khi chưa có ảnh nên không cần `image` prop ở đây.

- [ ] **Step 3: Ghi chú ở `BackupCard.tsx`**

Sau đoạn `<p className="text-sm text-muted-foreground">Tự sao lưu … Giữ 30 bản tự động gần nhất.</p>` thêm:

```tsx
            <p className="mt-1 text-sm text-muted-foreground">
              Ảnh sản phẩm nằm ở thư mục <span className="font-mono">data\images</span>, không có trong file <span className="font-mono">.db</span>; thư mục
              chép thêm được chép cả ảnh.
            </p>
```

- [ ] **Step 4: Typecheck**

Run (gốc): `npm run typecheck` → PASS.

### Task 7: Phiên bản, tài liệu, kiểm trên trình duyệt, commit

**Files:**
- Modify: `package.json:3` (`"version": "0.13.0"`)
- Modify: `README.md:37` (thêm gạch đầu dòng sau *In tem mã vạch*), `README.md` mục *Sao lưu và khôi phục*
- Modify: `CLAUDE.md:30` (Đã xong), `:42` (bất biến mới sau *Mã vạch nội bộ*), bảng "Migration: DB dev đã chạy tới `0005`" → `0006`

- [ ] **Step 1: Version + README**

`package.json`: `"version": "0.13.0"`.

README, sau dòng *In tem mã vạch*:

```md
- Ảnh sản phẩm: mở sản phẩm → *Chọn ảnh*; trên điện thoại chụp trực tiếp, ảnh được thu nhỏ trước khi gửi. Ảnh hiện ở danh sách, gợi ý tìm khi bán, Tổng quan; bấm vào ảnh để xem to. File ảnh ở `data\images` (không nằm trong bản sao `.db`).
```

README mục *Sao lưu và khôi phục*, cuối gạch đầu dòng *Thư mục chép thêm* thêm câu: `Ảnh sản phẩm (data\images) cũng được chép sang đó; khôi phục bản sao không đụng tới ảnh.`

- [ ] **Step 2: CLAUDE.md**

Dòng "Đã xong" nối thêm: `, Ảnh sản phẩm 0.13.0 (cột products.image = tên file trong data/images, services/product-images.ts, PUT/DELETE /api/products/:id/image, /images tĩnh immutable, thu nhỏ ở trình duyệt lib/image-resize.ts, ProductAvatar có ảnh, copyExtra chép ảnh sang thư mục chép thêm)`.

Sau bất biến *Mã vạch nội bộ* thêm:

```md
- **Ảnh sản phẩm** chỉ đổi qua `services/product-images.ts` (file `data/images/p<id>-<ms>.jpg`, DB giữ tên file; chỉ JPEG ≤ 1 MB, trình duyệt thu nhỏ ≤ 512px); `productInputSchema` không nhận `image`; sao lưu `.db` không chứa ảnh.
```

Dòng Migration: `DB dev đã chạy tới 0006`; `.claude/rules/database.md` sửa `0000`–`0005` → `0000`–`0006`, "tiếp theo là `0006`" → `0007`.

- [ ] **Step 3: Kiểm tra tự động**

Run (gốc): `npm run typecheck && npm test` → PASS toàn bộ. `npm run build` → PASS.

- [ ] **Step 4: Kiểm trên trình duyệt (skill `browser-verify`)**

Bật `npm run dev` nếu chưa; chặn mọi request ghi (POST/PUT/DELETE → 403 giả). Stub `GET /api/products` (và `/api/products/:id`) để sản phẩm đầu có `image: 'p1-1.jpg'` và sản phẩm thứ hai `image: 'khong-co.jpg'`; stub `GET /images/p1-1.jpg` trả một JPEG nhỏ (tạo bằng canvas trong Node không có → dùng file JPEG 1×1 base64 `/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==`), `/images/khong-co.jpg` → 404. Chụp 1366×768 và 390×844:

1. `/products`: hàng 1 hiện ảnh trong ô 40px (bảng) / 48px (thẻ), hàng 2 rơi về ô chữ cái (onError). Bấm ảnh hàng 1 → dialog xem ảnh với tên, **không** mở form sửa. Esc đóng.
2. Mở sửa sản phẩm 1: khối *Ảnh* hiện ảnh 112px, nút *Đổi ảnh* + *Xóa ảnh*. Sản phẩm 2 (ảnh hỏng): khối hiện `<img>` bị vỡ? – `preview` là `/images/khong-co.jpg` nên `<img>` sẽ lỗi; chấp nhận hiện icon ảnh vỡ của trình duyệt vì chỉ xảy ra khi file mất; **ghi nhận** trong kết quả, không sửa thêm.
3. *Thêm sản phẩm*: chọn file (dùng `setInputFiles` với JPEG trên) → xem trước object URL hiện, nút thành *Đổi ảnh*; bấm *Xóa ảnh* → về ô chữ cái. Chọn lại rồi *Lưu* → `POST` bị chặn 403 → toast lỗi, dialog còn mở (đúng hành vi cũ). Để kiểm `flush` lỗi: stub `POST /api/products` trả 201 với sản phẩm giả, giữ `PUT …/image` 403 → toast "Đã thêm sản phẩm nhưng chưa lưu được ảnh: …" và dialog đóng.
4. `/sell`: gõ tên sản phẩm 1 → gợi ý có ảnh 36px. `/overview`: nếu stub tồn thấp có `image` → ảnh 32px.
5. Chế độ tối: ảnh có viền/nền `bg-muted`, không chói.

Thử tay trên điện thoại thật một lần sau khi commit (không stub): chụp ảnh dọc → không bị xoay, cỡ gửi lên < 100 KB (xem Network).

- [ ] **Step 5: Soát diff rồi commit một lần**

Run: `git status`, `git diff --stat`. File cũ có số dòng đổi lớn bất thường (`ProductFormDialog.tsx` khoảng +45, `ProductAvatar.tsx` ~+15, các file khác ≤ 10) thì mở kiểm, hunk chỉ là format thì hoàn tác. `git add` file mới (`product-images.ts`, test, `0006_*.sql`, `meta/0006_snapshot.json`, `image-resize.ts`, `ProductImageDialog.tsx`, `useProductImage.ts`, `product-images-api.test.ts`, kế hoạch này nếu chưa commit).

```bash
git add -A
git commit -m "feat: ảnh sản phẩm 0.13.0 – chụp/chọn ảnh thu nhỏ ở trình duyệt, lưu data/images, hiện ở danh sách và gợi ý, chép sang thư mục sao lưu thêm"
```

(Thêm dòng `Co-Authored-By` theo quy ước phiên làm việc.)

---

## Tự soát

- **Spec §4 Dữ liệu** → Task 1. **§5 service** → Task 2; **backups** → Task 3; **route + tĩnh + proxy** → Task 4. **§6 client**: `image-resize`, hooks, `ProductAvatar`, 5 chỗ truyền `image`, dialog xem to → Task 5; form, BackupCard → Task 6. **§7 lỗi**: 400/413/404/503 test ở Task 2 & 4; `onError` ở Task 5 + kiểm Task 7. **§8 kiểm thử**: đủ các file nêu (test `api.test.ts` thay bằng file riêng `product-images-api.test.ts`). **§9 docs** → Task 7.
- Chữ ký nhất quán: `saveProductImage(db, deps, id, body, now?)`, `deleteProductImage(db, deps, id)`, `copyMissingImages(from, to)`, `ImageDeps { dir }`, `NO_IMAGES`, `productsRouter(db, images)`, `createApp(db, { imagesDir })`, `BackupOpts.imagesDir`, `productImageUrl`, `useSaveProductImage({ id, file })`, `useDeleteProductImage({ id })`, `ProductAvatar({ name, image?, className? })`, `ProductAvatarButton({ p, className?, onView })`, `ProductImageDialog({ product, onClose })`, `useProductImage(open, product)` → `{ preview, hasImage, busy, pick, remove, flush }`.
- Review Focus 1–5 đều có test/kiểm gắn với task sở hữu.
