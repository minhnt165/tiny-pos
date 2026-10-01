# Giai đoạn 6 – Trang Tổng quan và cảnh báo (0.10.0) – Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trang *Tổng quan* (`/overview`) cho chủ tiệm thấy trong một màn hình: số liệu hôm nay, 7 ngày gần đây, hóa đơn hôm nay, hàng sắp hết, khách nợ (có cờ nợ lâu), nợ nhà cung cấp, kiểm kê đang dở và tình trạng sao lưu; mọi khối đều có nút sang trang xử lý.

**Architecture:** Server gom toàn bộ trong `services/overview.ts` (một hàm thuần đọc, nhận `db` + `Clock` + giới hạn dòng), dùng lại `profitReport` (7 ngày), `toSummary` của hóa đơn (tách thành `recentOrders`), quy tắc tồn thấp `stock < minStock`, subquery giao dịch sổ nợ gần nhất của khách, và `getCurrentStocktake`. Route `GET /api/overview` ghép thêm phần sao lưu từ `BackupService.status()` (null khi không có service). Client chỉ hiển thị: `pages/overview/` gồm trang khung và 6 khối nhỏ, một hook `useOverview` tự làm mới mỗi 60 giây dưới khóa `['reports', 'overview']` nên mọi mutation hiện có tự invalidate.

**Tech Stack:** TypeScript ESM, Express 5, drizzle-orm + better-sqlite3, zod 4 (chỉ hằng số), vitest, React 19 + TanStack Query 5 + react-router 7, shadcn/ui (`Card`, `Table`, `Badge`, `Button`), lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-01-tiny-pos-overview-design.md`

## Global Constraints

- Text UI, thông báo lỗi API, comment code, commit message: **tiếng Việt**.
- **Không format lại file có sẵn**: diff chỉ chứa dòng cần đổi; không chạy prettier/eslint; theo phong cách xung quanh (2 space, nháy đơn, có `;`, dòng ≤ ~130 ký tự).
- **Git**: làm trên `master`, **không commit từng task**; cả đợt là **một commit** ở Task 7: `feat: tổng quan 0.10.0 – số liệu hôm nay, 7 ngày, cảnh báo tồn/nợ/kiểm kê/sao lưu`.
- **Không đổi schema DB, không migration. Không thêm thư viện** ở client lẫn server.
- Tổng quan **chỉ đọc**: không ghi DB, không gọi `recordMovement`/ledger.
- Tiền là số nguyên đồng; tồn là số thực. Số hôm nay phải bằng `daySummary` hôm nay (dùng `profitReport`, không tính lại).
- Hằng số ở shared: `DEBT_OVERDUE_DAYS = 30`, `OVERVIEW_RECENT_ORDERS = 5`, `OVERVIEW_LOW_STOCK_ROWS = 10`, `OVERVIEW_TOP_PARTIES = 5`, `BACKUP_STALE_DAYS = 2`.
- Tồn thấp = `isActive && stock < minStock`; hết hàng = `isActive && stock <= 0` (đúng `filterProducts` `stock=low`/`stock=out`).
- Đường dẫn gốc `/` **vẫn** chuyển sang `/sell`. Thanh dưới điện thoại: Tổng quan 1, Bán hàng 2, Hóa đơn 3, Sản phẩm 4; Kiểm kê vào *Thêm*.
- UI dùng component có sẵn (`PageTitle`, `StatStrip`/`Stat`, `ListPanel`, `EmptyState`, `TableSkeleton`, `ProductAvatar`, shadcn `Card`/`Table`/`Badge`/`Button`), icon lucide-react, màu từ token (`text-warning`, `text-destructive`, `text-success`). Không viết mã màu.
- Mạng công ty chặn TLS: lệnh npm cần `NODE_EXTRA_CA_CERTS=<repo>/.certs/corp-root.pem`; **không bao giờ** tắt kiểm tra TLS.
- Không dùng/kill cổng 5173/5174; kiểm tra trên trình duyệt **không ghi** vào `data/grocery.db` (skill `browser-verify`).
- Chạy test/typecheck từ **gốc repo** (`npm test`, `npm run typecheck`) để `shared` được build trước; chạy một file: `cd server && npx vitest run src/services/overview.test.ts` (cần `shared/dist` mới: `npm run build -w shared` trước nếu vừa sửa shared).

## Review Focus

1. **Đơn bán lúc 23:30 giờ VN hôm qua** (16:30 UTC) không được lọt vào "hôm nay"; đơn 00:30 hôm nay phải có → test "ranh giới ngày địa phương" ở Task 2.
2. **Khách trả nợ đúng 30 ngày trước** → coi là nợ lâu (≥ 30), 29 ngày thì không → test "ngưỡng 30 ngày" ở Task 3.
3. **Tồn âm với mức tối thiểu 0** (bán quá tồn) → vẫn là "sắp hết", xếp đầu danh sách, không ném lỗi chia cho 0 → test "tồn âm" ở Task 2.
4. **Tiệm mới, DB trống, không có service sao lưu** → API trả 200 đủ khóa, `rows` đủ 7 ngày, client hiện "Mọi thứ ổn" chứ không trống → test "DB trống" ở Task 2/3 và route ở Task 4; trình duyệt ở Task 7.
5. **Server tắt khi đang mở trang trên điện thoại** → số cũ giữ nguyên (`placeholderData`), toast lỗi, không trắng trang → trình duyệt ở Task 7 (dừng server rồi bấm *Làm mới*).

---

## Cấu trúc file

| File | Việc |
|---|---|
| `shared/src/schemas/overview.ts` (mới) | 5 hằng số |
| `shared/src/types.ts` (sửa, thêm cuối) | `LowStockRow`, `OverdueCustomerRow`, `OverviewBackup`, `Overview` |
| `shared/src/index.ts` (sửa) | `export * from './schemas/overview.js'` |
| `server/src/services/orders.ts` (sửa) | thêm `recentOrders(db, start, end, limit)` |
| `server/src/services/overview.ts` (mới) + `overview.test.ts` (mới) | `overview(db, clock?, limits?)` |
| `server/src/routes/overview.ts` (mới) + `overview-api.test.ts` (mới) | `GET /api/overview` |
| `server/src/routes/index.ts` (sửa) | mount `/overview` |
| `server/src/routes/backups-api.test.ts` (sửa, thêm 1 case) | `backup` có khi có service |
| `client/src/api/overview.ts` (mới) | `useOverview()` |
| `client/src/pages/overview/OverviewPage.tsx`, `TodayStats.tsx`, `AlertsCard.tsx`, `WeekTable.tsx`, `RecentOrders.tsx`, `LowStockList.tsx`, `DebtPanel.tsx` (mới) | Trang và 6 khối |
| `client/src/router.tsx` (sửa) | mục menu *Tổng quan*, `mobile` mới, route `/overview` |
| `package.json`, `README.md`, `CLAUDE.md` (sửa) | 0.10.0, hướng dẫn kiểm thử, dòng "Đã xong" |

---

### Task 1: Shared – hằng số và types tổng quan

**Files:**
- Create: `shared/src/schemas/overview.ts`
- Modify: `shared/src/types.ts` (thêm cuối file)
- Modify: `shared/src/index.ts` (thêm 1 dòng sau `export * from './schemas/backups.js';`)

**Interfaces:**
- Produces: `DEBT_OVERDUE_DAYS`, `OVERVIEW_RECENT_ORDERS`, `OVERVIEW_LOW_STOCK_ROWS`, `OVERVIEW_TOP_PARTIES`, `BACKUP_STALE_DAYS`; types `LowStockRow`, `OverdueCustomerRow`, `OverviewBackup`, `Overview` (Task 2–6 dùng).

- [ ] **Step 1: Tạo `shared/src/schemas/overview.ts`**

```ts
// Trang Tổng quan (0.10.0): chỉ hằng số, API không có query.

/** Khách còn nợ mà giao dịch sổ nợ gần nhất cách hôm nay từ số ngày này trở lên thì coi là nợ lâu. */
export const DEBT_OVERDUE_DAYS = 30;
/** Số hóa đơn hôm nay hiện trên Tổng quan. */
export const OVERVIEW_RECENT_ORDERS = 5;
/** Số mặt hàng sắp hết hiện trên Tổng quan. */
export const OVERVIEW_LOW_STOCK_ROWS = 10;
/** Số khách / nhà cung cấp nợ nhiều nhất hiện trên Tổng quan. */
export const OVERVIEW_TOP_PARTIES = 5;
/** Quá số ngày này chưa có bản sao lưu nào thì cảnh báo. */
export const BACKUP_STALE_DAYS = 2;
```

- [ ] **Step 2: Thêm types vào cuối `shared/src/types.ts`**

```ts

// Tổng quan (0.10.0) – một API gom: 7 ngày qua profitReport, hóa đơn hôm nay, tồn thấp, công nợ, kiểm kê dở, sao lưu
export interface LowStockRow {
  productId: number;
  name: string;
  unit: string;
  stock: number;
  minStock: number;
}

export interface OverdueCustomerRow extends DebtPartyRow {
  /** Giao dịch sổ nợ gần nhất (ghi nợ hoặc trả nợ), null nếu chưa có. */
  lastActivityAt: string | null;
  /** Còn nợ và lastActivityAt cách hôm nay ≥ DEBT_OVERDUE_DAYS (hoặc null). */
  overdue: boolean;
}

export interface OverviewBackup {
  /** Bản sao mới nhất bất kỳ loại nào; null = chưa có. */
  lastBackupAt: string | null;
  lastAutoAt: string | null;
  lastError: string | null;
  extraError: string | null;
}

export interface Overview {
  /** Ngày địa phương hôm nay theo đồng hồ server, "YYYY-MM-DD". */
  today: string;
  /** profitReport 7 ngày đến hôm nay, gom theo ngày, rows[0] = hôm nay, rows[1] = hôm qua. */
  week: ProfitReport;
  /** Hóa đơn hôm nay mới nhất trước, kể cả đơn hủy. */
  recentOrders: OrderSummary[];
  /** count = số hàng đang bán có stock < minStock; outCount = stock ≤ 0; items cắt theo giới hạn, thiếu nặng nhất trước. */
  lowStock: { count: number; outCount: number; items: LowStockRow[] };
  customers: { total: number; count: number; overdueCount: number; overdueTotal: number; top: OverdueCustomerRow[] };
  suppliers: { total: number; count: number; top: DebtPartyRow[] };
  /** Phiếu kiểm kê đang mở, không kèm items; null nếu không có. */
  stocktake: StocktakeSummary | null;
  /** null khi server không cấu hình sao lưu (test). */
  backup: OverviewBackup | null;
}
```

- [ ] **Step 3: Export trong `shared/src/index.ts`**

Sau dòng `export * from './schemas/backups.js';` thêm:

```ts
export * from './schemas/overview.js';
```

- [ ] **Step 4: Build shared và typecheck**

Run: `npm run build -w shared && npm run typecheck`
Expected: không lỗi.

---

### Task 2: Server – `recentOrders` và `overview()` phần hôm nay / 7 ngày / hóa đơn / tồn thấp

**Files:**
- Modify: `server/src/services/orders.ts` (thêm hàm sau `listOrders`, trước `listOrdersForExport`, ~dòng 256)
- Create: `server/src/services/overview.ts`
- Test: `server/src/services/overview.test.ts`

**Interfaces:**
- Consumes: `profitReport(db, q, clock)` (`services/reports.ts`), `toSummary`, `itemCount` (nội bộ `orders.ts`), `resolveClock` (`services/daily-code.ts`), `localDate`, `localDayRange`, `datePresetRange`, hằng số Task 1.
- Produces: `recentOrders(db: Db, start: string, end: string, limit: number): OrderSummary[]` (export từ `orders.ts`); `overview(db: Db, clock?: Clock, limits?: Partial<OverviewLimits>): OverviewData` với `OverviewData = Omit<Overview, 'backup'>` và `OverviewLimits = { orders: number; lowStock: number; parties: number }` (Task 3 bổ sung phần còn lại, Task 4 dùng).

- [ ] **Step 1: Viết test thất bại `server/src/services/overview.test.ts`**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  customerCreateSchema,
  customerPaymentSchema,
  filterProducts,
  importInputSchema,
  orderInputSchema,
  orderListQuerySchema,
  productInputSchema,
  productViewQuerySchema,
  supplierInputSchema,
} from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { debtTransactions } from '../db/schema.js';
import { createTestDb } from '../db/test-db.js';
import { collectDebt, createCustomer, listCustomers } from './customers.js';
import { createImport } from './imports.js';
import { cancelOrder, createOrder, listOrders } from './orders.js';
import { overview } from './overview.js';
import { createProduct, listProducts, setProductActive } from './products.js';
import { createSupplier } from './suppliers.js';
import { countItem, openStocktake } from './stocktakes.js';

const VN = 420;
const at = (iso: string) => ({ now: new Date(iso), tzOffsetMin: VN });
const NOON = at('2026-09-29T05:00:00.000Z'); // 12:00 ngày 29/9 giờ VN: lúc xem
const LATE_28 = at('2026-09-28T16:30:00.000Z'); // 23:30 ngày 28/9 giờ VN
const EARLY_29 = at('2026-09-28T17:30:00.000Z'); // 00:30 ngày 29/9 giờ VN
const daysAgo = (n: number) => at(new Date(NOON.now.getTime() - n * 86_400_000).toISOString());

let db: Db;
beforeEach(() => {
  db = createTestDb();
});
const product = (o: Record<string, unknown>) => createProduct(db, productInputSchema.parse(o));
const order = (o: Record<string, unknown>, clock = NOON) =>
  createOrder(db, orderInputSchema.parse({ paymentMethod: 'cash', paid: 10_000_000, ...o }), clock);
/** createCustomer không nhận Clock (nợ đầu kỳ ghi giờ máy): lùi ngày mọi bút toán hiện có của khách để giả "nợ từ lâu". */
const backdate = (customerId: number, clock: { now: Date }) =>
  db.update(debtTransactions).set({ createdAt: clock.now.toISOString() }).where(eq(debtTransactions.customerId, customerId)).run();

describe('overview – hôm nay, 7 ngày, hóa đơn', () => {
  it('today theo giờ địa phương; week đủ 7 dòng mới nhất trước; rows[0] bằng summary trang Hóa đơn hôm nay; total = Σ rows', () => {
    const bia = product({ name: 'Bia', unit: 'lon', sellPrice: 12000, costPrice: 10000, stock: 100 });
    order({ items: [{ productId: bia.id, qty: 2, price: 12000 }] }, LATE_28); // hôm qua
    order({ items: [{ productId: bia.id, qty: 1, price: 12000 }] }, EARLY_29); // hôm nay 00:30
    order({ paymentMethod: 'transfer', paid: 24000, items: [{ productId: bia.id, qty: 2, price: 12000 }] }); // hôm nay trưa
    const o = overview(db, NOON);
    expect(o.today).toBe('2026-09-29');
    expect(o.week.range).toEqual({ from: '2026-09-23', to: '2026-09-29', groupBy: 'day' });
    expect(o.week.rows.map((r) => r.period)).toEqual(['2026-09-29', '2026-09-28', '2026-09-27', '2026-09-26', '2026-09-25', '2026-09-24', '2026-09-23']);
    expect(o.week.rows[0]).toMatchObject({ orders: 2, revenue: 36000, cost: 30000, profit: 6000, cash: 12000, transfer: 24000 });
    expect(o.week.rows[1]).toMatchObject({ orders: 1, revenue: 24000 });
    const s = listOrders(db, orderListQuerySchema.parse({ from: '2026-09-29', to: '2026-09-29' }), NOON).summary;
    expect(o.week.rows[0]).toMatchObject({ orders: s.count, revenue: s.total, cash: s.cash, transfer: s.transfer, debt: s.debt, debtCollected: s.debtCollected });
    expect(o.week.total.revenue).toBe(o.week.rows.reduce((sum, r) => sum + r.revenue, 0));
  });

  it('recentOrders: chỉ hôm nay, mới nhất trước, kể cả đơn hủy, cắt theo limits.orders', () => {
    const bia = product({ name: 'Bia', unit: 'lon', sellPrice: 12000, costPrice: 10000, stock: 100 });
    order({ items: [{ productId: bia.id, qty: 1, price: 12000 }] }, LATE_28); // hôm qua: không có
    const ids = Array.from({ length: 6 }, () => order({ items: [{ productId: bia.id, qty: 1, price: 12000 }] }).id);
    cancelOrder(db, ids[5], NOON);
    const o = overview(db, NOON, { orders: 5 });
    expect(o.recentOrders.map((r) => r.id)).toEqual([ids[5], ids[4], ids[3], ids[2], ids[1]]);
    expect(o.recentOrders[0]).toMatchObject({ status: 'cancelled', itemCount: 1, payable: 12000, paymentMethod: 'cash' });
    expect(overview(db, NOON).recentOrders).toHaveLength(5);
  });
});

describe('overview – hàng sắp hết', () => {
  it('stock < minStock của hàng đang bán; outCount đếm stock ≤ 0; sắp theo tỉ lệ tăng dần; count đếm cả ngoài limit; khớp filterProducts', () => {
    product({ name: 'Nước', unit: 'chai', sellPrice: 1, stock: 2, minStock: 10 }); // 0,2
    product({ name: 'Kẹo', unit: 'gói', sellPrice: 1, stock: 5, minStock: 10 }); // 0,5
    product({ name: 'Bánh', unit: 'gói', sellPrice: 1, stock: 0, minStock: 4 }); // 0 → hết hàng
    product({ name: 'Đủ', unit: 'cái', sellPrice: 1, stock: 10, minStock: 10 }); // không thấp
    product({ name: 'Không đặt mức', unit: 'cái', sellPrice: 1, stock: 0, minStock: 0 }); // hết nhưng không thấp
    const off = product({ name: 'Ngừng', unit: 'cái', sellPrice: 1, stock: 0, minStock: 5 });
    setProductActive(db, off.id, false);
    const o = overview(db, NOON, { lowStock: 2 });
    expect(o.lowStock.count).toBe(3);
    expect(o.lowStock.outCount).toBe(2);
    expect(o.lowStock.items.map((i) => i.name)).toEqual(['Bánh', 'Nước']);
    expect(o.lowStock.items[0]).toEqual({ productId: expect.any(Number), name: 'Bánh', unit: 'gói', stock: 0, minStock: 4 });
    expect(overview(db, NOON).lowStock.items).toHaveLength(3);
    const shown = listProducts(db, { includeInactive: false });
    expect(o.lowStock.count).toBe(filterProducts(shown, productViewQuerySchema.parse({ stock: 'low' })).length);
    expect(o.lowStock.outCount).toBe(filterProducts(shown, productViewQuerySchema.parse({ stock: 'out' })).length);
  });

  it('tồn âm với minStock = 0 vẫn là sắp hết và xếp đầu, không lỗi chia 0', () => {
    const am = product({ name: 'Âm', unit: 'cái', sellPrice: 1, stock: 3, minStock: 0 });
    order({ items: [{ productId: am.id, qty: 5, price: 1 }] }); // tồn −2
    product({ name: 'Thấp', unit: 'cái', sellPrice: 1, stock: 1, minStock: 10 });
    const o = overview(db, NOON);
    expect(o.lowStock.items.map((i) => i.name)).toEqual(['Âm', 'Thấp']);
    expect(o.lowStock.items[0].stock).toBe(-2);
  });
});
```

(Các import `customerCreateSchema`, `customerPaymentSchema`, `importInputSchema`, `supplierInputSchema`, `collectDebt`, `createCustomer`, `listCustomers`, `createImport`, `createSupplier`, `countItem`, `openStocktake` dùng ở Task 3; TypeScript trong vitest không chặn import chưa dùng.)

- [ ] **Step 2: Chạy test, xác nhận thất bại**

Run: `npm run build -w shared && cd server && npx vitest run src/services/overview.test.ts`
Expected: FAIL – `Cannot find module './overview.js'`.

- [ ] **Step 3: Thêm `recentOrders` vào `server/src/services/orders.ts`**

Ngay sau hàm `listOrders` (sau dòng `return { orders: list, summary: daySummary(db, start, end), total, page, pageSize: PAGE_SIZE };` và dấu `}`), trước comment `/** Mọi hóa đơn khớp bộ lọc …`:

```ts

/** Hóa đơn mới nhất trong [start, end) (ISO UTC), mọi trạng thái, không phân trang; trang Tổng quan. */
export function recentOrders(db: Db, start: string, end: string, limit: number): OrderSummary[] {
  return db
    .select({ order: orders, itemCount, customerName: customers.name })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(and(gte(orders.createdAt, start), lt(orders.createdAt, end)))
    .orderBy(desc(orders.id))
    .limit(limit)
    .all()
    .map((r) => toSummary(r.order, Number(r.itemCount), r.customerName));
}
```

- [ ] **Step 4: Tạo `server/src/services/overview.ts`**

```ts
import { eq } from 'drizzle-orm';
import {
  datePresetRange,
  localDate,
  localDayRange,
  OVERVIEW_LOW_STOCK_ROWS,
  OVERVIEW_RECENT_ORDERS,
  OVERVIEW_TOP_PARTIES,
  type LowStockRow,
  type Overview,
} from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { products } from '../db/schema.js';
import { resolveClock, type Clock } from './daily-code.js';
import { recentOrders } from './orders.js';
import { profitReport } from './reports.js';

export interface OverviewLimits {
  orders: number;
  lowStock: number;
  parties: number;
}
const DEFAULT_LIMITS: OverviewLimits = { orders: OVERVIEW_RECENT_ORDERS, lowStock: OVERVIEW_LOW_STOCK_ROWS, parties: OVERVIEW_TOP_PARTIES };

/** Phần server tính; route ghép thêm `backup` từ BackupService. */
export type OverviewData = Omit<Overview, 'backup'>;

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'vi');

/** Hàng đang bán dưới mức tối thiểu, thiếu nặng nhất trước. minStock = 0 mà vẫn thấp nghĩa là tồn âm → xếp đầu. */
function lowStock(db: Db, limit: number): Overview['lowStock'] {
  const active = db.select().from(products).where(eq(products.isActive, true)).all();
  const low = active.filter((p) => p.stock < p.minStock);
  const ratio = (p: { stock: number; minStock: number }) => (p.minStock > 0 ? p.stock / p.minStock : Number.NEGATIVE_INFINITY);
  const items: LowStockRow[] = low
    .sort((a, b) => ratio(a) - ratio(b) || byName(a, b))
    .slice(0, limit)
    .map((p) => ({ productId: p.id, name: p.name, unit: p.unit, stock: p.stock, minStock: p.minStock }));
  return { count: low.length, outCount: active.filter((p) => p.stock <= 0).length, items };
}

/** Tổng quan tại thời điểm xem: chỉ đọc, không transaction. Giới hạn dòng truyền vào để test. */
export function overview(db: Db, clock?: Clock, limits: Partial<OverviewLimits> = {}): OverviewData {
  const lim = { ...DEFAULT_LIMITS, ...limits };
  const { now, tz } = resolveClock(clock);
  const today = localDate(now, tz);
  const { start, end } = localDayRange(today, tz);
  return {
    today,
    week: profitReport(db, datePresetRange('last7', today), clock),
    recentOrders: recentOrders(db, start, end, lim.orders),
    lowStock: lowStock(db, lim.lowStock),
    customers: { total: 0, count: 0, overdueCount: 0, overdueTotal: 0, top: [] },
    suppliers: { total: 0, count: 0, top: [] },
    stocktake: null,
  };
}
```

(`customers`, `suppliers`, `stocktake` tạm là giá trị rỗng; Task 3 thay bằng tính thật. `ratio(a) - ratio(b)` với hai `−∞` cho `NaN`, `||` rơi sang so tên: đúng ý.)

- [ ] **Step 5: Chạy test, xác nhận đạt**

Run: `cd server && npx vitest run src/services/overview.test.ts`
Expected: PASS 4 test.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: không lỗi.

---

### Task 3: Server – `overview()` phần khách nợ (nợ lâu), nợ NCC, kiểm kê dở, DB trống

**Files:**
- Modify: `server/src/services/overview.ts` (thay 3 giá trị rỗng ở Task 2)
- Test: `server/src/services/overview.test.ts` (thêm 2 `describe`)

**Interfaces:**
- Consumes: `getCurrentStocktake(db)` (`services/stocktakes.ts`, trả `StocktakeDetail | null`), `shiftDate`, `DEBT_OVERDUE_DAYS`, schema `customers`, `suppliers`, subquery `debt_transactions`.
- Produces: `overview()` đủ mọi khóa của `OverviewData`.

- [ ] **Step 1: Thêm test vào cuối `overview.test.ts`**

```ts

describe('overview – công nợ và kiểm kê', () => {
  it('khách: chỉ đang theo dõi có nợ > 0; nợ lâu khi giao dịch gần nhất ≥ 30 ngày; top cắt theo limits.parties; total = listCustomers().totalDebt', () => {
    const ba = createCustomer(db, customerCreateSchema.parse({ name: 'Cô Ba', openingDebt: 350000 }));
    backdate(ba.id, daysAgo(31)); // 31 ngày: lâu
    const lan = createCustomer(db, customerCreateSchema.parse({ name: 'Chị Lan', openingDebt: 100000 }));
    backdate(lan.id, daysAgo(40));
    collectDebt(db, lan.id, customerPaymentSchema.parse({ amount: 10000, method: 'cash' }), daysAgo(29)); // trả 29 ngày trước: chưa lâu
    const tu = createCustomer(db, customerCreateSchema.parse({ name: 'Anh Tư', openingDebt: 50000 }));
    backdate(tu.id, daysAgo(30)); // đúng 30 ngày: lâu
    const nam = createCustomer(db, customerCreateSchema.parse({ name: 'Anh Năm', openingDebt: 20000 }));
    collectDebt(db, nam.id, customerPaymentSchema.parse({ amount: 20000, method: 'cash' }), daysAgo(60)); // hết nợ: không tính
    backdate(nam.id, daysAgo(60));
    createCustomer(db, customerCreateSchema.parse({ name: 'Chị Sáu', openingDebt: 1000 })); // nợ 1.000 hôm nay (giờ máy)

    const o = overview(db, NOON, { parties: 3 });
    expect(o.customers.total).toBe(listCustomers(db).totalDebt);
    expect(o.customers).toMatchObject({ total: 491000, count: 4, overdueCount: 2, overdueTotal: 400000 });
    expect(o.customers.top.map((c) => [c.name, c.debt, c.overdue])).toEqual([
      ['Cô Ba', 350000, true],
      ['Chị Lan', 90000, false],
      ['Anh Tư', 50000, true],
    ]);
    expect(o.customers.top[0]).toMatchObject({ id: ba.id, phone: null, lastActivityAt: expect.stringMatching(/^2026-08-29T/) });
    expect(o.customers.top[2].id).toBe(tu.id);
    expect(overview(db, NOON).customers.top).toHaveLength(4);
  });

  it('NCC: nợ > 0 đang theo dõi, top giảm dần cắt theo limits.parties', () => {
    const bia = product({ name: 'Bia', unit: 'lon', sellPrice: 12000, costPrice: 10000, stock: 100 });
    const hung = createSupplier(db, supplierInputSchema.parse({ name: 'Đại lý Hùng' }));
    const minh = createSupplier(db, supplierInputSchema.parse({ name: 'Kho Minh' }));
    createSupplier(db, supplierInputSchema.parse({ name: 'Không nợ' }));
    createImport(db, importInputSchema.parse({ supplierId: hung.id, paid: 100000, items: [{ productId: bia.id, qty: 10, unitCost: 15000 }] }), NOON); // nợ 50.000
    createImport(db, importInputSchema.parse({ supplierId: minh.id, paid: 0, items: [{ productId: bia.id, qty: 10, unitCost: 15000 }] }), NOON); // nợ 150.000
    const o = overview(db, NOON, { parties: 1 });
    expect(o.suppliers).toEqual({ total: 200000, count: 2, top: [{ id: minh.id, name: 'Kho Minh', phone: null, debt: 150000 }] });
  });

  it('kiểm kê: không có phiếu mở → null; có → tóm tắt không kèm items', () => {
    expect(overview(db, NOON).stocktake).toBeNull();
    const a = product({ name: 'A', unit: 'cái', sellPrice: 1, costPrice: 1, stock: 10 });
    const b = product({ name: 'B', unit: 'cái', sellPrice: 1, costPrice: 1, stock: 10 });
    const s = openStocktake(db, { note: null }, NOON);
    countItem(db, s.id, a.id, { counted: 8 }, NOON);
    countItem(db, s.id, b.id, { counted: 10 }, NOON);
    const st = overview(db, NOON).stocktake!;
    expect(st).toMatchObject({ id: s.id, code: s.code, status: 'open', itemCount: 2, diffCount: 1, diffValue: -2 });
    expect('items' in st).toBe(false);
  });
});

describe('overview – tiệm mới', () => {
  it('DB trống: không ném lỗi, mọi số 0, week đủ 7 ngày', () => {
    const o = overview(db, NOON);
    expect(o).toMatchObject({
      today: '2026-09-29',
      recentOrders: [],
      lowStock: { count: 0, outCount: 0, items: [] },
      customers: { total: 0, count: 0, overdueCount: 0, overdueTotal: 0, top: [] },
      suppliers: { total: 0, count: 0, top: [] },
      stocktake: null,
    });
    expect(o.week.rows).toHaveLength(7);
    expect(o.week.total.orders).toBe(0);
    expect('backup' in o).toBe(false);
  });
});
```

`backdate` đã khai báo ở đầu file (Task 2 Step 1). `collectDebt` nhận `clock` nên không cần lùi ngày thêm; với Anh Năm, `backdate` sau `collectDebt` lùi cả hai bút toán về 60 ngày (khách hết nợ nên không ảnh hưởng kết quả).

- [ ] **Step 2: Chạy test, xác nhận thất bại**

Run: `cd server && npx vitest run src/services/overview.test.ts`
Expected: FAIL ở 3 test mới (`customers.total` 0 ≠ 491000, `suppliers` rỗng, `stocktake` null khi có phiếu mở); test "tiệm mới" có thể đã PASS.

- [ ] **Step 3: Hoàn thiện `overview.ts`**

Đổi import đầu file thành:

```ts
import { and, eq, gt, sql } from 'drizzle-orm';
import {
  datePresetRange,
  DEBT_OVERDUE_DAYS,
  localDate,
  localDayRange,
  OVERVIEW_LOW_STOCK_ROWS,
  OVERVIEW_RECENT_ORDERS,
  OVERVIEW_TOP_PARTIES,
  shiftDate,
  type DebtPartyRow,
  type LowStockRow,
  type OverdueCustomerRow,
  type Overview,
} from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { customers, products, suppliers } from '../db/schema.js';
import { resolveClock, type Clock } from './daily-code.js';
import { recentOrders } from './orders.js';
import { profitReport } from './reports.js';
import { getCurrentStocktake } from './stocktakes.js';
```

Thêm sau hàm `lowStock`:

```ts

/** Σ nợ, số người nợ và top nợ nhiều nhất của danh sách đã lọc `debt > 0`. */
function debtSummary<T extends DebtPartyRow>(owing: T[], limit: number): { total: number; count: number; top: T[] } {
  const sorted = [...owing].sort((a, b) => b.debt - a.debt || byName(a, b));
  return { total: sorted.reduce((s, x) => s + x.debt, 0), count: sorted.length, top: sorted.slice(0, limit) };
}

/** Khách đang nợ; nợ lâu = giao dịch sổ nợ gần nhất (ghi nợ hay trả nợ) cách hôm nay ≥ DEBT_OVERDUE_DAYS. */
function customerDebt(db: Db, today: string, tz: number, limit: number): Overview['customers'] {
  // Viết tên bảng cứng trong subquery (drizzle bỏ tiền tố bảng khi render cột), như listCustomers
  const lastActivityAt = sql<string | null>`(select max(created_at) from debt_transactions where debt_transactions.customer_id = customers.id)`;
  const cutoff = shiftDate(today, -DEBT_OVERDUE_DAYS);
  const owing: OverdueCustomerRow[] = db
    .select({ id: customers.id, name: customers.name, phone: customers.phone, debt: customers.debt, lastActivityAt })
    .from(customers)
    .where(and(eq(customers.isActive, true), gt(customers.debt, 0)))
    .all()
    .map((c) => ({ ...c, overdue: c.lastActivityAt === null || localDate(new Date(c.lastActivityAt), tz) <= cutoff }));
  const overdue = owing.filter((c) => c.overdue);
  return { ...debtSummary(owing, limit), overdueCount: overdue.length, overdueTotal: overdue.reduce((s, c) => s + c.debt, 0) };
}

function supplierDebt(db: Db, limit: number): Overview['suppliers'] {
  const owing: DebtPartyRow[] = db
    .select({ id: suppliers.id, name: suppliers.name, phone: suppliers.phone, debt: suppliers.debt })
    .from(suppliers)
    .where(and(eq(suppliers.isActive, true), gt(suppliers.debt, 0)))
    .all();
  return debtSummary(owing, limit);
}
```

Trong `overview()` thay ba dòng tạm bằng:

```ts
    customers: customerDebt(db, today, tz, lim.parties),
    suppliers: supplierDebt(db, lim.parties),
    stocktake: openStocktakeSummary(db),
```

và thêm trước `overview()`:

```ts

/** Phiếu kiểm kê đang mở, bỏ items (có thể hàng trăm dòng) như listStocktakes. */
function openStocktakeSummary(db: Db): Overview['stocktake'] {
  const cur = getCurrentStocktake(db);
  if (!cur) return null;
  const { items: _items, ...summary } = cur;
  return summary;
}
```

- [ ] **Step 4: Chạy test, xác nhận đạt**

Run: `cd server && npx vitest run src/services/overview.test.ts`
Expected: PASS 8 test.

- [ ] **Step 5: Chạy toàn bộ test và typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS toàn bộ (test cũ của orders/reports không đổi).

---

### Task 4: Server – route `GET /api/overview`

**Files:**
- Create: `server/src/routes/overview.ts`
- Modify: `server/src/routes/index.ts` (import + 1 dòng mount)
- Test: `server/src/routes/overview-api.test.ts` (mới), `server/src/routes/backups-api.test.ts` (thêm 1 `it`)

**Interfaces:**
- Consumes: `overview(db)` Task 3; `BackupService.status(): BackupStatus` (`items[0]` mới nhất, `lastAutoAt`, `lastError`, `extraError`).
- Produces: `GET /api/overview` → `Overview` (JSON). Client Task 5 gọi.

- [ ] **Step 1: Viết test thất bại `server/src/routes/overview-api.test.ts`**

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

describe('API tổng quan', () => {
  it('GET /api/overview trả đủ khóa; không có service sao lưu → backup null', async () => {
    const res = await fetch(`${base}/api/overview`);
    expect(res.status).toBe(200);
    const o = await res.json();
    expect(o.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(o.week.rows).toHaveLength(7);
    expect(o.week.rows[0].period).toBe(o.today);
    expect(o).toMatchObject({
      recentOrders: [],
      lowStock: { count: 0, outCount: 0, items: [] },
      customers: { total: 0, count: 0, overdueCount: 0, overdueTotal: 0, top: [] },
      suppliers: { total: 0, count: 0, top: [] },
      stocktake: null,
      backup: null,
    });
  });
});
```

Thêm vào cuối `describe('API sao lưu', …)` trong `backups-api.test.ts` (trước dấu `});` đóng describe):

```ts

  it('GET /api/overview có backup.lastBackupAt bằng bản sao mới nhất', async () => {
    const created = await call('POST', '/api/backups');
    const o = (await call('GET', '/api/overview')).json;
    expect(o.backup).toEqual({ lastBackupAt: created.json.createdAt, lastAutoAt: null, lastError: null, extraError: null });
  });
```

(Nếu test đầu của file đã xóa hết bản sao thì bản vừa tạo là duy nhất; nếu còn bản khác, `lastBackupAt` vẫn là bản mới nhất vì `items` mới nhất trước – `toEqual` với `created.json.createdAt` vẫn đúng khi bản vừa tạo mới nhất.)

- [ ] **Step 2: Chạy test, xác nhận thất bại**

Run: `cd server && npx vitest run src/routes/overview-api.test.ts src/routes/backups-api.test.ts`
Expected: FAIL – status 404 (`{ error: 'Không tìm thấy' }`).

- [ ] **Step 3: Tạo `server/src/routes/overview.ts`**

```ts
import { Router } from 'express';
import type { OverviewBackup } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import type { BackupService } from '../services/backups.js';
import { overview } from '../services/overview.js';

/** Phần sao lưu của Tổng quan: bản mới nhất bất kỳ loại nào + lỗi gần nhất. */
function backupSummary(backups: BackupService): OverviewBackup {
  const s = backups.status();
  return { lastBackupAt: s.items[0]?.createdAt ?? null, lastAutoAt: s.lastAutoAt, lastError: s.lastError, extraError: s.extraError };
}

/** Tổng quan chỉ đọc, không query; `backup` null khi server không cấu hình sao lưu (test). */
export function overviewRouter(db: Db, backups?: BackupService): Router {
  const r = Router();
  r.get('/', (_req, res) => res.json({ ...overview(db), backup: backups ? backupSummary(backups) : null }));
  return r;
}
```

- [ ] **Step 4: Mount trong `server/src/routes/index.ts`**

Thêm import sau `import { backupsRouter } from './backups.js';`:

```ts
import { overviewRouter } from './overview.js';
```

Thêm sau dòng `r.use('/reports', reportsRouter(db));`:

```ts
  r.use('/overview', overviewRouter(db, deps.backups));
```

- [ ] **Step 5: Chạy test, xác nhận đạt**

Run: `cd server && npx vitest run src/routes/overview-api.test.ts src/routes/backups-api.test.ts`
Expected: PASS.

- [ ] **Step 6: Toàn bộ test + typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS.

---

### Task 5: Client – hook, menu/route, trang khung, khối Hôm nay và 7 ngày

**Files:**
- Create: `client/src/api/overview.ts`, `client/src/pages/overview/OverviewPage.tsx`, `TodayStats.tsx`, `WeekTable.tsx`
- Modify: `client/src/router.tsx` (import icon + `NAV` + `Route`)

**Interfaces:**
- Consumes: `GET /api/overview` → `Overview`; `Stat`, `StatStrip`, `ListPanel`, `TableSkeleton`, `PageTitle`, `formatMoney`, `formatDateVn`, `shiftDate`, `today()` (`lib/today.ts`).
- Produces: `useOverview()`; `OverviewPage` có chỗ gắn 4 khối còn lại (Task 6 thay các `{/* Task 6 */}`); `TodayStats({ week, outCount })`, `WeekTable({ week, today, loading })`.

- [ ] **Step 1: Tạo `client/src/api/overview.ts`**

```ts
import { useQuery } from '@tanstack/react-query';
import type { Overview } from '@tiny-pos/shared';
import { api } from './client';

/**
 * Tổng quan: dưới khóa ['reports'] để mọi mutation bán/hủy/nhập/thu nợ/kiểm kê đã invalidate ['reports'] làm tươi luôn.
 * Tự làm mới mỗi phút khi tab đang mở (TanStack mặc định không refetch khi tab ẩn); giữ số cũ khi tải lại để không nháy.
 */
export const useOverview = () =>
  useQuery({ queryKey: ['reports', 'overview'], queryFn: () => api<Overview>('/overview'), refetchInterval: 60_000, placeholderData: (prev) => prev });
```

- [ ] **Step 2: Tạo `client/src/pages/overview/TodayStats.tsx`**

```tsx
import { Link } from 'react-router';
import { formatMoney, type ProfitReport } from '@tiny-pos/shared';
import { Stat, StatStrip } from '@/components/StatStrip';

const percent = (profit: number, revenue: number) => (revenue > 0 ? `${((profit / revenue) * 100).toFixed(1).replace('.', ',')}% doanh thu` : undefined);
const tone = (n: number) => (n > 0 ? 'success' : n < 0 ? 'danger' : 'default');
/** "+120.000 ₫" / "−30.000 ₫" / "0 ₫". */
const signed = (n: number) => (n > 0 ? `+${formatMoney(n)}` : n < 0 ? `−${formatMoney(-n)}` : formatMoney(0));
/** Ô số liệu bấm được: bọc Stat bằng Link, vòng focus như nút (như thẻ Mặt hàng của Báo cáo). */
const LINK = 'block rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';
const DASH = '—';

/** Hai hàng số liệu hôm nay; rows[0] của báo cáo 7 ngày là hôm nay, rows[1] hôm qua. Chưa có dữ liệu thì "—". */
export function TodayStats({ week, outCount }: { week: ProfitReport | undefined; outCount: number | undefined }) {
  const t = week?.rows[0];
  const y = week?.rows[1];
  const money = (n: number | undefined) => (n === undefined ? DASH : formatMoney(n));
  const collected = t ? t.debtCollected.cash + t.debtCollected.transfer : undefined;
  const diff = t && y ? t.revenue - y.revenue : undefined;
  return (
    <>
      <StatStrip>
        <Stat label="Doanh thu hôm nay" value={money(t?.revenue)} hint={t ? (t.orders ? `${t.orders} đơn` : 'Chưa có hóa đơn hôm nay') : undefined} />
        <Stat label="Lãi gộp" value={money(t?.profit)} hint={t ? percent(t.profit, t.revenue) : undefined} tone={tone(t?.profit ?? 0)} />
        <Stat label="Tiền mặt" value={money(t?.cash)} hint="Gồm trả trước của đơn ghi nợ" />
        <Stat label="Chuyển khoản" value={money(t?.transfer)} />
      </StatStrip>
      <StatStrip>
        <Stat label="Ghi nợ" value={money(t?.debt)} hint="Phần khách còn thiếu" tone={t?.debt ? 'danger' : 'default'} />
        <Stat
          label="Thu nợ"
          value={money(collected)}
          hint={t ? `Tiền mặt ${formatMoney(t.debtCollected.cash)} · CK ${formatMoney(t.debtCollected.transfer)}` : undefined}
          tone={collected ? 'success' : 'default'}
        />
        <Stat label="So với hôm qua" value={diff === undefined ? DASH : signed(diff)} hint={y ? `Hôm qua ${formatMoney(y.revenue)}` : undefined} tone={tone(diff ?? 0)} />
        <Link to="/products?stock=out" className={LINK}>
          <Stat label="Hết hàng" value={outCount === undefined ? DASH : `${outCount} mặt hàng`} hint="Bấm để xem" tone={outCount ? 'danger' : 'default'} />
        </Link>
      </StatStrip>
    </>
  );
}
```

- [ ] **Step 3: Tạo `client/src/pages/overview/WeekTable.tsx`**

```tsx
import { BarChart3 } from 'lucide-react';
import { Link } from 'react-router';
import { formatDateVn, formatMoney, shiftDate, type ProfitReport, type ProfitRow } from '@tiny-pos/shared';
import { ListPanel } from '@/components/ListPanel';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const CELL = 'px-3 py-3 md:px-4';
const MONEY = `${CELL} text-right tabular-nums`;
const HEAD = 'bg-muted/40 hover:bg-muted/40';

/** Hôm nay / Hôm qua / dd/mm. */
function dayLabel(period: string, today: string): string {
  if (period === today) return 'Hôm nay';
  if (period === shiftDate(today, -1)) return 'Hôm qua';
  return formatDateVn(period).slice(0, 5);
}

function Row({ r, label, total = false }: { r: ProfitRow; label: string; total?: boolean }) {
  const cls = total ? 'font-semibold' : '';
  return (
    <TableRow className={total ? HEAD : undefined}>
      <TableCell className={`${CELL} ${cls}`}>{label}</TableCell>
      <TableCell className={`${MONEY} ${cls}`}>{r.orders}</TableCell>
      <TableCell className={`${MONEY} ${cls}`}>{formatMoney(r.revenue)}</TableCell>
      <TableCell className={`${MONEY} font-semibold ${r.profit < 0 ? 'text-destructive' : ''}`}>{formatMoney(r.profit)}</TableCell>
    </TableRow>
  );
}

/** Bảng 7 ngày gần đây từ báo cáo lãi lỗ (ngày trống vẫn có dòng 0), dòng Tổng; nút sang Báo cáo. */
export function WeekTable({ week, today, loading }: { week: ProfitReport | undefined; today: string; loading: boolean }) {
  return (
    <ListPanel
      toolbar={
        <>
          <h2 className="text-sm font-semibold">7 ngày gần đây</h2>
          <Button variant="outline" size="sm" className="ml-auto" asChild>
            <Link to="/reports">
              <BarChart3 data-icon="inline-start" />
              Báo cáo
            </Link>
          </Button>
        </>
      }
    >
      {loading || !week ? (
        <TableSkeleton rows={7} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className={HEAD}>
              <TableHead className="px-3 md:px-4">Ngày</TableHead>
              <TableHead className="px-3 text-right md:px-4">Số đơn</TableHead>
              <TableHead className="px-3 text-right md:px-4">Doanh thu</TableHead>
              <TableHead className="px-3 text-right md:px-4">Lãi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {week.rows.map((r) => (
              <Row key={r.period} r={r} label={dayLabel(r.period, today)} />
            ))}
            <Row r={week.total} label="Tổng" total />
          </TableBody>
        </Table>
      )}
    </ListPanel>
  );
}
```

- [ ] **Step 4: Tạo `client/src/pages/overview/OverviewPage.tsx`**

```tsx
import { RefreshCw } from 'lucide-react';
import { formatDateVn } from '@tiny-pos/shared';
import { useOverview } from '@/api/overview';
import { PageTitle } from '@/components/layout/PageTitle';
import { today as todayOf } from '@/lib/today';
import { TodayStats } from './TodayStats';
import { WeekTable } from './WeekTable';

/**
 * Tổng quan: một API, tự làm mới mỗi phút. Hôm nay và Cần chú ý chiếm cả hàng; 5 khối còn lại lưới 2 cột trên máy tính.
 * Ngày lấy theo server khi đã có dữ liệu (điện thoại và máy quầy cùng một "hôm nay").
 */
export function OverviewPage() {
  const { data, isLoading, isFetching, refetch } = useOverview();
  const today = data?.today ?? todayOf();
  const loading = isLoading || !data;
  return (
    <>
      <PageTitle
        title="Tổng quan"
        count={formatDateVn(today)}
        actions={[{ label: isFetching ? 'Đang tải…' : 'Làm mới', icon: RefreshCw, onClick: () => void refetch(), disabled: isFetching }]}
      />
      <TodayStats week={data?.week} outCount={data?.lowStock.outCount} />
      {/* Task 6: AlertsCard */}
      <div className="grid gap-(--gap) lg:grid-cols-2">
        <WeekTable week={data?.week} today={today} loading={loading} />
        {/* Task 6: RecentOrders, LowStockList, DebtPanel ×2 */}
      </div>
    </>
  );
}
```

- [ ] **Step 5: Sửa `client/src/router.tsx`**

Dòng import đầu: thêm `LayoutDashboard` vào danh sách icon (giữ thứ tự chữ cái: sau `FolderOpen`, trước `Package`):

```ts
import { BarChart3, ClipboardList, FolderOpen, LayoutDashboard, Package, PackageOpen, ReceiptText, Settings, ShoppingCart, Truck, Users, type LucideIcon } from 'lucide-react';
```

Thêm import trang (sau `import { OrdersPage } …`):

```ts
import { OverviewPage } from './pages/overview/OverviewPage';
```

Sửa `NAV` (chỉ các dòng này; dòng khác giữ nguyên):

```ts
export const NAV: NavItem[] = [
  { to: '/overview', label: 'Tổng quan', icon: LayoutDashboard, group: 'sell', mobile: 1 },
  { to: '/sell', label: 'Bán hàng', icon: ShoppingCart, group: 'sell', mobile: 2 },
  { to: '/orders', label: 'Hóa đơn', icon: ReceiptText, group: 'sell', mobile: 3 },
  { to: '/reports', label: 'Báo cáo', icon: BarChart3, group: 'sell' },
  { to: '/customers', label: 'Khách hàng', icon: Users, group: 'sell' },
  { to: '/products', label: 'Sản phẩm', icon: Package, group: 'stock', mobile: 4 },
  { to: '/imports', label: 'Nhập hàng', icon: PackageOpen, group: 'stock' },
  { to: '/stocktake', label: 'Kiểm kê', icon: ClipboardList, group: 'stock' },
  { to: '/categories', label: 'Danh mục', icon: FolderOpen, group: 'stock' },
  { to: '/suppliers', label: 'Nhà cung cấp', icon: Truck, group: 'other' },
  { to: '/settings', label: 'Cài đặt', icon: Settings, group: 'other' },
];
```

Thêm route sau `<Route path="/" element={<Navigate to="/sell" replace />} />`:

```tsx
      <Route path="/overview" element={<OverviewPage />} />
```

`/` **không đổi**.

- [ ] **Step 6: Typecheck và build**

Run: `npm run typecheck && npm run build -w client`
Expected: không lỗi.

- [ ] **Step 7: Xem nhanh trên trình duyệt** (skill `browser-verify`, `npm run dev` đang chạy, chặn request ghi)

Mở `http://localhost:5180/overview` cỡ 1280 và 390 px: tiêu đề "Tổng quan" + ngày; hai hàng số; bảng 7 ngày có "Hôm nay"/"Hôm qua" và dòng Tổng; sidebar có *Tổng quan* đầu nhóm Bán hàng; thanh dưới điện thoại: Tổng quan · Bán hàng · Hóa đơn · Sản phẩm · Thêm (có Kiểm kê). Mở `/` → chuyển sang `/sell`.

---

### Task 6: Client – Cần chú ý, Hóa đơn hôm nay, Hàng sắp hết, Khách nợ, Nợ NCC

**Files:**
- Create: `client/src/pages/overview/AlertsCard.tsx`, `RecentOrders.tsx`, `LowStockList.tsx`, `DebtPanel.tsx`
- Modify: `client/src/pages/overview/OverviewPage.tsx` (thay 2 comment Task 6)

**Interfaces:**
- Consumes: `Overview` (Task 1), `METHOD_LABEL` (export sẵn ở `pages/orders/OrderTable.tsx`), `ProductAvatar`, `formatQty`, `localDate`, `currentTzOffset`, `shiftDate`, `BACKUP_STALE_DAYS`, `DEBT_OVERDUE_DAYS`.
- Produces: `AlertsCard({ data, today, loading })`, `RecentOrders({ orders, count, loading })`, `LowStockList({ low, loading })`, `DebtPanel({...})`.

- [ ] **Step 1: Tạo `client/src/pages/overview/AlertsCard.tsx`**

```tsx
import { CircleCheck, ClipboardList, DatabaseBackup, PackageMinus, PackageX, TriangleAlert, Users, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { BACKUP_STALE_DAYS, currentTzOffset, DEBT_OVERDUE_DAYS, formatDateVn, formatMoney, localDate, shiftDate, type Overview } from '@tiny-pos/shared';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type Tone = 'warning' | 'destructive';
interface Alert {
  key: string;
  icon: LucideIcon;
  text: string;
  tone: Tone;
  to: string;
  action: string;
}
const TONE: Record<Tone, string> = { warning: 'text-warning', destructive: 'text-destructive' };
const localDay = (iso: string) => localDate(new Date(iso), currentTzOffset());

/** Danh sách cảnh báo theo thứ tự spec: sao lưu lỗi → sao lưu cũ → kiểm kê dở → hết hàng → sắp hết → nợ lâu. */
export function buildAlerts(o: Overview, today: string): Alert[] {
  const list: Alert[] = [];
  const b = o.backup;
  if (b?.lastError) list.push({ key: 'backup-error', icon: DatabaseBackup, text: `Sao lưu tự động gần nhất bị lỗi: ${b.lastError}`, tone: 'destructive', to: '/settings', action: 'Cài đặt' });
  if (b?.extraError) list.push({ key: 'backup-extra', icon: DatabaseBackup, text: `Không chép được bản sao sang thư mục thêm: ${b.extraError}`, tone: 'warning', to: '/settings', action: 'Cài đặt' });
  if (b && !b.lastBackupAt) list.push({ key: 'backup-none', icon: DatabaseBackup, text: 'Chưa có bản sao lưu nào', tone: 'warning', to: '/settings', action: 'Cài đặt' });
  else if (b?.lastBackupAt && localDay(b.lastBackupAt) < shiftDate(today, -BACKUP_STALE_DAYS))
    list.push({ key: 'backup-stale', icon: DatabaseBackup, text: `Chưa sao lưu từ ${formatDateVn(localDay(b.lastBackupAt))}`, tone: 'warning', to: '/settings', action: 'Cài đặt' });
  if (o.stocktake)
    list.push({ key: 'stocktake', icon: ClipboardList, text: `Kiểm kê ${o.stocktake.code} đang dở, đã đếm ${o.stocktake.itemCount} món`, tone: 'warning', to: '/stocktake', action: 'Tiếp tục' });
  if (o.lowStock.outCount > 0) list.push({ key: 'out', icon: PackageX, text: `${o.lowStock.outCount} mặt hàng đã hết`, tone: 'destructive', to: '/products?stock=out', action: 'Xem' });
  if (o.lowStock.count > 0) list.push({ key: 'low', icon: PackageMinus, text: `${o.lowStock.count} mặt hàng sắp hết`, tone: 'warning', to: '/products?stock=low', action: 'Xem' });
  if (o.customers.overdueCount > 0)
    list.push({
      key: 'overdue',
      icon: Users,
      text: `${o.customers.overdueCount} khách nợ quá ${DEBT_OVERDUE_DAYS} ngày chưa trả, tổng ${formatMoney(o.customers.overdueTotal)}`,
      tone: 'warning',
      to: '/customers',
      action: 'Xem',
    });
  return list;
}

/** Thẻ "Cần chú ý": mỗi cảnh báo một dòng có nút sang trang xử lý; không có gì thì nói rõ là ổn. */
export function AlertsCard({ data, today, loading }: { data: Overview | undefined; today: string; loading: boolean }) {
  const alerts = data ? buildAlerts(data, today) : [];
  return (
    <Card className="mb-(--gap) py-0">
      <CardContent className="px-4 py-3">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <TriangleAlert className="size-4 text-muted-foreground" />
          Cần chú ý
        </h2>
        {loading || !data ? (
          <TableSkeleton rows={2} />
        ) : alerts.length === 0 ? (
          <p className="flex items-center gap-2 py-1 text-sm text-success">
            <CircleCheck className="size-4 shrink-0" />
            Mọi thứ ổn: không có cảnh báo.
          </p>
        ) : (
          <ul className="divide-y">
            {alerts.map(({ key, icon: Icon, text, tone, to, action }) => (
              <li key={key} className="flex items-center gap-3 py-2">
                <Icon className={`size-5 shrink-0 ${TONE[tone]}`} />
                <span className="min-w-0 flex-1 text-sm">{text}</span>
                <Button variant="outline" size="sm" asChild>
                  <Link to={to}>{action}</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Tạo `client/src/pages/overview/RecentOrders.tsx`**

```tsx
import { ReceiptText } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { formatMoney, type OrderSummary } from '@tiny-pos/shared';
import { EmptyState } from '@/components/EmptyState';
import { ListPanel } from '@/components/ListPanel';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { METHOD_LABEL } from '@/pages/orders/OrderTable';

const time = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
const CELL = 'px-3 py-3 md:px-4';
const MOBILE_HIDDEN = 'hidden md:table-cell';

/** 5 hóa đơn mới nhất hôm nay, kể cả đơn hủy (gạch ngang); bấm dòng sang trang Hóa đơn (mặc định hôm nay). */
export function RecentOrders({ orders, count, loading }: { orders: OrderSummary[] | undefined; count: number | undefined; loading: boolean }) {
  const navigate = useNavigate();
  return (
    <ListPanel
      toolbar={
        <>
          <h2 className="text-sm font-semibold">Hóa đơn hôm nay</h2>
          {count !== undefined && <span className="text-sm text-muted-foreground">{count} đơn</span>}
          <Button variant="outline" size="sm" className="ml-auto" asChild>
            <Link to="/orders">
              <ReceiptText data-icon="inline-start" />
              Hóa đơn
            </Link>
          </Button>
        </>
      }
    >
      {loading || !orders ? (
        <TableSkeleton rows={5} />
      ) : orders.length === 0 ? (
        <EmptyState icon={ReceiptText} title="Hôm nay chưa có hóa đơn" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="px-3 md:px-4">Giờ</TableHead>
              <TableHead className="px-3 md:px-4">Mã</TableHead>
              <TableHead className={`px-3 text-right md:px-4 ${MOBILE_HIDDEN}`}>Số món</TableHead>
              <TableHead className="px-3 text-right md:px-4">Phải trả</TableHead>
              <TableHead className="px-3 md:px-4">Thanh toán</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => {
              const cancelled = o.status === 'cancelled';
              return (
                <TableRow key={o.id} className={cn('cursor-pointer', cancelled && 'text-muted-foreground')} onClick={() => navigate('/orders')}>
                  <TableCell className={`${CELL} tabular-nums`}>{time(o.createdAt)}</TableCell>
                  <TableCell className={cn(CELL, 'font-mono', cancelled && 'line-through')}>{o.code}</TableCell>
                  <TableCell className={`${CELL} text-right tabular-nums ${MOBILE_HIDDEN}`}>{o.itemCount}</TableCell>
                  <TableCell className={cn(CELL, 'text-right font-semibold tabular-nums', cancelled && 'line-through')}>{formatMoney(o.payable)}</TableCell>
                  <TableCell className={CELL}>
                    {cancelled ? (
                      <Badge variant="secondary">Đã hủy</Badge>
                    ) : o.paymentMethod === 'debt' ? (
                      <Badge variant="outline">Ghi nợ · {o.customerName}</Badge>
                    ) : (
                      METHOD_LABEL[o.paymentMethod]
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </ListPanel>
  );
}
```

- [ ] **Step 3: Tạo `client/src/pages/overview/LowStockList.tsx`**

```tsx
import { PackageMinus } from 'lucide-react';
import { Link } from 'react-router';
import { formatQty, type Overview } from '@tiny-pos/shared';
import { EmptyState } from '@/components/EmptyState';
import { ListPanel } from '@/components/ListPanel';
import { ProductAvatar } from '@/components/ProductAvatar';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const CELL = 'px-3 py-2 md:px-4';
const NUM = `${CELL} text-right tabular-nums whitespace-nowrap`;

/** Hàng đang bán dưới mức tối thiểu, thiếu nặng nhất trước; tồn ≤ 0 tô đỏ; "và n mặt hàng nữa" khi quá giới hạn. */
export function LowStockList({ low, loading }: { low: Overview['lowStock'] | undefined; loading: boolean }) {
  const more = low ? low.count - low.items.length : 0;
  return (
    <ListPanel
      toolbar={
        <>
          <h2 className="text-sm font-semibold">Hàng sắp hết</h2>
          {low && <span className="text-sm text-muted-foreground">{low.count} mặt hàng</span>}
          <Button variant="outline" size="sm" className="ml-auto" asChild>
            <Link to="/products?stock=low">Xem tất cả</Link>
          </Button>
        </>
      }
      footer={more > 0 ? <div className="border-t px-4 py-2 text-sm text-muted-foreground">và {more} mặt hàng nữa</div> : undefined}
    >
      {loading || !low ? (
        <TableSkeleton rows={5} />
      ) : low.items.length === 0 ? (
        <EmptyState icon={PackageMinus} title="Không có mặt hàng nào dưới mức tối thiểu" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="px-3 md:px-4">Mặt hàng</TableHead>
              <TableHead className="px-3 text-right md:px-4">Tồn</TableHead>
              <TableHead className="px-3 text-right md:px-4">Tối thiểu</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {low.items.map((i) => (
              <TableRow key={i.productId}>
                <TableCell className={`${CELL} font-medium`}>
                  <span className="flex min-w-0 items-center gap-2">
                    <ProductAvatar name={i.name} className="size-8 shrink-0" />
                    <span className="truncate">{i.name}</span>
                  </span>
                </TableCell>
                <TableCell className={cn(NUM, 'font-semibold', i.stock <= 0 && 'text-destructive')}>
                  {formatQty(i.stock)} <span className="font-normal text-muted-foreground">{i.unit}</span>
                </TableCell>
                <TableCell className={`${NUM} text-muted-foreground`}>{formatQty(i.minStock)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </ListPanel>
  );
}
```

- [ ] **Step 4: Tạo `client/src/pages/overview/DebtPanel.tsx`**

```tsx
import { Users, type LucideIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { formatDateVn, formatMoney, localDate, currentTzOffset, type DebtPartyRow, type OverdueCustomerRow } from '@tiny-pos/shared';
import { EmptyState } from '@/components/EmptyState';
import { ListPanel } from '@/components/ListPanel';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Row = DebtPartyRow & Partial<Pick<OverdueCustomerRow, 'lastActivityAt' | 'overdue'>>;
const CELL = 'px-3 py-3 md:px-4';
const lastDay = (iso: string) => formatDateVn(localDate(new Date(iso), currentTzOffset())).slice(0, 5);

/** Khách nợ / nợ NCC dùng chung: header tổng + số người + nút sang trang; khách nợ lâu có hint vàng dưới tên; bấm dòng mở trang với tên điền sẵn. */
export function DebtPanel({
  title,
  icon: Icon,
  debtHeader,
  summary,
  rows,
  listPath,
  loading,
  emptyTitle,
}: {
  title: string;
  icon: LucideIcon;
  debtHeader: string;
  summary: { total: number; count: number } | undefined;
  rows: Row[] | undefined;
  listPath: '/customers' | '/suppliers';
  loading: boolean;
  emptyTitle: string;
}) {
  const navigate = useNavigate();
  return (
    <ListPanel
      toolbar={
        <>
          <h2 className="text-sm font-semibold">{title}</h2>
          {summary && (
            <span className="text-sm text-muted-foreground">
              {formatMoney(summary.total)} · {summary.count} người
            </span>
          )}
          <Button variant="outline" size="sm" className="ml-auto" asChild>
            <Link to={listPath}>
              <Icon data-icon="inline-start" />
              Xem tất cả
            </Link>
          </Button>
        </>
      }
    >
      {loading || !rows ? (
        <TableSkeleton rows={3} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} title={emptyTitle} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="px-3 md:px-4">Tên</TableHead>
              <TableHead className="hidden px-3 md:table-cell md:px-4">SĐT</TableHead>
              <TableHead className="px-3 text-right md:px-4">{debtHeader}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`${listPath}?q=${encodeURIComponent(r.name)}`)}>
                <TableCell className={`${CELL} font-medium`}>
                  <div className="truncate">{r.name}</div>
                  {r.overdue && r.lastActivityAt && <div className="text-xs font-normal text-warning">Giao dịch gần nhất {lastDay(r.lastActivityAt)}</div>}
                  {r.overdue && !r.lastActivityAt && <div className="text-xs font-normal text-warning">Chưa có giao dịch</div>}
                </TableCell>
                <TableCell className={`${CELL} hidden tabular-nums text-muted-foreground md:table-cell`}>{r.phone ?? '—'}</TableCell>
                <TableCell className={`${CELL} text-right font-semibold tabular-nums`}>{formatMoney(r.debt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </ListPanel>
  );
}
```

- [ ] **Step 5: Lắp vào `OverviewPage.tsx`**

Thêm import (theo thứ tự chữ cái sau `import { WeekTable } …` hoặc trước, giữ nhóm `./`):

```ts
import { Truck, Users } from 'lucide-react';
import { AlertsCard } from './AlertsCard';
import { DebtPanel } from './DebtPanel';
import { LowStockList } from './LowStockList';
import { RecentOrders } from './RecentOrders';
```

(`Truck, Users` gộp vào dòng import lucide đã có: `import { RefreshCw, Truck, Users } from 'lucide-react';`.)

Thay `{/* Task 6: AlertsCard */}` bằng:

```tsx
      <AlertsCard data={data} today={today} loading={loading} />
```

Thay `{/* Task 6: RecentOrders, LowStockList, DebtPanel ×2 */}` bằng:

```tsx
        <RecentOrders orders={data?.recentOrders} count={data?.week.rows[0]?.orders} loading={loading} />
        <LowStockList low={data?.lowStock} loading={loading} />
        <DebtPanel
          title="Khách nợ"
          icon={Users}
          debtHeader="Đang nợ"
          summary={data?.customers}
          rows={data?.customers.top}
          listPath="/customers"
          loading={loading}
          emptyTitle="Không ai đang nợ"
        />
        <DebtPanel
          title="Nợ nhà cung cấp"
          icon={Truck}
          debtHeader="Còn nợ"
          summary={data?.suppliers}
          rows={data?.suppliers.top}
          listPath="/suppliers"
          loading={loading}
          emptyTitle="Không nợ nhà cung cấp nào"
        />
```

- [ ] **Step 6: Typecheck và build**

Run: `npm run typecheck && npm run build -w client`
Expected: không lỗi. Nếu `Card` của shadcn có padding mặc định `py-6` làm thẻ cao: giữ `py-0` trên `Card` và `py-3` ở `CardContent` như trên.

- [ ] **Step 7: Kiểm trên trình duyệt với DB seed** (skill `browser-verify`, chặn request ghi)

DB dev của người dùng có thể không có phiếu kiểm kê mở hay khách nợ lâu. Để thấy đủ cảnh báo mà **không ghi** DB dev: trong playwright chặn `GET /api/overview` và trả JSON giả (`route.fulfill`) có `backup.lastError`, `stocktake` khác null, `customers.overdueCount = 2`, `lowStock.outCount = 1`; chụp 1280 và 390 px. Sau đó bỏ chặn, xem với dữ liệu thật: khối Cần chú ý hiện "Mọi thứ ổn" hoặc các dòng thật; bấm *Xem* ở "sắp hết" → `/products?stock=low` đúng bộ lọc; bấm dòng khách → `/customers?q=…`.

---

### Task 7: Kiểm thử tổng, tài liệu, phiên bản, commit

**Files:**
- Modify: `package.json:3` (`"version": "0.10.0"`)
- Modify: `README.md` (mục "Chạy thật" thêm 1 gạch đầu dòng; thêm mục kiểm thử cuối file), `CLAUDE.md:30` (dòng "Đã xong")

- [ ] **Step 1: Chạy skill `check`** (typecheck, test, build client, soát diff)

Run: `/check`. Expected: typecheck + `npm test` qua; `npm run build` qua; `git diff --stat` chỉ gồm file trong bảng "Cấu trúc file". File cũ chỉ đổi đúng các dòng kế hoạch nêu (`orders.ts` +1 hàm, `routes/index.ts` +2 dòng, `router.tsx` đổi `NAV`/import/route, `backups-api.test.ts` +1 `it`, `types.ts`/`index.ts` thêm cuối).

- [ ] **Step 2: Kiểm thử thủ công trên trình duyệt** (skill `browser-verify`, chặn request ghi; `npm run build` rồi vào `http://localhost:3000` để kiểm cả bản production có service sao lưu)

1. Mở `/overview` 1280 px: 7 khối, không cuộn ngang; số *Doanh thu hôm nay / Tiền mặt / CK / Ghi nợ / Thu nợ* **bằng** trang `/orders` (hôm nay) và `/reports?from=<hôm nay>&to=<hôm nay>`.
2. Khối *Cần chú ý* với dữ liệu thật: có bản sao (server production vừa tự sao lưu) → không có dòng sao lưu; dev (`:5180`, server dev cũng có service) tương tự.
3. Bấm *Làm mới* → nhãn "Đang tải…" rồi về "Làm mới". **Dừng server** rồi bấm *Làm mới* → toast lỗi, số cũ vẫn hiện, không trắng trang; bật lại server → số tươi sau ≤ 60 giây.
4. 390 px: thanh dưới Tổng quan · Bán hàng · Hóa đơn · Sản phẩm · Thêm (Kiểm kê trong Thêm); bảng ẩn cột *Số món*/*SĐT*; cỡ chữ *Rất lớn* vẫn không cuộn ngang.
5. `/` → `/sell`. `/overview` tải lại trang vẫn vào Tổng quan (SPA fallback).

- [ ] **Step 3: Cập nhật tài liệu và phiên bản**

- `package.json`: `"version": "0.10.0"`.
- `README.md`, mục "Chạy thật (production)", sau gạch đầu dòng "Điện thoại cùng Wi-Fi: …" thêm:

```md
- Trang *Tổng quan* (`http://<IP máy>:3000/overview`, mục đầu menu): số liệu hôm nay, 7 ngày, hàng sắp hết, khách nợ lâu, nợ NCC, kiểm kê dở, tình trạng sao lưu; tự làm mới mỗi phút. Máy quầy mở app vẫn vào thẳng Bán hàng.
```

- `README.md`: thêm cuối file

```md

## Kiểm thử thủ công – Tổng quan 0.10.0

1. *Tổng quan* (mục đầu menu; điện thoại ô đầu thanh dưới): hai hàng số hôm nay bằng đúng trang *Hóa đơn* hôm nay; *So với hôm qua* đổi dấu/màu; ô *Hết hàng* bấm sang *Sản phẩm* lọc hết hàng.
2. *Cần chú ý*: không có gì thì "Mọi thứ ổn"; có kiểm kê đang mở → dòng "Kiểm kê KK-… đang dở" bấm *Tiếp tục*; có hàng dưới mức tối thiểu → "n mặt hàng sắp hết" bấm *Xem*; khách còn nợ mà quá 30 ngày không có giao dịch → "n khách nợ quá 30 ngày…"; sao lưu lỗi hoặc quá 2 ngày không có bản sao → dòng sao lưu bấm *Cài đặt*.
3. *7 ngày gần đây* có "Hôm nay"/"Hôm qua", dòng Tổng; *Hóa đơn hôm nay* 5 đơn mới nhất, đơn hủy gạch ngang; *Hàng sắp hết* tối đa 10 dòng + "và n mặt hàng nữa"; *Khách nợ* / *Nợ nhà cung cấp* 5 người, khách nợ lâu có dòng vàng "Giao dịch gần nhất dd/mm", bấm dòng sang trang với tên điền sẵn.
4. Bán một đơn ở tab khác rồi quay lại → số đổi ngay (invalidate), hoặc chờ ≤ 1 phút. Dừng server rồi *Làm mới* → toast lỗi, số cũ vẫn hiện.
5. Điện thoại: thanh dưới Tổng quan · Bán hàng · Hóa đơn · Sản phẩm · Thêm (Kiểm kê nằm trong Thêm); không cuộn ngang. Đường dẫn gốc vẫn vào Bán hàng.
```

- `CLAUDE.md` dòng 30 "Đã xong": thêm vào cuối câu (trước dấu chấm hết câu) chuỗi sau:

```
, Tổng quan 0.10.0 (trang `/overview`, một API `services/overview.ts` gom 7 ngày từ `profitReport`, hóa đơn hôm nay, tồn thấp, khách nợ lâu `DEBT_OVERDUE_DAYS` = 30, nợ NCC, kiểm kê dở, sao lưu; thanh dưới điện thoại: Tổng quan · Bán hàng · Hóa đơn · Sản phẩm, gốc vẫn vào Bán hàng)
```

- [ ] **Step 4: Soát diff lần cuối và commit một lần**

```bash
git status
git diff --stat
```

Mọi file trong `git status` phải nằm trong bảng "Cấu trúc file" (cộng file plan này). Rồi:

```bash
git add shared/src server/src/services/orders.ts server/src/services/overview.ts server/src/services/overview.test.ts server/src/routes/overview.ts server/src/routes/overview-api.test.ts server/src/routes/backups-api.test.ts server/src/routes/index.ts client/src package.json README.md CLAUDE.md docs/superpowers/plans/2026-10-01-phase6-overview.md
git commit -m "feat: tổng quan 0.10.0 – số liệu hôm nay, 7 ngày, cảnh báo tồn/nợ/kiểm kê/sao lưu" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Kiểm tra lại `git show --stat HEAD` khớp bảng "Cấu trúc file".
