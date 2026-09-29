# Giai đoạn 3 – Nhập hàng, nhà cung cấp, kiểm kê: Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm phiếu nhập (theo đơn vị gốc hoặc thùng, cập nhật giá vốn/giá bán, hủy), nhà cung cấp với sổ nợ và trả nợ, phiên kiểm kê (đếm dần, chốt ghi chênh lệch), lịch sử tồn sản phẩm, và menu điện thoại có nút *Thêm*.

**Architecture:** Logic thuần (giá vốn gốc, % lãi, reducer phiếu nhập nháp, schema) ở `shared` có vitest. Server thêm service `suppliers` / `imports` / `stocktakes` / `movements` nhận `db`; mọi thay đổi tồn qua `recordMovement`, mọi thay đổi nợ NCC qua `recordSupplierTx`, trong cùng transaction. Mã chứng từ theo ngày địa phương dùng chung `nextDailyCode`. Client thêm các trang `/imports`, `/imports/new`, `/suppliers`, `/stocktake` và dialog lịch sử tồn.

**Tech Stack:** Node 24, TypeScript 5.9 ESM, Express 5, better-sqlite3, drizzle-orm 0.45 + drizzle-kit 0.31, zod 4, vitest 3; React 19, Vite 7, Tailwind v4, shadcn/ui (radix-nova) + lucide-react, TanStack Query 5, react-router 7, sonner. Component shadcn mới: `popover`, `command` (kéo theo `cmdk`).

**Spec:** `docs/superpowers/specs/2026-09-29-tiny-pos-phase3-inventory-design.md` (nền tảng: `2026-09-29-tiny-pos-phase1-design.md`, `2026-09-29-tiny-pos-phase2-sales-design.md`)

## Global Constraints

- Tiền là `integer` đồng; số lượng/tồn/factor/counted là `real`. Tiền nhập ≤ 1.000.000.000; `qty` ≤ 100.000; `counted` ≤ 1.000.000.
- Mọi thay đổi `products.stock` = 1 dòng `stock_movements` trong cùng transaction (`recordMovement` ở `server/src/services/stock.ts`).
- Mọi thay đổi `suppliers.debt` = 1 dòng `supplier_transactions` trong cùng transaction (`recordSupplierTx`).
- Mã chứng từ theo **ngày địa phương**: `PN-YYYYMMDD-NNNN` (phiếu nhập), `KK-YYYYMMDD-NN` (kiểm kê).
- Hủy phiếu nhập và chốt kiểm kê ghi movement loại `adjust`; tồn và nợ được phép âm.
- Giá vốn khi nhập = giá nhập lần gần nhất quy về đơn vị gốc (`round(unitCost / factor)`); hủy phiếu không đổi giá.
- API dưới `/api`, lỗi `{ error: string }`; body/query validate bằng zod trong `shared/`; nhãn trường tiếng Việt qua `FIELD_LABELS`.
- UI tiếng Việt, tiền `15.000đ`, nút/ô thao tác chính ≥ 44px (`h-11` / `size-11`). Component ≤ 200 dòng.
- Giao diện dùng shadcn/ui + lucide-react; thêm component shadcn bằng `npx shadcn@latest add <tên>` trong `client/` với `NODE_EXTRA_CA_CERTS="C:/Users/MinhNT165/Workspace/personal/tiny-pos/.certs/corp-root.pem"` (không tắt kiểm tra TLS).
- Thư viện mới duy nhất: `cmdk` (do `shadcn add command` cài).
- Định danh tiếng Anh; UI, comment, commit message tiếng Việt.
- **Không format lại file có sẵn** (không có Prettier): sửa file cũ chỉ đúng các dòng cần; trước commit xem `git diff --stat`.
- Làm trên `master`, không tạo nhánh.
- Không dùng `crypto.randomUUID` ở client; `localStorage` đọc/ghi qua `readStorage`/`writeStorage` (`client/src/lib/storage.ts`).
- Chạy thử UI bằng Chromium headless với `playwright-core` cài trong thư mục scratchpad (không cài vào repo); chặn (`route.abort`) các request ghi (`POST/PUT/DELETE /api/**`) trừ khi bước kiểm tra cần ghi thật; stub `window.print`.

## Review Focus

1. Bấm vào bên trong dialog *Lịch sử tồn* mở từ menu của một dòng sản phẩm: không được mở form sửa sản phẩm (sự kiện React portal nổi bọt lên `onClick` của dòng/thẻ) (Task 13: `stopPropagation` trên nội dung dialog + kiểm tra bằng trình duyệt).
2. Hủy phiếu nhập sau khi hàng đã bán bớt, hoặc sau khi đã trả hết nợ NCC: không lỗi; tồn có thể âm, nợ NCC có thể âm (NCC nợ lại mình) và sổ nợ ghi rõ (Task 5: test hủy sau bán và sau trả nợ).
3. Phiếu nháp trong `localStorage` tham chiếu đơn vị đã bị xóa: lưu phiếu phải trả 400 nêu tên sản phẩm, client giữ nguyên nháp (Task 5: test đơn vị không thuộc sản phẩm; Task 11: `onError` không xóa nháp).
4. Hai máy cùng đếm một sản phẩm trong cùng phiên: chỉ 1 dòng, lần sau ghi đè cả `counted` lẫn `expected` (Task 6: test đếm lại).
5. Tìm nhà cung cấp gõ chữ thường có dấu ("đại") phải ra "Đại lý Hùng" (LIKE của SQLite không bỏ hoa/thường với ký tự có dấu) (Task 4: test `listSuppliers`).

---

### Task 1: Schema, kiểu dữ liệu và hàm giá cho nhập hàng / NCC / kiểm kê (shared)

**Files:**
- Create: `shared/src/inventory-math.ts`, `shared/src/inventory-math.test.ts`
- Create: `shared/src/schemas/supplier.ts`, `shared/src/schemas/import.ts`, `shared/src/schemas/stocktake.ts`, `shared/src/schemas/inventory.test.ts`
- Modify: `shared/src/schemas/order.ts` (2 dòng: export `optionalId`, `MAX_MONEY`), `shared/src/schemas/common.ts` (thêm nhãn), `shared/src/types.ts` (thêm cuối file), `shared/src/index.ts` (thêm export)

**Interfaces:**
- Produces:
  - `baseCost(unitCost: number, factor: number): number`, `marginPercent(sellPrice: number, unitCost: number): number | null`, `importLineAmount(qty: number, unitCost: number): number`
  - `supplierInputSchema`, `type SupplierInput` (output), `type SupplierInputBody` (input); `supplierPaymentSchema`, `type SupplierPayment`, `type SupplierPaymentBody`
  - `importItemInputSchema`, `importInputSchema`, `type ImportInput` (output: `{ supplierId: number|null; note: string|null; paid: number; items: { productId: number; unitId: number|null; qty: number; unitCost: number; sellPrice: number|null }[] }`), `type ImportInputBody` (input)
  - `stocktakeInputSchema` / `type StocktakeInput` (`{ note: string|null }`), `stocktakeCountSchema` / `type StocktakeCount` (`{ counted: number }`), `stocktakeListQuerySchema` / `type StocktakeListQuery` (`{ limit: number }` mặc định 20), `movementListQuerySchema` / `type MovementListQuery` (`{ limit: number }` mặc định 100)
  - Types: `Supplier`, `SupplierTransaction`, `ImportItem`, `ImportSummary`, `ImportDetail`, `ImportList`, `StocktakeItem`, `StocktakeSummary`, `StocktakeDetail`, `MovementType`, `StockMovement`
  - `optionalId`, `MAX_MONEY` export từ `shared/src/schemas/order.ts`

- [ ] **Step 1: Viết test**

`shared/src/inventory-math.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { baseCost, importLineAmount, marginPercent } from './inventory-math.js';

describe('baseCost', () => {
  it('giá nhập 1 thùng quy về 1 đơn vị gốc, làm tròn đồng', () => {
    expect(baseCost(240000, 24)).toBe(10000);
    expect(baseCost(100000, 3)).toBe(33333);
    expect(baseCost(5000, 1)).toBe(5000);
  });
});

describe('marginPercent', () => {
  it('% lãi trên giá nhập, 1 số lẻ; giá nhập 0 → null', () => {
    expect(marginPercent(12000, 10000)).toBe(20);
    expect(marginPercent(9000, 10000)).toBe(-10);
    expect(marginPercent(11800, 10000)).toBe(18);
    expect(marginPercent(10333, 10000)).toBe(3.3);
    expect(marginPercent(1000, 0)).toBeNull();
  });
});

describe('importLineAmount', () => {
  it('qty × giá nhập, làm tròn đồng', () => {
    expect(importLineAmount(2, 240000)).toBe(480000);
    expect(importLineAmount(0.5, 33333)).toBe(16667);
  });
});
```

`shared/src/schemas/inventory.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { importInputSchema } from './import.js';
import { movementListQuerySchema, stocktakeCountSchema, stocktakeInputSchema, stocktakeListQuerySchema } from './stocktake.js';
import { supplierInputSchema, supplierPaymentSchema } from './supplier.js';

describe('importInputSchema', () => {
  it('điền mặc định: supplierId/unitId/sellPrice null, note null', () => {
    expect(importInputSchema.parse({ paid: 0, items: [{ productId: 1, qty: 2, unitCost: 1000 }] })).toEqual({
      supplierId: null,
      note: null,
      paid: 0,
      items: [{ productId: 1, unitId: null, qty: 2, unitCost: 1000, sellPrice: null }],
    });
  });
  it('từ chối phiếu rỗng, qty 0, giá lẻ, giá quá 1 tỷ, thiếu productId', () => {
    const bad = (o: Record<string, unknown>) => importInputSchema.safeParse({ paid: 0, ...o }).success;
    expect(bad({ items: [] })).toBe(false);
    expect(bad({ items: [{ productId: 1, qty: 0, unitCost: 1 }] })).toBe(false);
    expect(bad({ items: [{ productId: 1, qty: 1, unitCost: 1.5 }] })).toBe(false);
    expect(bad({ items: [{ productId: 1, qty: 1, unitCost: 1_000_000_001 }] })).toBe(false);
    expect(bad({ items: [{ qty: 1, unitCost: 1 }] })).toBe(false);
  });
});

describe('supplierInputSchema / supplierPaymentSchema', () => {
  it('trim tên, chuỗi rỗng → null', () => {
    expect(supplierInputSchema.parse({ name: ' Đại lý Hùng ', phone: '' })).toEqual({ name: 'Đại lý Hùng', phone: null, note: null });
    expect(supplierInputSchema.safeParse({ name: '  ' }).success).toBe(false);
  });
  it('trả nợ: số nguyên dương', () => {
    expect(supplierPaymentSchema.parse({ amount: 5000 })).toEqual({ amount: 5000, note: null });
    expect(supplierPaymentSchema.safeParse({ amount: 0 }).success).toBe(false);
    expect(supplierPaymentSchema.safeParse({ amount: 10.5 }).success).toBe(false);
  });
});

describe('stocktake schemas', () => {
  it('số đếm ≥ 0, cho số lẻ; ghi chú rỗng → null; limit mặc định', () => {
    expect(stocktakeCountSchema.parse({ counted: 0.35 })).toEqual({ counted: 0.35 });
    expect(stocktakeCountSchema.safeParse({ counted: -1 }).success).toBe(false);
    expect(stocktakeInputSchema.parse({})).toEqual({ note: null });
    expect(stocktakeListQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(stocktakeListQuerySchema.parse({ limit: '5' })).toEqual({ limit: 5 });
    expect(movementListQuerySchema.parse({})).toEqual({ limit: 100 });
    expect(movementListQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test, thấy FAIL**

Run: `npm test -w shared`
Expected: FAIL, không tìm thấy `./inventory-math.js`, `./import.js`, `./stocktake.js`, `./supplier.js`.

- [ ] **Step 3: Viết code**

Trong `shared/src/schemas/order.ts` đổi đúng 2 dòng:
- `const optionalId = z` → `export const optionalId = z`
- `const MAX_MONEY = 1_000_000_000;` → `export const MAX_MONEY = 1_000_000_000;`

`shared/src/inventory-math.ts`:

```ts
/** Giá vốn 1 đơn vị gốc từ giá nhập 1 đơn vị đã chọn (thùng = 24 lon…). */
export function baseCost(unitCost: number, factor: number): number {
  return Math.round(unitCost / factor);
}

/** % lãi so với giá nhập, 1 số lẻ; chưa có giá nhập thì không tính được. */
export function marginPercent(sellPrice: number, unitCost: number): number | null {
  if (unitCost <= 0) return null;
  return Math.round(((sellPrice - unitCost) / unitCost) * 1000) / 10;
}

/** Thành tiền 1 dòng phiếu nhập. */
export function importLineAmount(qty: number, unitCost: number): number {
  return Math.round(qty * unitCost);
}
```

`shared/src/schemas/supplier.ts`:

```ts
import { z } from 'zod';
import { nullableText } from './common.js';
import { MAX_MONEY } from './order.js';

export const supplierInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  phone: nullableText(20),
  note: nullableText(200),
});
export type SupplierInput = z.output<typeof supplierInputSchema>;
export type SupplierInputBody = z.input<typeof supplierInputSchema>;

export const supplierPaymentSchema = z.object({
  amount: z.number().int().positive().max(MAX_MONEY),
  note: nullableText(200),
});
export type SupplierPayment = z.output<typeof supplierPaymentSchema>;
export type SupplierPaymentBody = z.input<typeof supplierPaymentSchema>;
```

`shared/src/schemas/import.ts`:

```ts
import { z } from 'zod';
import { nullableText } from './common.js';
import { MAX_MONEY, optionalId } from './order.js';

const money = z.number().int().min(0).max(MAX_MONEY);

/** Một dòng phiếu nhập: số lượng và giá nhập theo đơn vị đã chọn (gốc hoặc thùng/lốc). */
export const importItemInputSchema = z.object({
  productId: z.number().int().positive(),
  unitId: optionalId,
  qty: z.number().positive().max(100_000),
  unitCost: money,
  /** Giá bán mới của đúng đơn vị này; null = không đổi. */
  sellPrice: money.nullish().transform((v) => v ?? null),
});

export const importInputSchema = z.object({
  supplierId: optionalId,
  note: nullableText(200),
  paid: money,
  items: z.array(importItemInputSchema).min(1, 'chưa có món nào'),
});
export type ImportInput = z.output<typeof importInputSchema>;
export type ImportInputBody = z.input<typeof importInputSchema>;
```

`shared/src/schemas/stocktake.ts`:

```ts
import { z } from 'zod';
import { nullableText } from './common.js';

export const stocktakeInputSchema = z.object({ note: nullableText(200) });
export type StocktakeInput = z.output<typeof stocktakeInputSchema>;

/** Số đếm theo đơn vị gốc; hàng cân được số lẻ. */
export const stocktakeCountSchema = z.object({ counted: z.number().min(0).max(1_000_000) });
export type StocktakeCount = z.output<typeof stocktakeCountSchema>;

export const stocktakeListQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) });
export type StocktakeListQuery = z.output<typeof stocktakeListQuerySchema>;

export const movementListQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) });
export type MovementListQuery = z.output<typeof movementListQuerySchema>;
```

Trong `shared/src/schemas/common.ts`, thêm các dòng sau ngay sau dòng `  autoPrint: 'Tự in',` (giữ nguyên các dòng khác):

```ts
  unitCost: 'Giá nhập',
  counted: 'Số đếm',
  supplierId: 'Nhà cung cấp',
  amount: 'Số tiền',
  phone: 'Số điện thoại',
  note: 'Ghi chú',
  limit: 'Giới hạn',
```

Thêm vào cuối `shared/src/types.ts`:

```ts

export interface Supplier {
  id: number;
  name: string;
  phone: string | null;
  note: string | null;
  /** Mình còn nợ NCC (cache của supplier_transactions); âm = NCC nợ lại. */
  debt: number;
  isActive: boolean;
  createdAt: string;
}

export interface SupplierTransaction {
  id: number;
  supplierId: number;
  importId: number | null;
  importCode: string | null;
  /** + nợ thêm, − trả nợ / hủy phiếu. */
  amount: number;
  note: string | null;
  createdAt: string;
  /** Số nợ sau giao dịch này. */
  balance: number;
}

export interface ImportItem {
  id: number;
  productId: number;
  productName: string;
  unitName: string;
  factor: number;
  qty: number;
  unitCost: number;
  /** Giá vốn 1 đơn vị gốc. */
  costPrice: number;
  amount: number;
}

export interface ImportSummary {
  id: number;
  code: string;
  supplierId: number | null;
  supplierName: string | null;
  total: number;
  paid: number;
  note: string | null;
  status: 'done' | 'cancelled';
  itemCount: number;
  createdAt: string;
  cancelledAt: string | null;
}

export interface ImportDetail extends ImportSummary {
  items: ImportItem[];
}

export interface ImportList {
  imports: ImportSummary[];
  summary: { count: number; total: number; paid: number };
}

export interface StocktakeItem {
  productId: number;
  productName: string;
  unit: string;
  costPrice: number;
  counted: number;
  /** Tồn máy lúc đếm. */
  expected: number;
  /** counted − expected, làm tròn 3 số lẻ. */
  diff: number;
  countedAt: string;
}

export interface StocktakeSummary {
  id: number;
  code: string;
  status: 'open' | 'done' | 'cancelled';
  note: string | null;
  createdAt: string;
  finishedAt: string | null;
  itemCount: number;
  diffCount: number;
  /** Σ diff × giá vốn hiện tại, làm tròn đồng. */
  diffValue: number;
}

export interface StocktakeDetail extends StocktakeSummary {
  items: StocktakeItem[];
}

export type MovementType = 'sale' | 'import' | 'return' | 'adjust';

export interface StockMovement {
  id: number;
  type: MovementType;
  /** +/- theo đơn vị gốc. */
  qty: number;
  note: string | null;
  createdAt: string;
  /** Mã chứng từ liên quan: HD-…, PN-…, KK-… hoặc null. */
  refCode: string | null;
}
```

Trong `shared/src/index.ts`, thêm sau dòng `export * from './cart.js';`:

```ts
export * from './inventory-math.js';
```

và sau dòng `export * from './schemas/settings.js';`:

```ts
export * from './schemas/supplier.js';
export * from './schemas/import.js';
export * from './schemas/stocktake.js';
```

- [ ] **Step 4: Chạy test, thấy PASS**

Run: `npm test -w shared`
Expected: PASS toàn bộ.

- [ ] **Step 5: Typecheck và commit**

Run: `npm run typecheck`
Expected: không lỗi.

```bash
git add shared/src/inventory-math.ts shared/src/inventory-math.test.ts shared/src/schemas/supplier.ts shared/src/schemas/import.ts shared/src/schemas/stocktake.ts shared/src/schemas/inventory.test.ts shared/src/schemas/order.ts shared/src/schemas/common.ts shared/src/types.ts shared/src/index.ts
git commit -m "feat(shared): schema và kiểu dữ liệu nhập hàng, nhà cung cấp, kiểm kê"
```

---

### Task 2: Reducer phiếu nhập nháp (shared)

**Files:**
- Create: `shared/src/import-draft.ts`, `shared/src/import-draft.test.ts`
- Modify: `shared/src/index.ts` (1 dòng)

**Interfaces:**
- Consumes: `newLineKey` (`shared/src/cart.ts`), `importLineAmount` (Task 1), `ImportInputBody` (Task 1), `ProductWithUnits` (types).
- Produces:
  - `type UnitOption = { id: number | null; name: string; factor: number; sellPrice: number }`
  - `type DraftLine = { key: string; productId: number; name: string; isActive: boolean; baseCost: number; options: UnitOption[]; unitId: number | null; qty: number; unitCost: number; sellPrice: number }`
  - `type ImportDraft = { supplierId: number | null; note: string; paid: number | null; lines: DraftLine[] }` (`paid = null` nghĩa là "trả đủ", tự theo tổng), `EMPTY_IMPORT_DRAFT`
  - `type DraftAction = { type: 'add'; product: ProductWithUnits; unitId: number | null } | { type: 'update'; key: string; patch: Partial<Pick<DraftLine, 'qty' | 'unitCost' | 'sellPrice'>> } | { type: 'setUnit'; key: string; unitId: number | null } | { type: 'remove'; key: string } | { type: 'setSupplier'; supplierId: number | null } | { type: 'setNote'; note: string } | { type: 'setPaid'; paid: number | null } | { type: 'clear' }`
  - `importDraftReducer(d: ImportDraft, a: DraftAction): ImportDraft`
  - `unitOptions(p: ProductWithUnits): UnitOption[]`, `currentOption(l: DraftLine): UnitOption`
  - `draftTotals(d: ImportDraft): { total: number; paid: number; debt: number }`
  - `toImportInput(d: ImportDraft): ImportInputBody`
  - `parseImportDraft(raw: string | null): ImportDraft`

- [ ] **Step 1: Viết test**

`shared/src/import-draft.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  EMPTY_IMPORT_DRAFT,
  currentOption,
  draftTotals,
  importDraftReducer,
  parseImportDraft,
  toImportInput,
  type ImportDraft,
} from './import-draft.js';
import type { ProductWithUnits } from './types.js';

const beer: ProductWithUnits = {
  id: 1,
  barcode: '893',
  name: 'Bia Tiger',
  unit: 'lon',
  costPrice: 10000,
  sellPrice: 12000,
  stock: 0,
  isWeighed: false,
  categoryId: null,
  minStock: 0,
  isActive: true,
  createdAt: '',
  updatedAt: '',
  categoryName: null,
  units: [{ id: 7, productId: 1, name: 'Thùng', barcode: '894', factor: 24, sellPrice: 280000 }],
};
const add = (d: ImportDraft, unitId: number | null = null, product = beer) =>
  importDraftReducer(d, { type: 'add', product, unitId });

describe('importDraftReducer', () => {
  it('thêm dòng: giá nhập mặc định = giá vốn × hệ số, giá bán = giá của đơn vị', () => {
    const d = add(add(EMPTY_IMPORT_DRAFT), 7);
    expect(d.lines.map((l) => [l.unitId, l.qty, l.unitCost, l.sellPrice])).toEqual([
      [null, 1, 10000, 12000],
      [7, 1, 240000, 280000],
    ]);
  });
  it('quét lại cùng sản phẩm + cùng đơn vị → cộng số lượng; unitId lạ → đơn vị gốc', () => {
    const d = add(add(add(EMPTY_IMPORT_DRAFT, 7), 7), 999);
    expect(d.lines.map((l) => [l.unitId, l.qty])).toEqual([
      [7, 2],
      [null, 1],
    ]);
  });
  it('đổi đơn vị: điền lại giá nhập và giá bán theo đơn vị mới', () => {
    let d = add(EMPTY_IMPORT_DRAFT);
    const key = d.lines[0]!.key;
    d = importDraftReducer(d, { type: 'update', key, patch: { unitCost: 9500 } });
    d = importDraftReducer(d, { type: 'setUnit', key, unitId: 7 });
    expect(d.lines[0]).toMatchObject({ unitId: 7, unitCost: 240000, sellPrice: 280000 });
    expect(currentOption(d.lines[0]!)).toMatchObject({ name: 'Thùng', factor: 24 });
  });
  it('update: qty ≤ 0 xóa dòng; giá làm tròn, không âm', () => {
    let d = add(EMPTY_IMPORT_DRAFT);
    const key = d.lines[0]!.key;
    d = importDraftReducer(d, { type: 'update', key, patch: { unitCost: -3, sellPrice: 12500.6 } });
    expect(d.lines[0]).toMatchObject({ unitCost: 0, sellPrice: 12501 });
    d = importDraftReducer(d, { type: 'update', key, patch: { qty: 0 } });
    expect(d.lines).toEqual([]);
  });
  it('setSupplier / setNote / setPaid / clear', () => {
    let d = importDraftReducer(EMPTY_IMPORT_DRAFT, { type: 'setSupplier', supplierId: 3 });
    d = importDraftReducer(d, { type: 'setNote', note: 'hàng tết' });
    d = importDraftReducer(d, { type: 'setPaid', paid: 5000 });
    expect(d).toMatchObject({ supplierId: 3, note: 'hàng tết', paid: 5000 });
    expect(importDraftReducer(d, { type: 'clear' })).toEqual(EMPTY_IMPORT_DRAFT);
  });
});

describe('draftTotals / toImportInput', () => {
  it('paid null = trả đủ; nợ = tổng − đã trả', () => {
    let d = add(add(EMPTY_IMPORT_DRAFT, 7), null);
    expect(draftTotals(d)).toEqual({ total: 250000, paid: 250000, debt: 0 });
    d = importDraftReducer(d, { type: 'setPaid', paid: 200000 });
    expect(draftTotals(d)).toEqual({ total: 250000, paid: 200000, debt: 50000 });
  });
  it('chỉ gửi sellPrice khi khác giá hiện tại của đơn vị; note rỗng → null', () => {
    let d = add(add(EMPTY_IMPORT_DRAFT, 7));
    d = importDraftReducer(d, { type: 'update', key: d.lines[0]!.key, patch: { sellPrice: 290000 } });
    d = importDraftReducer(d, { type: 'setSupplier', supplierId: 3 });
    expect(toImportInput(d)).toEqual({
      supplierId: 3,
      note: null,
      paid: 250000,
      items: [
        { productId: 1, unitId: 7, qty: 1, unitCost: 240000, sellPrice: 290000 },
        { productId: 1, unitId: null, qty: 1, unitCost: 10000, sellPrice: null },
      ],
    });
  });
});

describe('parseImportDraft', () => {
  it('rác hoặc sai cấu trúc → phiếu trống; đọc lại đúng phiếu đã lưu', () => {
    expect(parseImportDraft(null)).toEqual(EMPTY_IMPORT_DRAFT);
    expect(parseImportDraft('{oops')).toEqual(EMPTY_IMPORT_DRAFT);
    expect(parseImportDraft('{"lines":[{"name":"x"}]}')).toEqual(EMPTY_IMPORT_DRAFT);
    const d = add(EMPTY_IMPORT_DRAFT, 7);
    expect(parseImportDraft(JSON.stringify(d))).toEqual(d);
  });
});
```

- [ ] **Step 2: Chạy test, thấy FAIL**

Run: `npm test -w shared`
Expected: FAIL, không tìm thấy `./import-draft.js`.

- [ ] **Step 3: Viết code**

`shared/src/import-draft.ts`:

```ts
import { z } from 'zod';
import { newLineKey } from './cart.js';
import { importLineAmount } from './inventory-math.js';
import type { ImportInputBody } from './schemas/import.js';
import type { ProductWithUnits } from './types.js';

const unitOptionSchema = z.object({
  id: z.number().int().nullable(),
  name: z.string(),
  factor: z.number().positive(),
  sellPrice: z.number().int().min(0),
});
const draftLineSchema = z.object({
  key: z.string(),
  productId: z.number().int(),
  name: z.string(),
  isActive: z.boolean(),
  /** Giá vốn 1 đơn vị gốc lúc thêm dòng, để điền lại giá nhập khi đổi đơn vị. */
  baseCost: z.number().int().min(0),
  options: z.array(unitOptionSchema).min(1),
  unitId: z.number().int().nullable(),
  qty: z.number().positive(),
  unitCost: z.number().int().min(0),
  sellPrice: z.number().int().min(0),
});
const draftSchema = z.object({
  supplierId: z.number().int().nullable(),
  note: z.string(),
  /** null = trả đủ (tự theo tổng tiền). */
  paid: z.number().int().min(0).nullable(),
  lines: z.array(draftLineSchema),
});

export type UnitOption = z.infer<typeof unitOptionSchema>;
export type DraftLine = z.infer<typeof draftLineSchema>;
export type ImportDraft = z.infer<typeof draftSchema>;

export const EMPTY_IMPORT_DRAFT: ImportDraft = { supplierId: null, note: '', paid: null, lines: [] };

export type DraftAction =
  | { type: 'add'; product: ProductWithUnits; unitId: number | null }
  | { type: 'update'; key: string; patch: Partial<Pick<DraftLine, 'qty' | 'unitCost' | 'sellPrice'>> }
  | { type: 'setUnit'; key: string; unitId: number | null }
  | { type: 'remove'; key: string }
  | { type: 'setSupplier'; supplierId: number | null }
  | { type: 'setNote'; note: string }
  | { type: 'setPaid'; paid: number | null }
  | { type: 'clear' };

/** Đơn vị gốc + các đơn vị quy đổi của sản phẩm. */
export function unitOptions(p: ProductWithUnits): UnitOption[] {
  return [
    { id: null, name: p.unit, factor: 1, sellPrice: p.sellPrice },
    ...p.units.map((u) => ({ id: u.id, name: u.name, factor: u.factor, sellPrice: u.sellPrice })),
  ];
}

export function currentOption(l: DraftLine): UnitOption {
  return l.options.find((o) => o.id === l.unitId) ?? l.options[0]!;
}

/** Đặt đơn vị cho dòng; giá nhập và giá bán điền lại theo đơn vị đó. unitId lạ → đơn vị gốc. */
function withUnit(l: DraftLine, unitId: number | null): DraftLine {
  const opt = l.options.find((o) => o.id === unitId) ?? l.options[0]!;
  return { ...l, unitId: opt.id, unitCost: Math.round(l.baseCost * opt.factor), sellPrice: opt.sellPrice };
}

const money = (n: number) => Math.max(0, Math.round(n));

export function importDraftReducer(d: ImportDraft, a: DraftAction): ImportDraft {
  switch (a.type) {
    case 'add': {
      const p = a.product;
      const base: DraftLine = {
        key: newLineKey(),
        productId: p.id,
        name: p.name,
        isActive: p.isActive,
        baseCost: p.costPrice,
        options: unitOptions(p),
        unitId: null,
        qty: 1,
        unitCost: p.costPrice,
        sellPrice: p.sellPrice,
      };
      const line = withUnit(base, a.unitId);
      const same = d.lines.find((l) => l.productId === p.id && l.unitId === line.unitId);
      if (same) return { ...d, lines: d.lines.map((l) => (l === same ? { ...l, qty: l.qty + 1 } : l)) };
      return { ...d, lines: [...d.lines, line] };
    }
    case 'update': {
      if (a.patch.qty !== undefined && a.patch.qty <= 0) return importDraftReducer(d, { type: 'remove', key: a.key });
      const patch = { ...a.patch };
      if (patch.unitCost !== undefined) patch.unitCost = money(patch.unitCost);
      if (patch.sellPrice !== undefined) patch.sellPrice = money(patch.sellPrice);
      return { ...d, lines: d.lines.map((l) => (l.key === a.key ? { ...l, ...patch } : l)) };
    }
    case 'setUnit':
      return { ...d, lines: d.lines.map((l) => (l.key === a.key && l.unitId !== a.unitId ? withUnit(l, a.unitId) : l)) };
    case 'remove':
      return { ...d, lines: d.lines.filter((l) => l.key !== a.key) };
    case 'setSupplier':
      return { ...d, supplierId: a.supplierId };
    case 'setNote':
      return { ...d, note: a.note };
    case 'setPaid':
      return { ...d, paid: a.paid === null ? null : money(a.paid) };
    case 'clear':
      return EMPTY_IMPORT_DRAFT;
  }
}

export function draftTotals(d: ImportDraft): { total: number; paid: number; debt: number } {
  const total = d.lines.reduce((s, l) => s + importLineAmount(l.qty, l.unitCost), 0);
  const paid = d.paid ?? total;
  return { total, paid, debt: total - paid };
}

/** Body gửi POST /api/imports; sellPrice chỉ gửi khi khác giá hiện tại của đơn vị. */
export function toImportInput(d: ImportDraft): ImportInputBody {
  return {
    supplierId: d.supplierId,
    note: d.note.trim() || null,
    paid: draftTotals(d).paid,
    items: d.lines.map((l) => ({
      productId: l.productId,
      unitId: l.unitId,
      qty: l.qty,
      unitCost: l.unitCost,
      sellPrice: l.sellPrice !== currentOption(l).sellPrice ? l.sellPrice : null,
    })),
  };
}

/** Đọc nháp từ localStorage; hỏng hoặc sai cấu trúc thì trả phiếu trống. */
export function parseImportDraft(raw: string | null): ImportDraft {
  if (!raw) return EMPTY_IMPORT_DRAFT;
  try {
    const r = draftSchema.safeParse(JSON.parse(raw));
    return r.success ? r.data : EMPTY_IMPORT_DRAFT;
  } catch {
    return EMPTY_IMPORT_DRAFT;
  }
}
```

Trong `shared/src/index.ts`, thêm sau dòng `export * from './inventory-math.js';`:

```ts
export * from './import-draft.js';
```

- [ ] **Step 4: Chạy test, thấy PASS**

Run: `npm test -w shared`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/src/import-draft.ts shared/src/import-draft.test.ts shared/src/index.ts
git commit -m "feat(shared): phiếu nhập nháp – thêm/gộp dòng, đổi đơn vị, tổng tiền, đọc nháp"
```

---

### Task 3: Migration nhập hàng, NCC, kiểm kê (server)

**Files:**
- Modify: `server/src/db/schema.ts` (bảng `imports`, `importItems`; thêm `suppliers`, `supplierTransactions`, `stocktakes`, `stocktakeItems`)
- Create: `server/drizzle/0002_*.sql` + `server/drizzle/meta/*` (drizzle-kit sinh, có thể sửa tay dòng `INSERT … SELECT`)
- Create: `server/src/db/migration-0002.test.ts`
- Modify: `server/src/db/connection.test.ts` (danh sách bảng)

**Interfaces:**
- Produces (drizzle tables, tên export): `suppliers`, `supplierTransactions`, `stocktakes`, `stocktakeItems`; cột mới `imports.code/supplierId/paid/status/cancelledAt`, `importItems.productName/unitName/factor/unitCost/amount`.

- [ ] **Step 1: Viết test**

Trong `server/src/db/connection.test.ts`, test `'tạo đủ 11 bảng nghiệp vụ và bật foreign_keys'`: đổi tên thành `'tạo đủ 15 bảng nghiệp vụ và bật foreign_keys'` và mảng `toEqual([...])` thành (giữ nguyên phần còn lại của test):

```ts
    expect(tables).toEqual([
      'categories',
      'customers',
      'debt_transactions',
      'import_items',
      'imports',
      'order_items',
      'orders',
      'product_units',
      'products',
      'settings',
      'stock_movements',
      'stocktake_items',
      'stocktakes',
      'supplier_transactions',
      'suppliers',
    ]);
```

(Đọc file trước; nếu mảng cũ có dạng khác, chỉ thêm 4 tên mới vào đúng thứ tự chữ cái và sửa số 11 → 15.)

`server/src/db/migration-0002.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(here, '../../drizzle');

/** Bản sao thư mục migration chỉ giữ `count` migration đầu, giả lập DB của giai đoạn trước. */
function partialMigrations(count: number): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tiny-pos-mig-'));
  fs.cpSync(migrationsFolder, dir, { recursive: true });
  const journalPath = path.join(dir, 'meta', '_journal.json');
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')) as { entries: unknown[] };
  journal.entries = journal.entries.slice(0, count);
  fs.writeFileSync(journalPath, JSON.stringify(journal));
  return dir;
}

describe('migration 0002', () => {
  it('chạy được trên DB giai đoạn 2 đã có phiếu nhập và đơn hàng; dữ liệu cũ còn nguyên', () => {
    const sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    const db = drizzle(sqlite);
    migrate(db, { migrationsFolder: partialMigrations(2) });
    sqlite.exec(`
      INSERT INTO products (id, name, stock, cost_price) VALUES (1, 'Bia', 5, 9000);
      INSERT INTO imports (id, supplier_name, total, note) VALUES (1, 'Đại lý cũ', 90000, 'phiếu cũ');
      INSERT INTO import_items (import_id, product_id, qty, cost_price) VALUES (1, 1, 10, 9000);
      INSERT INTO orders (id, code, total, paid, payment_method) VALUES (1, 'HD-20260929-0001', 12000, 12000, 'cash');
      INSERT INTO order_items (order_id, product_id, product_name, unit, qty, price, cost_price, factor, amount)
        VALUES (1, 1, 'Bia', 'lon', 1, 12000, 9000, 1, 12000);
    `);
    migrate(db, { migrationsFolder });
    expect(sqlite.prepare('SELECT id, code, supplier_id, supplier_name, total, paid, status, note FROM imports').all()).toEqual([
      { id: 1, code: 'PN-OLD-1', supplier_id: null, supplier_name: 'Đại lý cũ', total: 90000, paid: 0, status: 'done', note: 'phiếu cũ' },
    ]);
    expect(sqlite.prepare('SELECT import_id, product_id, qty, cost_price, factor, amount FROM import_items').all()).toEqual([
      { import_id: 1, product_id: 1, qty: 10, cost_price: 9000, factor: 1, amount: 0 },
    ]);
    expect(sqlite.prepare('SELECT count(*) AS n FROM order_items').get()).toEqual({ n: 1 });
    expect(sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });
});
```

- [ ] **Step 2: Chạy test, thấy FAIL**

Run: `npm test -w server -- src/db`
Expected: FAIL (thiếu bảng mới; `imports` chưa có cột `code`).

- [ ] **Step 3: Sửa schema**

Trong `server/src/db/schema.ts`:

(a) Thêm bảng `suppliers` ngay **sau** bảng `customers` (phải đứng trước `imports`):

```ts
export const suppliers = sqliteTable('suppliers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  phone: text('phone'),
  note: text('note'),
  debt: integer('debt').notNull().default(0), // cache, tính từ supplier_transactions
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: createdAt(),
});
```

(b) Thay toàn bộ khối `export const imports = sqliteTable('imports', { … });` bằng:

```ts
export const imports = sqliteTable(
  'imports',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    code: text('code').notNull().unique(), // PN-20260929-0001
    supplierId: integer('supplier_id').references(() => suppliers.id),
    supplierName: text('supplier_name'), // snapshot tên NCC lúc nhập
    total: integer('total').notNull().default(0),
    paid: integer('paid').notNull().default(0),
    note: text('note'),
    status: text('status', { enum: ['done', 'cancelled'] }).notNull().default('done'),
    createdAt: createdAt(),
    cancelledAt: text('cancelled_at'),
  },
  (t) => [index('imports_created_idx').on(t.createdAt)],
);
```

(c) Trong `importItems`, thay 2 dòng

```ts
  qty: real('qty').notNull(),
  costPrice: integer('cost_price').notNull(),
```

bằng

```ts
  productName: text('product_name').notNull().default(''),
  unitName: text('unit_name').notNull().default(''),
  factor: real('factor').notNull().default(1), // hệ số đơn vị đã chọn
  qty: real('qty').notNull(), // theo đơn vị đã chọn
  unitCost: integer('unit_cost').notNull().default(0), // giá nhập 1 đơn vị đã chọn
  costPrice: integer('cost_price').notNull(), // giá vốn 1 đơn vị gốc
  amount: integer('amount').notNull().default(0),
```

(d) Thêm ngay sau khối `importItems`:

```ts
export const supplierTransactions = sqliteTable(
  'supplier_transactions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    supplierId: integer('supplier_id')
      .notNull()
      .references(() => suppliers.id),
    importId: integer('import_id').references(() => imports.id),
    amount: integer('amount').notNull(), // + nợ thêm, - trả nợ / hủy phiếu
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [index('supplier_tx_supplier_idx').on(t.supplierId, t.createdAt)],
);
```

(e) Thêm vào cuối file:

```ts
export const stocktakes = sqliteTable('stocktakes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(), // KK-20260929-01
  status: text('status', { enum: ['open', 'done', 'cancelled'] }).notNull().default('open'),
  note: text('note'),
  createdAt: createdAt(),
  finishedAt: text('finished_at'),
});

export const stocktakeItems = sqliteTable(
  'stocktake_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    stocktakeId: integer('stocktake_id')
      .notNull()
      .references(() => stocktakes.id, { onDelete: 'cascade' }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    counted: real('counted').notNull(), // theo đơn vị gốc
    expected: real('expected').notNull(), // tồn máy lúc đếm
    countedAt: text('counted_at').notNull(),
  },
  (t) => [uniqueIndex('stocktake_items_uq').on(t.stocktakeId, t.productId)],
);
```

- [ ] **Step 4: Sinh migration và sửa `INSERT … SELECT` nếu cần**

Run: `npm run db:generate`
Expected: tạo `server/drizzle/0002_<tên>.sql`, cập nhật `server/drizzle/meta/_journal.json` + snapshot mới. Không có câu hỏi tương tác (không xóa/đổi tên cột). Nếu có, báo NEEDS_CONTEXT kèm nội dung câu hỏi.

Mở file SQL. SQLite không `ADD COLUMN … NOT NULL` không default được nên drizzle-kit sẽ dựng lại bảng `imports` (`__new_imports`). Ở migration `0001`, drizzle-kit sinh `INSERT INTO __new_… SELECT` có chọn cả **cột chưa tồn tại** ở bảng cũ. Sửa tay đúng dòng `INSERT INTO \`__new_imports\`…` để:
- danh sách cột đích = `"id", "code", "supplier_name", "total", "note", "created_at"`;
- vế `SELECT` = `"id", 'PN-OLD-' || "id", "supplier_name", "total", "note", "created_at" FROM \`imports\``;
- các cột mới khác nhận DEFAULT (`paid` 0, `status` 'done', `supplier_id`/`cancelled_at` NULL).

Làm tương tự với `import_items` nếu drizzle-kit dựng lại bảng này (chỉ chọn các cột đã tồn tại ở bảng cũ: `id`, `import_id`, `product_id`, `qty`, `cost_price`). Thêm một dòng comment SQL `-- Sửa tay: …` ngay trên mỗi dòng đã sửa (giữ nguyên các dòng `--> statement-breakpoint`). Không sửa `0000`, `0001`.

- [ ] **Step 5: Chạy test, thấy PASS**

Run: `npm test`
Expected: PASS toàn bộ shared + server (gồm test migration mới và test cũ của seed/orders/products).

Run: `npm run db:generate`
Expected: "No schema changes" (snapshot khớp schema).

- [ ] **Step 6: Typecheck và commit**

Run: `npm run typecheck`

```bash
git add server/src/db/schema.ts server/drizzle server/src/db/migration-0002.test.ts server/src/db/connection.test.ts
git commit -m "feat(server): migration nhập hàng, nhà cung cấp, kiểm kê"
```

---

### Task 4: Nhà cung cấp, sổ nợ và mã chứng từ theo ngày (server)

**Files:**
- Create: `server/src/services/daily-code.ts`, `server/src/services/supplier-ledger.ts`, `server/src/services/suppliers.ts`, `server/src/services/suppliers.test.ts`
- Modify: `server/src/services/orders.ts` (dùng `daily-code.ts` thay `Clock`/`resolveClock`/`nextCode` nội bộ)

**Interfaces:**
- Consumes: bảng Task 3; `SupplierInput`, `SupplierPayment`, `Supplier`, `SupplierTransaction`, `currentTzOffset` (shared); `ConflictError`, `BadRequestError`, `NotFoundError`.
- Produces:
  - `daily-code.ts`: `interface Clock { now?: Date; tzOffsetMin?: number }`, `resolveClock(c?: Clock): { now: Date; tz: number }`, `nextDailyCode(tx: DbOrTx, table: 'orders' | 'imports' | 'stocktakes', prefix: string, day: string, width: number): string`
  - `supplier-ledger.ts`: `recordSupplierTx(tx: DbOrTx, t: { supplierId: number; amount: number; importId?: number | null; note?: string | null; createdAt?: string }): void`
  - `suppliers.ts`: `listSuppliers(db: Db, q?: string): Supplier[]`, `getSupplier(db: DbOrTx, id: number): Supplier`, `createSupplier(db: Db, input: SupplierInput): Supplier`, `updateSupplier(db: Db, id: number, input: SupplierInput): Supplier`, `deleteSupplier(db: Db, id: number): void`, `paySupplier(db: Db, id: number, input: SupplierPayment): Supplier`, `listSupplierTransactions(db: Db, id: number): SupplierTransaction[]`
  - `orders.ts` vẫn export `Clock` (re-export) để không đổi giao diện.

- [ ] **Step 1: Viết test**

`server/src/services/suppliers.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { supplierInputSchema } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { createTestDb } from '../db/test-db.js';
import { nextDailyCode } from './daily-code.js';
import { recordSupplierTx } from './supplier-ledger.js';
import {
  createSupplier,
  deleteSupplier,
  getSupplier,
  listSupplierTransactions,
  listSuppliers,
  paySupplier,
  updateSupplier,
} from './suppliers.js';

let db: Db;
beforeEach(() => {
  db = createTestDb();
});
const make = (o: Record<string, unknown>) => createSupplier(db, supplierInputSchema.parse(o));

describe('suppliers', () => {
  it('tạo, sửa, tìm theo tên có dấu không phân biệt hoa/thường, sắp theo tên', () => {
    const a = make({ name: 'Đại lý Hùng', phone: '0909' });
    make({ name: 'Bánh kẹo Minh' });
    expect(a).toMatchObject({ name: 'Đại lý Hùng', phone: '0909', note: null, debt: 0, isActive: true });
    expect(listSuppliers(db).map((s) => s.name)).toEqual(['Bánh kẹo Minh', 'Đại lý Hùng']);
    expect(listSuppliers(db, 'đại').map((s) => s.name)).toEqual(['Đại lý Hùng']);
    expect(listSuppliers(db, '0909').map((s) => s.id)).toEqual([a.id]);
    expect(updateSupplier(db, a.id, supplierInputSchema.parse({ name: 'Đại lý Hùng 2' })).name).toBe('Đại lý Hùng 2');
  });

  it('sổ nợ: recordSupplierTx cộng dồn debt; trả nợ trừ; số dư theo từng dòng, mới nhất trước', () => {
    const s = make({ name: 'NCC' });
    recordSupplierTx(db, { supplierId: s.id, amount: 80000, note: 'Nhập PN-1' });
    recordSupplierTx(db, { supplierId: s.id, amount: 20000, note: 'Nhập PN-2' });
    expect(paySupplier(db, s.id, { amount: 30000, note: null }).debt).toBe(70000);
    expect(listSupplierTransactions(db, s.id).map((t) => [t.amount, t.balance, t.note])).toEqual([
      [-30000, 70000, 'Trả nợ'],
      [20000, 100000, 'Nhập PN-2'],
      [80000, 80000, 'Nhập PN-1'],
    ]);
  });

  it('trả nhiều hơn số đang nợ → 400; xóa khi còn nợ → 409; hết nợ thì xóa mềm được', () => {
    const s = make({ name: 'NCC' });
    recordSupplierTx(db, { supplierId: s.id, amount: 10000 });
    expect(() => paySupplier(db, s.id, { amount: 10001, note: null })).toThrow('Trả nhiều hơn số đang nợ');
    expect(() => deleteSupplier(db, s.id)).toThrow('Còn nợ, không xóa được');
    paySupplier(db, s.id, { amount: 10000, note: 'tiền mặt' });
    deleteSupplier(db, s.id);
    expect(listSuppliers(db)).toEqual([]);
    expect(getSupplier(db, s.id).isActive).toBe(false);
    expect(() => paySupplier(db, s.id, { amount: 1, note: null })).toThrow('Nhà cung cấp không còn hoạt động');
    expect(() => getSupplier(db, 999)).toThrow('Không tìm thấy nhà cung cấp');
  });
});

describe('nextDailyCode', () => {
  it('bắt đầu 1 mỗi ngày, độ rộng theo tham số', () => {
    expect(nextDailyCode(db, 'imports', 'PN', '2026-09-29', 4)).toBe('PN-20260929-0001');
    expect(nextDailyCode(db, 'stocktakes', 'KK', '2026-09-29', 2)).toBe('KK-20260929-01');
  });
});
```

- [ ] **Step 2: Chạy test, thấy FAIL**

Run: `npm run build -w shared && npm test -w server -- src/services/suppliers.test.ts`
Expected: FAIL, không tìm thấy `./daily-code.js`, `./supplier-ledger.js`, `./suppliers.js`.

- [ ] **Step 3: Viết code**

`server/src/services/daily-code.ts`:

```ts
import { sql } from 'drizzle-orm';
import { currentTzOffset } from '@tiny-pos/shared';
import type { DbOrTx } from '../db/connection.js';

/** Giờ hiện tại và múi giờ; test truyền vào để không phụ thuộc máy chạy. */
export interface Clock {
  now?: Date;
  tzOffsetMin?: number;
}

export function resolveClock(c: Clock = {}) {
  const now = c.now ?? new Date();
  return { now, tz: c.tzOffsetMin ?? currentTzOffset(now) };
}

/**
 * Mã chứng từ theo ngày địa phương: `${prefix}-YYYYMMDD-NNNN`, số lớn nhất trong ngày + 1.
 * Gọi trong cùng transaction với lệnh insert.
 */
export function nextDailyCode(
  tx: DbOrTx,
  table: 'orders' | 'imports' | 'stocktakes',
  prefix: string,
  day: string,
  width: number,
): string {
  const p = `${prefix}-${day.replaceAll('-', '')}-`;
  const last = tx.get<{ code: string } | undefined>(
    sql`select code from ${sql.identifier(table)} where code like ${`${p}%`} order by code desc limit 1`,
  );
  const seq = last ? Number(last.code.slice(p.length)) + 1 : 1;
  return p + String(seq).padStart(width, '0');
}
```

`server/src/services/supplier-ledger.ts`:

```ts
import { eq, sql } from 'drizzle-orm';
import type { DbOrTx } from '../db/connection.js';
import { supplierTransactions, suppliers } from '../db/schema.js';

export interface SupplierTxInput {
  supplierId: number;
  amount: number;
  importId?: number | null;
  note?: string | null;
  createdAt?: string;
}

/** Cách DUY NHẤT để đổi nợ nhà cung cấp: ghi sổ rồi cộng dồn vào suppliers.debt. */
export function recordSupplierTx(tx: DbOrTx, t: SupplierTxInput): void {
  tx.insert(supplierTransactions)
    .values({
      supplierId: t.supplierId,
      amount: t.amount,
      importId: t.importId ?? null,
      note: t.note ?? null,
      ...(t.createdAt ? { createdAt: t.createdAt } : {}),
    })
    .run();
  tx.update(suppliers)
    .set({ debt: sql`${suppliers.debt} + ${t.amount}` })
    .where(eq(suppliers.id, t.supplierId))
    .run();
}
```

`server/src/services/suppliers.ts`:

```ts
import { asc, eq } from 'drizzle-orm';
import type { Supplier, SupplierInput, SupplierPayment, SupplierTransaction } from '@tiny-pos/shared';
import type { Db, DbOrTx } from '../db/connection.js';
import { imports, supplierTransactions, suppliers } from '../db/schema.js';
import { BadRequestError, ConflictError, NotFoundError } from '../errors.js';
import { recordSupplierTx } from './supplier-ledger.js';

/** Lọc bằng JS vì LIKE của SQLite không bỏ hoa/thường với chữ có dấu ("đại" ≠ "Đại"). */
export function listSuppliers(db: Db, q?: string): Supplier[] {
  const rows = db.select().from(suppliers).where(eq(suppliers.isActive, true)).orderBy(asc(suppliers.name)).all();
  const t = q?.trim().toLowerCase();
  if (!t) return rows;
  return rows.filter((s) => s.name.toLowerCase().includes(t) || (s.phone?.includes(t) ?? false));
}

export function getSupplier(db: DbOrTx, id: number): Supplier {
  const s = db.select().from(suppliers).where(eq(suppliers.id, id)).get();
  if (!s) throw new NotFoundError('Không tìm thấy nhà cung cấp');
  return s;
}

export function createSupplier(db: Db, input: SupplierInput): Supplier {
  const { id } = db.insert(suppliers).values(input).returning({ id: suppliers.id }).get();
  return getSupplier(db, id);
}

export function updateSupplier(db: Db, id: number, input: SupplierInput): Supplier {
  getSupplier(db, id);
  db.update(suppliers).set(input).where(eq(suppliers.id, id)).run();
  return getSupplier(db, id);
}

/** Xóa mềm; còn nợ (kể cả âm) thì không cho, để sổ nợ không bị "treo". */
export function deleteSupplier(db: Db, id: number): void {
  const s = getSupplier(db, id);
  if (s.debt !== 0) throw new ConflictError('Còn nợ, không xóa được');
  db.update(suppliers).set({ isActive: false }).where(eq(suppliers.id, id)).run();
}

export function paySupplier(db: Db, id: number, input: SupplierPayment): Supplier {
  return db.transaction((tx) => {
    const s = getSupplier(tx, id);
    if (!s.isActive) throw new BadRequestError('Nhà cung cấp không còn hoạt động');
    if (input.amount > s.debt) throw new BadRequestError('Trả nhiều hơn số đang nợ');
    recordSupplierTx(tx, { supplierId: id, amount: -input.amount, note: input.note ?? 'Trả nợ' });
    return getSupplier(tx, id);
  });
}

/** Sổ nợ mới nhất trước, kèm số dư sau từng giao dịch. */
export function listSupplierTransactions(db: Db, id: number): SupplierTransaction[] {
  getSupplier(db, id);
  const rows = db
    .select({
      id: supplierTransactions.id,
      supplierId: supplierTransactions.supplierId,
      importId: supplierTransactions.importId,
      importCode: imports.code,
      amount: supplierTransactions.amount,
      note: supplierTransactions.note,
      createdAt: supplierTransactions.createdAt,
    })
    .from(supplierTransactions)
    .leftJoin(imports, eq(supplierTransactions.importId, imports.id))
    .where(eq(supplierTransactions.supplierId, id))
    .orderBy(asc(supplierTransactions.id))
    .all();
  let balance = 0;
  return rows.map((r) => ({ ...r, balance: (balance += r.amount) })).reverse();
}
```

Trong `server/src/services/orders.ts`:
- Xóa khối `/** Giờ hiện tại và múi giờ… */ export interface Clock {…}` và hàm `resolveClock` (từ dòng comment đến hết `}` của `resolveClock`), thay bằng:

```ts
export type { Clock } from './daily-code.js';
```

- Xóa hàm `nextCode` (từ comment `/** HD-YYYYMMDD-NNNN…` đến hết `}`).
- Trong `createOrder`, thay `code: nextCode(tx, localDate(now, tz)),` bằng `code: nextDailyCode(tx, 'orders', 'HD', localDate(now, tz), 4),`.
- Thêm import: `import { nextDailyCode, resolveClock, type Clock } from './daily-code.js';` (sau import `recordMovement`), bỏ `currentTzOffset` và `like`/`desc` khỏi import nếu không còn dùng (typecheck sẽ báo; `desc` vẫn dùng trong `listOrders`).

Chữ ký `createOrder(db, input, clock?: Clock)`, `listOrders`, `cancelOrder` giữ nguyên.

- [ ] **Step 4: Chạy test, thấy PASS**

Run: `npm test`
Expected: PASS (gồm `orders.test.ts` cũ – mã `HD-…` vẫn đúng).

- [ ] **Step 5: Typecheck và commit**

Run: `npm run typecheck`

```bash
git add server/src/services/daily-code.ts server/src/services/supplier-ledger.ts server/src/services/suppliers.ts server/src/services/suppliers.test.ts server/src/services/orders.ts
git commit -m "feat(server): nhà cung cấp, sổ nợ, mã chứng từ theo ngày dùng chung"
```

---

### Task 5: Phiếu nhập – tạo, xem, danh sách, hủy (server)

**Files:**
- Create: `server/src/services/imports.ts`, `server/src/services/imports.test.ts`

**Interfaces:**
- Consumes: `recordMovement`, `recordSupplierTx`, `nextDailyCode`, `resolveClock`, `Clock` (Task 4); `baseCost`, `importLineAmount`, `localDate`, `localDayRange`, `ImportInput`, `ImportDetail`, `ImportList`, `ImportSummary` (shared).
- Produces: `createImport(db: Db, input: ImportInput, clock?: Clock): ImportDetail`, `getImport(db: DbOrTx, id: number): ImportDetail`, `listImports(db: Db, date: string, clock?: Clock): ImportList`, `cancelImport(db: Db, id: number, clock?: Clock): ImportDetail`

- [ ] **Step 1: Viết test**

`server/src/services/imports.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  importInputSchema,
  orderInputSchema,
  productInputSchema,
  productUnitInputSchema,
  supplierInputSchema,
} from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { productUnits, stockMovements } from '../db/schema.js';
import { createTestDb } from '../db/test-db.js';
import { cancelImport, createImport, getImport, listImports } from './imports.js';
import { createOrder } from './orders.js';
import { createUnit, deleteUnit } from './product-units.js';
import { createProduct, getProduct, setProductActive } from './products.js';
import { createSupplier, deleteSupplier, getSupplier, listSupplierTransactions, paySupplier } from './suppliers.js';

const VN = 420;
const at = (iso: string) => ({ now: new Date(iso), tzOffsetMin: VN });
const MORNING = at('2026-09-29T03:00:00.000Z');

let db: Db;
beforeEach(() => {
  db = createTestDb();
});
const product = (o: Record<string, unknown>) => createProduct(db, productInputSchema.parse(o));
const supplier = (name = 'Đại lý Hùng') => createSupplier(db, supplierInputSchema.parse({ name }));
const crateOf = (productId: number) =>
  createUnit(db, productId, productUnitInputSchema.parse({ name: 'Thùng', factor: 24, sellPrice: 280000 }));
const imp = (o: Record<string, unknown>, clock = MORNING) => createImport(db, importInputSchema.parse(o), clock);

describe('createImport', () => {
  it('nhập theo thùng: +qty×factor, giá vốn gốc, giá bán thùng; ghi nợ phần chưa trả', () => {
    const p = product({ name: 'Bia', unit: 'lon', costPrice: 9000, sellPrice: 12000 });
    const crate = crateOf(p.id);
    const s = supplier();
    const r = imp({
      supplierId: s.id,
      paid: 400000,
      items: [{ productId: p.id, unitId: crate.id, qty: 2, unitCost: 240000, sellPrice: 290000 }],
    });
    expect(r).toMatchObject({ code: 'PN-20260929-0001', supplierName: 'Đại lý Hùng', total: 480000, paid: 400000, status: 'done', itemCount: 1 });
    expect(r.items).toMatchObject([{ productName: 'Bia', unitName: 'Thùng', factor: 24, qty: 2, unitCost: 240000, costPrice: 10000, amount: 480000 }]);
    expect(getProduct(db, p.id)).toMatchObject({ stock: 48, costPrice: 10000, sellPrice: 12000 });
    expect(db.select().from(productUnits).where(eq(productUnits.id, crate.id)).get()?.sellPrice).toBe(290000);
    expect(db.select().from(stockMovements).all().map((m) => [m.type, m.qty, m.refId, m.note])).toEqual([
      ['import', 48, r.id, 'Nhập PN-20260929-0001'],
    ]);
    expect(getSupplier(db, s.id).debt).toBe(80000);
    expect(listSupplierTransactions(db, s.id)).toMatchObject([{ amount: 80000, importCode: 'PN-20260929-0001' }]);
  });

  it('hai dòng cùng sản phẩm → giá vốn theo dòng cuối; sửa giá bán đơn vị gốc; hàng ngừng bán vẫn nhập', () => {
    const p = product({ name: 'Mì', costPrice: 3000, sellPrice: 4000 });
    setProductActive(db, p.id, false);
    imp({
      paid: 21000,
      items: [
        { productId: p.id, qty: 4, unitCost: 3000 },
        { productId: p.id, qty: 3, unitCost: 3000, sellPrice: 4500 },
      ],
    });
    imp({ paid: 3200, items: [{ productId: p.id, qty: 1, unitCost: 3200 }] });
    expect(getProduct(db, p.id)).toMatchObject({ stock: 8, costPrice: 3200, sellPrice: 4500 });
  });

  it('400: không NCC mà chưa trả đủ, trả vượt tổng, NCC đã xóa, đơn vị không thuộc sản phẩm, sản phẩm không có', () => {
    const a = product({ name: 'A', barcode: '1' });
    const b = product({ name: 'B', barcode: '2' });
    const crateB = crateOf(b.id);
    const gone = supplier('Cũ');
    deleteSupplier(db, gone.id);
    expect(() => imp({ paid: 0, items: [{ productId: a.id, qty: 1, unitCost: 1000 }] })).toThrow('Không ghi nhà cung cấp thì phải trả đủ');
    expect(() => imp({ paid: 2000, items: [{ productId: a.id, qty: 1, unitCost: 1000 }] })).toThrow('Số đã trả lớn hơn tổng tiền');
    expect(() => imp({ supplierId: gone.id, paid: 0, items: [{ productId: a.id, qty: 1, unitCost: 1000 }] })).toThrow(
      'Nhà cung cấp không còn hoạt động',
    );
    expect(() => imp({ paid: 1000, items: [{ productId: a.id, unitId: crateB.id, qty: 1, unitCost: 1000 }] })).toThrow(
      'Đơn vị của "A" không hợp lệ',
    );
    expect(() => imp({ paid: 1000, items: [{ productId: 999, qty: 1, unitCost: 1000 }] })).toThrow('Sản phẩm #999 không tồn tại');
    expect(db.select().from(stockMovements).all()).toEqual([]);
  });

  it('phiếu nháp cũ tham chiếu đơn vị đã xóa → 400 nêu tên sản phẩm', () => {
    const p = product({ name: 'Bia' });
    const crate = crateOf(p.id);
    deleteUnit(db, p.id, crate.id);
    expect(() => imp({ paid: 240000, items: [{ productId: p.id, unitId: crate.id, qty: 1, unitCost: 240000 }] })).toThrow(
      'Đơn vị của "Bia" không hợp lệ',
    );
  });

  it('mã tăng dần trong ngày VN, sang ngày mới về 0001', () => {
    const p = product({ name: 'A' });
    const one = { paid: 1000, items: [{ productId: p.id, qty: 1, unitCost: 1000 }] };
    expect(imp(one).code).toBe('PN-20260929-0001');
    expect(imp(one, at('2026-09-29T10:00:00.000Z')).code).toBe('PN-20260929-0002');
    expect(imp(one, at('2026-09-29T17:30:00.000Z')).code).toBe('PN-20260930-0001');
  });
});

describe('cancelImport', () => {
  it('trừ lại kho (được âm nếu đã bán), trừ lại nợ, giữ giá; hủy lần hai 409', () => {
    const p = product({ name: 'Bia', costPrice: 9000, sellPrice: 12000 });
    const s = supplier();
    const r = imp({ supplierId: s.id, paid: 0, items: [{ productId: p.id, qty: 48, unitCost: 10000 }] });
    createOrder(db, orderInputSchema.parse({ items: [{ productId: p.id, qty: 50, price: 12000 }], paymentMethod: 'cash', paid: 600000 }), MORNING);
    const c = cancelImport(db, r.id, at('2026-09-29T04:00:00.000Z'));
    expect(c).toMatchObject({ status: 'cancelled', cancelledAt: '2026-09-29T04:00:00.000Z' });
    expect(getProduct(db, p.id)).toMatchObject({ stock: -50, costPrice: 10000 });
    expect(getSupplier(db, s.id).debt).toBe(0);
    expect(listSupplierTransactions(db, s.id).map((t) => [t.amount, t.note])).toEqual([
      [-480000, 'Hủy PN-20260929-0001'],
      [480000, 'Nhập PN-20260929-0001'],
    ]);
    expect(() => cancelImport(db, r.id)).toThrow('Phiếu nhập đã hủy');
    expect(() => cancelImport(db, 999)).toThrow('Không tìm thấy phiếu nhập');
  });

  it('hủy sau khi đã trả hết nợ → NCC nợ lại mình (debt âm), không lỗi', () => {
    const p = product({ name: 'A' });
    const s = supplier();
    const r = imp({ supplierId: s.id, paid: 0, items: [{ productId: p.id, qty: 1, unitCost: 50000 }] });
    paySupplier(db, s.id, { amount: 50000, note: null });
    cancelImport(db, r.id);
    expect(getSupplier(db, s.id).debt).toBe(-50000);
  });
});

describe('listImports / getImport', () => {
  it('lọc theo ngày VN, mới nhất trước; tóm tắt bỏ phiếu hủy', () => {
    const p = product({ name: 'A' });
    const one = { paid: 1000, items: [{ productId: p.id, qty: 1, unitCost: 1000 }] };
    imp(one, at('2026-09-28T16:59:59.000Z'));
    const a = imp(one, at('2026-09-28T17:00:00.000Z'));
    const b = imp({ paid: 3000, items: [{ productId: p.id, qty: 3, unitCost: 1000 }] });
    const c = imp(one);
    cancelImport(db, c.id);
    const r = listImports(db, '2026-09-29', { tzOffsetMin: VN });
    expect(r.imports.map((i) => i.id)).toEqual([c.id, b.id, a.id]);
    expect(r.summary).toEqual({ count: 2, total: 4000, paid: 4000 });
    expect(getImport(db, b.id).items).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Chạy test, thấy FAIL**

Run: `npm run build -w shared && npm test -w server -- src/services/imports.test.ts`
Expected: FAIL, không tìm thấy `./imports.js`.

- [ ] **Step 3: Viết code**

`server/src/services/imports.ts`:

```ts
import { and, asc, desc, eq, gte, lt, sql } from 'drizzle-orm';
import {
  baseCost,
  importLineAmount,
  localDate,
  localDayRange,
  type ImportDetail,
  type ImportInput,
  type ImportList,
  type ImportSummary,
} from '@tiny-pos/shared';
import type { Db, DbOrTx } from '../db/connection.js';
import { importItems, imports, productUnits, products, suppliers } from '../db/schema.js';
import { BadRequestError, ConflictError, NotFoundError } from '../errors.js';
import { nextDailyCode, resolveClock, type Clock } from './daily-code.js';
import { recordMovement } from './stock.js';
import { recordSupplierTx } from './supplier-ledger.js';

interface ResolvedLine {
  productId: number;
  unitId: number | null;
  productName: string;
  unitName: string;
  factor: number;
  qty: number;
  unitCost: number;
  costPrice: number;
  amount: number;
  sellPrice: number | null;
}

/** Sản phẩm ngừng bán vẫn nhập được (nhập lại hàng cũ). */
function resolveLine(tx: DbOrTx, it: ImportInput['items'][number]): ResolvedLine {
  const p = tx.select().from(products).where(eq(products.id, it.productId)).get();
  if (!p) throw new BadRequestError(`Sản phẩm #${it.productId} không tồn tại`);
  let factor = 1;
  let unitName = p.unit;
  if (it.unitId !== null) {
    const u = tx
      .select()
      .from(productUnits)
      .where(and(eq(productUnits.id, it.unitId), eq(productUnits.productId, p.id)))
      .get();
    if (!u) throw new BadRequestError(`Đơn vị của "${p.name}" không hợp lệ`);
    factor = u.factor;
    unitName = u.name;
  }
  return {
    productId: p.id,
    unitId: it.unitId,
    productName: p.name,
    unitName,
    factor,
    qty: it.qty,
    unitCost: it.unitCost,
    costPrice: baseCost(it.unitCost, factor),
    amount: importLineAmount(it.qty, it.unitCost),
    sellPrice: it.sellPrice,
  };
}

/** Giá vốn theo dòng cuối của mỗi sản phẩm; giá bán áp vào đúng đơn vị của dòng (dòng cuối thắng). */
function applyPrices(tx: DbOrTx, lines: ResolvedLine[], updatedAt: string): void {
  const cost = new Map<number, number>();
  const baseSell = new Map<number, number>();
  const unitSell = new Map<number, number>();
  for (const l of lines) {
    cost.set(l.productId, l.costPrice);
    if (l.sellPrice === null) continue;
    if (l.unitId === null) baseSell.set(l.productId, l.sellPrice);
    else unitSell.set(l.unitId, l.sellPrice);
  }
  for (const [id, costPrice] of cost) {
    const sell = baseSell.get(id);
    tx.update(products)
      .set({ costPrice, updatedAt, ...(sell !== undefined ? { sellPrice: sell } : {}) })
      .where(eq(products.id, id))
      .run();
  }
  for (const [id, sellPrice] of unitSell) tx.update(productUnits).set({ sellPrice }).where(eq(productUnits.id, id)).run();
}

type ImportRow = typeof imports.$inferSelect;

function toSummary(r: ImportRow, itemCount: number): ImportSummary {
  return {
    id: r.id,
    code: r.code,
    supplierId: r.supplierId,
    supplierName: r.supplierName,
    total: r.total,
    paid: r.paid,
    note: r.note,
    status: r.status,
    itemCount,
    createdAt: r.createdAt,
    cancelledAt: r.cancelledAt,
  };
}

export function getImport(db: DbOrTx, id: number): ImportDetail {
  const r = db.select().from(imports).where(eq(imports.id, id)).get();
  if (!r) throw new NotFoundError('Không tìm thấy phiếu nhập');
  const items = db
    .select({
      id: importItems.id,
      productId: importItems.productId,
      productName: importItems.productName,
      unitName: importItems.unitName,
      factor: importItems.factor,
      qty: importItems.qty,
      unitCost: importItems.unitCost,
      costPrice: importItems.costPrice,
      amount: importItems.amount,
    })
    .from(importItems)
    .where(eq(importItems.importId, id))
    .orderBy(asc(importItems.id))
    .all();
  return { ...toSummary(r, items.length), items };
}

export function createImport(db: Db, input: ImportInput, clock?: Clock): ImportDetail {
  const { now, tz } = resolveClock(clock);
  return db.transaction((tx) => {
    const lines = input.items.map((it) => resolveLine(tx, it));
    const total = lines.reduce((s, l) => s + l.amount, 0);
    if (input.paid > total) throw new BadRequestError('Số đã trả lớn hơn tổng tiền');
    let supplierName: string | null = null;
    if (input.supplierId !== null) {
      const s = tx.select().from(suppliers).where(eq(suppliers.id, input.supplierId)).get();
      if (!s || !s.isActive) throw new BadRequestError('Nhà cung cấp không còn hoạt động');
      supplierName = s.name;
    } else if (input.paid !== total) throw new BadRequestError('Không ghi nhà cung cấp thì phải trả đủ');

    const code = nextDailyCode(tx, 'imports', 'PN', localDate(now, tz), 4);
    const createdAt = now.toISOString();
    const { id } = tx
      .insert(imports)
      .values({ code, supplierId: input.supplierId, supplierName, total, paid: input.paid, note: input.note, createdAt })
      .returning({ id: imports.id })
      .get();
    for (const l of lines) {
      tx.insert(importItems)
        .values({
          importId: id,
          productId: l.productId,
          productName: l.productName,
          unitName: l.unitName,
          factor: l.factor,
          qty: l.qty,
          unitCost: l.unitCost,
          costPrice: l.costPrice,
          amount: l.amount,
        })
        .run();
      recordMovement(tx, { productId: l.productId, qty: l.qty * l.factor, type: 'import', refId: id, note: `Nhập ${code}` });
    }
    applyPrices(tx, lines, createdAt);
    const debt = total - input.paid;
    if (input.supplierId !== null && debt > 0) {
      recordSupplierTx(tx, { supplierId: input.supplierId, amount: debt, importId: id, note: `Nhập ${code}`, createdAt });
    }
    return getImport(tx, id);
  });
}

// Viết tên bảng cứng: drizzle bỏ tiền tố bảng khi render cột trong subquery
const itemCount = sql<number>`(select count(*) from import_items where import_items.import_id = imports.id)`;

export function listImports(db: Db, date: string, clock?: Clock): ImportList {
  const { tz } = resolveClock(clock);
  const { start, end } = localDayRange(date, tz);
  const list = db
    .select({ row: imports, itemCount })
    .from(imports)
    .where(and(gte(imports.createdAt, start), lt(imports.createdAt, end)))
    .orderBy(desc(imports.id))
    .all()
    .map((r) => toSummary(r.row, Number(r.itemCount)));
  const done = list.filter((i) => i.status === 'done');
  return {
    imports: list,
    summary: {
      count: done.length,
      total: done.reduce((s, i) => s + i.total, 0),
      paid: done.reduce((s, i) => s + i.paid, 0),
    },
  };
}

/** Hủy: trừ lại kho (movement adjust, được âm) và phần nợ đã ghi; giá vốn/giá bán giữ nguyên. */
export function cancelImport(db: Db, id: number, clock?: Clock): ImportDetail {
  const { now } = resolveClock(clock);
  return db.transaction((tx) => {
    const r = getImport(tx, id);
    if (r.status === 'cancelled') throw new ConflictError('Phiếu nhập đã hủy');
    for (const it of r.items) {
      recordMovement(tx, { productId: it.productId, qty: -it.qty * it.factor, type: 'adjust', refId: id, note: `Hủy ${r.code}` });
    }
    const debt = r.total - r.paid;
    if (r.supplierId !== null && debt > 0) {
      recordSupplierTx(tx, { supplierId: r.supplierId, amount: -debt, importId: id, note: `Hủy ${r.code}` });
    }
    tx.update(imports).set({ status: 'cancelled', cancelledAt: now.toISOString() }).where(eq(imports.id, id)).run();
    return getImport(tx, id);
  });
}
```

- [ ] **Step 4: Chạy test, thấy PASS**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Typecheck và commit**

Run: `npm run typecheck`

```bash
git add server/src/services/imports.ts server/src/services/imports.test.ts
git commit -m "feat(server): phiếu nhập – cộng kho, giá vốn, giá bán, ghi nợ NCC, hủy phiếu"
```

---

### Task 6: Phiên kiểm kê (server)

**Files:**
- Create: `server/src/services/stocktakes.ts`, `server/src/services/stocktakes.test.ts`

**Interfaces:**
- Consumes: `recordMovement`, `nextDailyCode`, `resolveClock`, `Clock`; `localDate`, `StocktakeInput`, `StocktakeCount`, `StocktakeDetail`, `StocktakeSummary`, `StocktakeItem`.
- Produces: `openStocktake(db: Db, input: StocktakeInput, clock?: Clock): StocktakeDetail`, `countItem(db: Db, id: number, productId: number, input: StocktakeCount, clock?: Clock): StocktakeDetail`, `removeItem(db: Db, id: number, productId: number): StocktakeDetail`, `finishStocktake(db: Db, id: number, clock?: Clock): StocktakeDetail`, `cancelStocktake(db: Db, id: number, clock?: Clock): StocktakeDetail`, `getStocktake(db: DbOrTx, id: number): StocktakeDetail`, `getCurrentStocktake(db: Db): StocktakeDetail | null`, `listStocktakes(db: Db, limit: number): StocktakeSummary[]`

- [ ] **Step 1: Viết test**

`server/src/services/stocktakes.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { orderInputSchema, productInputSchema } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { stockMovements } from '../db/schema.js';
import { createTestDb } from '../db/test-db.js';
import { createOrder } from './orders.js';
import { createProduct, getProduct } from './products.js';
import {
  cancelStocktake,
  countItem,
  finishStocktake,
  getCurrentStocktake,
  listStocktakes,
  openStocktake,
  removeItem,
} from './stocktakes.js';

const VN = 420;
const at = (iso: string) => ({ now: new Date(iso), tzOffsetMin: VN });
const MORNING = at('2026-09-29T03:00:00.000Z');

let db: Db;
beforeEach(() => {
  db = createTestDb();
});
const product = (o: Record<string, unknown>) => createProduct(db, productInputSchema.parse(o));
const sell = (productId: number, qty: number) =>
  createOrder(db, orderInputSchema.parse({ items: [{ productId, qty, price: 1000 }], paymentMethod: 'cash', paid: 1_000_000 }), MORNING);
const adjusts = () =>
  db
    .select()
    .from(stockMovements)
    .where(eq(stockMovements.type, 'adjust'))
    .all()
    .map((m) => [m.productId, m.qty, m.note]);

describe('stocktakes', () => {
  it('chỉ một phiên mở; mã KK theo ngày; chốt xong mở phiên mới được', () => {
    const s = openStocktake(db, { note: 'quầy nước' }, MORNING);
    expect(s).toMatchObject({ code: 'KK-20260929-01', status: 'open', note: 'quầy nước', itemCount: 0 });
    expect(() => openStocktake(db, { note: null })).toThrow('Đang có phiên kiểm kê chưa chốt');
    expect(getCurrentStocktake(db)?.id).toBe(s.id);
    finishStocktake(db, s.id);
    expect(getCurrentStocktake(db)).toBeNull();
    expect(openStocktake(db, { note: null }, MORNING).code).toBe('KK-20260929-02');
  });

  it('đếm → bán thêm → chốt: tồn cuối = số đếm − số bán sau lúc đếm; món không đếm giữ nguyên', () => {
    const a = product({ name: 'Nước', stock: 10, costPrice: 5000 });
    const b = product({ name: 'Mì', stock: 7 });
    const s = openStocktake(db, { note: null }, MORNING);
    const counted = countItem(db, s.id, a.id, { counted: 8 }, MORNING);
    expect(counted.items).toMatchObject([{ productId: a.id, productName: 'Nước', counted: 8, expected: 10, diff: -2 }]);
    expect(counted).toMatchObject({ itemCount: 1, diffCount: 1, diffValue: -10000 });
    sell(a.id, 2);
    const done = finishStocktake(db, s.id, at('2026-09-29T05:00:00.000Z'));
    expect(done).toMatchObject({ status: 'done', finishedAt: '2026-09-29T05:00:00.000Z' });
    expect(getProduct(db, a.id).stock).toBe(6);
    expect(getProduct(db, b.id).stock).toBe(7);
    expect(adjusts()).toEqual([[a.id, -2, 'Kiểm kê KK-20260929-01']]);
  });

  it('đếm lại cùng món (máy khác) → 1 dòng, ghi đè cả counted lẫn expected', () => {
    const a = product({ name: 'Nước', stock: 10 });
    const s = openStocktake(db, { note: null });
    countItem(db, s.id, a.id, { counted: 8 });
    sell(a.id, 1);
    const again = countItem(db, s.id, a.id, { counted: 9 });
    expect(again.items).toMatchObject([{ counted: 9, expected: 9, diff: 0 }]);
    expect(again.diffCount).toBe(0);
    finishStocktake(db, s.id);
    expect(adjusts()).toEqual([]);
    expect(getProduct(db, a.id).stock).toBe(9);
  });

  it('hàng cân số lẻ; bỏ món đã đếm', () => {
    const a = product({ name: 'Thịt', unit: 'kg', isWeighed: true, stock: 1.5 });
    const b = product({ name: 'Gạo', unit: 'kg', stock: 3 });
    const s = openStocktake(db, { note: null });
    countItem(db, s.id, a.id, { counted: 1.25 });
    countItem(db, s.id, b.id, { counted: 2 });
    expect(removeItem(db, s.id, b.id).items.map((i) => [i.productId, i.diff])).toEqual([[a.id, -0.25]]);
    finishStocktake(db, s.id);
    expect(getProduct(db, a.id).stock).toBeCloseTo(1.25);
    expect(getProduct(db, b.id).stock).toBe(3);
  });

  it('hủy phiên: kho không đổi; đếm/bỏ/chốt/hủy phiên đã đóng → 409', () => {
    const a = product({ name: 'Nước', stock: 10 });
    const s = openStocktake(db, { note: null });
    countItem(db, s.id, a.id, { counted: 3 });
    expect(cancelStocktake(db, s.id).status).toBe('cancelled');
    expect(getProduct(db, a.id).stock).toBe(10);
    expect(() => countItem(db, s.id, a.id, { counted: 1 })).toThrow('Phiên kiểm kê đã đóng');
    expect(() => removeItem(db, s.id, a.id)).toThrow('Phiên kiểm kê đã đóng');
    expect(() => finishStocktake(db, s.id)).toThrow('Phiên kiểm kê đã đóng');
    expect(() => cancelStocktake(db, s.id)).toThrow('Phiên kiểm kê đã đóng');
    expect(() => countItem(db, 999, a.id, { counted: 1 })).toThrow('Không tìm thấy phiên kiểm kê');
  });

  it('lịch sử: chỉ phiên đã chốt/hủy, mới nhất trước, có tóm tắt', () => {
    const a = product({ name: 'Nước', stock: 10, costPrice: 1000 });
    const s1 = openStocktake(db, { note: null });
    countItem(db, s1.id, a.id, { counted: 12 });
    finishStocktake(db, s1.id);
    const s2 = openStocktake(db, { note: null });
    cancelStocktake(db, s2.id);
    openStocktake(db, { note: null });
    expect(listStocktakes(db, 20).map((s) => [s.id, s.status, s.itemCount, s.diffValue])).toEqual([
      [s2.id, 'cancelled', 0, 0],
      [s1.id, 'done', 1, 2000],
    ]);
  });
});
```

- [ ] **Step 2: Chạy test, thấy FAIL**

Run: `npm run build -w shared && npm test -w server -- src/services/stocktakes.test.ts`
Expected: FAIL, không tìm thấy `./stocktakes.js`.

- [ ] **Step 3: Viết code**

`server/src/services/stocktakes.ts`:

```ts
import { and, asc, desc, eq, ne } from 'drizzle-orm';
import {
  localDate,
  type StocktakeCount,
  type StocktakeDetail,
  type StocktakeInput,
  type StocktakeItem,
  type StocktakeSummary,
} from '@tiny-pos/shared';
import type { Db, DbOrTx } from '../db/connection.js';
import { products, stocktakeItems, stocktakes } from '../db/schema.js';
import { ConflictError, NotFoundError } from '../errors.js';
import { nextDailyCode, resolveClock, type Clock } from './daily-code.js';
import { recordMovement } from './stock.js';

const EPS = 1e-9;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

type StocktakeRow = typeof stocktakes.$inferSelect;

function findRow(tx: DbOrTx, id: number): StocktakeRow {
  const s = tx.select().from(stocktakes).where(eq(stocktakes.id, id)).get();
  if (!s) throw new NotFoundError('Không tìm thấy phiên kiểm kê');
  return s;
}

function assertOpen(tx: DbOrTx, id: number): StocktakeRow {
  const s = findRow(tx, id);
  if (s.status !== 'open') throw new ConflictError('Phiên kiểm kê đã đóng');
  return s;
}

function itemsOf(tx: DbOrTx, id: number): StocktakeItem[] {
  return tx
    .select({
      productId: stocktakeItems.productId,
      productName: products.name,
      unit: products.unit,
      costPrice: products.costPrice,
      counted: stocktakeItems.counted,
      expected: stocktakeItems.expected,
      countedAt: stocktakeItems.countedAt,
    })
    .from(stocktakeItems)
    .innerJoin(products, eq(stocktakeItems.productId, products.id))
    .where(eq(stocktakeItems.stocktakeId, id))
    .orderBy(asc(stocktakeItems.id))
    .all()
    .map((r) => ({ ...r, diff: round3(r.counted - r.expected) }));
}

export function getStocktake(db: DbOrTx, id: number): StocktakeDetail {
  const s = findRow(db, id);
  const items = itemsOf(db, id);
  const diffs = items.filter((i) => Math.abs(i.diff) > EPS);
  return {
    id: s.id,
    code: s.code,
    status: s.status,
    note: s.note,
    createdAt: s.createdAt,
    finishedAt: s.finishedAt,
    itemCount: items.length,
    diffCount: diffs.length,
    diffValue: Math.round(diffs.reduce((sum, i) => sum + i.diff * i.costPrice, 0)),
    items,
  };
}

export function getCurrentStocktake(db: Db): StocktakeDetail | null {
  const s = db.select({ id: stocktakes.id }).from(stocktakes).where(eq(stocktakes.status, 'open')).get();
  return s ? getStocktake(db, s.id) : null;
}

export function listStocktakes(db: Db, limit: number): StocktakeSummary[] {
  return db
    .select({ id: stocktakes.id })
    .from(stocktakes)
    .where(ne(stocktakes.status, 'open'))
    .orderBy(desc(stocktakes.id))
    .limit(limit)
    .all()
    .map(({ id }) => {
      const { items: _items, ...summary } = getStocktake(db, id);
      return summary;
    });
}

export function openStocktake(db: Db, input: StocktakeInput, clock?: Clock): StocktakeDetail {
  const { now, tz } = resolveClock(clock);
  return db.transaction((tx) => {
    const open = tx.select({ id: stocktakes.id }).from(stocktakes).where(eq(stocktakes.status, 'open')).get();
    if (open) throw new ConflictError('Đang có phiên kiểm kê chưa chốt');
    const code = nextDailyCode(tx, 'stocktakes', 'KK', localDate(now, tz), 2);
    const { id } = tx
      .insert(stocktakes)
      .values({ code, note: input.note, createdAt: now.toISOString() })
      .returning({ id: stocktakes.id })
      .get();
    return getStocktake(tx, id);
  });
}

/** Ghi (hoặc ghi đè) số đếm; `expected` = tồn máy ngay lúc đếm để bán sau đó không bị mất. */
export function countItem(db: Db, id: number, productId: number, input: StocktakeCount, clock?: Clock): StocktakeDetail {
  const { now } = resolveClock(clock);
  return db.transaction((tx) => {
    assertOpen(tx, id);
    const p = tx.select({ stock: products.stock }).from(products).where(eq(products.id, productId)).get();
    if (!p) throw new NotFoundError('Không tìm thấy sản phẩm');
    const values = { counted: input.counted, expected: p.stock, countedAt: now.toISOString() };
    tx.insert(stocktakeItems)
      .values({ stocktakeId: id, productId, ...values })
      .onConflictDoUpdate({ target: [stocktakeItems.stocktakeId, stocktakeItems.productId], set: values })
      .run();
    return getStocktake(tx, id);
  });
}

export function removeItem(db: Db, id: number, productId: number): StocktakeDetail {
  return db.transaction((tx) => {
    assertOpen(tx, id);
    tx.delete(stocktakeItems)
      .where(and(eq(stocktakeItems.stocktakeId, id), eq(stocktakeItems.productId, productId)))
      .run();
    return getStocktake(tx, id);
  });
}

/** Chốt: mỗi món lệch ghi 1 movement adjust = counted − expected. */
export function finishStocktake(db: Db, id: number, clock?: Clock): StocktakeDetail {
  const { now } = resolveClock(clock);
  return db.transaction((tx) => {
    const s = assertOpen(tx, id);
    for (const it of itemsOf(tx, id)) {
      if (Math.abs(it.diff) <= EPS) continue;
      recordMovement(tx, { productId: it.productId, qty: it.diff, type: 'adjust', refId: id, note: `Kiểm kê ${s.code}` });
    }
    tx.update(stocktakes).set({ status: 'done', finishedAt: now.toISOString() }).where(eq(stocktakes.id, id)).run();
    return getStocktake(tx, id);
  });
}

export function cancelStocktake(db: Db, id: number, clock?: Clock): StocktakeDetail {
  const { now } = resolveClock(clock);
  return db.transaction((tx) => {
    assertOpen(tx, id);
    tx.update(stocktakes).set({ status: 'cancelled', finishedAt: now.toISOString() }).where(eq(stocktakes.id, id)).run();
    return getStocktake(tx, id);
  });
}
```

- [ ] **Step 4: Chạy test, thấy PASS**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Typecheck và commit**

Run: `npm run typecheck`

```bash
git add server/src/services/stocktakes.ts server/src/services/stocktakes.test.ts
git commit -m "feat(server): phiên kiểm kê – đếm dần, chốt ghi chênh lệch theo tồn lúc đếm, hủy"
```

---

### Task 7: Lịch sử tồn và API nhập hàng / NCC / kiểm kê (server)

**Files:**
- Create: `server/src/services/movements.ts`, `server/src/services/movements.test.ts`
- Create: `server/src/routes/suppliers.ts`, `server/src/routes/imports.ts`, `server/src/routes/stocktakes.ts`, `server/src/routes/inventory-api.test.ts`
- Modify: `server/src/routes/products.ts` (1 import + 1 route), `server/src/routes/index.ts` (3 import + 3 `r.use`)

**Interfaces:**
- Consumes: services Task 4–6; schemas Task 1; `orderListQuerySchema`, `localDate`, `currentTzOffset`.
- Produces: `listMovements(db: Db, productId: number, limit: number): StockMovement[]`; các endpoint theo bảng API của spec mục 6.

- [ ] **Step 1: Viết test**

`server/src/services/movements.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { importInputSchema, orderInputSchema, productInputSchema } from '@tiny-pos/shared';
import { createTestDb } from '../db/test-db.js';
import { cancelImport, createImport } from './imports.js';
import { listMovements } from './movements.js';
import { cancelOrder, createOrder } from './orders.js';
import { createProduct } from './products.js';
import { countItem, finishStocktake, openStocktake } from './stocktakes.js';

describe('listMovements', () => {
  it('đủ loại, mới nhất trước, mã chứng từ đúng; sản phẩm lạ 404', () => {
    const db = createTestDb();
    const clock = { now: new Date('2026-09-29T03:00:00.000Z'), tzOffsetMin: 420 };
    const p = createProduct(db, productInputSchema.parse({ name: 'Bia', stock: 5 }));
    const im = createImport(db, importInputSchema.parse({ paid: 10000, items: [{ productId: p.id, qty: 1, unitCost: 10000 }] }), clock);
    const o = createOrder(db, orderInputSchema.parse({ items: [{ productId: p.id, qty: 2, price: 12000 }], paymentMethod: 'cash', paid: 24000 }), clock);
    cancelOrder(db, o.id);
    cancelImport(db, im.id);
    const s = openStocktake(db, { note: null }, clock);
    countItem(db, s.id, p.id, { counted: 3 });
    finishStocktake(db, s.id);
    expect(listMovements(db, p.id, 100).map((m) => [m.type, m.qty, m.refCode])).toEqual([
      // tồn 5 +1 −2 +2 −1 = 5, đếm 3 → −2
      ['adjust', -2, 'KK-20260929-01'],
      ['adjust', -1, 'PN-20260929-0001'],
      ['return', 2, 'HD-20260929-0001'],
      ['sale', -2, 'HD-20260929-0001'],
      ['import', 1, 'PN-20260929-0001'],
      ['adjust', 5, null],
    ]);
    expect(listMovements(db, p.id, 2)).toHaveLength(2);
    expect(() => listMovements(db, 999, 10)).toThrow('Không tìm thấy sản phẩm');
  });
});
```

`server/src/routes/inventory-api.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { createTestDb } from '../db/test-db.js';
import { createApp } from '../app.js';

let server: Server;
let base: string;
beforeAll(async () => {
  server = createApp(createTestDb()).listen(0);
  await new Promise((r) => server.once('listening', r));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});
afterAll(() => server.close());

const call = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : {},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
};

describe('API nhập hàng, NCC, kiểm kê, lịch sử tồn', () => {
  it('NCC → phiếu nhập ghi nợ → trả nợ → hủy phiếu → lịch sử tồn', async () => {
    const p = await call('POST', '/api/products', { name: 'Bia', costPrice: 9000, sellPrice: 12000 });
    const s = await call('POST', '/api/suppliers', { name: 'Đại lý Hùng', phone: '0909' });
    expect(s.status).toBe(201);
    const im = await call('POST', '/api/imports', {
      supplierId: s.json.id,
      paid: 50000,
      items: [{ productId: p.json.id, qty: 10, unitCost: 10000 }],
    });
    expect(im.status).toBe(201);
    expect(im.json.code).toMatch(/^PN-\d{8}-0001$/);
    expect((await call('GET', '/api/suppliers?q=đại')).json).toMatchObject([{ name: 'Đại lý Hùng', debt: 50000 }]);
    expect((await call('GET', `/api/suppliers/${s.json.id}/transactions`)).json).toHaveLength(1);
    expect((await call('POST', `/api/suppliers/${s.json.id}/payments`, { amount: 60000 })).status).toBe(400);
    expect((await call('POST', `/api/suppliers/${s.json.id}/payments`, { amount: 20000 })).json.debt).toBe(30000);
    expect((await call('DELETE', `/api/suppliers/${s.json.id}`)).status).toBe(409);
    expect((await call('GET', '/api/imports')).json.summary).toEqual({ count: 1, total: 100000, paid: 50000 });
    expect((await call('GET', `/api/imports/${im.json.id}`)).json.items).toHaveLength(1);
    expect((await call('POST', `/api/imports/${im.json.id}/cancel`)).json.status).toBe('cancelled');
    expect((await call('POST', `/api/imports/${im.json.id}/cancel`)).status).toBe(409);
    const mv = await call('GET', `/api/products/${p.json.id}/movements`);
    expect(mv.json.map((m: { type: string }) => m.type)).toEqual(['adjust', 'import']);
    expect((await call('GET', `/api/products/${p.json.id}/movements?limit=0`)).status).toBe(400);
  });

  it('kiểm kê: mở, mở lần hai 409, đếm, chốt, lịch sử', async () => {
    const p = await call('POST', '/api/products', { name: 'Nước', stock: 10 });
    const s = await call('POST', '/api/stocktakes', {});
    expect(s.status).toBe(201);
    expect((await call('POST', '/api/stocktakes', {})).status).toBe(409);
    expect((await call('GET', '/api/stocktakes/current')).json.id).toBe(s.json.id);
    const c = await call('PUT', `/api/stocktakes/${s.json.id}/items/${p.json.id}`, { counted: 7 });
    expect(c.json.items).toMatchObject([{ counted: 7, expected: 10, diff: -3 }]);
    expect((await call('DELETE', `/api/stocktakes/${s.json.id}/items/${p.json.id}`)).json.items).toEqual([]);
    await call('PUT', `/api/stocktakes/${s.json.id}/items/${p.json.id}`, { counted: 7 });
    expect((await call('POST', `/api/stocktakes/${s.json.id}/finish`)).json.status).toBe('done');
    expect((await call('GET', '/api/stocktakes/current')).json).toBeNull();
    expect((await call('GET', `/api/products/${p.json.id}`)).json.stock).toBe(7);
    expect((await call('GET', '/api/stocktakes')).json.map((x: { id: number }) => x.id)).toEqual([s.json.id]);
    expect((await call('GET', `/api/stocktakes/${s.json.id}`)).json.items).toHaveLength(1);
    expect((await call('PUT', `/api/stocktakes/${s.json.id}/items/${p.json.id}`, { counted: 1 })).status).toBe(409);
  });

  it('400 có nhãn tiếng Việt', async () => {
    const bad = await call('POST', '/api/imports', { paid: 0, items: [{ productId: 1, qty: 1, unitCost: 1.5 }] });
    expect(bad.status).toBe(400);
    expect(bad.json.error).toContain('Giá nhập');
    expect((await call('POST', '/api/suppliers', { name: '' })).json.error).toContain('Tên');
    expect((await call('PUT', '/api/stocktakes/1/items/1', { counted: -1 })).json.error).toContain('Số đếm');
  });
});
```

- [ ] **Step 2: Chạy test, thấy FAIL**

Run: `npm run build -w shared && npm test -w server -- src/services/movements.test.ts src/routes/inventory-api.test.ts`
Expected: FAIL (thiếu `./movements.js`; API trả 404).

- [ ] **Step 3: Viết code**

`server/src/services/movements.ts`:

```ts
import { desc, eq, inArray } from 'drizzle-orm';
import type { StockMovement } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { orders, products, stockMovements } from '../db/schema.js';
import { NotFoundError } from '../errors.js';

/** Ghi chú của movement nhập/hủy phiếu/kiểm kê đã chứa mã chứng từ ("Nhập PN-…", "Kiểm kê KK-…"). */
const CODE_IN_NOTE = /\b(?:HD|PN|KK)-\d{8}-\d+\b/;

export function listMovements(db: Db, productId: number, limit: number): StockMovement[] {
  const p = db.select({ id: products.id }).from(products).where(eq(products.id, productId)).get();
  if (!p) throw new NotFoundError('Không tìm thấy sản phẩm');
  const rows = db
    .select({
      id: stockMovements.id,
      type: stockMovements.type,
      qty: stockMovements.qty,
      note: stockMovements.note,
      createdAt: stockMovements.createdAt,
      refId: stockMovements.refId,
    })
    .from(stockMovements)
    .where(eq(stockMovements.productId, productId))
    .orderBy(desc(stockMovements.id))
    .limit(limit)
    .all();
  const isOrder = (t: string) => t === 'sale' || t === 'return';
  const orderIds = [...new Set(rows.filter((r) => isOrder(r.type) && r.refId !== null).map((r) => r.refId!))];
  const orderCodes = new Map(
    orderIds.length
      ? db
          .select({ id: orders.id, code: orders.code })
          .from(orders)
          .where(inArray(orders.id, orderIds))
          .all()
          .map((o) => [o.id, o.code] as const)
      : [],
  );
  return rows.map(({ refId, ...r }) => ({
    ...r,
    refCode: r.note?.match(CODE_IN_NOTE)?.[0] ?? (isOrder(r.type) && refId !== null ? (orderCodes.get(refId) ?? null) : null),
  }));
}
```

`server/src/routes/suppliers.ts`:

```ts
import { Router } from 'express';
import { supplierInputSchema, supplierPaymentSchema } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { intParam, validateBody } from '../middleware/validate.js';
import {
  createSupplier,
  deleteSupplier,
  listSupplierTransactions,
  listSuppliers,
  paySupplier,
  updateSupplier,
} from '../services/suppliers.js';

export function suppliersRouter(db: Db): Router {
  const r = Router();
  r.get('/', (req, res) => res.json(listSuppliers(db, typeof req.query['q'] === 'string' ? req.query['q'] : undefined)));
  r.post('/', validateBody(supplierInputSchema), (req, res) => res.status(201).json(createSupplier(db, req.body)));
  r.put('/:id', validateBody(supplierInputSchema), (req, res) => res.json(updateSupplier(db, intParam(req, 'id'), req.body)));
  r.delete('/:id', (req, res) => {
    deleteSupplier(db, intParam(req, 'id'));
    res.status(204).end();
  });
  r.get('/:id/transactions', (req, res) => res.json(listSupplierTransactions(db, intParam(req, 'id'))));
  r.post('/:id/payments', validateBody(supplierPaymentSchema), (req, res) =>
    res.json(paySupplier(db, intParam(req, 'id'), req.body)),
  );
  return r;
}
```

`server/src/routes/imports.ts`:

```ts
import { Router } from 'express';
import { currentTzOffset, importInputSchema, localDate, orderListQuerySchema, type OrderListQuery } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { intParam, validateBody, validateQuery } from '../middleware/validate.js';
import { cancelImport, createImport, getImport, listImports } from '../services/imports.js';

export function importsRouter(db: Db): Router {
  const r = Router();
  // Cùng quy tắc ngày với hóa đơn: YYYY-MM-DD có thật, mặc định hôm nay (giờ địa phương)
  r.get('/', validateQuery(orderListQuerySchema), (_req, res) => {
    const { date } = res.locals['query'] as OrderListQuery;
    res.json(listImports(db, date ?? localDate(new Date(), currentTzOffset())));
  });
  r.get('/:id', (req, res) => res.json(getImport(db, intParam(req, 'id'))));
  r.post('/', validateBody(importInputSchema), (req, res) => res.status(201).json(createImport(db, req.body)));
  r.post('/:id/cancel', (req, res) => res.json(cancelImport(db, intParam(req, 'id'))));
  return r;
}
```

`server/src/routes/stocktakes.ts`:

```ts
import { Router } from 'express';
import { stocktakeCountSchema, stocktakeInputSchema, stocktakeListQuerySchema, type StocktakeListQuery } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { intParam, validateBody, validateQuery } from '../middleware/validate.js';
import {
  cancelStocktake,
  countItem,
  finishStocktake,
  getCurrentStocktake,
  getStocktake,
  listStocktakes,
  openStocktake,
  removeItem,
} from '../services/stocktakes.js';

export function stocktakesRouter(db: Db): Router {
  const r = Router();
  // Route tĩnh trước /:id
  r.get('/current', (_req, res) => res.json(getCurrentStocktake(db)));
  r.get('/', validateQuery(stocktakeListQuerySchema), (_req, res) =>
    res.json(listStocktakes(db, (res.locals['query'] as StocktakeListQuery).limit)),
  );
  r.get('/:id', (req, res) => res.json(getStocktake(db, intParam(req, 'id'))));
  r.post('/', validateBody(stocktakeInputSchema), (req, res) => res.status(201).json(openStocktake(db, req.body)));
  r.put('/:id/items/:productId', validateBody(stocktakeCountSchema), (req, res) =>
    res.json(countItem(db, intParam(req, 'id'), intParam(req, 'productId'), req.body)),
  );
  r.delete('/:id/items/:productId', (req, res) => res.json(removeItem(db, intParam(req, 'id'), intParam(req, 'productId'))));
  r.post('/:id/finish', (req, res) => res.json(finishStocktake(db, intParam(req, 'id'))));
  r.post('/:id/cancel', (req, res) => res.json(cancelStocktake(db, intParam(req, 'id'))));
  return r;
}
```

Trong `server/src/routes/products.ts`:
- Trong khối import từ `'@tiny-pos/shared'`, thêm 2 tên `movementListQuerySchema,` và `type MovementListQuery,` (giữ thứ tự chữ cái, không sửa dòng khác).
- Thêm import `import { listMovements } from '../services/movements.js';` sau dòng import `product-units.js`.
- Thêm route ngay sau dòng `r.get('/:id', (req, res) => res.json(getProduct(db, intParam(req, 'id'))));`:

```ts
  r.get('/:id/movements', validateQuery(movementListQuerySchema), (req, res) =>
    res.json(listMovements(db, intParam(req, 'id'), (res.locals['query'] as MovementListQuery).limit)),
  );
```

Trong `server/src/routes/index.ts`, thêm 3 import sau `import { settingsRouter } from './settings.js';`:

```ts
import { importsRouter } from './imports.js';
import { stocktakesRouter } from './stocktakes.js';
import { suppliersRouter } from './suppliers.js';
```

và 3 dòng sau `r.use('/settings', settingsRouter(db));`:

```ts
  r.use('/suppliers', suppliersRouter(db));
  r.use('/imports', importsRouter(db));
  r.use('/stocktakes', stocktakesRouter(db));
```

- [ ] **Step 4: Chạy test, thấy PASS**

Run: `npm test`
Expected: PASS toàn bộ.

- [ ] **Step 5: Typecheck và commit**

Run: `npm run typecheck`

```bash
git add server/src/services/movements.ts server/src/services/movements.test.ts server/src/routes/suppliers.ts server/src/routes/imports.ts server/src/routes/stocktakes.ts server/src/routes/inventory-api.test.ts server/src/routes/products.ts server/src/routes/index.ts
git commit -m "feat(server): API nhập hàng, nhà cung cấp, kiểm kê và lịch sử tồn"
```

---

### Task 8: Hạ tầng client – API hooks, component dùng chung, menu điện thoại (client)

**Files:**
- Create: `client/src/api/suppliers.ts`, `client/src/api/imports.ts`, `client/src/api/stocktakes.ts`
- Modify: `client/src/api/products.ts` (thêm `fetchProduct`, `useMovements`; thêm `ProductWithUnits`/`StockMovement` vào import type nếu chưa có)
- Move: `client/src/pages/sell/ProductSearch.tsx` → `client/src/components/ProductSearch.tsx`; `client/src/pages/orders/DayPicker.tsx` → `client/src/components/DayPicker.tsx` (dùng `git mv`; sửa import ở `SellPage.tsx`, `OrdersPage.tsx`)
- Create: `client/src/components/CommitInput.tsx`, `client/src/components/MobileMoreMenu.tsx`
- Create (shadcn CLI): `client/src/components/ui/popover.tsx`, `client/src/components/ui/command.tsx` (+ dependency `cmdk`)
- Modify: `client/src/router.tsx` (`NavItem.mobile`, cờ `mobile` cho Bán hàng/Hóa đơn/Sản phẩm), `client/src/App.tsx` (thanh dưới: chỉ mục `mobile` + `MobileMoreMenu`; chữ sidebar "Giai đoạn 3")

**Interfaces:**
- Produces:
  - `useSuppliers()`, `useSupplierTransactions(id: number | null)`, `useSaveSupplier()` (mutation `SupplierInputBody & { id?: number }` → `Supplier`), `useDeleteSupplier()` (id), `usePaySupplier()` (`SupplierPaymentBody & { id: number }` → `Supplier`)
  - `useImports(date: string)`, `useImport(id: number | null)`, `useCreateImport()` (`ImportInputBody` → `ImportDetail`), `useCancelImport()` (id)
  - `useCurrentStocktake()`, `useStocktakes()`, `useStocktake(id: number | null)`, `useOpenStocktake()` (`{ note: string | null }`), `useCountItem()` (`{ id; productId; counted }`), `useRemoveCountItem()` (`{ id; productId }`), `useFinishStocktake()` (id), `useCancelStocktake()` (id)
  - `fetchProduct(id: number): Promise<ProductWithUnits>`, `useMovements(id: number | null)`
  - `@/components/ProductSearch` (`ProductSearch` props không đổi: `inputRef`, `onScan`, `onPick`), `@/components/DayPicker` (`DayPicker`, `today`)
  - `CommitInput` props: `{ value: number; onCommit: (n: number) => void; money?: boolean; disabled?: boolean; onEnter?: () => void; className?: string; 'aria-label': string }`
  - `NavItem` có thêm `mobile?: boolean`

- [ ] **Step 1: Thêm Popover và Command**

Run (trong `client/`): `NODE_EXTRA_CA_CERTS="C:/Users/MinhNT165/Workspace/personal/tiny-pos/.certs/corp-root.pem" npx shadcn@latest add popover command`
Expected: tạo `client/src/components/ui/popover.tsx`, `command.tsx` (có thể thêm `dialog.tsx` – đã có thì trả lời **No** khi hỏi ghi đè), `client/package.json` có `cmdk`. `git status`: không file có sẵn nào khác bị sửa ngoài `client/package.json`, `package-lock.json`; nếu có, hoàn tác file đó.

- [ ] **Step 2: Chuyển component dùng chung**

```bash
git mv client/src/pages/sell/ProductSearch.tsx client/src/components/ProductSearch.tsx
git mv client/src/pages/orders/DayPicker.tsx client/src/components/DayPicker.tsx
```

- `client/src/pages/sell/SellPage.tsx`: đổi `import { ProductSearch } from './ProductSearch';` thành `import { ProductSearch } from '@/components/ProductSearch';` (di chuyển dòng lên nhóm import `@/components/...` nếu muốn giữ thứ tự; chỉ sửa đúng dòng này).
- `client/src/pages/orders/OrdersPage.tsx`: đổi `import { DayPicker, today } from './DayPicker';` thành `import { DayPicker, today } from '@/components/DayPicker';`.

- [ ] **Step 3: API hooks**

`client/src/api/suppliers.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Supplier, SupplierInputBody, SupplierPaymentBody, SupplierTransaction } from '@tiny-pos/shared';
import { api } from './client';

export const useSuppliers = () => useQuery({ queryKey: ['suppliers'], queryFn: () => api<Supplier[]>('/suppliers') });

export const useSupplierTransactions = (id: number | null) =>
  useQuery({
    queryKey: ['suppliers', 'tx', id],
    queryFn: () => api<SupplierTransaction[]>(`/suppliers/${id}/transactions`),
    enabled: id !== null,
  });

function useInvalidateSuppliers() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: ['suppliers'] });
}

export function useSaveSupplier() {
  const invalidate = useInvalidateSuppliers();
  return useMutation({
    mutationFn: ({ id, ...input }: SupplierInputBody & { id?: number }) =>
      id ? api<Supplier>(`/suppliers/${id}`, { method: 'PUT', json: input }) : api<Supplier>('/suppliers', { json: input }),
    onSuccess: invalidate,
  });
}

export function useDeleteSupplier() {
  const invalidate = useInvalidateSuppliers();
  return useMutation({ mutationFn: (id: number) => api<void>(`/suppliers/${id}`, { method: 'DELETE' }), onSuccess: invalidate });
}

export function usePaySupplier() {
  const invalidate = useInvalidateSuppliers();
  return useMutation({
    mutationFn: ({ id, ...body }: SupplierPaymentBody & { id: number }) => api<Supplier>(`/suppliers/${id}/payments`, { json: body }),
    onSuccess: invalidate,
  });
}
```

`client/src/api/imports.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ImportDetail, ImportInputBody, ImportList } from '@tiny-pos/shared';
import { api } from './client';

export const useImports = (date: string) =>
  useQuery({ queryKey: ['imports', 'day', date], queryFn: () => api<ImportList>(`/imports?date=${date}`) });

export const useImport = (id: number | null) =>
  useQuery({ queryKey: ['imports', 'detail', id], queryFn: () => api<ImportDetail>(`/imports/${id}`), enabled: id !== null });

/** Nhập/hủy phiếu đổi tồn, giá và nợ NCC. */
function useInvalidateImports() {
  const qc = useQueryClient();
  return () => {
    for (const key of ['imports', 'products', 'suppliers']) void qc.invalidateQueries({ queryKey: [key] });
  };
}

export function useCreateImport() {
  const invalidate = useInvalidateImports();
  return useMutation({ mutationFn: (input: ImportInputBody) => api<ImportDetail>('/imports', { json: input }), onSuccess: invalidate });
}

export function useCancelImport() {
  const invalidate = useInvalidateImports();
  return useMutation({ mutationFn: (id: number) => api<ImportDetail>(`/imports/${id}/cancel`, { method: 'POST' }), onSuccess: invalidate });
}
```

`client/src/api/stocktakes.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { StocktakeDetail, StocktakeSummary } from '@tiny-pos/shared';
import { api } from './client';

export const useCurrentStocktake = () =>
  useQuery({ queryKey: ['stocktakes', 'current'], queryFn: () => api<StocktakeDetail | null>('/stocktakes/current') });

export const useStocktakes = () => useQuery({ queryKey: ['stocktakes', 'list'], queryFn: () => api<StocktakeSummary[]>('/stocktakes') });

export const useStocktake = (id: number | null) =>
  useQuery({ queryKey: ['stocktakes', 'detail', id], queryFn: () => api<StocktakeDetail>(`/stocktakes/${id}`), enabled: id !== null });

/** Chốt kiểm kê đổi tồn nên làm mới cả sản phẩm. */
function useInvalidateStocktakes() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['stocktakes'] });
    void qc.invalidateQueries({ queryKey: ['products'] });
  };
}

export function useOpenStocktake() {
  const invalidate = useInvalidateStocktakes();
  return useMutation({
    mutationFn: (body: { note: string | null }) => api<StocktakeDetail>('/stocktakes', { json: body }),
    onSuccess: invalidate,
  });
}

export function useCountItem() {
  const invalidate = useInvalidateStocktakes();
  return useMutation({
    mutationFn: ({ id, productId, counted }: { id: number; productId: number; counted: number }) =>
      api<StocktakeDetail>(`/stocktakes/${id}/items/${productId}`, { method: 'PUT', json: { counted } }),
    onSuccess: invalidate,
  });
}

export function useRemoveCountItem() {
  const invalidate = useInvalidateStocktakes();
  return useMutation({
    mutationFn: ({ id, productId }: { id: number; productId: number }) =>
      api<StocktakeDetail>(`/stocktakes/${id}/items/${productId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useFinishStocktake() {
  const invalidate = useInvalidateStocktakes();
  return useMutation({ mutationFn: (id: number) => api<StocktakeDetail>(`/stocktakes/${id}/finish`, { method: 'POST' }), onSuccess: invalidate });
}

export function useCancelStocktake() {
  const invalidate = useInvalidateStocktakes();
  return useMutation({ mutationFn: (id: number) => api<StocktakeDetail>(`/stocktakes/${id}/cancel`, { method: 'POST' }), onSuccess: invalidate });
}
```

Trong `client/src/api/products.ts`: thêm `StockMovement,` vào khối `import type { … } from '@tiny-pos/shared';` (`ProductWithUnits` đã có), rồi thêm vào cuối file:

```ts

/** Sản phẩm kèm đơn vị quy đổi (màn Nhập hàng cần danh sách đơn vị để chọn). */
export const fetchProduct = (id: number) => api<ProductWithUnits>(`/products/${id}`);

export const useMovements = (id: number | null) =>
  useQuery({
    queryKey: ['products', 'movements', id],
    queryFn: () => api<StockMovement[]>(`/products/${id}/movements`),
    enabled: id !== null,
  });
```

- [ ] **Step 4: Component dùng chung**

`client/src/components/CommitInput.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { formatQty, parseVnNumber } from '@tiny-pos/shared';
import { Input } from '@/components/ui/input';
import { groupThousands, moneyChange } from '@/lib/money-input';
import { cn } from '@/lib/utils';

interface Props {
  value: number;
  onCommit: (n: number) => void;
  /** Ô tiền: chia dấu chấm hàng nghìn, làm tròn đồng. */
  money?: boolean;
  disabled?: boolean;
  /** Gọi sau Enter (ví dụ trả focus về ô quét). */
  onEnter?: () => void;
  className?: string;
  'aria-label': string;
}

/** Ô số sửa nhanh: gõ nháp, blur/Enter mới ghi; rỗng hoặc sai thì trả lại giá trị cũ. */
export function CommitInput({ value, onCommit, money, disabled, onEnter, className, ...rest }: Props) {
  const shown = money ? groupThousands(String(value)) : formatQty(value);
  const [draft, setDraft] = useState(shown);
  useEffect(() => setDraft(shown), [shown]);

  const commit = () => {
    const n = parseVnNumber(draft);
    if (!draft.trim() || !Number.isFinite(n) || n < 0) return setDraft(shown);
    onCommit(money ? Math.round(n) : n);
  };

  return (
    <Input
      value={draft}
      disabled={disabled}
      onChange={money ? moneyChange(setDraft) : (e) => setDraft(e.target.value)}
      onBlur={commit}
      onFocus={(e) => e.target.select()}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
        e.preventDefault();
        commit();
        onEnter?.();
      }}
      inputMode={money ? 'numeric' : 'decimal'}
      className={cn('h-11 text-base tabular-nums', money && 'text-right', className)}
      aria-label={rest['aria-label']}
    />
  );
}
```

`client/src/components/MobileMoreMenu.tsx`:

```tsx
import { Ellipsis } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { NavItem } from '@/router';

/** Nút "Thêm" ở thanh dưới điện thoại: chứa các mục không nằm trên thanh. */
export function MobileMoreMenu({ items }: { items: NavItem[] }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const active = items.some((i) => pathname.startsWith(i.to));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] leading-4 font-medium whitespace-nowrap',
            active ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          <span className={cn('grid h-8 w-14 place-items-center rounded-full transition-colors', active && 'bg-accent')}>
            <Ellipsis className="size-5" />
          </span>
          Thêm
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="min-w-56">
        {items.map(({ to, label, icon: Icon }) => (
          <DropdownMenuItem key={to} className="h-11 text-base" onSelect={() => navigate(to)}>
            <Icon />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 5: Menu**

`client/src/router.tsx`:
- Trong `interface NavItem`, thêm dòng sau `  disabled?: boolean;`:

```ts
  /** Hiện trên thanh dưới điện thoại (tối đa 4 mục, còn lại vào nút "Thêm"). */
  mobile?: boolean;
```

- Sửa 3 dòng NAV (chỉ thêm `mobile: true`):

```ts
  { to: '/sell', label: 'Bán hàng', icon: ShoppingCart, mobile: true },
  { to: '/orders', label: 'Hóa đơn', icon: ReceiptText, mobile: true },
  { to: '/products', label: 'Sản phẩm', icon: Package, mobile: true },
```

`client/src/App.tsx`:
- Thêm import `import { MobileMoreMenu } from '@/components/MobileMoreMenu';` sau import `Topbar`.
- Thay dòng `        {NAV.filter((n) => !n.disabled).map(({ to, label, icon: Icon }) => (` bằng `        {NAV.filter((n) => n.mobile).map(({ to, label, icon: Icon }) => (`.
- Ngay sau dòng `        ))}` kết thúc vòng map đó (trước `</nav>` của thanh dưới), thêm:

```tsx
        <MobileMoreMenu items={NAV.filter((n) => !n.mobile && !n.disabled)} />
```

- Đổi 2 dòng chữ sidebar: `Giai đoạn 2` → `Giai đoạn 3`; `Bán hàng, hóa đơn, in, cài đặt` → `Nhập hàng, nhà cung cấp, kiểm kê`.

- [ ] **Step 6: Typecheck, build, chạy thử**

Run: `npm run typecheck` và `npm run build -w client`
Expected: không lỗi.

Chạy thử (Chromium headless, viewport 390×844, dev server): thanh dưới có Bán hàng, Hóa đơn, Sản phẩm, **Thêm**; bấm Thêm → menu có Danh mục, Nhập nhanh, Cài đặt; chọn Cài đặt → tới `/settings`. Màn Bán hàng và Hóa đơn vẫn hoạt động (ô quét, ◀ ▶).

- [ ] **Step 7: Commit**

```bash
git add client/src/api client/src/components client/src/pages/sell/SellPage.tsx client/src/pages/orders/OrdersPage.tsx client/src/router.tsx client/src/App.tsx client/package.json package-lock.json
git commit -m "feat(client): API kho, component dùng chung, menu điện thoại có nút Thêm"
```

---

### Task 9: Màn Nhà cung cấp (client)

**Files:**
- Create: `client/src/pages/suppliers/SuppliersPage.tsx`, `SupplierFormDialog.tsx`, `SupplierDetailDialog.tsx`, `PaymentDialog.tsx`
- Modify: `client/src/router.tsx` (import, NAV, route)

**Interfaces:**
- Consumes: `useSuppliers`, `useSupplierTransactions`, `useSaveSupplier`, `useDeleteSupplier`, `usePaySupplier` (Task 8); `Supplier` (shared); `PageHeader`, `EmptyState`, `TextField`, `useConfirm`.
- Produces: `SupplierFormDialog({ open: boolean; supplier?: Supplier | null; onClose: () => void; onSaved: (s: Supplier) => void })` (Task 10 dùng lại); trang `/suppliers`.

- [ ] **Step 1: Viết component**

`client/src/pages/suppliers/SupplierFormDialog.tsx`:

```tsx
import { useEffect, useState, type FormEvent } from 'react';
import { Check, Truck } from 'lucide-react';
import { toast } from 'sonner';
import type { Supplier } from '@tiny-pos/shared';
import { useSaveSupplier } from '@/api/suppliers';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Props {
  open: boolean;
  supplier?: Supplier | null;
  onClose: () => void;
  onSaved: (s: Supplier) => void;
}

export function SupplierFormDialog({ open, supplier, onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const save = useSaveSupplier();

  useEffect(() => {
    if (!open) return;
    setName(supplier?.name ?? '');
    setPhone(supplier?.phone ?? '');
    setNote(supplier?.note ?? '');
  }, [open, supplier]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || save.isPending) return;
    save.mutate(
      { id: supplier?.id, name, phone, note },
      {
        onSuccess: (s) => {
          toast.success(supplier ? 'Đã lưu' : `Đã thêm "${s.name}"`);
          onSaved(s);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Truck className="size-5 text-primary" />
            {supplier ? 'Sửa nhà cung cấp' : 'Thêm nhà cung cấp'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <TextField id="sf-name" label="Tên" autoFocus maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
          <TextField id="sf-phone" label="Số điện thoại" inputMode="tel" maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} />
          <TextField id="sf-note" label="Ghi chú" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
          <Button type="submit" className="h-11 w-full text-base" disabled={!name.trim() || save.isPending}>
            <Check data-icon="inline-start" />
            Lưu
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

`client/src/pages/suppliers/PaymentDialog.tsx`:

```tsx
import { useEffect, useState, type FormEvent } from 'react';
import { Check, HandCoins } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney, parseVnNumber, type Supplier } from '@tiny-pos/shared';
import { usePaySupplier } from '@/api/suppliers';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { groupThousands, moneyChange } from '@/lib/money-input';

/** Trả nợ NCC: mặc định trả hết số đang nợ. */
export function PaymentDialog({ supplier, open, onClose }: { supplier: Supplier; open: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const pay = usePaySupplier();

  useEffect(() => {
    if (!open) return;
    setAmount(groupThousands(String(Math.max(0, supplier.debt))));
    setNote('');
  }, [open, supplier.debt]);

  const n = parseVnNumber(amount || 'x');
  const valid = Number.isFinite(n) && n > 0 && n <= supplier.debt;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid || pay.isPending) return;
    pay.mutate(
      { id: supplier.id, amount: Math.round(n), note },
      {
        onSuccess: () => {
          toast.success(`Đã trả ${formatMoney(n)} cho ${supplier.name}`);
          onClose();
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <HandCoins className="size-5 text-primary" />
            Trả nợ {supplier.name}
          </DialogTitle>
          <DialogDescription className="text-base">Đang nợ {formatMoney(supplier.debt)}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <TextField
            id="pd-amount"
            label="Số tiền trả"
            suffix="đ"
            inputMode="numeric"
            autoFocus
            value={amount}
            onChange={moneyChange(setAmount)}
            onFocus={(e) => e.target.select()}
            error={amount && !valid ? 'Số tiền phải lớn hơn 0 và không vượt số đang nợ' : undefined}
          />
          <TextField id="pd-note" label="Ghi chú" placeholder="Trả nợ" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
          <Button type="submit" className="h-11 w-full text-base" disabled={!valid || pay.isPending}>
            <Check data-icon="inline-start" />
            Xác nhận trả
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

`client/src/pages/suppliers/SupplierDetailDialog.tsx`:

```tsx
import { useState } from 'react';
import { HandCoins, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney } from '@tiny-pos/shared';
import { useDeleteSupplier, useSupplierTransactions, useSuppliers } from '@/api/suppliers';
import { useConfirm } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { PaymentDialog } from './PaymentDialog';
import { SupplierFormDialog } from './SupplierFormDialog';

const when = (iso: string) => new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

/** Thông tin NCC + sổ nợ + trả nợ / sửa / xóa. */
export function SupplierDetailDialog({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data: suppliers = [] } = useSuppliers();
  const s = suppliers.find((x) => x.id === id) ?? null;
  const { data: txs = [] } = useSupplierTransactions(id);
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState(false);
  const del = useDeleteSupplier();
  const confirm = useConfirm();

  const onDelete = async () => {
    if (!s) return;
    if (!(await confirm({ title: `Xóa nhà cung cấp "${s.name}"?`, confirmText: 'Xóa', destructive: true }))) return;
    del.mutate(s.id, {
      onSuccess: () => {
        toast.success('Đã xóa');
        onClose();
      },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <>
      <Dialog open={s !== null} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">{s?.name}</DialogTitle>
            <DialogDescription className="text-base">{[s?.phone, s?.note].filter(Boolean).join(' · ') || 'Chưa có số điện thoại'}</DialogDescription>
          </DialogHeader>
          <div className="rounded-xl bg-muted/60 px-4 py-3">
            <div className="text-sm text-muted-foreground">{(s?.debt ?? 0) < 0 ? 'NCC đang nợ lại' : 'Đang nợ'}</div>
            <div className={cn('font-heading text-3xl font-semibold tabular-nums', (s?.debt ?? 0) > 0 && 'text-destructive')}>
              {formatMoney(Math.abs(s?.debt ?? 0))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-sm font-medium text-muted-foreground">Sổ nợ</div>
            {txs.length ? (
              <ul className="divide-y rounded-xl border">
                {txs.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{t.note ?? (t.amount > 0 ? 'Ghi nợ' : 'Trả nợ')}</div>
                      <div className="text-sm text-muted-foreground">{when(t.createdAt)}</div>
                    </div>
                    <div className="text-right tabular-nums">
                      <div className={cn('font-semibold', t.amount > 0 ? 'text-destructive' : 'text-emerald-600')}>
                        {t.amount > 0 ? '+' : '−'}
                        {formatMoney(Math.abs(t.amount))}
                      </div>
                      <div className="text-sm text-muted-foreground">còn {formatMoney(t.balance)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">Chưa có giao dịch.</p>
            )}
          </div>
          <DialogFooter className="gap-2">
            {s?.debt === 0 && (
              <Button variant="outline" className="h-11 text-base text-destructive" onClick={() => void onDelete()}>
                <Trash2 data-icon="inline-start" />
                Xóa
              </Button>
            )}
            <Button variant="outline" className="h-11 text-base" onClick={() => setEditing(true)}>
              <Pencil data-icon="inline-start" />
              Sửa
            </Button>
            <Button className="h-11 text-base" disabled={!s || s.debt <= 0} onClick={() => setPaying(true)}>
              <HandCoins data-icon="inline-start" />
              Trả nợ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <SupplierFormDialog open={editing} supplier={s} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />
      {s && <PaymentDialog supplier={s} open={paying} onClose={() => setPaying(false)} />}
    </>
  );
}
```

`client/src/pages/suppliers/SuppliersPage.tsx`:

```tsx
import { useState } from 'react';
import { Plus, Truck } from 'lucide-react';
import { formatMoney } from '@tiny-pos/shared';
import { useSuppliers } from '@/api/suppliers';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { SupplierDetailDialog } from './SupplierDetailDialog';
import { SupplierFormDialog } from './SupplierFormDialog';

export function SuppliersPage() {
  const { data: suppliers = [], isLoading } = useSuppliers();
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const totalDebt = suppliers.reduce((s, x) => s + Math.max(0, x.debt), 0);

  return (
    <>
      <PageHeader
        title="Nhà cung cấp"
        description={`Tổng đang nợ ${formatMoney(totalDebt)}`}
        icon={Truck}
        actions={
          <Button className="h-11 px-5 text-base" onClick={() => setAdding(true)}>
            <Plus data-icon="inline-start" />
            Thêm nhà cung cấp
          </Button>
        }
      />
      <Card className="gap-0 overflow-hidden py-0">
        {!isLoading && !suppliers.length ? (
          <EmptyState icon={Truck} title="Chưa có nhà cung cấp" description="Thêm nhà cung cấp để ghi nợ khi nhập hàng." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="px-4">Tên</TableHead>
                <TableHead className="px-4">Số điện thoại</TableHead>
                <TableHead className="px-4 text-right">Đang nợ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s) => (
                <TableRow key={s.id} className="cursor-pointer" onClick={() => setOpenId(s.id)}>
                  <TableCell className="px-4 py-3 font-medium">{s.name}</TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground">{s.phone ?? '—'}</TableCell>
                  <TableCell className={cn('px-4 py-3 text-right font-semibold tabular-nums', s.debt > 0 && 'text-destructive')}>
                    {formatMoney(s.debt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <SupplierFormDialog open={adding} onClose={() => setAdding(false)} onSaved={() => setAdding(false)} />
      <SupplierDetailDialog id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
```

- [ ] **Step 2: Menu và route**

`client/src/router.tsx`:
- Import lucide: thêm `Truck` vào dòng import từ `'lucide-react'` (giữ thứ tự chữ cái).
- Thêm `import { SuppliersPage } from './pages/suppliers/SuppliersPage';` sau import `SettingsPage`.
- Thêm vào NAV ngay sau dòng `{ to: '/categories', … }`: `  { to: '/suppliers', label: 'Nhà cung cấp', icon: Truck },`
- Thêm route sau `<Route path="/categories" … />`: `      <Route path="/suppliers" element={<SuppliersPage />} />`

- [ ] **Step 3: Typecheck, build, chạy thử**

Run: `npm run typecheck`, `npm run build -w client`

Chạy thử (Chromium headless; cho phép ghi thật trong bước này vì dữ liệu NCC thử sẽ được xóa ở cuối): thêm "NCC thử Playwright" → hiện trong bảng, nợ 0đ; mở chi tiết → nút *Trả nợ* bị khóa; *Sửa* đổi SĐT → lưu; *Xóa* → xác nhận → biến khỏi bảng.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/suppliers client/src/router.tsx
git commit -m "feat(client): màn Nhà cung cấp – danh sách, sổ nợ, trả nợ"
```

---

### Task 10: Thành phần phiếu nhập – chọn NCC, dòng nhập, chân phiếu (client)

**Files:**
- Create: `client/src/pages/imports/SupplierPicker.tsx`, `ImportLineRow.tsx`, `ImportLinesTable.tsx`, `ImportFooter.tsx`, `useImportDraft.ts`

**Interfaces:**
- Consumes: `importDraftReducer`, `parseImportDraft`, `draftTotals`, `currentOption`, `marginPercent`, `importLineAmount`, `formatMoney`, `formatQty`, `DraftLine`, `DraftAction`, `ImportDraft` (shared); `useSuppliers` (Task 8); `SupplierFormDialog` (Task 9); `CommitInput` (Task 8); shadcn `popover`, `command`, `select`, `table`.
- Produces:
  - `useImportDraft(): { draft: ImportDraft; dispatch: Dispatch<DraftAction>; totals: { total: number; paid: number; debt: number } }` (khóa `tiny-pos.import-draft`)
  - `<SupplierPicker value={number | null} onChange={(id: number | null) => void} />`
  - `<ImportLinesTable lines={DraftLine[]} dispatch onDone={() => void} />`
  - `<ImportFooter totals hasSupplier paidAuto onPaid={(v: number | null) => void} onSave saving empty />`

- [ ] **Step 1: Viết component**

`client/src/pages/imports/useImportDraft.ts`:

```ts
import { useEffect, useMemo, useReducer } from 'react';
import { draftTotals, importDraftReducer, parseImportDraft } from '@tiny-pos/shared';
import { readStorage, writeStorage } from '@/lib/storage';

const KEY = 'tiny-pos.import-draft';

/** Phiếu nhập đang soạn; tự lưu nháp để rời trang/F5 không mất. */
export function useImportDraft() {
  const [draft, dispatch] = useReducer(importDraftReducer, undefined, () => parseImportDraft(readStorage(KEY)));
  useEffect(() => writeStorage(KEY, JSON.stringify(draft)), [draft]);
  const totals = useMemo(() => draftTotals(draft), [draft]);
  return { draft, dispatch, totals };
}
```

`client/src/pages/imports/SupplierPicker.tsx`:

```tsx
import { useState } from 'react';
import { Check, ChevronsUpDown, Plus, Truck } from 'lucide-react';
import { formatMoney } from '@tiny-pos/shared';
import { useSuppliers } from '@/api/suppliers';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { SupplierFormDialog } from '../suppliers/SupplierFormDialog';

interface Props {
  value: number | null;
  onChange: (id: number | null) => void;
}

/** Ô chọn NCC có tìm; có mục "Không ghi nhà cung cấp" và "+ Thêm nhà cung cấp". */
export function SupplierPicker({ value, onChange }: Props) {
  const { data: suppliers = [] } = useSuppliers();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const current = suppliers.find((s) => s.id === value);
  const pick = (id: number | null) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="h-11 w-full justify-between text-base sm:w-96">
            <span className="flex min-w-0 items-center gap-2">
              <Truck className="shrink-0 text-primary" />
              <span className="truncate">{current ? current.name : 'Không ghi nhà cung cấp'}</span>
            </span>
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command>
            <CommandInput placeholder="Tìm nhà cung cấp…" className="h-11 text-base" />
            <CommandList>
              <CommandEmpty>Không tìm thấy</CommandEmpty>
              <CommandGroup>
                <CommandItem value="Không ghi nhà cung cấp #none" className="py-2 text-base" onSelect={() => pick(null)}>
                  <Check className={cn(value === null ? 'opacity-100' : 'opacity-0')} />
                  Không ghi nhà cung cấp
                </CommandItem>
                {suppliers.map((s) => (
                  <CommandItem key={s.id} value={`${s.name} ${s.phone ?? ''} #${s.id}`} className="py-2 text-base" onSelect={() => pick(s.id)}>
                    <Check className={cn(value === s.id ? 'opacity-100' : 'opacity-0')} />
                    <span className="flex-1 truncate">{s.name}</span>
                    {s.debt > 0 && <span className="text-sm text-destructive tabular-nums">nợ {formatMoney(s.debt)}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  value="Thêm nhà cung cấp #add"
                  className="py-2 text-base"
                  onSelect={() => {
                    setOpen(false);
                    setAdding(true);
                  }}
                >
                  <Plus />
                  Thêm nhà cung cấp
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <SupplierFormDialog
        open={adding}
        onClose={() => setAdding(false)}
        onSaved={(s) => {
          setAdding(false);
          onChange(s.id);
        }}
      />
    </>
  );
}
```

`client/src/pages/imports/ImportLineRow.tsx`:

```tsx
import type { Dispatch } from 'react';
import { Trash2 } from 'lucide-react';
import { currentOption, formatMoney, formatQty, importLineAmount, marginPercent, type DraftAction, type DraftLine } from '@tiny-pos/shared';
import { CommitInput } from '@/components/CommitInput';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

/** Radix không cho SelectItem value rỗng: đơn vị gốc dùng giá trị thay thế. */
const BASE = '__base__';

interface Props {
  line: DraftLine;
  dispatch: Dispatch<DraftAction>;
  onDone: () => void;
}

export function ImportLineRow({ line, dispatch, onDone }: Props) {
  const opt = currentOption(line);
  const margin = marginPercent(line.sellPrice, line.unitCost);
  const update = (patch: Partial<Pick<DraftLine, 'qty' | 'unitCost' | 'sellPrice'>>) => dispatch({ type: 'update', key: line.key, patch });

  return (
    <TableRow>
      <TableCell className="px-4 py-2 whitespace-normal">
        <div className="font-medium">{line.name}</div>
        {!line.isActive && <Badge variant="secondary">Ngừng bán</Badge>}
      </TableCell>
      <TableCell className="px-2 py-2">
        {line.options.length > 1 ? (
          <Select
            value={line.unitId === null ? BASE : String(line.unitId)}
            onValueChange={(v) => dispatch({ type: 'setUnit', key: line.key, unitId: v === BASE ? null : Number(v) })}
          >
            <SelectTrigger aria-label="Đơn vị" className="h-11 w-36 text-base data-[size=default]:h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {line.options.map((o) => (
                <SelectItem key={o.id ?? BASE} value={o.id === null ? BASE : String(o.id)} className="py-2 text-base">
                  {o.name}
                  {o.factor !== 1 && ` (${formatQty(o.factor)})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="px-2">{opt.name}</span>
        )}
      </TableCell>
      <TableCell className="px-2 py-2">
        <CommitInput aria-label="Số lượng" value={line.qty} onCommit={(qty) => update({ qty })} onEnter={onDone} className="w-20 text-center" />
      </TableCell>
      <TableCell className="px-2 py-2">
        <CommitInput aria-label="Giá nhập" money value={line.unitCost} onCommit={(unitCost) => update({ unitCost })} onEnter={onDone} className="w-32" />
      </TableCell>
      <TableCell className="px-2 py-2 text-right font-semibold tabular-nums">{formatMoney(importLineAmount(line.qty, line.unitCost))}</TableCell>
      <TableCell className="px-2 py-2">
        <CommitInput aria-label="Giá bán" money value={line.sellPrice} onCommit={(sellPrice) => update({ sellPrice })} onEnter={onDone} className="w-32" />
        <div className={cn('mt-0.5 text-right text-xs tabular-nums', margin !== null && margin < 0 ? 'text-destructive' : 'text-muted-foreground')}>
          {margin === null ? 'chưa có giá nhập' : `lãi ${String(margin).replace('.', ',')}%`}
          {line.sellPrice !== opt.sellPrice && ' · giá mới'}
        </div>
      </TableCell>
      <TableCell className="py-2 pr-2">
        <Button variant="ghost" size="icon-lg" className="size-11" aria-label="Xóa dòng" onClick={() => dispatch({ type: 'remove', key: line.key })}>
          <Trash2 />
        </Button>
      </TableCell>
    </TableRow>
  );
}
```

`client/src/pages/imports/ImportLinesTable.tsx`:

```tsx
import type { Dispatch } from 'react';
import { PackageOpen } from 'lucide-react';
import type { DraftAction, DraftLine } from '@tiny-pos/shared';
import { EmptyState } from '@/components/EmptyState';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ImportLineRow } from './ImportLineRow';

interface Props {
  lines: DraftLine[];
  dispatch: Dispatch<DraftAction>;
  onDone: () => void;
}

export function ImportLinesTable({ lines, dispatch, onDone }: Props) {
  if (!lines.length)
    return <EmptyState icon={PackageOpen} title="Phiếu nhập trống" description="Quét mã vạch hoặc gõ tên sản phẩm để thêm dòng." />;
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <TableHead className="px-4">Sản phẩm</TableHead>
          <TableHead className="px-2">Đơn vị</TableHead>
          <TableHead className="px-2">Số lượng</TableHead>
          <TableHead className="px-2 text-right">Giá nhập</TableHead>
          <TableHead className="px-2 text-right">Thành tiền</TableHead>
          <TableHead className="px-2 text-right">Giá bán</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((l) => (
          <ImportLineRow key={l.key} line={l} dispatch={dispatch} onDone={onDone} />
        ))}
      </TableBody>
    </Table>
  );
}
```

`client/src/pages/imports/ImportFooter.tsx`:

```tsx
import { Save } from 'lucide-react';
import { formatMoney } from '@tiny-pos/shared';
import { CommitInput } from '@/components/CommitInput';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Kbd } from '@/components/ui/kbd';

interface Props {
  totals: { total: number; paid: number; debt: number };
  hasSupplier: boolean;
  /** Đang để "trả đủ" (paid tự theo tổng). */
  paidAuto: boolean;
  onPaid: (v: number | null) => void;
  onSave: () => void;
  saving: boolean;
  empty: boolean;
}

export function ImportFooter({ totals, hasSupplier, paidAuto, onPaid, onSave, saving, empty }: Props) {
  const over = totals.paid > totals.total;
  return (
    <Card className="gap-0 py-0">
      <CardContent className="flex flex-wrap items-end justify-between gap-4 p-5">
        <div>
          <div className="text-sm text-muted-foreground">Tổng tiền nhập</div>
          <div className="font-heading text-3xl font-semibold text-primary tabular-nums">{formatMoney(totals.total)}</div>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Đã trả</label>
            {hasSupplier && !paidAuto && (
              <Button variant="link" className="h-auto p-0 text-sm" onClick={() => onPaid(null)}>
                Trả đủ
              </Button>
            )}
          </div>
          <CommitInput aria-label="Đã trả" money disabled={!hasSupplier} value={totals.paid} onCommit={(v) => onPaid(v)} className="w-40" />
          <div className={over ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
            {over ? 'Số đã trả lớn hơn tổng tiền' : hasSupplier ? `Ghi nợ: ${formatMoney(totals.debt)}` : 'Không ghi NCC thì trả đủ'}
          </div>
        </div>
        <Button className="h-14 px-8 text-lg" disabled={empty || over || saving} onClick={onSave}>
          <Save data-icon="inline-start" />
          Lưu phiếu <Kbd className="ml-1">F9</Kbd>
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: không lỗi (component chưa được gắn vào trang – Task 11 ghép).

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/imports
git commit -m "feat(client): thành phần phiếu nhập – chọn NCC, dòng nhập theo đơn vị, chân phiếu"
```

---

### Task 11: Màn Nhập hàng – tạo phiếu, danh sách, chi tiết, hủy (client)

**Files:**
- Create: `client/src/pages/imports/ImportFormPage.tsx`, `ImportsPage.tsx`, `ImportTable.tsx`, `ImportDetailDialog.tsx`
- Modify: `client/src/router.tsx` (import, NAV, 2 route)

**Interfaces:**
- Consumes: Task 8 (`useImports`, `useImport`, `useCreateImport`, `useCancelImport`, `fetchProduct`, `ProductSearch`, `DayPicker`, `today`), Task 10 (component + `useImportDraft`), `toImportInput` (shared), `lookupBarcode`, `ApiError`, `ProductFormDialog`, `useScanInput`, `useConfirm`, `StatCard`, `PageHeader`, `EmptyState`.
- Produces: trang `/imports`, `/imports/new`.

- [ ] **Step 1: Viết component**

`client/src/pages/imports/ImportFormPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { ArrowLeft, PackagePlus } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { toImportInput, type Product, type ProductWithUnits } from '@tiny-pos/shared';
import { ApiError } from '@/api/client';
import { useCreateImport } from '@/api/imports';
import { fetchProduct, lookupBarcode } from '@/api/products';
import { PageHeader } from '@/components/PageHeader';
import { ProductSearch } from '@/components/ProductSearch';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useScanInput } from '@/hooks/useScanInput';
import { ProductFormDialog } from '../products/ProductFormDialog';
import { ImportFooter } from './ImportFooter';
import { ImportLinesTable } from './ImportLinesTable';
import { SupplierPicker } from './SupplierPicker';
import { useImportDraft } from './useImportDraft';

const noop = () => {};

export function ImportFormPage() {
  const { draft, dispatch, totals } = useImportDraft();
  const [newBarcode, setNewBarcode] = useState<string | null>(null);
  const create = useCreateImport();
  const navigate = useNavigate();
  const scan = useScanInput(noop, newBarcode !== null);

  const add = (product: ProductWithUnits, unitId: number | null) => dispatch({ type: 'add', product, unitId });
  const onScan = async (code: string) => {
    try {
      const r = await lookupBarcode(code);
      add(await fetchProduct(r.product.id), r.unit?.id ?? null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setNewBarcode(code);
      else toast.error((e as Error).message);
    }
  };
  const onPick = async (p: Product) => {
    try {
      add(await fetchProduct(p.id), null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const setSupplier = (supplierId: number | null) => {
    dispatch({ type: 'setSupplier', supplierId });
    // Không ghi NCC thì phải trả đủ
    if (supplierId === null) dispatch({ type: 'setPaid', paid: null });
  };

  const save = () => {
    if (!draft.lines.length || totals.paid > totals.total || create.isPending) return;
    create.mutate(toImportInput(draft), {
      onSuccess: (r) => {
        dispatch({ type: 'clear' });
        toast.success(`Đã lưu ${r.code}`);
        navigate('/imports');
      },
      // Lỗi: giữ nguyên phiếu nháp để sửa rồi lưu lại
      onError: (err) => toast.error(err.message),
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'F9' || newBarcode !== null) return;
      e.preventDefault();
      save();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        title="Tạo phiếu nhập"
        description="Quét mã hàng về; mã lạ sẽ mở form thêm sản phẩm"
        icon={PackagePlus}
        actions={
          <Button variant="outline" className="h-11 text-base" asChild>
            <Link to="/imports">
              <ArrowLeft data-icon="inline-start" />
              Danh sách phiếu
            </Link>
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <SupplierPicker value={draft.supplierId} onChange={setSupplier} />
        <Input
          placeholder="Ghi chú phiếu (tùy chọn)"
          maxLength={200}
          value={draft.note}
          onChange={(e) => dispatch({ type: 'setNote', note: e.target.value })}
          className="h-11 min-w-0 flex-1 text-base"
        />
      </div>
      <ProductSearch inputRef={scan.ref} onScan={(c) => void onScan(c)} onPick={(p) => void onPick(p)} />
      <Card className="gap-0 overflow-hidden py-0">
        <ImportLinesTable lines={draft.lines} dispatch={dispatch} onDone={scan.focus} />
      </Card>
      <ImportFooter
        totals={totals}
        hasSupplier={draft.supplierId !== null}
        paidAuto={draft.paid === null}
        onPaid={(paid) => dispatch({ type: 'setPaid', paid })}
        onSave={save}
        saving={create.isPending}
        empty={!draft.lines.length}
      />
      <ProductFormDialog
        open={newBarcode !== null}
        initialBarcode={newBarcode ?? undefined}
        onClose={() => setNewBarcode(null)}
        onSaved={(p) => {
          setNewBarcode(null);
          add(p, null);
        }}
      />
    </div>
  );
}
```

`client/src/pages/imports/ImportTable.tsx`:

```tsx
import { formatMoney, type ImportSummary } from '@tiny-pos/shared';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const time = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

export function ImportTable({ imports, onOpen }: { imports: ImportSummary[]; onOpen: (id: number) => void }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <TableHead className="px-4">Mã</TableHead>
          <TableHead className="px-4">Giờ</TableHead>
          <TableHead className="px-4">Nhà cung cấp</TableHead>
          <TableHead className="px-4 text-right">Số dòng</TableHead>
          <TableHead className="px-4 text-right">Tổng</TableHead>
          <TableHead className="px-4 text-right">Còn nợ</TableHead>
          <TableHead className="px-4">Trạng thái</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {imports.map((i) => {
          const cancelled = i.status === 'cancelled';
          return (
            <TableRow key={i.id} className={cn('cursor-pointer', cancelled && 'text-muted-foreground')} onClick={() => onOpen(i.id)}>
              <TableCell className={cn('px-4 py-3 font-mono', cancelled && 'line-through')}>{i.code}</TableCell>
              <TableCell className="px-4 py-3 tabular-nums">{time(i.createdAt)}</TableCell>
              <TableCell className="px-4 py-3">{i.supplierName ?? '—'}</TableCell>
              <TableCell className="px-4 py-3 text-right tabular-nums">{i.itemCount}</TableCell>
              <TableCell className={cn('px-4 py-3 text-right font-semibold tabular-nums', cancelled && 'line-through')}>{formatMoney(i.total)}</TableCell>
              <TableCell className="px-4 py-3 text-right tabular-nums">{i.total > i.paid ? formatMoney(i.total - i.paid) : '—'}</TableCell>
              <TableCell className="px-4 py-3">{cancelled ? <Badge variant="secondary">Đã hủy</Badge> : <Badge>Hoàn tất</Badge>}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
```

`client/src/pages/imports/ImportDetailDialog.tsx`:

```tsx
import { Ban } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney, formatQty } from '@tiny-pos/shared';
import { useCancelImport, useImport } from '@/api/imports';
import { useConfirm } from '@/components/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function ImportDetailDialog({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data: r } = useImport(id);
  const cancel = useCancelImport();
  const confirm = useConfirm();

  const onCancel = async () => {
    if (!r) return;
    const ok = await confirm({
      title: `Hủy ${r.code} và trừ lại kho?`,
      description: 'Tồn kho và nợ nhà cung cấp được trừ lại; giá vốn, giá bán giữ nguyên.',
      confirmText: 'Hủy phiếu',
      cancelText: 'Không',
      destructive: true,
    });
    if (!ok) return;
    cancel.mutate(r.id, { onSuccess: () => toast.success(`Đã hủy ${r.code}`), onError: (e) => toast.error(e.message) });
  };

  return (
    <Dialog open={id !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono text-xl">
            {r?.code ?? 'Phiếu nhập'}
            {r?.status === 'cancelled' && <Badge variant="secondary">Đã hủy</Badge>}
          </DialogTitle>
          <DialogDescription className="text-base">
            {r && `${new Date(r.createdAt).toLocaleString('vi-VN')} · ${r.supplierName ?? 'Không ghi NCC'}${r.note ? ` · ${r.note}` : ''}`}
          </DialogDescription>
        </DialogHeader>
        {r && (
          <div className="space-y-4">
            <ul className="divide-y rounded-xl border">
              {r.items.map((it) => (
                <li key={it.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="font-medium">{it.productName}</div>
                    <div className="text-sm text-muted-foreground tabular-nums">
                      {formatQty(it.qty)} {it.unitName} × {formatMoney(it.unitCost)}
                    </div>
                  </div>
                  <div className="font-semibold tabular-nums">{formatMoney(it.amount)}</div>
                </li>
              ))}
            </ul>
            <div className="space-y-1 tabular-nums">
              <div className="flex justify-between text-lg font-semibold">
                <span>Tổng</span>
                <span>{formatMoney(r.total)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Đã trả</span>
                <span>{formatMoney(r.paid)}</span>
              </div>
              {r.total > r.paid && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Ghi nợ</span>
                  <span>{formatMoney(r.total - r.paid)}</span>
                </div>
              )}
            </div>
          </div>
        )}
        <DialogFooter>
          {r?.status === 'done' && (
            <Button variant="outline" className="h-11 text-base text-destructive" disabled={cancel.isPending} onClick={() => void onCancel()}>
              <Ban data-icon="inline-start" />
              Hủy phiếu
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

`client/src/pages/imports/ImportsPage.tsx`:

```tsx
import { useState } from 'react';
import { PackagePlus, PackageOpen, Wallet, HandCoins } from 'lucide-react';
import { Link } from 'react-router';
import { formatMoney } from '@tiny-pos/shared';
import { useImports } from '@/api/imports';
import { DayPicker, today } from '@/components/DayPicker';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ImportDetailDialog } from './ImportDetailDialog';
import { ImportTable } from './ImportTable';

export function ImportsPage() {
  const [date, setDate] = useState(today);
  const [openId, setOpenId] = useState<number | null>(null);
  const { data, isLoading } = useImports(date);
  const s = data?.summary;

  return (
    <>
      <PageHeader
        title="Nhập hàng"
        description="Phiếu nhập theo ngày; hủy phiếu sẽ trừ lại kho"
        icon={PackageOpen}
        actions={
          <>
            <DayPicker value={date} onChange={setDate} />
            <Button className="h-11 px-5 text-base" asChild>
              <Link to="/imports/new">
                <PackagePlus data-icon="inline-start" />
                Tạo phiếu nhập
              </Link>
            </Button>
          </>
        }
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard icon={PackageOpen} label="Số phiếu" value={String(s?.count ?? 0)} hint="Không tính phiếu đã hủy" />
        <StatCard icon={Wallet} label="Tổng nhập" value={formatMoney(s?.total ?? 0)} tone="info" />
        <StatCard icon={HandCoins} label="Đã trả" value={formatMoney(s?.paid ?? 0)} tone="warn" />
      </div>
      <Card className="gap-0 overflow-hidden py-0">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : data?.imports.length ? (
          <ImportTable imports={data.imports} onOpen={setOpenId} />
        ) : (
          <EmptyState icon={PackageOpen} title="Chưa có phiếu nhập" description="Ngày này chưa nhập hàng." />
        )}
      </Card>
      <ImportDetailDialog id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
```

- [ ] **Step 2: Menu và route**

`client/src/router.tsx`:
- Import lucide: thêm `PackageOpen` vào dòng import `'lucide-react'`.
- Thêm 2 import sau import `CategoriesPage`:

```tsx
import { ImportFormPage } from './pages/imports/ImportFormPage';
import { ImportsPage } from './pages/imports/ImportsPage';
```

- Thêm vào NAV ngay sau dòng `/orders`: `  { to: '/imports', label: 'Nhập hàng', icon: PackageOpen },`
- Thêm 2 route sau `<Route path="/orders" … />`:

```tsx
      <Route path="/imports" element={<ImportsPage />} />
      <Route path="/imports/new" element={<ImportFormPage />} />
```

- [ ] **Step 3: Typecheck, build, chạy thử**

Run: `npm run typecheck`, `npm run build -w client`

Chạy thử (Chromium headless, `npm run seed` đã có dữ liệu, chặn `POST /api/imports` bằng `route.fulfill` trả lỗi 400 `{ "error": "thử lỗi" }` ở lượt đầu):
- `/imports/new`: quét một mã có đơn vị thùng trong seed → dòng chọn sẵn "Thùng", giá nhập = giá vốn × hệ số; quét lại → số lượng 2; đổi đơn vị sang gốc → giá điền lại; sửa giá bán → chữ "giá mới"; ô "Đã trả" khóa khi chưa chọn NCC.
- Quét mã lạ `999000111` → mở form thêm sản phẩm với mã điền sẵn (đóng form, không lưu).
- F9 với request bị chặn trả 400 → toast đỏ "thử lỗi", phiếu vẫn còn nguyên; F5 → phiếu nháp vẫn còn.
- Xóa hết dòng (hoặc để nguyên nháp rồi `localStorage.removeItem('tiny-pos.import-draft')` cuối bước) để không để lại nháp.
- `/imports`: ◀ ▶ đổi ngày, empty state hiện đúng.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/imports client/src/router.tsx
git commit -m "feat(client): màn Nhập hàng – tạo phiếu theo đơn vị, danh sách theo ngày, hủy phiếu"
```

---

### Task 12: Màn Kiểm kê (client)

**Files:**
- Create: `client/src/pages/stocktake/StocktakePage.tsx`, `StocktakeStart.tsx`, `StocktakeSession.tsx`, `CountDialog.tsx`, `StocktakeItemsTable.tsx`, `StocktakeHistory.tsx`, `StocktakeDetailDialog.tsx`
- Modify: `client/src/router.tsx` (import, NAV có `mobile: true`, route)

**Interfaces:**
- Consumes: Task 8 stocktake hooks, `ProductSearch`; `lookupBarcode`, `ApiError`, `useScanInput`, `useConfirm`, `ConfirmOptions`; `formatMoney`, `formatQty`, `parseVnNumber`, `StocktakeDetail`, `StocktakeItem`, `Product`.
- Produces: trang `/stocktake`.

- [ ] **Step 1: Viết component**

`client/src/pages/stocktake/CountDialog.tsx`:

```tsx
import { useEffect, useState, type FormEvent } from 'react';
import { Check, ClipboardCheck } from 'lucide-react';
import { formatQty, parseVnNumber } from '@tiny-pos/shared';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export interface CountTarget {
  productId: number;
  name: string;
  unit: string;
  /** Tồn máy hiện tại (hoặc lúc đếm trước, khi sửa dòng đã đếm). */
  stock: number;
  /** Số đã đếm trước đó trong phiên, nếu có. */
  counted?: number;
}

interface Props {
  target: CountTarget | null;
  saving: boolean;
  onClose: () => void;
  onSave: (counted: number) => void;
}

export function CountDialog({ target, saving, onClose, onSave }: Props) {
  const [value, setValue] = useState('');
  useEffect(() => {
    if (target) setValue(target.counted !== undefined ? formatQty(target.counted) : '');
  }, [target]);

  const n = parseVnNumber(value);
  const valid = value.trim() !== '' && Number.isFinite(n) && n >= 0;
  const diff = valid && target ? Math.round((n - target.stock) * 1000) / 1000 : null;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (valid && !saving) onSave(n);
  };

  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ClipboardCheck className="size-5 text-primary" />
            {target?.name}
          </DialogTitle>
          <DialogDescription className="text-base">
            Tồn máy: {target && `${formatQty(target.stock)} ${target.unit}`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <TextField
            id="cd-counted"
            label="Số đếm được"
            suffix={target?.unit}
            inputMode="decimal"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={(e) => e.target.select()}
          />
          {diff !== null && (
            <p className={cn('text-base font-medium', diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-destructive' : 'text-muted-foreground')}>
              {diff === 0 ? 'Khớp tồn máy' : `Chênh lệch ${diff > 0 ? '+' : ''}${formatQty(diff)} ${target?.unit}`}
            </p>
          )}
          <Button type="submit" className="h-11 w-full text-base" disabled={!valid || saving}>
            <Check data-icon="inline-start" />
            Lưu (Enter)
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

`client/src/pages/stocktake/StocktakeItemsTable.tsx`:

```tsx
import { Pencil, Trash2 } from 'lucide-react';
import { formatQty, type StocktakeItem } from '@tiny-pos/shared';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface Props {
  items: StocktakeItem[];
  onEdit?: (i: StocktakeItem) => void;
  onRemove?: (i: StocktakeItem) => void;
}

export function DiffText({ diff, unit }: { diff: number; unit: string }) {
  return (
    <span className={cn('font-semibold tabular-nums', diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-destructive' : 'text-muted-foreground')}>
      {diff > 0 ? '+' : ''}
      {formatQty(diff)} {unit}
    </span>
  );
}

/** Bảng món đã đếm; không truyền onEdit/onRemove thì chỉ đọc. */
export function StocktakeItemsTable({ items, onEdit, onRemove }: Props) {
  const editable = !!onEdit || !!onRemove;
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <TableHead className="px-4">Sản phẩm</TableHead>
          <TableHead className="px-4 text-right">Tồn máy</TableHead>
          <TableHead className="px-4 text-right">Đếm được</TableHead>
          <TableHead className="px-4 text-right">Lệch</TableHead>
          {editable && <TableHead className="w-28" />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((i) => (
          <TableRow key={i.productId}>
            <TableCell className="px-4 py-2 font-medium whitespace-normal">{i.productName}</TableCell>
            <TableCell className="px-4 py-2 text-right tabular-nums">{formatQty(i.expected)}</TableCell>
            <TableCell className="px-4 py-2 text-right tabular-nums">{formatQty(i.counted)}</TableCell>
            <TableCell className="px-4 py-2 text-right">
              <DiffText diff={i.diff} unit={i.unit} />
            </TableCell>
            {editable && (
              <TableCell className="py-2 pr-2 text-right">
                {onEdit && (
                  <Button variant="ghost" size="icon-lg" className="size-11" aria-label="Sửa số đếm" onClick={() => onEdit(i)}>
                    <Pencil />
                  </Button>
                )}
                {onRemove && (
                  <Button variant="ghost" size="icon-lg" className="size-11" aria-label="Bỏ món" onClick={() => onRemove(i)}>
                    <Trash2 />
                  </Button>
                )}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

`client/src/pages/stocktake/StocktakeSession.tsx`:

```tsx
import { useState } from 'react';
import { ClipboardList, CheckCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney, type Product, type StocktakeDetail } from '@tiny-pos/shared';
import { ApiError } from '@/api/client';
import { lookupBarcode } from '@/api/products';
import { useCancelStocktake, useCountItem, useFinishStocktake, useRemoveCountItem } from '@/api/stocktakes';
import { useConfirm, type ConfirmOptions } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { ProductSearch } from '@/components/ProductSearch';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useScanInput } from '@/hooks/useScanInput';
import { CountDialog, type CountTarget } from './CountDialog';
import { StocktakeItemsTable } from './StocktakeItemsTable';

const noop = () => {};

export function StocktakeSession({ session }: { session: StocktakeDetail }) {
  const [target, setTarget] = useState<CountTarget | null>(null);
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const count = useCountItem();
  const remove = useRemoveCountItem();
  const finish = useFinishStocktake();
  const cancel = useCancelStocktake();
  const confirm = useConfirm();
  const scan = useScanInput(noop, target !== null || confirming);

  const openFor = (p: Product) =>
    setTarget({ productId: p.id, name: p.name, unit: p.unit, stock: p.stock, counted: session.items.find((i) => i.productId === p.id)?.counted });
  const onScan = async (code: string) => {
    try {
      openFor((await lookupBarcode(code)).product);
    } catch (e) {
      toast.error(e instanceof ApiError && e.status === 404 ? `Không có mã ${code}` : (e as Error).message);
    }
  };
  const save = (counted: number) => {
    if (!target) return;
    count.mutate(
      { id: session.id, productId: target.productId, counted },
      {
        onSuccess: () => {
          toast.success(`Đã đếm ${target.name}`);
          setTarget(null);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };
  const ask = async (opts: ConfirmOptions) => {
    setConfirming(true);
    try {
      return await confirm(opts);
    } finally {
      setConfirming(false);
    }
  };
  const onFinish = async () => {
    const ok = await ask({
      title: `Chốt ${session.code}?`,
      description: `${session.itemCount} món đã đếm, ${session.diffCount} món lệch, giá trị lệch ${formatMoney(session.diffValue)} (theo giá vốn). Tồn kho các món lệch sẽ được điều chỉnh.`,
      confirmText: 'Chốt kiểm kê',
    });
    if (ok) finish.mutate(session.id, { onSuccess: () => toast.success(`Đã chốt ${session.code}`), onError: (e) => toast.error(e.message) });
  };
  const onCancel = async () => {
    const ok = await ask({ title: 'Hủy phiên kiểm kê?', description: 'Số đã đếm sẽ bỏ, tồn kho không đổi.', confirmText: 'Hủy phiên', destructive: true });
    if (ok) cancel.mutate(session.id, { onSuccess: () => toast.success('Đã hủy phiên'), onError: (e) => toast.error(e.message) });
  };

  const items = onlyDiff ? session.items.filter((i) => Math.abs(i.diff) > 1e-9) : session.items;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Kiểm kê"
        description={`${session.code} · ${session.itemCount} món đã đếm · ${session.diffCount} món lệch${session.note ? ` · ${session.note}` : ''}`}
        icon={ClipboardList}
        actions={
          <>
            <Button variant="outline" className="h-11 text-base text-destructive" onClick={() => void onCancel()}>
              <X data-icon="inline-start" />
              Hủy phiên
            </Button>
            <Button className="h-11 text-base" disabled={!session.itemCount || finish.isPending} onClick={() => void onFinish()}>
              <CheckCheck data-icon="inline-start" />
              Chốt kiểm kê
            </Button>
          </>
        }
      />
      <ProductSearch inputRef={scan.ref} onScan={(c) => void onScan(c)} onPick={openFor} />
      <label className="flex items-center gap-3">
        <Switch checked={onlyDiff} onCheckedChange={setOnlyDiff} />
        <span>Chỉ món lệch</span>
      </label>
      <Card className="gap-0 overflow-hidden py-0">
        {items.length ? (
          <StocktakeItemsTable
            items={items}
            onEdit={(i) => setTarget({ productId: i.productId, name: i.productName, unit: i.unit, stock: i.expected, counted: i.counted })}
            onRemove={(i) => remove.mutate({ id: session.id, productId: i.productId }, { onError: (e) => toast.error(e.message) })}
          />
        ) : (
          <EmptyState icon={ClipboardList} title={onlyDiff ? 'Không có món lệch' : 'Chưa đếm món nào'} description="Quét mã hoặc gõ tên để đếm." />
        )}
      </Card>
      <CountDialog target={target} saving={count.isPending} onClose={() => setTarget(null)} onSave={save} />
    </div>
  );
}
```

`client/src/pages/stocktake/StocktakeDetailDialog.tsx`:

```tsx
import { formatMoney } from '@tiny-pos/shared';
import { useStocktake } from '@/api/stocktakes';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StocktakeItemsTable } from './StocktakeItemsTable';

export function StocktakeDetailDialog({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data: s } = useStocktake(id);
  return (
    <Dialog open={id !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono text-xl">
            {s?.code ?? 'Kiểm kê'}
            {s?.status === 'cancelled' && <Badge variant="secondary">Đã hủy</Badge>}
          </DialogTitle>
          <DialogDescription className="text-base">
            {s && `${new Date(s.createdAt).toLocaleString('vi-VN')} · ${s.itemCount} món · ${s.diffCount} món lệch · ${formatMoney(s.diffValue)}`}
          </DialogDescription>
        </DialogHeader>
        {s && <StocktakeItemsTable items={s.items} />}
      </DialogContent>
    </Dialog>
  );
}
```

`client/src/pages/stocktake/StocktakeHistory.tsx`:

```tsx
import { useState } from 'react';
import { formatMoney } from '@tiny-pos/shared';
import { useStocktakes } from '@/api/stocktakes';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { StocktakeDetailDialog } from './StocktakeDetailDialog';

export function StocktakeHistory() {
  const { data = [] } = useStocktakes();
  const [openId, setOpenId] = useState<number | null>(null);
  if (!data.length) return null;
  return (
    <>
      <h2 className="mt-8 mb-3 font-heading text-lg font-semibold">Các lần kiểm kê trước</h2>
      <Card className="gap-0 overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="px-4">Mã</TableHead>
              <TableHead className="px-4">Ngày</TableHead>
              <TableHead className="px-4 text-right">Số món</TableHead>
              <TableHead className="px-4 text-right">Món lệch</TableHead>
              <TableHead className="px-4 text-right">Giá trị lệch</TableHead>
              <TableHead className="px-4">Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((s) => (
              <TableRow key={s.id} className="cursor-pointer" onClick={() => setOpenId(s.id)}>
                <TableCell className="px-4 py-3 font-mono">{s.code}</TableCell>
                <TableCell className="px-4 py-3">{new Date(s.createdAt).toLocaleDateString('vi-VN')}</TableCell>
                <TableCell className="px-4 py-3 text-right tabular-nums">{s.itemCount}</TableCell>
                <TableCell className="px-4 py-3 text-right tabular-nums">{s.diffCount}</TableCell>
                <TableCell className={cn('px-4 py-3 text-right tabular-nums', s.diffValue < 0 && 'text-destructive')}>{formatMoney(s.diffValue)}</TableCell>
                <TableCell className="px-4 py-3">{s.status === 'done' ? <Badge>Đã chốt</Badge> : <Badge variant="secondary">Đã hủy</Badge>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <StocktakeDetailDialog id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
```

`client/src/pages/stocktake/StocktakeStart.tsx`:

```tsx
import { useState } from 'react';
import { ClipboardList, Play } from 'lucide-react';
import { toast } from 'sonner';
import { useOpenStocktake } from '@/api/stocktakes';
import { PageHeader } from '@/components/PageHeader';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StocktakeHistory } from './StocktakeHistory';

export function StocktakeStart() {
  const [note, setNote] = useState('');
  const open = useOpenStocktake();
  const start = () =>
    open.mutate({ note: note.trim() || null }, { onSuccess: (s) => toast.success(`Đã mở ${s.code}`), onError: (e) => toast.error(e.message) });

  return (
    <>
      <PageHeader title="Kiểm kê" description="Đếm thực tế, chốt để đưa tồn máy về đúng" icon={ClipboardList} />
      <Card>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Có thể đếm từng phần (ví dụ chỉ quầy nước) và vẫn bán hàng trong lúc đếm; món không đếm giữ nguyên tồn.
          </p>
          <TextField id="st-note" label="Ghi chú (tùy chọn)" placeholder="Quầy nước, kho sau…" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
          <Button className="h-14 w-full text-lg sm:w-auto sm:px-10" disabled={open.isPending} onClick={start}>
            <Play data-icon="inline-start" />
            Bắt đầu kiểm kê
          </Button>
        </CardContent>
      </Card>
      <StocktakeHistory />
    </>
  );
}
```

`client/src/pages/stocktake/StocktakePage.tsx`:

```tsx
import { useCurrentStocktake } from '@/api/stocktakes';
import { Skeleton } from '@/components/ui/skeleton';
import { StocktakeSession } from './StocktakeSession';
import { StocktakeStart } from './StocktakeStart';

/** Có phiên đang mở thì vào màn đếm, không thì màn bắt đầu + lịch sử. */
export function StocktakePage() {
  const { data: current, isLoading } = useCurrentStocktake();
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  return current ? <StocktakeSession session={current} /> : <StocktakeStart />;
}
```

- [ ] **Step 2: Menu và route**

`client/src/router.tsx`:
- Import lucide: thêm `ClipboardList`.
- Thêm `import { StocktakePage } from './pages/stocktake/StocktakePage';` sau import `SettingsPage`.
- Thêm vào NAV ngay sau dòng `/imports`: `  { to: '/stocktake', label: 'Kiểm kê', icon: ClipboardList, mobile: true },`
- Thêm route sau `<Route path="/imports/new" … />`: `      <Route path="/stocktake" element={<StocktakePage />} />`

- [ ] **Step 3: Typecheck, build, chạy thử**

Run: `npm run typecheck`, `npm run build -w client`

Chạy thử (Chromium headless, viewport 390×844 và 1280×800; bước này ghi thật vào DB dev, cuối bước phải **hủy phiên** để tồn kho không đổi):
- Thanh dưới điện thoại có Kiểm kê; `/stocktake` → *Bắt đầu kiểm kê* → màn đếm với mã `KK-…`.
- Quét mã seed → dialog Đếm (tồn máy hiện đúng) → gõ số khác tồn → thấy "Chênh lệch …" → Enter → dòng vào bảng với lệch màu; quét lại cùng mã → dialog điền sẵn số cũ.
- Công tắc "Chỉ món lệch" lọc đúng; khi dialog xác nhận "Hủy phiên" đang mở, nhấn F-key/quét không mở dialog Đếm.
- *Hủy phiên* → xác nhận → quay về màn bắt đầu, lịch sử có dòng "Đã hủy".

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/stocktake client/src/router.tsx
git commit -m "feat(client): màn Kiểm kê – phiên đếm, chênh lệch, chốt/hủy, lịch sử"
```

---

### Task 13: Lịch sử tồn sản phẩm (client)

**Files:**
- Create: `client/src/pages/products/StockHistoryDialog.tsx`
- Modify: `client/src/pages/products/ProductTable.tsx` (`ProductMenu`: thêm mục + dialog)

**Interfaces:**
- Consumes: `useMovements` (Task 8), `formatQty`, `Product`, `MovementType`.
- Produces: `StockHistoryDialog({ product: Product | null; onClose: () => void })`.

- [ ] **Step 1: Viết component**

`client/src/pages/products/StockHistoryDialog.tsx`:

```tsx
import { formatQty, type MovementType, type Product } from '@tiny-pos/shared';
import { useMovements } from '@/api/products';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const TYPE_LABEL: Record<MovementType, string> = { sale: 'Bán', return: 'Trả', import: 'Nhập', adjust: 'Điều chỉnh' };
const when = (iso: string) => new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

/** 100 lần thay đổi tồn gần nhất của một sản phẩm. */
export function StockHistoryDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { data = [], isLoading } = useMovements(product?.id ?? null);
  return (
    <Dialog open={product !== null} onOpenChange={(o) => !o && onClose()}>
      {/* Dialog render qua portal nhưng sự kiện React vẫn nổi bọt lên dòng/thẻ sản phẩm (onClick = mở form sửa) */}
      <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="text-xl">Lịch sử tồn – {product?.name}</DialogTitle>
          <DialogDescription className="text-base">
            Tồn hiện tại: {product && `${formatQty(product.stock)} ${product.unit}`}
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : data.length ? (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="px-3">Thời gian</TableHead>
                <TableHead className="px-3">Loại</TableHead>
                <TableHead className="px-3 text-right">Số lượng</TableHead>
                <TableHead className="px-3">Chứng từ / ghi chú</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="px-3 py-2 tabular-nums">{when(m.createdAt)}</TableCell>
                  <TableCell className="px-3 py-2">
                    <Badge variant="secondary">{TYPE_LABEL[m.type]}</Badge>
                  </TableCell>
                  <TableCell className={cn('px-3 py-2 text-right font-semibold tabular-nums', m.qty > 0 ? 'text-emerald-600' : 'text-destructive')}>
                    {m.qty > 0 ? '+' : ''}
                    {formatQty(m.qty)}
                  </TableCell>
                  <TableCell className="px-3 py-2 whitespace-normal">
                    {m.refCode && <span className="mr-2 font-mono">{m.refCode}</span>}
                    <span className="text-muted-foreground">{m.note && m.note !== `Nhập ${m.refCode}` ? m.note : ''}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-muted-foreground">Chưa có thay đổi tồn nào.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Gắn vào menu thao tác**

Trong `client/src/pages/products/ProductTable.tsx`:
- Dòng import lucide: thêm `History` (`import { Ban, History, MoreHorizontal, Pencil, RotateCcw } from 'lucide-react';`).
- Thêm dòng đầu file: `import { useState } from 'react';`.
- Thêm import `import { StockHistoryDialog } from './StockHistoryDialog';` sau import `@/lib/utils`.
- Trong `ProductMenu`: thêm `const [history, setHistory] = useState(false);` ở đầu thân hàm; bọc `<DropdownMenu>…</DropdownMenu>` trong fragment `<>…</>`; thêm ngay sau `DropdownMenuItem` "Sửa sản phẩm":

```tsx
        <DropdownMenuItem onSelect={() => setHistory(true)}>
          <History />
          Lịch sử tồn
        </DropdownMenuItem>
```

  và sau `</DropdownMenu>` (trong fragment):

```tsx
      <StockHistoryDialog product={history ? p : null} onClose={() => setHistory(false)} />
```

Chữ ký `ProductMenu({ p, onEdit, onToggle })` không đổi, nên `ProductCardList` không phải sửa.

- [ ] **Step 3: Typecheck, build, chạy thử**

Run: `npm run typecheck`, `npm run build -w client`

Chạy thử (Chromium headless, 1280×800 và 390×844): ở `/products` mở menu ⋯ của một sản phẩm → *Lịch sử tồn* → dialog có dòng "Điều chỉnh +N" (tồn đầu seed); **bấm vào bên trong dialog và vào vùng bảng → form sửa sản phẩm KHÔNG mở**; đóng dialog → vẫn ở danh sách. Trên điện thoại (thẻ) cũng vậy.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/products/StockHistoryDialog.tsx client/src/pages/products/ProductTable.tsx
git commit -m "feat(client): lịch sử tồn sản phẩm trong menu thao tác"
```

---

### Task 14: README và kiểm tra toàn bộ

**Files:**
- Modify: `README.md` (thêm mục cuối file)

- [ ] **Step 1: Cập nhật README**

Thêm vào cuối `README.md`:

```md

## Kiểm thử thủ công Giai đoạn 3

1. **Nhà cung cấp**: *Nhà cung cấp* → *Thêm nhà cung cấp* "Đại lý Hùng". Mở lại → nút *Trả nợ* bị khóa khi chưa nợ.
2. **Nhập theo thùng**: *Nhập hàng* → *Tạo phiếu nhập* → chọn "Đại lý Hùng" → quét mã thùng của một sản phẩm → dòng chọn sẵn "Thùng", giá nhập = giá vốn × 24. Sửa số lượng 2, giá nhập 240.000, giá bán thùng 290.000 (hiện "giá mới", % lãi). "Đã trả" 400.000 → "Ghi nợ: 80.000đ" → **Lưu phiếu (F9)**. Sản phẩm: tồn +48, giá vốn 10.000; thùng giá bán 290.000; NCC nợ 80.000.
3. **Mã lạ**: trong phiếu nhập quét mã chưa có → form thêm sản phẩm với mã điền sẵn → lưu → dòng tự vào phiếu.
4. **Không ghi NCC**: chọn "Không ghi nhà cung cấp" → ô "Đã trả" khóa bằng tổng.
5. **Nháp**: thêm vài dòng, F5 → phiếu vẫn còn.
6. **Trả nợ**: mở "Đại lý Hùng" → *Trả nợ* 30.000 → sổ nợ có dòng −30.000, còn 50.000. Thử trả 60.000 → báo lỗi.
7. **Hủy phiếu**: *Nhập hàng* → mở phiếu → *Hủy phiếu* → tồn −48, nợ NCC trừ lại, giá vốn giữ nguyên.
8. **Kiểm kê**: *Kiểm kê* → *Bắt đầu kiểm kê* → quét một món, nhập số đếm khác tồn → thấy chênh lệch. Sang máy khác (hoặc tab khác) bán 1 món đó → quay lại *Chốt kiểm kê* → tồn cuối = số đếm − 1.
9. **Kiểm kê từng phần / hủy**: mở phiên mới, đếm 1 món rồi *Hủy phiên* → tồn không đổi; lịch sử có phiên "Đã hủy".
10. **Lịch sử tồn**: *Sản phẩm* → ⋯ → *Lịch sử tồn* → thấy Nhập (PN-…), Bán (HD-…), Điều chỉnh (KK-… / Hủy PN-…).
11. **Điện thoại**: thanh dưới có Bán hàng, Hóa đơn, Kiểm kê, Sản phẩm, *Thêm*; *Thêm* mở menu các mục còn lại.
```

- [ ] **Step 2: Chạy toàn bộ kiểm tra**

Run: `npm test`
Expected: PASS toàn bộ shared + server.

Run: `npm run typecheck`
Expected: không lỗi.

Run: `npm run build`
Expected: build xong cả 3 workspace.

- [ ] **Step 3: Kiểm tra diff không có nhiễu format**

Run: `git diff --stat a0913a2..HEAD -- . ':!package-lock.json' ':!server/drizzle'`
Expected: các file có sẵn (`schema.ts`, `orders.ts`, `connection.test.ts`, `routes/products.ts`, `routes/index.ts`, `order.ts`, `common.ts`, `types.ts`, `index.ts`, `api/products.ts`, `router.tsx`, `App.tsx`, `SellPage.tsx`, `OrdersPage.tsx`, `ProductTable.tsx`, `README.md`) chỉ thay đổi đúng những dòng các task mô tả. Hunk nào chỉ là format thì hoàn tác.

- [ ] **Step 4: Dọn dữ liệu thử**

Kiểm tra `data/grocery.db` không còn phiên kiểm kê `open` do chạy thử (`GET /api/stocktakes/current` trả `null`) và không còn nháp phiếu nhập trong trình duyệt thử. Nếu các task trước đã tạo phiếu nhập/NCC thử thật, ghi rõ trong báo cáo (mã phiếu, tên NCC) để người dùng biết.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: hướng dẫn kiểm thử thủ công giai đoạn 3"
```
