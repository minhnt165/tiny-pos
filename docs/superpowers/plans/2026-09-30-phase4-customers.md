# Giai đoạn 4 – Khách hàng, công nợ khách: Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm khách hàng với sổ nợ: bán *Ghi nợ* ngay trong hộp thanh toán (trả trước một phần, tạo khách nhanh), hủy đơn ghi nợ, thu nợ tiền mặt/chuyển khoản có QR, ghi nợ tay, nợ đầu kỳ, hóa đơn in thông tin nợ, biên nhận thu nợ 80mm, tổng kết ngày có ghi nợ/thu nợ.

**Architecture:** Schema zod + types ở `shared`. Server thêm `customer-ledger.ts` (hàm duy nhất `recordCustomerDebtTx` đổi `customers.debt`, giống `recordSupplierTx`), service `customers.ts`, sửa `orders.ts` cho `paymentMethod = 'debt'`; migration `0003` chỉ `ALTER TABLE … ADD`. Client thêm trang `/customers`, tab *Ghi nợ* trong `CheckoutDialog` (tách `DebtPanel`, `CustomerPicker`, `TransferQr`), biên nhận thu nợ in qua `PrintProvider`.

**Tech Stack:** Node 24, TypeScript 5.9 ESM, Express 5, better-sqlite3, drizzle-orm 0.45 + drizzle-kit 0.31, zod 4, vitest 3; React 19, Vite 7, Tailwind v4, shadcn/ui (radix-nova) + lucide-react, TanStack Query 5, react-router 7, sonner, cmdk (đã có). Không thêm thư viện.

**Spec:** `docs/superpowers/specs/2026-09-30-tiny-pos-phase4-customers-design.md` (nền: spec giai đoạn 1–3 cùng thư mục)

## Global Constraints

- Tiền là `integer` đồng, trần `MAX_MONEY` = 1.000.000.000; số tiền thu/ghi tay/nợ đầu kỳ là số nguyên.
- Mọi thay đổi `customers.debt` = 1 dòng `debt_transactions` trong cùng transaction, chỉ qua `recordCustomerDebtTx` (`server/src/services/customer-ledger.ts`). Không `update customers set debt` ở chỗ khác.
- `debt_transactions.amount`: `+` nợ thêm (`opening`, `order`, `manual`), `−` giảm nợ (`order_cancel`, `payment`). Nợ khách được phép âm (tiệm nợ lại khách).
- Mọi thay đổi tồn vẫn qua `recordMovement`; chứng từ không sửa, chỉ hủy.
- Thời gian ghi sổ lấy từ `Clock` (`resolveClock`) khi service có tham số `clock`, để test không phụ thuộc máy.
- API dưới `/api`, lỗi `{ error: string }`; body validate bằng zod trong `shared/`; nhãn trường tiếng Việt qua `FIELD_LABELS`.
- UI, thông báo lỗi, comment, commit message bằng tiếng Việt; định danh tiếng Anh. Tiền hiển thị `15.000đ` (`formatMoney`). Nút/ô thao tác chính ≥ 44px (`h-11`). Component ≤ 200 dòng.
- Giao diện dùng component shadcn có sẵn trong `client/src/components/ui` và component dùng chung trong `client/src/components`; không tự viết component thô.
- **Không format lại file có sẵn** (repo không có Prettier/ESLint): sửa file cũ chỉ đúng các dòng cần, giữ nguyên thụt lề/thứ tự import của phần không liên quan. Phong cách: 2 space, nháy đơn, có `;`, dòng tới ~130 ký tự.
- Không sửa migration đã có (`0000`–`0002`). Migration mới `0003` sinh bằng `npm run db:generate`, đọc lại SQL.
- Làm trên `master`, không tạo nhánh. **Không commit sau từng task**: cả giai đoạn là **một commit** ở Task 9 (người dùng không muốn chia nhỏ commit).
- Sửa `shared` thì phải build lại (`npm run build -w shared`) trước khi chạy test/typecheck của `server`/`client` riêng lẻ; `npm test` / `npm run typecheck` từ gốc repo tự build.
- Kiểm tra giao diện theo skill `browser-verify` (`.claude/skills/browser-verify/SKILL.md`): Chrome headless + `playwright-core` cài trong scratchpad, **chặn mọi request ghi** tới `/api` (stub GET bằng `route.fulfill` khi cần dữ liệu), stub `window.print`. Không dùng/kill cổng 5173/5174.
- Mạng công ty: lỗi TLS khi cài gói thì đặt `NODE_EXTRA_CA_CERTS=C:/Users/MinhNT165/Workspace/personal/tiny-pos/.certs/corp-root.pem`; không bao giờ tắt kiểm tra TLS.

## Review Focus

1. Thu nợ xong, TanStack Query làm mới danh sách khách → `customer.debt` đổi: hộp *Thu nợ* phải giữ màn kết quả và nút *In biên nhận*, không tự đặt lại form (Task 8: effect chỉ phụ thuộc `open`; kiểm bằng trình duyệt ở Task 9).
2. Gõ "chị lan" khi đã có "Chị Lan": không hiện "+ Thêm khách" để tránh tạo trùng khách (Task 6: so khớp tên không phân biệt hoa/thường; kiểm bằng trình duyệt).
3. Hủy một đơn ghi nợ cũ của khách đã trả hết nợ và bị xóa mềm: vẫn hủy được, sổ ghi `order_cancel`, nợ âm (Task 4: test riêng).
4. Enter trong ô tìm khách chỉ chọn khách, không gửi form thanh toán; chọn xong con trỏ nhảy sang ô *Khách trả trước* để Enter tiếp là ghi nợ (Task 6: `onCloseAutoFocus`; kiểm bằng trình duyệt).
5. Nợ đầu kỳ hoặc số thu gõ quá 1 tỷ / số lẻ, hình thức thu lạ, ghi nợ tay chỉ có khoảng trắng: trả 400 kèm nhãn tiếng Việt, không ghi sổ (Task 5: test API).

---

### Task 1: Schema và kiểu dữ liệu khách hàng / đơn ghi nợ (shared)

**Files:**
- Create: `shared/src/schemas/customer.ts`, `shared/src/schemas/customer.test.ts`
- Modify: `shared/src/schemas/order.ts` (`orderInputSchema`: 2 dòng), `shared/src/schemas/order.test.ts` (2 chỗ), `shared/src/schemas/common.ts` (3 nhãn), `shared/src/types.ts` (thêm cuối file), `shared/src/index.ts` (1 dòng export)

**Interfaces:**
- Produces:
  - `customerInputSchema` / `type CustomerInput` (`{ name: string; phone: string|null; note: string|null }`) / `type CustomerInputBody`
  - `customerCreateSchema` / `type CustomerCreate` (= `CustomerInput & { openingDebt: number }`, mặc định 0) / `type CustomerCreateBody`
  - `customerPaymentSchema` / `type CustomerPayment` (`{ amount: number; method: 'cash'|'transfer'; note: string|null }`) / `type CustomerPaymentBody`
  - `customerAdjustmentSchema` / `type CustomerAdjustment` (`{ amount: number; note: string }`) / `type CustomerAdjustmentBody`
  - `orderInputSchema` nhận `paymentMethod: 'cash'|'transfer'|'debt'`, `customerId: number|null` (qua `optionalId`)
  - Types: `DebtTxKind`, `CollectMethod`, `Customer`, `CustomerList`, `CustomerTransaction`, `CustomerPaymentResult`, `OrderDebt`

- [ ] **Step 1: Viết test schema khách hàng**

`shared/src/schemas/customer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { customerAdjustmentSchema, customerCreateSchema, customerInputSchema, customerPaymentSchema } from './customer.js';

describe('customer schemas', () => {
  it('khách: trim tên, SĐT/ghi chú rỗng → null; nợ đầu kỳ mặc định 0', () => {
    expect(customerInputSchema.parse({ name: '  Chị Lan ', phone: '', note: ' ' })).toEqual({ name: 'Chị Lan', phone: null, note: null });
    expect(customerCreateSchema.parse({ name: 'Anh Tư' })).toEqual({ name: 'Anh Tư', phone: null, note: null, openingDebt: 0 });
    expect(customerInputSchema.safeParse({ name: '  ' }).success).toBe(false);
  });

  it('nợ đầu kỳ: số nguyên 0 – 1 tỷ', () => {
    expect(customerCreateSchema.safeParse({ name: 'A', openingDebt: 1_000_000_000 }).success).toBe(true);
    expect(customerCreateSchema.safeParse({ name: 'A', openingDebt: 1_000_000_001 }).success).toBe(false);
    expect(customerCreateSchema.safeParse({ name: 'A', openingDebt: -1 }).success).toBe(false);
    expect(customerCreateSchema.safeParse({ name: 'A', openingDebt: 1.5 }).success).toBe(false);
  });

  it('thu nợ: số tiền nguyên > 0, hình thức cash/transfer, ghi chú tùy chọn', () => {
    expect(customerPaymentSchema.parse({ amount: 50000, method: 'transfer' })).toEqual({ amount: 50000, method: 'transfer', note: null });
    expect(customerPaymentSchema.safeParse({ amount: 0, method: 'cash' }).success).toBe(false);
    expect(customerPaymentSchema.safeParse({ amount: 1000, method: 'card' }).success).toBe(false);
  });

  it('ghi nợ tay: bắt buộc ghi chú (không tính khoảng trắng)', () => {
    expect(customerAdjustmentSchema.parse({ amount: 5000, note: ' Quên ghi ' })).toEqual({ amount: 5000, note: 'Quên ghi' });
    expect(customerAdjustmentSchema.safeParse({ amount: 5000, note: '   ' }).success).toBe(false);
    expect(customerAdjustmentSchema.safeParse({ amount: 5000 }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Sửa test đơn hàng cho `debt`**

`shared/src/schemas/order.test.ts`:

Trong test "chuẩn hóa dòng", object kỳ vọng thêm `customerId: null` (sau dòng `paid: 5000,`):

```ts
      paid: 5000,
      customerId: null,
```

Đổi tên và dòng cuối của test "từ chối giỏ rỗng, qty ≤ 0, giá lẻ, phương thức debt" thành:

```ts
  it('từ chối giỏ rỗng, qty ≤ 0, giá lẻ, phương thức lạ', () => {
```

```ts
    expect(orderInputSchema.safeParse({ items: [{ qty: 1, price: 1 }], paymentMethod: 'card' }).success).toBe(false);
```

Thêm test mới ngay sau test đó:

```ts
  it('ghi nợ: nhận paymentMethod debt kèm customerId', () => {
    const r = orderInputSchema.parse({ items: [{ qty: 1, price: 5000 }], paymentMethod: 'debt', customerId: 3, paid: 1000 });
    expect(r).toMatchObject({ paymentMethod: 'debt', customerId: 3, paid: 1000 });
  });
```

- [ ] **Step 3: Chạy test, thấy lỗi**

Run: `cd shared && npx vitest run src/schemas`
Expected: FAIL – không tìm thấy `./customer.js`; test đơn hàng lỗi vì chưa có `customerId`.

- [ ] **Step 4: Viết schema khách hàng**

`shared/src/schemas/customer.ts`:

```ts
import { z } from 'zod';
import { nullableText } from './common.js';
import { MAX_MONEY } from './order.js';

export const customerInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  phone: nullableText(20),
  note: nullableText(200),
});
export type CustomerInput = z.output<typeof customerInputSchema>;
export type CustomerInputBody = z.input<typeof customerInputSchema>;

/** Tạo khách kèm nợ đầu kỳ (chuyển từ sổ giấy). */
export const customerCreateSchema = customerInputSchema.extend({
  openingDebt: z.number().int().min(0).max(MAX_MONEY).default(0),
});
export type CustomerCreate = z.output<typeof customerCreateSchema>;
export type CustomerCreateBody = z.input<typeof customerCreateSchema>;

export const customerPaymentSchema = z.object({
  amount: z.number().int().positive().max(MAX_MONEY),
  method: z.enum(['cash', 'transfer']),
  note: nullableText(200),
});
export type CustomerPayment = z.output<typeof customerPaymentSchema>;
export type CustomerPaymentBody = z.input<typeof customerPaymentSchema>;

/** Ghi nợ tay: dùng khi quên ghi hoặc sửa thu nhầm, nên bắt buộc ghi chú. */
export const customerAdjustmentSchema = z.object({
  amount: z.number().int().positive().max(MAX_MONEY),
  note: z.string().trim().min(1).max(200),
});
export type CustomerAdjustment = z.output<typeof customerAdjustmentSchema>;
export type CustomerAdjustmentBody = z.input<typeof customerAdjustmentSchema>;
```

- [ ] **Step 5: Mở `orderInputSchema` cho ghi nợ**

`shared/src/schemas/order.ts`, trong `orderInputSchema` thay dòng `paymentMethod: z.enum(['cash', 'transfer']),` bằng:

```ts
  paymentMethod: z.enum(['cash', 'transfer', 'debt']),
  /** Chỉ dùng khi ghi nợ; đơn tiền mặt/chuyển khoản bỏ qua. */
  customerId: optionalId,
```

- [ ] **Step 6: Nhãn, types, export**

`shared/src/schemas/common.ts`, thêm vào cuối `FIELD_LABELS` (sau `limit: 'Giới hạn',`):

```ts
  customerId: 'Khách hàng',
  openingDebt: 'Nợ đầu kỳ',
  method: 'Hình thức',
```

`shared/src/types.ts`, thêm cuối file:

```ts
export type DebtTxKind = 'opening' | 'order' | 'order_cancel' | 'payment' | 'manual';
export type CollectMethod = 'cash' | 'transfer';

export interface Customer {
  id: number;
  name: string;
  phone: string | null;
  note: string | null;
  /** Khách đang nợ tiệm (cache của debt_transactions); âm = tiệm nợ lại khách. */
  debt: number;
  isActive: boolean;
}

export interface CustomerList {
  customers: Customer[];
  /** Σ nợ dương của mọi khách đang theo dõi, không phụ thuộc ô tìm. */
  totalDebt: number;
}

export interface CustomerTransaction {
  id: number;
  customerId: number;
  kind: DebtTxKind;
  /** + nợ thêm, − thu nợ / hủy đơn. */
  amount: number;
  method: CollectMethod | null;
  note: string | null;
  orderId: number | null;
  orderCode: string | null;
  createdAt: string;
  /** Số nợ sau giao dịch này. */
  balanceAfter: number;
}

export interface CustomerPaymentResult {
  customer: Customer;
  transaction: CustomerTransaction;
}

/** Nợ của một đơn ghi nợ tại lúc bán. Nợ cũ = balanceAfter − amount. */
export interface OrderDebt {
  amount: number;
  balanceAfter: number;
}
```

`shared/src/index.ts`, thêm sau dòng `export * from './schemas/stocktake.js';`:

```ts
export * from './schemas/customer.js';
```

- [ ] **Step 7: Chạy test shared**

Run: `cd shared && npx vitest run`
Expected: PASS toàn bộ.

- [ ] **Step 8: Build shared**

Run: `npm run build -w shared`
Expected: không lỗi.

---

### Task 2: Migration `0003` và sổ nợ khách (server)

**Files:**
- Modify: `server/src/db/schema.ts` (bảng `customers` +1 dòng, `debtTransactions` +2 dòng)
- Create (sinh tự động): `server/drizzle/0003_*.sql`, `server/drizzle/meta/0003_snapshot.json`; sửa `server/drizzle/meta/_journal.json` (do drizzle-kit)
- Create: `server/src/services/customer-ledger.ts`, `server/src/db/test-migrations.ts`, `server/src/db/migration-0003.test.ts`
- Modify: `server/src/db/migration-0002.test.ts` (chuyển hàm `partialMigrations` sang `test-migrations.ts`)

**Interfaces:**
- Consumes: `DebtTxKind`, `CollectMethod` (Task 1)
- Produces:
  - `recordCustomerDebtTx(tx: DbOrTx, t: CustomerDebtTxInput): number` – trả `id` dòng sổ vừa ghi. `CustomerDebtTxInput = { customerId: number; amount: number; kind: DebtTxKind; orderId?: number|null; method?: CollectMethod|null; note?: string|null; createdAt?: string }`
  - `debtBalanceAt(db: DbOrTx, customerId: number, txId: number): number` – Σ `amount` các dòng của khách có `id ≤ txId`
  - Cột mới: `customers.isActive` (boolean, mặc định true), `debtTransactions.kind` (enum, mặc định `'manual'`), `debtTransactions.method` (enum nullable)

- [ ] **Step 1: Sao lưu DB dev trước khi có migration mới**

Server dev (nếu đang chạy bằng `tsx watch`) sẽ tự chạy `0003` vào `data/grocery.db` khi khởi động lại. Sao một bản trước:

```bash
cd server && node -e "const D=require('better-sqlite3'); new D('../data/grocery.db',{readonly:true}).backup(process.argv[1]).then(()=>console.log('ok'))" "<scratchpad>/grocery-before-0003.db"
```

Expected: in `ok`. (Không có file `data/grocery.db` thì bỏ qua bước này.)

- [ ] **Step 2: Sửa schema**

`server/src/db/schema.ts`, bảng `customers`: thêm sau dòng `note: text('note'),`:

```ts
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
```

Bảng `debtTransactions`: thêm sau dòng `note: text('note'),`:

```ts
    kind: text('kind', { enum: ['opening', 'order', 'order_cancel', 'payment', 'manual'] }).notNull().default('manual'),
    method: text('method', { enum: ['cash', 'transfer'] }), // chỉ dòng thu nợ
```

- [ ] **Step 3: Sinh migration và đọc lại SQL**

Run: `npm run db:generate`
Expected: tạo `server/drizzle/0003_<tên>.sql` với đúng 3 lệnh:

```sql
ALTER TABLE `customers` ADD `is_active` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `debt_transactions` ADD `kind` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `debt_transactions` ADD `method` text;
```

Nếu drizzle-kit sinh câu dựng lại bảng (`CREATE TABLE __new_…`) thay vì `ALTER … ADD` thì dừng lại, kiểm lại Step 2 (không được thêm cột có default là biểu thức như `created_at`).

- [ ] **Step 4: Tách hàm migration dùng chung cho test**

Tạo `server/src/db/test-migrations.ts` (chuyển nguyên từ `migration-0002.test.ts`):

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const migrationsFolder = path.resolve(here, '../../drizzle');

/** Bản sao thư mục migration chỉ giữ `count` migration đầu, giả lập DB của giai đoạn trước. */
export function partialMigrations(count: number): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tiny-pos-mig-'));
  fs.cpSync(migrationsFolder, dir, { recursive: true });
  const journalPath = path.join(dir, 'meta', '_journal.json');
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')) as { entries: unknown[] };
  journal.entries = journal.entries.slice(0, count);
  fs.writeFileSync(journalPath, JSON.stringify(journal));
  return dir;
}
```

Trong `server/src/db/migration-0002.test.ts`, thay khối từ dòng `import fs from 'node:fs';` tới hết hàm `partialMigrations` (dòng 5–22) bằng đúng một dòng:

```ts
import { migrationsFolder, partialMigrations } from './test-migrations.js';
```

Phần `describe('migration 0002', …)` giữ nguyên.

- [ ] **Step 5: Viết test migration `0003`**

`server/src/db/migration-0003.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { migrationsFolder, partialMigrations } from './test-migrations.js';

describe('migration 0003', () => {
  it('chạy được trên DB giai đoạn 3 đã có khách, đơn ghi nợ, sổ nợ; dữ liệu cũ còn nguyên', () => {
    const sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    const db = drizzle(sqlite);
    migrate(db, { migrationsFolder: partialMigrations(3) });
    sqlite.exec(`
      INSERT INTO customers (id, name, phone, debt) VALUES (1, 'Chị Lan', '0909', 50000);
      INSERT INTO orders (id, code, total, paid, payment_method, customer_id) VALUES (1, 'HD-20260929-0001', 50000, 0, 'debt', 1);
      INSERT INTO debt_transactions (customer_id, order_id, amount, note) VALUES (1, 1, 50000, 'cũ');
    `);
    migrate(db, { migrationsFolder });
    expect(sqlite.prepare('SELECT id, name, phone, debt, note, is_active FROM customers').all()).toEqual([
      { id: 1, name: 'Chị Lan', phone: '0909', debt: 50000, note: null, is_active: 1 },
    ]);
    expect(sqlite.prepare('SELECT customer_id, order_id, amount, note, kind, method FROM debt_transactions').all()).toEqual([
      { customer_id: 1, order_id: 1, amount: 50000, note: 'cũ', kind: 'manual', method: null },
    ]);
    expect(sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });
});
```

- [ ] **Step 6: Viết `customer-ledger.ts`**

`server/src/services/customer-ledger.ts`:

```ts
import { and, eq, lte, sql } from 'drizzle-orm';
import type { CollectMethod, DebtTxKind } from '@tiny-pos/shared';
import type { DbOrTx } from '../db/connection.js';
import { customers, debtTransactions } from '../db/schema.js';

export interface CustomerDebtTxInput {
  customerId: number;
  amount: number;
  kind: DebtTxKind;
  orderId?: number | null;
  method?: CollectMethod | null;
  note?: string | null;
  createdAt?: string;
}

/** Cách DUY NHẤT để đổi nợ khách: ghi sổ rồi cộng dồn vào customers.debt. Trả id dòng sổ. */
export function recordCustomerDebtTx(tx: DbOrTx, t: CustomerDebtTxInput): number {
  const { id } = tx
    .insert(debtTransactions)
    .values({
      customerId: t.customerId,
      amount: t.amount,
      kind: t.kind,
      orderId: t.orderId ?? null,
      method: t.method ?? null,
      note: t.note ?? null,
      ...(t.createdAt ? { createdAt: t.createdAt } : {}),
    })
    .returning({ id: debtTransactions.id })
    .get();
  tx.update(customers)
    .set({ debt: sql`${customers.debt} + ${t.amount}` })
    .where(eq(customers.id, t.customerId))
    .run();
  return id;
}

/** Số nợ của khách ngay sau dòng sổ `txId` (dùng cho "nợ cũ / tổng nợ" khi in lại hóa đơn). */
export function debtBalanceAt(db: DbOrTx, customerId: number, txId: number): number {
  const r = db
    .select({ s: sql<number>`coalesce(sum(${debtTransactions.amount}), 0)` })
    .from(debtTransactions)
    .where(and(eq(debtTransactions.customerId, customerId), lte(debtTransactions.id, txId)))
    .get();
  return Number(r?.s ?? 0);
}
```

(Test của hai hàm này nằm ở Task 3.)

- [ ] **Step 7: Chạy test DB**

Run: `cd server && npx vitest run src/db`
Expected: PASS (`migration 0002`, `migration 0003`, `connection.test.ts`).

---

### Task 3: Service khách hàng (server)

**Files:**
- Create: `server/src/services/customers.ts`, `server/src/services/customers.test.ts`

**Interfaces:**
- Consumes: `recordCustomerDebtTx`, `debtBalanceAt` (Task 2); schema/types Task 1; `resolveClock`, `Clock` từ `./daily-code.js`
- Produces:
  - `listCustomers(db: Db, q?: string): CustomerList`
  - `getCustomer(db: DbOrTx, id: number): Customer` (404 "Không tìm thấy khách hàng")
  - `createCustomer(db: Db, input: CustomerCreate): Customer`
  - `updateCustomer(db: Db, id: number, input: CustomerInput): Customer`
  - `deleteCustomer(db: Db, id: number): void`
  - `collectDebt(db: Db, id: number, input: CustomerPayment, clock?: Clock): CustomerPaymentResult`
  - `addManualDebt(db: Db, id: number, input: CustomerAdjustment): Customer`
  - `listCustomerTransactions(db: DbOrTx, id: number): CustomerTransaction[]` (mới nhất trước)

- [ ] **Step 1: Viết test**

`server/src/services/customers.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { customerCreateSchema, customerInputSchema } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { createTestDb } from '../db/test-db.js';
import { debtBalanceAt, recordCustomerDebtTx } from './customer-ledger.js';
import {
  addManualDebt,
  collectDebt,
  createCustomer,
  deleteCustomer,
  getCustomer,
  listCustomerTransactions,
  listCustomers,
  updateCustomer,
} from './customers.js';

let db: Db;
beforeEach(() => {
  db = createTestDb();
});
const make = (o: Record<string, unknown>) => createCustomer(db, customerCreateSchema.parse(o));
/** Bất biến: cache customers.debt luôn bằng tổng sổ. */
const ledgerSum = (id: number) =>
  db.get<{ s: number }>(sql`select coalesce(sum(amount), 0) as s from debt_transactions where customer_id = ${id}`)?.s;

describe('customers', () => {
  it('tạo có nợ đầu kỳ → dòng opening; không nợ đầu kỳ → sổ trống; sửa không đổi nợ', () => {
    const a = make({ name: 'Chị Lan', phone: '0909', openingDebt: 150000 });
    expect(a).toMatchObject({ name: 'Chị Lan', phone: '0909', note: null, debt: 150000, isActive: true });
    expect(listCustomerTransactions(db, a.id).map((t) => [t.kind, t.amount, t.note, t.balanceAfter])).toEqual([
      ['opening', 150000, 'Nợ đầu kỳ', 150000],
    ]);
    const b = make({ name: 'Anh Tư' });
    expect(listCustomerTransactions(db, b.id)).toEqual([]);
    expect(updateCustomer(db, a.id, customerInputSchema.parse({ name: 'Chị Lan chợ' }))).toMatchObject({ name: 'Chị Lan chợ', debt: 150000 });
  });

  it('danh sách: chỉ khách đang theo dõi, nợ nhiều trước; tìm tên có dấu hoặc SĐT; totalDebt không theo q và bỏ nợ âm', () => {
    const lan = make({ name: 'Chị Lan', openingDebt: 50000 });
    const duc = make({ name: 'Đức Tư', phone: '0911', openingDebt: 90000 });
    const ba = make({ name: 'Bà Ba' });
    recordCustomerDebtTx(db, { customerId: ba.id, amount: -20000, kind: 'order_cancel' });
    const old = make({ name: 'Khách cũ' });
    deleteCustomer(db, old.id);
    expect(listCustomers(db).customers.map((c) => c.name)).toEqual(['Đức Tư', 'Chị Lan', 'Bà Ba']);
    expect(listCustomers(db, 'đức').customers.map((c) => c.id)).toEqual([duc.id]);
    expect(listCustomers(db, '0911').customers.map((c) => c.id)).toEqual([duc.id]);
    expect(listCustomers(db, 'lan')).toMatchObject({ customers: [{ id: lan.id }], totalDebt: 140000 });
  });

  it('thu nợ: trả kèm dòng sổ + số dư; ghi chú mặc định "Thu nợ"; thời gian theo clock', () => {
    const c = make({ name: 'Chị Lan', openingDebt: 50000 });
    const r = collectDebt(db, c.id, { amount: 30000, method: 'transfer', note: null }, { now: new Date('2026-09-29T03:00:00.000Z') });
    expect(r.customer.debt).toBe(20000);
    expect(r.transaction).toMatchObject({
      kind: 'payment',
      amount: -30000,
      method: 'transfer',
      note: 'Thu nợ',
      balanceAfter: 20000,
      createdAt: '2026-09-29T03:00:00.000Z',
    });
    expect(collectDebt(db, c.id, { amount: 5000, method: 'cash', note: 'Con trả hộ' }).transaction.note).toBe('Con trả hộ');
  });

  it('thu vượt nợ → 400; thu/ghi tay khách đã xóa → 400; khách không có → 404', () => {
    const c = make({ name: 'Chị Lan', openingDebt: 10000 });
    expect(() => collectDebt(db, c.id, { amount: 10001, method: 'cash', note: null })).toThrow('Thu nhiều hơn số đang nợ');
    collectDebt(db, c.id, { amount: 10000, method: 'cash', note: null });
    deleteCustomer(db, c.id);
    expect(() => collectDebt(db, c.id, { amount: 1, method: 'cash', note: null })).toThrow('Khách hàng không còn theo dõi');
    expect(() => addManualDebt(db, c.id, { amount: 1, note: 'x' })).toThrow('Khách hàng không còn theo dõi');
    expect(() => getCustomer(db, 999)).toThrow('Không tìm thấy khách hàng');
  });

  it('ghi nợ tay cộng nợ với ghi chú; xóa khi còn nợ (kể cả âm) → 409; hết nợ thì xóa mềm', () => {
    const c = make({ name: 'Chị Lan' });
    expect(addManualDebt(db, c.id, { amount: 7000, note: 'Quên ghi gói thuốc' }).debt).toBe(7000);
    expect(listCustomerTransactions(db, c.id)[0]).toMatchObject({ kind: 'manual', amount: 7000, note: 'Quên ghi gói thuốc', method: null });
    expect(() => deleteCustomer(db, c.id)).toThrow('Còn nợ, không xóa được');
    recordCustomerDebtTx(db, { customerId: c.id, amount: -8000, kind: 'order_cancel' });
    expect(() => deleteCustomer(db, c.id)).toThrow('Còn nợ, không xóa được');
    recordCustomerDebtTx(db, { customerId: c.id, amount: 1000, kind: 'manual', note: 'bù' });
    deleteCustomer(db, c.id);
    expect(getCustomer(db, c.id).isActive).toBe(false);
  });

  it('sổ nợ mới nhất trước, số dư từng dòng; debtBalanceAt; cache debt = tổng sổ', () => {
    const c = make({ name: 'Chị Lan', openingDebt: 100000 });
    const t2 = recordCustomerDebtTx(db, { customerId: c.id, amount: 20000, kind: 'manual', note: 'a' });
    collectDebt(db, c.id, { amount: 50000, method: 'cash', note: null });
    expect(listCustomerTransactions(db, c.id).map((t) => [t.kind, t.amount, t.balanceAfter])).toEqual([
      ['payment', -50000, 70000],
      ['manual', 20000, 120000],
      ['opening', 100000, 100000],
    ]);
    expect(debtBalanceAt(db, c.id, t2)).toBe(120000);
    expect(getCustomer(db, c.id).debt).toBe(ledgerSum(c.id));
  });
});
```

- [ ] **Step 2: Chạy test, thấy lỗi**

Run: `cd server && npx vitest run src/services/customers.test.ts`
Expected: FAIL – không tìm thấy `./customers.js`.

- [ ] **Step 3: Viết service**

`server/src/services/customers.ts`:

```ts
import { asc, desc, eq } from 'drizzle-orm';
import type {
  Customer,
  CustomerAdjustment,
  CustomerCreate,
  CustomerInput,
  CustomerList,
  CustomerPayment,
  CustomerPaymentResult,
  CustomerTransaction,
} from '@tiny-pos/shared';
import type { Db, DbOrTx } from '../db/connection.js';
import { customers, debtTransactions, orders } from '../db/schema.js';
import { BadRequestError, ConflictError, NotFoundError } from '../errors.js';
import { recordCustomerDebtTx } from './customer-ledger.js';
import { resolveClock, type Clock } from './daily-code.js';

/** Lọc bằng JS vì LIKE của SQLite không bỏ hoa/thường với chữ có dấu ("đức" ≠ "Đức"). */
export function listCustomers(db: Db, q?: string): CustomerList {
  const rows = db
    .select()
    .from(customers)
    .where(eq(customers.isActive, true))
    .orderBy(desc(customers.debt), asc(customers.name))
    .all();
  const totalDebt = rows.reduce((s, c) => s + Math.max(0, c.debt), 0);
  const t = q?.trim().toLowerCase();
  if (!t) return { customers: rows, totalDebt };
  return { customers: rows.filter((c) => c.name.toLowerCase().includes(t) || (c.phone?.includes(t) ?? false)), totalDebt };
}

export function getCustomer(db: DbOrTx, id: number): Customer {
  const c = db.select().from(customers).where(eq(customers.id, id)).get();
  if (!c) throw new NotFoundError('Không tìm thấy khách hàng');
  return c;
}

function activeCustomer(db: DbOrTx, id: number): Customer {
  const c = getCustomer(db, id);
  if (!c.isActive) throw new BadRequestError('Khách hàng không còn theo dõi');
  return c;
}

export function createCustomer(db: Db, input: CustomerCreate): Customer {
  const { openingDebt, ...fields } = input;
  return db.transaction((tx) => {
    const { id } = tx.insert(customers).values(fields).returning({ id: customers.id }).get();
    if (openingDebt > 0) recordCustomerDebtTx(tx, { customerId: id, amount: openingDebt, kind: 'opening', note: 'Nợ đầu kỳ' });
    return getCustomer(tx, id);
  });
}

export function updateCustomer(db: Db, id: number, input: CustomerInput): Customer {
  getCustomer(db, id);
  db.update(customers).set(input).where(eq(customers.id, id)).run();
  return getCustomer(db, id);
}

/** Xóa mềm; còn nợ (kể cả âm) thì không cho, để sổ nợ không bị "treo". */
export function deleteCustomer(db: Db, id: number): void {
  const c = getCustomer(db, id);
  if (c.debt !== 0) throw new ConflictError('Còn nợ, không xóa được');
  db.update(customers).set({ isActive: false }).where(eq(customers.id, id)).run();
}

export function collectDebt(db: Db, id: number, input: CustomerPayment, clock?: Clock): CustomerPaymentResult {
  const { now } = resolveClock(clock);
  return db.transaction((tx) => {
    const c = activeCustomer(tx, id);
    if (input.amount > c.debt) throw new BadRequestError('Thu nhiều hơn số đang nợ');
    recordCustomerDebtTx(tx, {
      customerId: id,
      amount: -input.amount,
      kind: 'payment',
      method: input.method,
      note: input.note ?? 'Thu nợ',
      createdAt: now.toISOString(),
    });
    return { customer: getCustomer(tx, id), transaction: listCustomerTransactions(tx, id)[0]! };
  });
}

export function addManualDebt(db: Db, id: number, input: CustomerAdjustment): Customer {
  return db.transaction((tx) => {
    activeCustomer(tx, id);
    recordCustomerDebtTx(tx, { customerId: id, amount: input.amount, kind: 'manual', note: input.note });
    return getCustomer(tx, id);
  });
}

/** Sổ nợ mới nhất trước, kèm số dư sau từng giao dịch và mã hóa đơn nếu có. */
export function listCustomerTransactions(db: DbOrTx, id: number): CustomerTransaction[] {
  getCustomer(db, id);
  const rows = db
    .select({
      id: debtTransactions.id,
      customerId: debtTransactions.customerId,
      kind: debtTransactions.kind,
      amount: debtTransactions.amount,
      method: debtTransactions.method,
      note: debtTransactions.note,
      orderId: debtTransactions.orderId,
      orderCode: orders.code,
      createdAt: debtTransactions.createdAt,
    })
    .from(debtTransactions)
    .leftJoin(orders, eq(debtTransactions.orderId, orders.id))
    .where(eq(debtTransactions.customerId, id))
    .orderBy(asc(debtTransactions.id))
    .all();
  let balance = 0;
  return rows.map((r) => ({ ...r, balanceAfter: (balance += r.amount) })).reverse();
}
```

- [ ] **Step 4: Chạy test**

Run: `cd server && npx vitest run src/services/customers.test.ts`
Expected: PASS.

---

### Task 4: Đơn ghi nợ, hủy đơn ghi nợ, tổng kết ngày (server)

**Files:**
- Modify: `shared/src/types.ts` (`OrderSummary`, `OrderDetail`, `DaySummary`)
- Modify: `server/src/services/orders.ts`
- Modify: `server/src/services/orders.test.ts` (import, 1 assertion cũ, thêm `describe` mới)
- Modify: `server/src/routes/orders-api.test.ts` (1 assertion cũ)

**Interfaces:**
- Consumes: `recordCustomerDebtTx`, `debtBalanceAt` (Task 2); `createCustomer`, `collectDebt`, `deleteCustomer`, `getCustomer`, `listCustomerTransactions` (Task 3, chỉ trong test)
- Produces:
  - `OrderSummary` thêm `customerId: number | null`, `customerName: string | null`
  - `OrderDetail` thêm `debt: OrderDebt | null`
  - `DaySummary` thêm `debt: number`, `debtCollected: { cash: number; transfer: number }`; `cash` = đơn tiền mặt + phần trả trước của đơn ghi nợ

- [ ] **Step 1: Sửa types**

`shared/src/types.ts`:

Trong `OrderSummary`, thêm sau dòng `paymentMethod: PaymentMethod;`:

```ts
  /** Chỉ đơn ghi nợ có khách; tên lấy theo tên hiện tại của khách. */
  customerId: number | null;
  customerName: string | null;
```

Thay `OrderDetail`:

```ts
export interface OrderDetail extends OrderSummary {
  items: OrderItem[];
  /** Đơn ghi nợ: số nợ của đơn và tổng nợ của khách ngay sau đơn; đơn khác: null. */
  debt: OrderDebt | null;
}
```

Thay `DaySummary`:

```ts
export interface DaySummary {
  count: number;
  total: number;
  /** Đơn tiền mặt + phần khách trả trước của đơn ghi nợ. */
  cash: number;
  transfer: number;
  /** Số ghi nợ mới trong ngày; total = cash + transfer + debt. */
  debt: number;
  /** Thu nợ trong ngày theo hình thức (không tính vào total). */
  debtCollected: { cash: number; transfer: number };
}
```

Run: `npm run build -w shared`

- [ ] **Step 2: Viết test đơn ghi nợ**

`server/src/services/orders.test.ts`:

Thêm vào khối import (sau dòng `import { createProduct, … } from './products.js';`):

```ts
import { collectDebt, createCustomer, deleteCustomer, getCustomer, listCustomerTransactions } from './customers.js';
```

và trong dòng `import { orderInputSchema, productInputSchema, productUnitInputSchema } from '@tiny-pos/shared';` thêm `customerCreateSchema`:

```ts
import { customerCreateSchema, orderInputSchema, productInputSchema, productUnitInputSchema } from '@tiny-pos/shared';
```

Trong test `listOrders` có sẵn, thay dòng `expect(r.summary).toEqual({ count: 2, total: 20000, cash: 10000, transfer: 10000 });` bằng:

```ts
    expect(r.summary).toEqual({ count: 2, total: 20000, cash: 10000, transfer: 10000, debt: 0, debtCollected: { cash: 0, transfer: 0 } });
```

Thêm cuối file:

```ts
describe('đơn ghi nợ', () => {
  const customer = (openingDebt = 0) => createCustomer(db, customerCreateSchema.parse({ name: 'Chị Lan', openingDebt }));
  const debtOrder = (customerId: number | null, paid: number, clock = MORNING) =>
    createOrder(db, order({ items: [{ qty: 1, price: 50000 }], paymentMethod: 'debt', customerId, paid }), clock);

  it('trả 0 và trả một phần: nợ tăng đúng phần thiếu, dòng sổ order, chi tiết có khách và nợ', () => {
    const c = customer(100000);
    const a = debtOrder(c.id, 0);
    const b = debtOrder(c.id, 20000);
    expect(a.debt).toEqual({ amount: 50000, balanceAfter: 150000 });
    expect(b).toMatchObject({
      paymentMethod: 'debt',
      paid: 20000,
      customerId: c.id,
      customerName: 'Chị Lan',
      debt: { amount: 30000, balanceAfter: 180000 },
    });
    expect(getCustomer(db, c.id).debt).toBe(180000);
    expect(listCustomerTransactions(db, c.id)[0]).toMatchObject({
      kind: 'order',
      amount: 30000,
      orderId: b.id,
      orderCode: b.code,
      note: `Bán ${b.code}`,
      createdAt: '2026-09-29T03:00:00.000Z',
    });
  });

  it('thiếu khách, khách không có/đã xóa, trả đủ → 400 và không lưu đơn', () => {
    const c = customer(100000);
    expect(() => debtOrder(null, 0)).toThrow('Chưa chọn khách');
    expect(() => debtOrder(999, 0)).toThrow('Khách hàng không còn theo dõi');
    expect(() => debtOrder(c.id, 50000)).toThrow('Khách trả đủ thì chọn Tiền mặt');
    collectDebt(db, c.id, { amount: 100000, method: 'cash', note: null });
    deleteCustomer(db, c.id);
    expect(() => debtOrder(c.id, 0)).toThrow('Khách hàng không còn theo dõi');
    expect(listOrders(db, '2026-09-29', { tzOffsetMin: VN }).orders).toEqual([]);
  });

  it('đơn tiền mặt gửi kèm customerId → không gắn khách, không ghi nợ', () => {
    const c = customer();
    const o = createOrder(db, order({ items: [{ qty: 1, price: 10000 }], customerId: c.id }), MORNING);
    expect(o).toMatchObject({ customerId: null, customerName: null, debt: null });
    expect(getCustomer(db, c.id).debt).toBe(0);
  });

  it('hủy đơn ghi nợ: dòng order_cancel trừ đúng phần nợ; thu hết rồi hủy → nợ âm; in lại vẫn số lúc bán', () => {
    const c = customer();
    const o = debtOrder(c.id, 10000); // nợ 40.000
    collectDebt(db, c.id, { amount: 40000, method: 'cash', note: null });
    const x = cancelOrder(db, o.id, MORNING);
    expect(getCustomer(db, c.id).debt).toBe(-40000);
    expect(x.debt).toEqual({ amount: 40000, balanceAfter: 40000 });
    expect(listCustomerTransactions(db, c.id)[0]).toMatchObject({ kind: 'order_cancel', amount: -40000, orderId: o.id, note: `Hủy ${o.code}` });
  });

  it('hủy đơn ghi nợ của khách đã ngừng theo dõi vẫn được', () => {
    const c = customer();
    const o = debtOrder(c.id, 0);
    collectDebt(db, c.id, { amount: 50000, method: 'cash', note: null });
    deleteCustomer(db, c.id);
    expect(cancelOrder(db, o.id, MORNING).status).toBe('cancelled');
    expect(getCustomer(db, c.id).debt).toBe(-50000);
  });

  it('in lại sau nhiều giao dịch khác của khách vẫn ra nợ cũ / tổng nợ lúc bán', () => {
    const c = customer(100000);
    const a = debtOrder(c.id, 0); // 150.000
    collectDebt(db, c.id, { amount: 70000, method: 'cash', note: null }); // 80.000
    debtOrder(c.id, 0); // 130.000
    expect(getOrder(db, a.id).debt).toEqual({ amount: 50000, balanceAfter: 150000 });
  });

  it('tổng kết ngày VN: total = cash + transfer + debt; thu nợ tách TM/CK, không tính ngày khác', () => {
    const c = customer(200000);
    const item = { items: [{ qty: 1, price: 10000 }] };
    createOrder(db, order(item), MORNING);
    createOrder(db, order({ ...item, paymentMethod: 'transfer' }), MORNING);
    createOrder(db, order({ ...item, paymentMethod: 'debt', customerId: c.id, paid: 4000 }), MORNING);
    const cancelled = createOrder(db, order({ ...item, paymentMethod: 'debt', customerId: c.id, paid: 0 }), MORNING);
    cancelOrder(db, cancelled.id, MORNING);
    collectDebt(db, c.id, { amount: 50000, method: 'cash', note: null }, MORNING);
    collectDebt(db, c.id, { amount: 30000, method: 'transfer', note: null }, MORNING);
    collectDebt(db, c.id, { amount: 1000, method: 'cash', note: null }, at('2026-09-28T16:59:59.000Z')); // 23:59 ngày 28 VN
    expect(listOrders(db, '2026-09-29', { tzOffsetMin: VN }).summary).toEqual({
      count: 3,
      total: 30000,
      cash: 14000,
      transfer: 10000,
      debt: 6000,
      debtCollected: { cash: 50000, transfer: 30000 },
    });
  });
});
```

`server/src/routes/orders-api.test.ts`, thay dòng `expect(today.json.summary).toEqual({ count: 1, total: 12000, cash: 12000, transfer: 0 });` bằng:

```ts
    expect(today.json.summary).toEqual({ count: 1, total: 12000, cash: 12000, transfer: 0, debt: 0, debtCollected: { cash: 0, transfer: 0 } });
```

- [ ] **Step 3: Chạy test, thấy lỗi**

Run: `cd server && npx vitest run src/services/orders.test.ts`
Expected: FAIL – các test ghi nợ và tổng kết (chưa có `customerName`, `debt`, …).

- [ ] **Step 4: Sửa `orders.ts`**

`server/src/services/orders.ts`:

Import: trong khối `from '@tiny-pos/shared'` thêm `type OrderDebt,` (sau `type OrderDetail,`). Thay dòng import schema và thêm import ledger:

```ts
import { customers, debtTransactions, orderItems, orders, productUnits, products } from '../db/schema.js';
```

```ts
import { debtBalanceAt, recordCustomerDebtTx } from './customer-ledger.js';
```

(đặt ngay sau dòng `import { recordMovement } from './stock.js';`)

Thay hàm `toSummary`:

```ts
function toSummary(o: OrderRow, itemCount: number, customerName: string | null): OrderSummary {
  return {
    id: o.id,
    code: o.code,
    total: o.total,
    discount: o.discount,
    payable: o.total - o.discount,
    paid: o.paid,
    paymentMethod: o.paymentMethod,
    customerId: o.customerId,
    customerName,
    status: o.status,
    itemCount,
    createdAt: o.createdAt,
    cancelledAt: o.cancelledAt,
  };
}

/** Nợ của đơn ghi nợ tại lúc bán: lấy dòng sổ `order` của đơn và số dư của khách ngay sau dòng đó. */
function orderDebt(db: DbOrTx, o: OrderRow): OrderDebt | null {
  if (o.paymentMethod !== 'debt') return null;
  const t = db
    .select()
    .from(debtTransactions)
    .where(and(eq(debtTransactions.orderId, o.id), eq(debtTransactions.kind, 'order')))
    .get();
  return t ? { amount: t.amount, balanceAfter: debtBalanceAt(db, t.customerId, t.id) } : null;
}
```

Trong `getOrder`, thay hai dòng đầu:

```ts
  const r = db
    .select({ order: orders, customerName: customers.name })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(orders.id, id))
    .get();
  if (!r) throw new NotFoundError('Không tìm thấy hóa đơn');
  const o = r.order;
```

và dòng `return`:

```ts
  return { ...toSummary(o, items.length, r.customerName), items, debt: orderDebt(db, o) };
```

Trong `createOrder`, thay đoạn từ `if (input.paymentMethod === 'cash' && input.paid < payable) …` tới hết `.get();` của insert bằng:

```ts
    if (input.paymentMethod === 'cash' && input.paid < payable) throw new BadRequestError('Tiền khách đưa chưa đủ');
    let customerId: number | null = null;
    if (input.paymentMethod === 'debt') {
      if (input.customerId === null) throw new BadRequestError('Chưa chọn khách');
      const c = tx.select().from(customers).where(eq(customers.id, input.customerId)).get();
      if (!c || !c.isActive) throw new BadRequestError('Khách hàng không còn theo dõi');
      if (input.paid >= payable) throw new BadRequestError('Khách trả đủ thì chọn Tiền mặt');
      customerId = c.id;
    }
    // Ghi nợ: paid là tiền mặt khách trả trước; chuyển khoản luôn đủ
    const paid = input.paymentMethod === 'transfer' ? payable : input.paid;
    const code = nextDailyCode(tx, 'orders', 'HD', localDate(now, tz), 4);
    const { id } = tx
      .insert(orders)
      .values({
        code,
        total,
        discount: input.discount,
        paid,
        paymentMethod: input.paymentMethod,
        customerId,
        createdAt: now.toISOString(),
      })
      .returning({ id: orders.id })
      .get();
```

Sau vòng `for (const l of lines) { … }` (trước `return getOrder(tx, id);`) thêm:

```ts
    if (customerId !== null)
      recordCustomerDebtTx(tx, { customerId, amount: payable - paid, kind: 'order', orderId: id, note: `Bán ${code}`, createdAt: now.toISOString() });
```

Trong `listOrders`, thay khối `const list = db … ;` tới hết `return { … };` bằng:

```ts
  const list = db
    .select({ order: orders, itemCount, customerName: customers.name })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(and(gte(orders.createdAt, start), lt(orders.createdAt, end)))
    .orderBy(desc(orders.id))
    .all()
    .map((r) => toSummary(r.order, Number(r.itemCount), r.customerName));
  const done = list.filter((o) => o.status === 'done');
  const sum = (rows: OrderSummary[]) => rows.reduce((s, o) => s + o.payable, 0);
  const debtOrders = done.filter((o) => o.paymentMethod === 'debt');
  const collected = db
    .select({ method: debtTransactions.method, amount: debtTransactions.amount })
    .from(debtTransactions)
    .where(and(eq(debtTransactions.kind, 'payment'), gte(debtTransactions.createdAt, start), lt(debtTransactions.createdAt, end)))
    .all();
  const collectedBy = (m: 'cash' | 'transfer') => collected.filter((r) => r.method === m).reduce((s, r) => s - r.amount, 0);
  return {
    orders: list,
    summary: {
      count: done.length,
      total: sum(done),
      cash: sum(done.filter((o) => o.paymentMethod === 'cash')) + debtOrders.reduce((s, o) => s + o.paid, 0),
      transfer: sum(done.filter((o) => o.paymentMethod === 'transfer')),
      debt: debtOrders.reduce((s, o) => s + o.payable - o.paid, 0),
      debtCollected: { cash: collectedBy('cash'), transfer: collectedBy('transfer') },
    },
  };
```

Trong `cancelOrder`, sau vòng `for (const it of o.items) { … }` thêm:

```ts
    if (o.paymentMethod === 'debt' && o.customerId !== null && o.payable > o.paid)
      recordCustomerDebtTx(tx, {
        customerId: o.customerId,
        amount: -(o.payable - o.paid),
        kind: 'order_cancel',
        orderId: id,
        note: `Hủy ${o.code}`,
        createdAt: now.toISOString(),
      });
```

- [ ] **Step 5: Chạy test**

Run: `cd server && npx vitest run src/services`
Expected: PASS toàn bộ (kể cả test đơn hàng cũ).

---

### Task 5: API khách hàng (server)

**Files:**
- Create: `server/src/routes/customers.ts`, `server/src/routes/customers-api.test.ts`
- Modify: `server/src/routes/index.ts` (2 dòng)

**Interfaces:**
- Consumes: service Task 3; schema Task 1
- Produces: `GET/POST /api/customers`, `PUT/DELETE /api/customers/:id`, `GET /api/customers/:id/transactions`, `POST /api/customers/:id/payments` → `CustomerPaymentResult`, `POST /api/customers/:id/adjustments` → `Customer`

- [ ] **Step 1: Viết test API**

`server/src/routes/customers-api.test.ts`:

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

describe('API khách hàng và ghi nợ', () => {
  it('nợ đầu kỳ → bán ghi nợ → thu nợ CK → ghi tay → sổ nợ, tổng kết → hủy đơn → xóa còn nợ 409', async () => {
    const c = await call('POST', '/api/customers', { name: 'Chị Lan', phone: '0909', openingDebt: 100000 });
    expect(c.status).toBe(201);
    expect(c.json).toMatchObject({ name: 'Chị Lan', debt: 100000, isActive: true });
    const id = c.json.id;

    const o = await call('POST', '/api/orders', {
      items: [{ name: 'Gạo', qty: 1, price: 50000 }],
      paymentMethod: 'debt',
      customerId: id,
      paid: 20000,
    });
    expect(o.status).toBe(201);
    expect(o.json).toMatchObject({ paymentMethod: 'debt', customerName: 'Chị Lan', paid: 20000, debt: { amount: 30000, balanceAfter: 130000 } });

    const pay = await call('POST', `/api/customers/${id}/payments`, { amount: 50000, method: 'transfer' });
    expect(pay.status).toBe(200);
    expect(pay.json).toMatchObject({
      customer: { debt: 80000 },
      transaction: { kind: 'payment', amount: -50000, method: 'transfer', note: 'Thu nợ', balanceAfter: 80000 },
    });
    expect((await call('POST', `/api/customers/${id}/adjustments`, { amount: 5000, note: 'Quên ghi gói thuốc' })).json.debt).toBe(85000);

    expect((await call('GET', '/api/customers?q=lan')).json).toMatchObject({ totalDebt: 85000, customers: [{ id, debt: 85000 }] });
    const tx = await call('GET', `/api/customers/${id}/transactions`);
    expect(tx.json.map((t: { kind: string }) => t.kind)).toEqual(['manual', 'payment', 'order', 'opening']);
    expect(tx.json[2].orderCode).toBe(o.json.code);

    const day = await call('GET', '/api/orders');
    expect(day.json.summary).toMatchObject({ total: 50000, cash: 20000, transfer: 0, debt: 30000, debtCollected: { cash: 0, transfer: 50000 } });
    expect(day.json.orders[0]).toMatchObject({ customerId: id, customerName: 'Chị Lan' });

    expect((await call('POST', `/api/orders/${o.json.id}/cancel`)).json.status).toBe('cancelled');
    expect((await call('GET', `/api/customers/${id}/transactions`)).json[0]).toMatchObject({ kind: 'order_cancel', amount: -30000 });
    expect(await call('DELETE', `/api/customers/${id}`)).toEqual({ status: 409, json: { error: 'Còn nợ, không xóa được' } });
  });

  it('sửa khách; hết nợ thì xóa được (204) và không còn trong danh sách', async () => {
    const c = await call('POST', '/api/customers', { name: 'Anh Tư' });
    expect((await call('PUT', `/api/customers/${c.json.id}`, { name: 'Anh Tư xe ôm', phone: '0911' })).json).toMatchObject({
      name: 'Anh Tư xe ôm',
      phone: '0911',
      debt: 0,
    });
    expect((await call('DELETE', `/api/customers/${c.json.id}`)).status).toBe(204);
    const list = await call('GET', '/api/customers');
    expect(list.json.customers.map((x: { id: number }) => x.id)).not.toContain(c.json.id);
  });

  it('400 có nhãn tiếng Việt, không ghi sổ; 404 khách lạ', async () => {
    const big = await call('POST', '/api/customers', { name: 'A', openingDebt: 1_000_000_001 });
    expect(big.status).toBe(400);
    expect(big.json.error).toContain('Nợ đầu kỳ');
    const c = await call('POST', '/api/customers', { name: 'Bà Ba', openingDebt: 10000 });
    const noNote = await call('POST', `/api/customers/${c.json.id}/adjustments`, { amount: 1000, note: '   ' });
    expect(noNote.status).toBe(400);
    expect(noNote.json.error).toContain('Ghi chú');
    const frac = await call('POST', `/api/customers/${c.json.id}/payments`, { amount: 1.5, method: 'cash' });
    expect(frac.status).toBe(400);
    expect(frac.json.error).toContain('Số tiền');
    const badMethod = await call('POST', `/api/customers/${c.json.id}/payments`, { amount: 1000, method: 'card' });
    expect(badMethod.json.error).toContain('Hình thức');
    expect((await call('POST', `/api/customers/${c.json.id}/payments`, { amount: 10001, method: 'cash' })).json).toEqual({
      error: 'Thu nhiều hơn số đang nợ',
    });
    expect((await call('GET', `/api/customers/${c.json.id}/transactions`)).json).toHaveLength(1);
    expect((await call('POST', '/api/orders', { items: [{ qty: 1, price: 1000 }], paymentMethod: 'debt' })).json).toEqual({
      error: 'Chưa chọn khách',
    });
    expect((await call('GET', '/api/customers/9999/transactions')).status).toBe(404);
  });
});
```

- [ ] **Step 2: Chạy test, thấy lỗi**

Run: `cd server && npx vitest run src/routes/customers-api.test.ts`
Expected: FAIL – `/api/customers` trả 404.

- [ ] **Step 3: Viết router**

`server/src/routes/customers.ts`:

```ts
import { Router } from 'express';
import { customerAdjustmentSchema, customerCreateSchema, customerInputSchema, customerPaymentSchema } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { intParam, validateBody } from '../middleware/validate.js';
import {
  addManualDebt,
  collectDebt,
  createCustomer,
  deleteCustomer,
  listCustomerTransactions,
  listCustomers,
  updateCustomer,
} from '../services/customers.js';

export function customersRouter(db: Db): Router {
  const r = Router();
  r.get('/', (req, res) => res.json(listCustomers(db, typeof req.query['q'] === 'string' ? req.query['q'] : undefined)));
  r.post('/', validateBody(customerCreateSchema), (req, res) => res.status(201).json(createCustomer(db, req.body)));
  r.put('/:id', validateBody(customerInputSchema), (req, res) => res.json(updateCustomer(db, intParam(req, 'id'), req.body)));
  r.delete('/:id', (req, res) => {
    deleteCustomer(db, intParam(req, 'id'));
    res.status(204).end();
  });
  r.get('/:id/transactions', (req, res) => res.json(listCustomerTransactions(db, intParam(req, 'id'))));
  r.post('/:id/payments', validateBody(customerPaymentSchema), (req, res) => res.json(collectDebt(db, intParam(req, 'id'), req.body)));
  r.post('/:id/adjustments', validateBody(customerAdjustmentSchema), (req, res) =>
    res.json(addManualDebt(db, intParam(req, 'id'), req.body)),
  );
  return r;
}
```

`server/src/routes/index.ts`: thêm import sau dòng `import { suppliersRouter } from './suppliers.js';`:

```ts
import { customersRouter } from './customers.js';
```

và sau dòng `r.use('/suppliers', suppliersRouter(db));`:

```ts
  r.use('/customers', customersRouter(db));
```

- [ ] **Step 4: Chạy toàn bộ test và typecheck server**

Run: `npm test && npm run build -w shared && npm run typecheck -w server`
Expected: PASS; typecheck server không lỗi.

---

### Task 6: Tab *Ghi nợ* trong hộp thanh toán (client)

**Files:**
- Create: `client/src/api/customers.ts`, `client/src/components/TransferQr.tsx`, `client/src/pages/customers/CustomerPicker.tsx`, `client/src/pages/sell/DebtPanel.tsx`
- Modify: `client/src/api/orders.ts` (1 dòng), `client/src/pages/sell/CheckoutDialog.tsx`, `client/src/pages/sell/CheckoutPanel.tsx` (1 dòng), `client/src/pages/sell/SaleResult.tsx` (khối không phải tiền mặt)

**Interfaces:**
- Consumes: types/schema Task 1, 4; API Task 5
- Produces:
  - Hooks: `useCustomers()` (`CustomerList`), `useCustomerTransactions(id: number | null)`, `useCreateCustomer()` (`CustomerCreateBody` → `Customer`), `useUpdateCustomer()` (`CustomerInputBody & { id }`), `useDeleteCustomer()` (`id`), `useCollectDebt()` (`CustomerPaymentBody & { id }` → `CustomerPaymentResult`), `useAddManualDebt()` (`CustomerAdjustmentBody & { id }` → `Customer`)
  - `<TransferQr amount={number} />` – QR VietQR + tài khoản nhận, nhắc mở Cài đặt khi thiếu
  - `<CustomerPicker value={Customer | null} onChange={(c: Customer) => void} onPicked?={() => void} />`

- [ ] **Step 1: Hooks API**

`client/src/api/customers.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Customer,
  CustomerAdjustmentBody,
  CustomerCreateBody,
  CustomerInputBody,
  CustomerList,
  CustomerPaymentBody,
  CustomerPaymentResult,
  CustomerTransaction,
} from '@tiny-pos/shared';
import { api } from './client';

export const useCustomers = () => useQuery({ queryKey: ['customers'], queryFn: () => api<CustomerList>('/customers') });

export const useCustomerTransactions = (id: number | null) =>
  useQuery({
    queryKey: ['customers', 'tx', id],
    queryFn: () => api<CustomerTransaction[]>(`/customers/${id}/transactions`),
    enabled: id !== null,
  });

/** Nợ khách đổi thì tổng kết ngày (thu nợ) cũng đổi. */
function useInvalidateCustomers() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['customers'] });
    void qc.invalidateQueries({ queryKey: ['orders'] });
  };
}

export function useCreateCustomer() {
  const invalidate = useInvalidateCustomers();
  return useMutation({ mutationFn: (input: CustomerCreateBody) => api<Customer>('/customers', { json: input }), onSuccess: invalidate });
}

export function useUpdateCustomer() {
  const invalidate = useInvalidateCustomers();
  return useMutation({
    mutationFn: ({ id, ...input }: CustomerInputBody & { id: number }) => api<Customer>(`/customers/${id}`, { method: 'PUT', json: input }),
    onSuccess: invalidate,
  });
}

export function useDeleteCustomer() {
  const invalidate = useInvalidateCustomers();
  return useMutation({ mutationFn: (id: number) => api<void>(`/customers/${id}`, { method: 'DELETE' }), onSuccess: invalidate });
}

export function useCollectDebt() {
  const invalidate = useInvalidateCustomers();
  return useMutation({
    mutationFn: ({ id, ...body }: CustomerPaymentBody & { id: number }) =>
      api<CustomerPaymentResult>(`/customers/${id}/payments`, { json: body }),
    onSuccess: invalidate,
  });
}

export function useAddManualDebt() {
  const invalidate = useInvalidateCustomers();
  return useMutation({
    mutationFn: ({ id, ...body }: CustomerAdjustmentBody & { id: number }) => api<Customer>(`/customers/${id}/adjustments`, { json: body }),
    onSuccess: invalidate,
  });
}
```

`client/src/api/orders.ts`, trong `useInvalidateSales` thêm sau dòng `void qc.invalidateQueries({ queryKey: ['products'] });`:

```ts
    void qc.invalidateQueries({ queryKey: ['customers'] }); // đơn ghi nợ / hủy đơn đổi nợ khách
```

- [ ] **Step 2: Tách `TransferQr` (chuyển nguyên phần QR từ `CheckoutDialog`)**

`client/src/components/TransferQr.tsx`:

```tsx
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Link } from 'react-router';
import { BANKS, vietQrFromSettings } from '@tiny-pos/shared';
import { useSettings } from '@/api/settings';

/** Mã VietQR đúng số tiền + tài khoản nhận; thiếu cài đặt ngân hàng thì nhắc mở Cài đặt. */
export function TransferQr({ amount }: { amount: number }) {
  const { data: settings } = useSettings();
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);
  const qrPayload = settings ? vietQrFromSettings(settings, amount) : null;
  const bank = BANKS.find((b) => b.bin === settings?.bankBin);
  // Nhắc theo trường còn thiếu trong Cài đặt (không dựa vào qrUrl để tránh chớp trong lúc QR đang sinh)
  const missing = !settings ? null : !settings.bankBin ? 'Chưa chọn ngân hàng' : !settings.bankAccount ? 'Chưa nhập số tài khoản' : null;

  useEffect(() => {
    setQrError(false);
    if (!qrPayload) {
      setQrUrl(null);
      return;
    }
    let alive = true;
    QRCode.toDataURL(qrPayload, { margin: 1, width: 320 })
      .then((u) => alive && setQrUrl(u))
      .catch(() => alive && setQrError(true));
    return () => {
      alive = false;
    };
  }, [qrPayload]);

  return (
    <>
      {qrUrl ? (
        <img src={qrUrl} alt="Mã VietQR" className="mx-auto size-64 rounded-xl border bg-white p-2" />
      ) : missing || qrError ? (
        <p className="rounded-xl bg-muted px-4 py-6 text-muted-foreground">
          {missing ?? 'Không tạo được mã QR'}.{' '}
          <Link to="/settings" className="font-medium text-primary underline">
            Mở Cài đặt
          </Link>
        </p>
      ) : (
        <div className="mx-auto size-64 animate-pulse rounded-xl bg-muted" />
      )}
      {!missing && settings?.bankAccount && (
        <div className="text-sm">
          <div className="font-medium">{bank?.shortName ?? settings.bankBin}</div>
          <div className="font-mono text-base">{settings.bankAccount}</div>
          <div className="text-muted-foreground">{settings.bankAccountName}</div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 3: `CustomerPicker`**

`client/src/pages/customers/CustomerPicker.tsx`:

```tsx
import { useRef, useState } from 'react';
import { Check, ChevronsUpDown, Plus, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney, type Customer } from '@tiny-pos/shared';
import { useCreateCustomer, useCustomers } from '@/api/customers';
import { Button } from '@/components/ui/button';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface Props {
  value: Customer | null;
  onChange: (c: Customer) => void;
  /** Gọi sau khi chọn xong và popover đã đóng (để chuyển con trỏ sang ô kế tiếp). */
  onPicked?: () => void;
}

/** Ô chọn khách có tìm; gõ tên chưa có thì "+ Thêm khách" tạo ngay (chỉ tên). */
export function CustomerPicker({ value, onChange, onPicked }: Props) {
  const { data } = useCustomers();
  const customers = data?.customers ?? [];
  const create = useCreateCustomer();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const picked = useRef(false);
  const name = search.trim();
  // So khớp không phân biệt hoa/thường để không tạo trùng "chị lan" với "Chị Lan"
  const exists = customers.some((c) => c.name.toLowerCase() === name.toLowerCase());

  const pick = (c: Customer) => {
    picked.current = true;
    onChange(c);
    setOpen(false);
    setSearch('');
  };
  const add = () => {
    if (!name || create.isPending) return;
    create.mutate({ name }, { onSuccess: pick, onError: (e) => toast.error(e.message) });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id="co-customer" type="button" variant="outline" role="combobox" aria-expanded={open} autoFocus className="h-12 w-full justify-between text-base">
          <span className="flex min-w-0 items-center gap-2">
            <UserRound className="shrink-0 text-primary" />
            <span className="truncate">{value ? value.name : 'Chọn khách…'}</span>
          </span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
        onCloseAutoFocus={(e) => {
          if (!picked.current) return;
          picked.current = false;
          e.preventDefault();
          onPicked?.();
        }}
      >
        <Command>
          <CommandInput placeholder="Tên hoặc số điện thoại…" className="h-11 text-base" value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandGroup>
              {customers.map((c) => (
                <CommandItem key={c.id} value={`${c.name} ${c.phone ?? ''} #${c.id}`} className="py-2 text-base" onSelect={() => pick(c)}>
                  <Check className={cn(value?.id === c.id ? 'opacity-100' : 'opacity-0')} />
                  <span className="flex-1 truncate">
                    {c.name}
                    {c.phone && <span className="text-muted-foreground"> · {c.phone}</span>}
                  </span>
                  {c.debt > 0 && <span className="text-sm text-destructive tabular-nums">nợ {formatMoney(c.debt)}</span>}
                </CommandItem>
              ))}
              {name && !exists && (
                <CommandItem forceMount value={`#add ${name}`} className="py-2 text-base" disabled={create.isPending} onSelect={add}>
                  <Plus />
                  Thêm khách "{name}"
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 4: `DebtPanel`**

`client/src/pages/sell/DebtPanel.tsx`:

```tsx
import { useRef } from 'react';
import { formatMoney, type Customer } from '@tiny-pos/shared';
import { Input } from '@/components/ui/input';
import { moneyChange } from '@/lib/money-input';
import { CustomerPicker } from '../customers/CustomerPicker';

interface Props {
  payable: number;
  customer: Customer | null;
  onCustomer: (c: Customer) => void;
  prepaid: string;
  onPrepaid: (v: string) => void;
  /** Số trả trước đã parse; NaN khi ô gõ sai. */
  paid: number;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/** Tab Ghi nợ: chọn khách, khách trả trước (tiền mặt), nợ cũ → tổng nợ sau đơn. */
export function DebtPanel({ payable, customer, onCustomer, prepaid, onPrepaid, paid }: Props) {
  const prepaidRef = useRef<HTMLInputElement>(null);
  const valid = Number.isFinite(paid) && paid >= 0 && paid < payable;
  const owed = valid ? payable - paid : 0;
  const before = customer?.debt ?? 0;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label htmlFor="co-customer" className="text-sm font-medium">
          Khách
        </label>
        <CustomerPicker value={customer} onChange={onCustomer} onPicked={() => prepaidRef.current?.focus()} />
      </div>
      <div className="space-y-2">
        <label htmlFor="co-prepaid" className="text-sm font-medium">
          Khách trả trước (tiền mặt)
        </label>
        <Input
          id="co-prepaid"
          ref={prepaidRef}
          inputMode="numeric"
          placeholder="0"
          value={prepaid}
          onChange={moneyChange(onPrepaid)}
          onFocus={(e) => e.target.select()}
          aria-invalid={!valid}
          className="h-12 text-right font-heading text-2xl! font-semibold tabular-nums"
        />
        {!valid && <p className="text-sm text-destructive">Trả trước phải ít hơn số phải trả (trả đủ thì chọn Tiền mặt)</p>}
      </div>
      {customer && (
        <div className="space-y-1 rounded-xl bg-muted/60 px-4 py-3">
          <Row label={before < 0 ? 'Tiệm đang nợ khách' : 'Nợ cũ'} value={formatMoney(Math.abs(before))} />
          <Row label="Ghi nợ đơn này" value={`+${formatMoney(owed)}`} />
          <div className="flex items-baseline justify-between border-t pt-2 text-destructive">
            <span className="font-medium">Tổng nợ sau đơn</span>
            <span className="font-heading text-2xl font-semibold tabular-nums">{formatMoney(before + owed)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Sửa `CheckoutDialog`**

`client/src/pages/sell/CheckoutDialog.tsx` – chỉ sửa các chỗ dưới, các dòng khác giữ nguyên từng ký tự.

Khối import đầu file thành (bỏ `QRCode`, `Link`, `BANKS`; thêm `NotebookPen`, `type Customer`, `TransferQr`, `DebtPanel`):

```tsx
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Banknote, Check, Landmark, NotebookPen, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney, parseVnNumber, suggestCash, toOrderItems, vietQrFromSettings, type Cart, type Customer, type OrderDetail } from '@tiny-pos/shared';
import { useCreateOrder } from '@/api/orders';
import { useSettings } from '@/api/settings';
import { TransferQr } from '@/components/TransferQr';
import { usePrint } from '@/components/receipt/PrintProvider';
import { draftReceipt } from '@/components/receipt/receipt-data';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { groupThousands, moneyChange } from '@/lib/money-input';
import { cn } from '@/lib/utils';
import { DebtPanel } from './DebtPanel';
```

`type Method = 'cash' | 'transfer';` → `type Method = 'cash' | 'transfer' | 'debt';`

Thay phần đầu thân hàm, từ `const [method, setMethod] = …` tới hết `useEffect` sinh QR (dòng `}, [qrPayload]);`), bằng:

```tsx
  const [method, setMethod] = useState<Method>('cash');
  const [given, setGiven] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [prepaid, setPrepaid] = useState('');
  const givenRef = useRef<HTMLInputElement>(null);
  const { data: settings } = useSettings();
  const create = useCreateOrder();
  const print = usePrint();
  const qrPayload = settings ? vietQrFromSettings(settings, payable) : null;

  useEffect(() => {
    if (!open) return;
    setMethod('cash');
    setGiven(groupThousands(String(payable)));
    setCustomer(null);
    setPrepaid('');
  }, [open, payable]);
```

Thay 3 dòng `const paid = …`, `const change = …`, `const short = …` bằng:

```tsx
  const paid = method === 'cash' ? parseVnNumber(given || '0') : method === 'debt' ? parseVnNumber(prepaid || '0') : payable;
  const change = paid - payable;
  const short = method === 'cash' && (!Number.isFinite(paid) || change < 0);
  // Ghi nợ: phải chọn khách và còn thiếu ít nhất 1đ (trả đủ thì là đơn tiền mặt)
  const debtInvalid = method === 'debt' && (customer === null || !Number.isFinite(paid) || paid < 0 || paid >= payable);
```

Trong `submit`: `if (short || create.isPending) return;` → `if (short || debtInvalid || create.isPending) return;`, và object gửi đi thành:

```tsx
      {
        items: toOrderItems(cart.lines),
        discount: cart.discount,
        paymentMethod: method,
        paid,
        customerId: method === 'debt' ? (customer?.id ?? null) : null,
      },
```

Tabs: `grid-cols-2` → `grid-cols-3`; thêm sau `TabsTrigger` "Chuyển khoản":

```tsx
              <TabsTrigger value="debt" className="text-base">
                <NotebookPen /> Ghi nợ
              </TabsTrigger>
```

Thay nhánh chuyển khoản: dòng `) : (` ngay trước `<div className="space-y-3 text-center">` đổi thành `) : method === 'transfer' ? (`; nội dung khối đó thay bằng:

```tsx
            <div className="space-y-3 text-center">
              <TransferQr amount={payable} />
              {qrPayload && (
                <Button type="button" variant="outline" className="h-11 w-full text-base" onClick={() => void print(draftReceipt(cart, qrPayload))}>
                  <Printer data-icon="inline-start" />
                  In tạm tính kèm QR
                </Button>
              )}
            </div>
          ) : (
            <DebtPanel payable={payable} customer={customer} onCustomer={setCustomer} prepaid={prepaid} onPrepaid={setPrepaid} paid={paid} />
          )}
```

Nút xác nhận:

```tsx
          <Button type="submit" className="h-12 w-full text-lg" disabled={short || debtInvalid || create.isPending}>
            <Check data-icon="inline-start" />
            {method === 'cash' ? 'Xác nhận (Enter)' : method === 'debt' ? 'Ghi nợ (Enter)' : 'Đã nhận tiền'}
          </Button>
```

File sau khi sửa phải ≤ 200 dòng (khoảng 150).

- [ ] **Step 6: Tóm tắt hôm nay và kết quả bán**

`client/src/pages/sell/CheckoutPanel.tsx`, trong `TodaySummary` thêm dòng sau `Tiền mặt {formatMoney(s.cash)} · Chuyển khoản {formatMoney(s.transfer)}`:

```tsx
        {s.debt > 0 && ` · Ghi nợ ${formatMoney(s.debt)}`}
```

`client/src/pages/sell/SaleResult.tsx`, thay khối `) : ( <div className="text-muted-foreground">Chuyển khoản</div> )}` bằng:

```tsx
        ) : order.debt ? (
          <div className="text-muted-foreground">
            Ghi nợ {order.customerName} · {formatMoney(order.debt.amount)} (tổng nợ {formatMoney(order.debt.balanceAfter)})
          </div>
        ) : (
          <div className="text-muted-foreground">Chuyển khoản</div>
        )}
```

- [ ] **Step 7: Typecheck client**

Run: `npm run build -w shared && npm run typecheck -w client`
Expected: không lỗi.

---

### Task 7: In hóa đơn nợ, biên nhận thu nợ, trang Hóa đơn (client)

**Files:**
- Modify: `client/src/components/receipt/receipt-data.ts`, `client/src/components/receipt/Receipt.tsx`, `client/src/components/receipt/PrintProvider.tsx`
- Modify: `client/src/pages/orders/OrdersPage.tsx`, `client/src/pages/orders/OrderTable.tsx`, `client/src/pages/orders/OrderDetailDialog.tsx`

**Interfaces:**
- Consumes: `OrderDetail.debt`, `OrderSummary.customerName`, `DaySummary.debt/debtCollected` (Task 4); `CustomerPaymentResult` (Task 1)
- Produces:
  - `ReceiptData` thêm `customerName: string | null`, `debt: OrderDebt | null`
  - `DebtReceiptData` (`{ kind: 'debt-payment'; customerName; amount; method: CollectMethod; balanceAfter; createdAt }`), `PrintData = ReceiptData | DebtReceiptData`, `debtReceiptFromPayment(r: CustomerPaymentResult): DebtReceiptData`
  - `usePrint()` nhận `PrintData`
  - `DebtReceipt` component trong `Receipt.tsx`

- [ ] **Step 1: Dữ liệu in**

`client/src/components/receipt/receipt-data.ts`:

Dòng import đầu thành:

```ts
import { cartTotals, lineAmount, type Cart, type CollectMethod, type CustomerPaymentResult, type OrderDebt, type OrderDetail, type PaymentMethod } from '@tiny-pos/shared';
```

Trong `interface ReceiptData`, thêm sau `qrPayload: string | null;`:

```ts
  /** Đơn ghi nợ: tên khách và nợ tại lúc bán; đơn khác null. */
  customerName: string | null;
  debt: OrderDebt | null;
```

Trong `receiptFromOrder` thêm sau `qrPayload: null,`:

```ts
    customerName: o.customerName,
    debt: o.debt,
```

Trong `draftReceipt` và `sampleReceipt` thêm sau `qrPayload…,`:

```ts
    customerName: null,
    debt: null,
```

Thêm cuối file:

```ts
/** Biên nhận thu nợ: khách giữ làm bằng đã trả. */
export interface DebtReceiptData {
  kind: 'debt-payment';
  customerName: string;
  amount: number;
  method: CollectMethod;
  /** Còn nợ sau lần thu này; âm = tiệm nợ lại khách. */
  balanceAfter: number;
  createdAt: string;
}

export type PrintData = ReceiptData | DebtReceiptData;

export function debtReceiptFromPayment(r: CustomerPaymentResult): DebtReceiptData {
  return {
    kind: 'debt-payment',
    customerName: r.customer.name,
    amount: -r.transaction.amount,
    method: r.transaction.method ?? 'cash',
    balanceAfter: r.transaction.balanceAfter,
    createdAt: r.transaction.createdAt,
  };
}
```

- [ ] **Step 2: Hóa đơn nợ và biên nhận**

`client/src/components/receipt/Receipt.tsx`:

Dòng `import type { ReceiptData } from './receipt-data';` → `import type { DebtReceiptData, ReceiptData } from './receipt-data';`

Thêm sau hàm `timeLabel`:

```tsx
function StoreHeader({ settings }: { settings: Settings }) {
  return (
    <>
      <div style={{ ...center, fontSize: '16px', fontWeight: 700 }}>{settings.storeName}</div>
      {settings.storeAddress && <div style={center}>{settings.storeAddress}</div>}
      {settings.storePhone && <div style={center}>ĐT: {settings.storePhone}</div>}
    </>
  );
}
```

Trong `Receipt`, thay 3 dòng tên/địa chỉ/ĐT cửa hàng bằng `<StoreHeader settings={settings} />`. Sau dòng `<div style={center}>{timeLabel(data.createdAt)}</div>` thêm:

```tsx
      {data.customerName && <div style={center}>Khách: {data.customerName}</div>}
```

Sau khối `{paidOrder && data.paymentMethod === 'cash' && ( … )}` thêm:

```tsx
      {paidOrder && data.debt && (
        <>
          <Row label="Khách trả" value={formatMoney(data.paid)} />
          <Row label="Ghi nợ đơn này" value={formatMoney(data.debt.amount)} />
          <Row label="Nợ cũ" value={formatMoney(data.debt.balanceAfter - data.debt.amount)} />
          <Row label="Tổng nợ" value={formatMoney(data.debt.balanceAfter)} strong />
        </>
      )}
```

Thêm cuối file:

```tsx
const COLLECT_LABEL = { cash: 'Tiền mặt', transfer: 'Chuyển khoản' } as const;

/** Biên nhận thu nợ 80mm. */
export function DebtReceipt({ data, settings }: { data: DebtReceiptData; settings: Settings }) {
  return (
    <div style={page}>
      <StoreHeader settings={settings} />
      <div style={rule} />
      <div style={{ ...center, fontWeight: 700 }}>BIÊN NHẬN THU NỢ</div>
      <div style={center}>{timeLabel(data.createdAt)}</div>
      <div style={rule} />
      <Row label="Khách" value={data.customerName} />
      <Row label="Đã thu" value={formatMoney(data.amount)} strong />
      <Row label="Hình thức" value={COLLECT_LABEL[data.method]} />
      <Row label={data.balanceAfter < 0 ? 'Tiệm nợ lại' : 'Còn nợ'} value={formatMoney(Math.abs(data.balanceAfter))} />
      <div style={rule} />
      {settings.receiptFooter && <div style={center}>{settings.receiptFooter}</div>}
    </div>
  );
}
```

- [ ] **Step 3: `PrintProvider` in được cả biên nhận**

`client/src/components/receipt/PrintProvider.tsx`:

- `import { Receipt } from './Receipt';` → `import { DebtReceipt, Receipt } from './Receipt';`
- `import type { ReceiptData } from './receipt-data';` → `import type { PrintData } from './receipt-data';`
- `type PrintFn = (data: ReceiptData) => Promise<void>;` → `type PrintFn = (data: PrintData) => Promise<void>;`
- Trong `interface Job`: `data: ReceiptData;` → `data: PrintData;`
- Trong `print`: `const qrUrl = data.qrPayload ? …` → 

```tsx
    const qrPayload = 'kind' in data ? null : data.qrPayload;
    const qrUrl = qrPayload ? await QRCode.toDataURL(qrPayload, { margin: 1, width: 320 }) : null;
```

- Dòng render portal thành:

```tsx
      {root &&
        job &&
        createPortal(
          'kind' in job.data ? (
            <DebtReceipt data={job.data} settings={settings ?? SETTINGS_DEFAULTS} />
          ) : (
            <Receipt data={job.data} settings={settings ?? SETTINGS_DEFAULTS} qrUrl={job.qrUrl} />
          ),
          root,
        )}
```

- [ ] **Step 4: Trang Hóa đơn**

`client/src/pages/orders/OrderTable.tsx`, ô thanh toán `<TableCell className="px-4 py-3">{METHOD_LABEL[o.paymentMethod]}</TableCell>` thành:

```tsx
              <TableCell className="px-4 py-3">
                {o.paymentMethod === 'debt' ? <Badge variant="outline">Ghi nợ · {o.customerName}</Badge> : METHOD_LABEL[o.paymentMethod]}
              </TableCell>
```

`client/src/pages/orders/OrderDetailDialog.tsx`:

- Trong `onCancel`, dòng `description: 'Hóa đơn vẫn được giữ lại …',` thành:

```tsx
      description: `${o.debt ? 'Nợ của khách được trừ lại. ' : ''}Hóa đơn vẫn được giữ lại với trạng thái Đã hủy và không tính vào doanh thu.`,
```

- `DialogDescription`: `` {o && `${new Date(o.createdAt).toLocaleString('vi-VN')} · ${METHOD_LABEL[o.paymentMethod]}`} `` thành:

```tsx
            {o && `${new Date(o.createdAt).toLocaleString('vi-VN')} · ${METHOD_LABEL[o.paymentMethod]}${o.customerName ? ` · ${o.customerName}` : ''}`}
```

- Sau khối `{o.paymentMethod === 'cash' && ( … )}` thêm:

```tsx
              {o.debt && (
                <>
                  <Line label="Khách trả" value={formatMoney(o.paid)} />
                  <Line label="Ghi nợ đơn này" value={formatMoney(o.debt.amount)} />
                  <Line label="Nợ cũ" value={formatMoney(o.debt.balanceAfter - o.debt.amount)} />
                  <Line label="Tổng nợ sau đơn" value={formatMoney(o.debt.balanceAfter)} />
                </>
              )}
```

`client/src/pages/orders/OrdersPage.tsx`:

- Dòng import lucide thành `import { Banknote, HandCoins, Landmark, NotebookPen, ReceiptText, Wallet } from 'lucide-react';`
- `className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"` → `className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"`
- Thêm sau `StatCard` "Chuyển khoản":

```tsx
        <StatCard icon={NotebookPen} label="Ghi nợ" value={formatMoney(s?.debt ?? 0)} tone="danger" hint="Phần khách còn thiếu" />
        <StatCard
          icon={HandCoins}
          label="Thu nợ"
          value={formatMoney((s?.debtCollected.cash ?? 0) + (s?.debtCollected.transfer ?? 0))}
          hint={`Tiền mặt ${formatMoney(s?.debtCollected.cash ?? 0)} · CK ${formatMoney(s?.debtCollected.transfer ?? 0)}`}
        />
```

- [ ] **Step 5: Typecheck client**

Run: `npm run build -w shared && npm run typecheck -w client`
Expected: không lỗi.

---

### Task 8: Trang Khách hàng (client)

**Files:**
- Create: `client/src/pages/customers/CustomersPage.tsx`, `CustomerFormDialog.tsx`, `CustomerDetailDialog.tsx`, `CollectDebtDialog.tsx`, `ManualDebtDialog.tsx` (cùng thư mục `client/src/pages/customers/`)
- Modify: `client/src/router.tsx` (import lucide `Users`, import trang, 1 mục `NAV`, 1 `Route`)

**Interfaces:**
- Consumes: hooks Task 6; `TransferQr` (Task 6); `usePrint`, `debtReceiptFromPayment` (Task 7); `OrderDetailDialog` (`client/src/pages/orders/OrderDetailDialog.tsx`, props `{ id: number | null; onClose }`)
- Produces: route `/customers`, mục menu *Khách hàng*

- [ ] **Step 1: Form khách**

`client/src/pages/customers/CustomerFormDialog.tsx`:

```tsx
import { useEffect, useState, type FormEvent } from 'react';
import { Check, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { parseVnNumber, type Customer } from '@tiny-pos/shared';
import { useCreateCustomer, useUpdateCustomer } from '@/api/customers';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { moneyChange } from '@/lib/money-input';

interface Props {
  open: boolean;
  customer?: Customer | null;
  onClose: () => void;
  onSaved: (c: Customer) => void;
}

/** Thêm/sửa khách; nợ đầu kỳ (chuyển từ sổ giấy) chỉ nhập khi thêm mới. */
export function CustomerFormDialog({ open, customer, onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [opening, setOpening] = useState('');
  const create = useCreateCustomer();
  const update = useUpdateCustomer();
  const pending = create.isPending || update.isPending;

  useEffect(() => {
    if (!open) return;
    setName(customer?.name ?? '');
    setPhone(customer?.phone ?? '');
    setNote(customer?.note ?? '');
    setOpening('');
  }, [open, customer]);

  const openingDebt = parseVnNumber(opening || '0');
  const openingOk = Number.isFinite(openingDebt) && openingDebt >= 0;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !openingOk || pending) return;
    const opts = {
      onSuccess: (c: Customer) => {
        toast.success(customer ? 'Đã lưu' : `Đã thêm "${c.name}"`);
        onSaved(c);
      },
      onError: (err: Error) => toast.error(err.message),
    };
    if (customer) update.mutate({ id: customer.id, name, phone, note }, opts);
    else create.mutate({ name, phone, note, openingDebt: Math.round(openingDebt) }, opts);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <UserRound className="size-5 text-primary" />
            {customer ? 'Sửa khách hàng' : 'Thêm khách hàng'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <TextField id="cf-name" label="Tên" autoFocus maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
          <TextField id="cf-phone" label="Số điện thoại" inputMode="tel" maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} />
          <TextField id="cf-note" label="Ghi chú" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
          {!customer && (
            <TextField
              id="cf-opening"
              label="Nợ đầu kỳ"
              hint="Số khách đang nợ trong sổ giấy (bỏ trống nếu không nợ)"
              suffix="đ"
              inputMode="numeric"
              placeholder="0"
              value={opening}
              onChange={moneyChange(setOpening)}
              error={openingOk ? undefined : 'Số tiền không hợp lệ'}
            />
          )}
          <Button type="submit" className="h-11 w-full text-base" disabled={!name.trim() || !openingOk || pending}>
            <Check data-icon="inline-start" />
            Lưu
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Thu nợ**

`client/src/pages/customers/CollectDebtDialog.tsx`:

```tsx
import { useEffect, useState, type FormEvent } from 'react';
import { Banknote, Check, CircleCheck, HandCoins, Landmark, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney, parseVnNumber, type CollectMethod, type Customer, type CustomerPaymentResult } from '@tiny-pos/shared';
import { useCollectDebt } from '@/api/customers';
import { useSettings } from '@/api/settings';
import { TextField } from '@/components/TextField';
import { TransferQr } from '@/components/TransferQr';
import { usePrint } from '@/components/receipt/PrintProvider';
import { debtReceiptFromPayment } from '@/components/receipt/receipt-data';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { groupThousands, moneyChange } from '@/lib/money-input';

/** Thu nợ: mặc định thu hết; chuyển khoản hiện QR đúng số tiền; lưu xong cho in biên nhận. */
export function CollectDebtDialog({ customer, open, onClose }: { customer: Customer; open: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<CollectMethod>('cash');
  const [note, setNote] = useState('');
  const [result, setResult] = useState<CustomerPaymentResult | null>(null);
  const collect = useCollectDebt();
  const print = usePrint();
  const { data: settings } = useSettings();

  // Chỉ đặt lại khi mở hộp: thu xong nợ khách đổi (refetch) nhưng không được xóa màn kết quả
  useEffect(() => {
    if (!open) return;
    setAmount(groupThousands(String(Math.max(0, customer.debt))));
    setMethod('cash');
    setNote('');
    setResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const n = parseVnNumber(amount || 'x');
  const valid = Number.isFinite(n) && n > 0 && n <= customer.debt;
  const printReceipt = (r: CustomerPaymentResult) => void print(debtReceiptFromPayment(r));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid || collect.isPending) return;
    collect.mutate(
      { id: customer.id, amount: Math.round(n), method, note },
      {
        onSuccess: (r) => {
          toast.success(`Đã thu ${formatMoney(n)} của ${customer.name}`);
          setResult(r);
          if (settings?.autoPrint ?? true) printReceipt(r);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !collect.isPending && onClose()}>
      <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <HandCoins className="size-5 text-primary" />
            Thu nợ {customer.name}
          </DialogTitle>
          <DialogDescription className="text-base">
            {result ? 'Đã ghi vào sổ nợ' : `Đang nợ ${formatMoney(customer.debt)}`}
          </DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 dark:bg-emerald-500/10">
              <CircleCheck className="size-7 shrink-0 text-emerald-600" />
              <div>
                <div className="font-heading text-2xl font-semibold tabular-nums">Đã thu {formatMoney(-result.transaction.amount)}</div>
                <div className="text-muted-foreground">
                  {result.transaction.method === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt'} · còn nợ {formatMoney(result.transaction.balanceAfter)}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-11 text-base" onClick={() => printReceipt(result)}>
                <Printer data-icon="inline-start" />
                In biên nhận
              </Button>
              <Button className="h-11 text-base" onClick={onClose}>
                Xong
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <TextField
              id="cd-amount"
              label="Số tiền thu"
              suffix="đ"
              inputMode="numeric"
              autoFocus
              value={amount}
              onChange={moneyChange(setAmount)}
              onFocus={(e) => e.target.select()}
              error={amount && !valid ? 'Số tiền phải lớn hơn 0 và không vượt số đang nợ' : undefined}
            />
            <Tabs value={method} onValueChange={(v) => setMethod(v as CollectMethod)}>
              <TabsList className="grid h-11 w-full grid-cols-2">
                <TabsTrigger value="cash" className="text-base">
                  <Banknote /> Tiền mặt
                </TabsTrigger>
                <TabsTrigger value="transfer" className="text-base">
                  <Landmark /> Chuyển khoản
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {method === 'transfer' && valid && (
              <div className="space-y-3 text-center">
                <TransferQr amount={Math.round(n)} />
              </div>
            )}
            <TextField id="cd-note" label="Ghi chú" placeholder="Thu nợ" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
            <Button type="submit" className="h-11 w-full text-base" disabled={!valid || collect.isPending}>
              <Check data-icon="inline-start" />
              Xác nhận thu
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Ghi nợ tay**

`client/src/pages/customers/ManualDebtDialog.tsx`:

```tsx
import { useEffect, useState, type FormEvent } from 'react';
import { Check, NotebookPen } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney, parseVnNumber, type Customer } from '@tiny-pos/shared';
import { useAddManualDebt } from '@/api/customers';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { moneyChange } from '@/lib/money-input';

/** Ghi nợ tay: quên ghi hoặc sửa lần thu nhầm; bắt buộc ghi chú để sổ còn truy được. */
export function ManualDebtDialog({ customer, open, onClose }: { customer: Customer; open: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const add = useAddManualDebt();

  useEffect(() => {
    if (!open) return;
    setAmount('');
    setNote('');
  }, [open]);

  const n = parseVnNumber(amount || 'x');
  const valid = Number.isFinite(n) && n > 0 && note.trim().length > 0;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid || add.isPending) return;
    add.mutate(
      { id: customer.id, amount: Math.round(n), note },
      {
        onSuccess: (c) => {
          toast.success(`Đã ghi thêm ${formatMoney(n)} · tổng nợ ${formatMoney(c.debt)}`);
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
            <NotebookPen className="size-5 text-primary" />
            Ghi nợ tay – {customer.name}
          </DialogTitle>
          <DialogDescription className="text-base">Đang nợ {formatMoney(customer.debt)}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <TextField id="md-amount" label="Số tiền ghi thêm" suffix="đ" inputMode="numeric" autoFocus value={amount} onChange={moneyChange(setAmount)} />
          <TextField
            id="md-note"
            label="Ghi chú (bắt buộc)"
            placeholder="Ví dụ: quên ghi gói thuốc ngày 28"
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button type="submit" className="h-11 w-full text-base" disabled={!valid || add.isPending}>
            <Check data-icon="inline-start" />
            Ghi nợ
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Chi tiết khách + sổ nợ**

`client/src/pages/customers/CustomerDetailDialog.tsx`:

```tsx
import { useState } from 'react';
import { HandCoins, NotebookPen, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney, type CustomerTransaction, type DebtTxKind } from '@tiny-pos/shared';
import { useCustomerTransactions, useCustomers, useDeleteCustomer } from '@/api/customers';
import { useConfirm } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { OrderDetailDialog } from '../orders/OrderDetailDialog';
import { CollectDebtDialog } from './CollectDebtDialog';
import { CustomerFormDialog } from './CustomerFormDialog';
import { ManualDebtDialog } from './ManualDebtDialog';

const KIND_LABEL: Record<DebtTxKind, string> = {
  opening: 'Nợ đầu kỳ',
  order: 'Mua chịu',
  order_cancel: 'Hủy đơn',
  payment: 'Thu nợ',
  manual: 'Ghi nợ tay',
};
const when = (iso: string) => new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
const title = (t: CustomerTransaction) => (t.kind === 'payment' ? `Thu nợ (${t.method === 'transfer' ? 'CK' : 'TM'})` : KIND_LABEL[t.kind]);
/** Ghi chú tự sinh ("Bán HD-…", "Thu nợ", "Nợ đầu kỳ") đã thể hiện qua tiêu đề/mã; chỉ hiện ghi chú người dùng gõ. */
const userNote = (t: CustomerTransaction) => (t.kind === 'manual' || (t.kind === 'payment' && t.note !== 'Thu nợ') ? t.note : null);

/** Thông tin khách + sổ nợ + thu nợ / ghi nợ tay / sửa / xóa. */
export function CustomerDetailDialog({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data } = useCustomers();
  const c = data?.customers.find((x) => x.id === id) ?? null;
  const { data: txs = [] } = useCustomerTransactions(id);
  const [editing, setEditing] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);
  const del = useDeleteCustomer();
  const confirm = useConfirm();
  const debt = c?.debt ?? 0;

  const onDelete = async () => {
    if (!c) return;
    if (!(await confirm({ title: `Xóa khách "${c.name}"?`, description: 'Sổ nợ cũ vẫn được giữ lại.', confirmText: 'Xóa', destructive: true }))) return;
    del.mutate(c.id, {
      onSuccess: () => {
        toast.success('Đã xóa');
        onClose();
      },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <>
      <Dialog open={c !== null} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">{c?.name}</DialogTitle>
            <DialogDescription className="text-base">{[c?.phone, c?.note].filter(Boolean).join(' · ') || 'Chưa có số điện thoại'}</DialogDescription>
          </DialogHeader>
          <div className="rounded-xl bg-muted/60 px-4 py-3">
            <div className="text-sm text-muted-foreground">{debt < 0 ? 'Tiệm đang nợ khách' : 'Khách đang nợ'}</div>
            <div className={cn('font-heading text-3xl font-semibold tabular-nums', debt > 0 && 'text-destructive')}>{formatMoney(Math.abs(debt))}</div>
          </div>
          <div>
            <div className="mb-2 text-sm font-medium text-muted-foreground">Sổ nợ</div>
            {txs.length ? (
              <ul className="divide-y rounded-xl border">
                {txs.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2 font-medium">
                        {title(t)}
                        {t.orderCode && t.orderId !== null && (
                          <button type="button" className="font-mono text-sm text-primary underline" onClick={() => setOrderId(t.orderId)}>
                            {t.orderCode}
                          </button>
                        )}
                      </div>
                      <div className="truncate text-sm text-muted-foreground">
                        {when(t.createdAt)}
                        {userNote(t) && ` · ${userNote(t)}`}
                      </div>
                    </div>
                    <div className="text-right tabular-nums">
                      <div className={cn('font-semibold', t.amount > 0 ? 'text-destructive' : 'text-emerald-600')}>
                        {t.amount > 0 ? '+' : '−'}
                        {formatMoney(Math.abs(t.amount))}
                      </div>
                      <div className="text-sm text-muted-foreground">còn {formatMoney(t.balanceAfter)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">Chưa có giao dịch.</p>
            )}
          </div>
          <DialogFooter className="gap-2">
            {debt === 0 && (
              <Button variant="outline" className="h-11 text-base text-destructive" onClick={() => void onDelete()}>
                <Trash2 data-icon="inline-start" />
                Xóa
              </Button>
            )}
            <Button variant="outline" className="h-11 text-base" onClick={() => setEditing(true)}>
              <Pencil data-icon="inline-start" />
              Sửa
            </Button>
            <Button variant="outline" className="h-11 text-base" disabled={!c} onClick={() => setAdding(true)}>
              <NotebookPen data-icon="inline-start" />
              Ghi nợ tay
            </Button>
            <Button className="h-11 text-base" disabled={!c || debt <= 0} onClick={() => setCollecting(true)}>
              <HandCoins data-icon="inline-start" />
              Thu nợ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CustomerFormDialog open={editing} customer={c} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />
      {c && <CollectDebtDialog customer={c} open={collecting} onClose={() => setCollecting(false)} />}
      {c && <ManualDebtDialog customer={c} open={adding} onClose={() => setAdding(false)} />}
      <OrderDetailDialog id={orderId} onClose={() => setOrderId(null)} />
    </>
  );
}
```

- [ ] **Step 5: Trang danh sách**

`client/src/pages/customers/CustomersPage.tsx`:

```tsx
import { useState } from 'react';
import { Plus, Search, Users, Wallet } from 'lucide-react';
import { formatMoney } from '@tiny-pos/shared';
import { useCustomers } from '@/api/customers';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { CustomerDetailDialog } from './CustomerDetailDialog';
import { CustomerFormDialog } from './CustomerFormDialog';

export function CustomersPage() {
  const { data, isLoading } = useCustomers();
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  // Lọc giống server: tên không phân biệt hoa/thường (kể cả chữ có dấu) hoặc SĐT
  const t = q.trim().toLowerCase();
  const customers = (data?.customers ?? []).filter((c) => !t || c.name.toLowerCase().includes(t) || (c.phone?.includes(t) ?? false));

  return (
    <>
      <PageHeader
        title="Khách hàng"
        description="Sổ nợ khách mua chịu"
        icon={Users}
        actions={
          <Button className="h-11 px-5 text-base" onClick={() => setAdding(true)}>
            <Plus data-icon="inline-start" />
            Thêm khách
          </Button>
        }
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <StatCard icon={Wallet} label="Tổng nợ phải thu" value={formatMoney(data?.totalDebt ?? 0)} tone="danger" />
        <InputGroup className="h-11 self-center">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput type="search" placeholder="Tìm tên hoặc số điện thoại…" className="text-base" value={q} onChange={(e) => setQ(e.target.value)} />
        </InputGroup>
      </div>
      <Card className="gap-0 overflow-hidden py-0">
        {!isLoading && !customers.length ? (
          t ? (
            <EmptyState icon={Search} title="Không tìm thấy" description={`Không có khách nào khớp "${q.trim()}".`} />
          ) : (
            <EmptyState icon={Users} title="Chưa có khách hàng" description="Thêm khách để ghi nợ khi bán chịu." />
          )
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="px-4">Tên</TableHead>
                <TableHead className="hidden px-4 sm:table-cell">Số điện thoại</TableHead>
                <TableHead className="px-4 text-right">Đang nợ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => setOpenId(c.id)}>
                  <TableCell className="px-4 py-3 font-medium">{c.name}</TableCell>
                  <TableCell className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{c.phone ?? '—'}</TableCell>
                  <TableCell className={cn('px-4 py-3 text-right font-semibold tabular-nums', c.debt > 0 && 'text-destructive')}>
                    {c.debt < 0 ? `Tiệm nợ ${formatMoney(-c.debt)}` : formatMoney(c.debt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <CustomerFormDialog open={adding} onClose={() => setAdding(false)} onSaved={() => setAdding(false)} />
      <CustomerDetailDialog id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
```

(Trang danh sách dùng bảng cả trên điện thoại – 2 cột Tên / Đang nợ vừa màn 390px; cột SĐT ẩn dưới `sm`. Spec mục 7 nói "danh sách thẻ" cho điện thoại: sửa spec thành "cột SĐT ẩn trên điện thoại" ở Task 9.)

- [ ] **Step 6: Menu và route**

`client/src/router.tsx`:

- Dòng import lucide: thêm `Users` vào cuối danh sách icon (trước `type LucideIcon`): `…, Truck, Users, type LucideIcon } from 'lucide-react';`
- Thêm sau dòng `import { CategoriesPage } from './pages/categories/CategoriesPage';`:

```tsx
import { CustomersPage } from './pages/customers/CustomersPage';
```

- Trong `NAV`, thêm sau mục `/suppliers`:

```tsx
  { to: '/customers', label: 'Khách hàng', icon: Users },
```

- Trong `AppRoutes`, thêm sau route `/suppliers`:

```tsx
      <Route path="/customers" element={<CustomersPage />} />
```

- [ ] **Step 7: Typecheck và build client**

Run: `npm run typecheck && npm run build`
Expected: không lỗi; mọi file mới ≤ 200 dòng (`wc -l client/src/pages/customers/*.tsx client/src/pages/sell/CheckoutDialog.tsx`).

---

### Task 9: Kiểm tra trên trình duyệt, tài liệu, commit

**Files:**
- Modify: `README.md` (thêm mục "Kiểm thử thủ công Giai đoạn 4" cuối file), `CLAUDE.md` (3 dòng), `.claude/rules/database.md` (1 dòng), `docs/superpowers/specs/2026-09-30-tiny-pos-phase4-customers-design.md` (1 dòng mục 7)

- [ ] **Step 1: Chạy lại toàn bộ kiểm tra**

Run: `npm run typecheck && npm test && npm run build`
Expected: tất cả PASS.

- [ ] **Step 2: Kiểm tra giao diện bằng skill `browser-verify`**

Làm theo `.claude/skills/browser-verify/SKILL.md` (server dev `:3000` + Vite `:5180`; server khởi động lại sẽ chạy migration `0003` vào DB dev – đã sao lưu ở Task 2). Chặn mọi request ghi; dùng `route.fulfill` để stub:
- `GET /api/customers` → `{ customers: [{ id: 1, name: 'Chị Lan', phone: '0909', note: null, debt: 350000, isActive: true }], totalDebt: 350000 }`
- `GET /api/customers/1/transactions` → vài dòng đủ loại `opening`, `order` (có `orderCode`), `payment` (`method: 'transfer'`), `manual`
- `POST /api/customers` (tạo nhanh) → fulfill `201` `{ id: 2, name: <tên gửi lên>, phone: null, note: null, debt: 0, isActive: true }`
- `POST /api/customers/1/payments` → fulfill `{ customer: {…, debt: 300000}, transaction: { id: 9, customerId: 1, kind: 'payment', amount: -50000, method: 'cash', note: 'Thu nợ', orderId: null, orderCode: null, createdAt: <ISO>, balanceAfter: 300000 } }`
- Các request ghi khác: abort và ghi log body.

Kiểm và báo lại **điều quan sát được** (giá trị trên màn hình, body request, ảnh chụp), cỡ 1280×900 và 390×844:
1. Màn Bán hàng: thêm 1 món → *Thanh toán* → tab **Ghi nợ**: nút chọn khách được focus. Mở danh sách, gõ "chị lan" → **không** có dòng "+ Thêm khách" (Review Focus 2). Gõ "Cô Ba" → có "+ Thêm khách "Cô Ba"" → Enter → body `POST /api/customers` là `{"name":"Cô Ba"}`, khách được chọn, con trỏ ở ô *Khách trả trước* (Review Focus 4).
2. Chọn "Chị Lan", gõ trả trước 20.000 với đơn 50.000 → khối số: Nợ cũ 350.000đ, Ghi nợ đơn này +30.000đ, Tổng nợ sau đơn 380.000đ. Enter trong ô trả trước → body `POST /api/orders` có `"paymentMethod":"debt","customerId":1,"paid":20000`. Gõ trả trước 50.000 → nút khóa và hiện dòng nhắc.
3. Tab Chuyển khoản vẫn hiện QR / nhắc Cài đặt như trước (TransferQr).
4. Trang **Khách hàng**: StatCard "Tổng nợ phải thu 350.000đ"; mở Chị Lan → sổ nợ đủ loại, bấm mã HD mở chi tiết hóa đơn. *Thu nợ* 50.000 → màn kết quả "Đã thu 50.000đ · còn nợ 300.000đ" **vẫn còn** sau khi danh sách refetch (Review Focus 1); *In biên nhận* gọi `window.print` (stub) với nội dung "BIÊN NHẬN THU NỢ" trong `#print-root`. Chọn Chuyển khoản → QR hiện.
5. *Ghi nợ tay*: nút khóa khi chưa có ghi chú.
6. Trang **Hóa đơn**: 6 StatCard (stub `GET /api/orders?date=…` có một đơn `paymentMethod: 'debt'`, `customerName: 'Chị Lan'`, summary có `debt`, `debtCollected`) → badge "Ghi nợ · Chị Lan"; chi tiết đơn có khối Khách trả / Ghi nợ đơn này / Nợ cũ / Tổng nợ sau đơn; *In lại* → `#print-root` có "Khách: Chị Lan" và "Tổng nợ".
7. Điện thoại 390×844: menu *Thêm* có "Khách hàng"; hộp thanh toán 3 tab không tràn ngang; trang Khách hàng không cuộn ngang.

Sửa mọi lỗi phát hiện rồi kiểm lại bước tương ứng.

- [ ] **Step 3: Tài liệu**

`README.md`, thêm cuối file:

```markdown

## Kiểm thử thủ công Giai đoạn 4

1. **Thêm khách có nợ cũ**: *Khách hàng* → *Thêm khách* "Chị Lan", nợ đầu kỳ 350.000 → danh sách hiện nợ 350.000, sổ nợ có dòng "Nợ đầu kỳ".
2. **Ghi nợ khi bán**: *Bán hàng* → thêm món 50.000 → *Thanh toán* → tab *Ghi nợ* → chọn "Chị Lan", khách trả trước 20.000 → thấy Nợ cũ 350.000, Ghi nợ đơn này 30.000, Tổng nợ 380.000 → Enter. Hóa đơn in có tên khách, Nợ cũ, Tổng nợ.
3. **Khách mới ngay tại quầy**: tab *Ghi nợ* → gõ tên chưa có → *+ Thêm khách "…"* → khách được chọn luôn.
4. **Trả đủ không cho ghi nợ**: gõ trả trước bằng số phải trả → nút khóa, nhắc chọn Tiền mặt.
5. **Thu nợ**: mở "Chị Lan" → *Thu nợ* 100.000, Chuyển khoản → hiện QR đúng số tiền → xác nhận → *In biên nhận*. Sổ nợ có dòng "Thu nợ (CK)", còn 280.000.
6. **Ghi nợ tay**: *Ghi nợ tay* 5.000, ghi chú "quên ghi" → nợ tăng 5.000.
7. **Hủy đơn ghi nợ**: *Hóa đơn* → mở đơn ghi nợ → *Hủy đơn* → nợ khách trừ lại 30.000; sổ có dòng "Hủy đơn".
8. **Tổng kết ngày**: trang *Hóa đơn* có thẻ Ghi nợ và Thu nợ (TM/CK); tiền mặt trong két = thẻ Tiền mặt + thu nợ tiền mặt.
9. **Xóa khách**: khách còn nợ thì không có nút *Xóa*; thu hết nợ → *Xóa* được.
```

`CLAUDE.md`:
- Dòng "Đã xong: …" thêm `, 4 (khách hàng, công nợ khách)` trước dấu `.` cuối.
- Trong "Bất biến nghiệp vụ", thêm sau dòng về `recordSupplierTx`:

```markdown
- **Mọi thay đổi nợ khách** đi qua `recordCustomerDebtTx` (`services/customer-ledger.ts`), cùng transaction. Hóa đơn ghi nợ: `paid` là tiền mặt trả trước, nợ = `payable − paid`.
```

- Dòng "**Migration**: DB dev đã chạy tới `0002`." → "`0003`".

`.claude/rules/database.md`: dòng "**Không sửa migration đã có** (`0000`–`0002`) … (tiếp theo là `0003`)." → `0000`–`0003`, tiếp theo là `0004`.

Spec `docs/superpowers/specs/2026-09-30-tiny-pos-phase4-customers-design.md`, mục 7 "Khách hàng": dòng `- Bảng (điện thoại: danh sách thẻ): tên, SĐT, nợ. …` → `- Bảng: tên, SĐT (ẩn trên điện thoại), nợ. …` (giữ phần còn lại của dòng).

- [ ] **Step 4: Soát diff**

Run: `git status && git diff --stat`
Expected: chỉ các file trong kế hoạch này. File có sẵn không có số dòng đổi lớn bất thường (nhiều nhất: `server/src/services/orders.ts`, `client/src/pages/sell/CheckoutDialog.tsx`). Mở `git diff` các file cũ: không có hunk chỉ đổi thụt lề/format; hunk nào như vậy thì hoàn tác.

- [ ] **Step 5: Commit một lần cho cả giai đoạn**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: giai đoạn 4 – khách hàng, công nợ khách

- Bán ghi nợ trong hộp thanh toán: trả trước một phần, tạo khách nhanh
- Sổ nợ khách: nợ đầu kỳ, thu nợ TM/CK có QR, ghi nợ tay; hủy đơn ghi bút toán bù
- Hóa đơn in nợ cũ/tổng nợ, biên nhận thu nợ 80mm
- Tổng kết ngày có ghi nợ và thu nợ; migration 0003

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

Kiểm: `git log --oneline -1` và `git status` sạch (trừ file không theo dõi có sẵn trong `.gitignore`).
