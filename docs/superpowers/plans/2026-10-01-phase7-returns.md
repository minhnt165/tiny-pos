# Giai đoạn 7 – Khách trả hàng (0.11.0) – Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chủ tiệm trả lại một phần hoặc toàn bộ hóa đơn `done` bằng phiếu trả `TH-YYYYMMDD-NNNN`: tiền hoàn theo giá trị sau giảm giá, đơn ghi nợ trừ nợ trước rồi mới trả tiền mặt, từng món chọn có nhập lại kho; phiếu tính vào ngày lập, hủy được; báo cáo/két ra số thuần.

**Architecture:** Hai bảng mới `returns` + `return_items` (migration `0004`, chỉ thêm bảng). Logic tiền thuần ở `shared/src/return-math.ts`, client dùng để hiện trước, server tính lại khi lưu. Truy vấn đọc dùng chung (dòng phiếu, số đã trả, Σ hoàn, tóm tắt theo khoảng) ở `server/src/services/return-rows.ts`, chỉ phụ thuộc schema, nên `orders.ts` (getOrder, daySummary) và `returns.ts` (lập/hủy/lọc) không import vòng nhau. Báo cáo đọc thêm `returns` theo `created_at` của phiếu. Client thêm nút *Trả hàng* trong chi tiết hóa đơn, hộp lập phiếu, trang `/returns`, phiếu in 80mm.

**Tech Stack:** TypeScript ESM, Express 5, drizzle-orm + better-sqlite3, zod 4, vitest, exceljs (đã có), React 19 + TanStack Query 5 + react-router 7, shadcn/ui (`Dialog`, `Checkbox`, `Badge`, `Button`, `Input`, `Table`), lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-01-tiny-pos-returns-design.md`

## Global Constraints

- Text UI, thông báo lỗi API, comment code, commit message: **tiếng Việt**.
- **Không format lại file có sẵn**: diff chỉ chứa dòng cần đổi; không chạy prettier/eslint; theo phong cách xung quanh (2 space, nháy đơn, có `;`, dòng ≤ ~130 ký tự). Không sắp xếp lại import của code không liên quan; thêm tên vào dòng import có sẵn là được.
- **Git**: làm trên `master`, **không commit từng task**; cả đợt là **một commit** ở Task 7: `feat: trả hàng 0.11.0 – phiếu trả theo hóa đơn, hoàn tiền/trừ nợ, nhập lại kho, báo cáo số thuần`.
- **Tiền** số nguyên đồng; **số lượng trả** là số thực theo đơn vị lúc bán, làm tròn 3 chữ số (`roundQty`), so sánh với sai số `QTY_EPS = 1e-9`.
- Tồn chỉ đổi qua `recordMovement`, nợ khách chỉ qua `recordCustomerDebtTx`, **cùng transaction** với phiếu. Lập phiếu: movement `return` `+qty × factor`, note `Trả hàng TH-…`; sổ nợ kind `return` (âm), note `Trả hàng TH-…`. Hủy phiếu: movement `adjust` `−qty × factor`, note `Hủy phiếu trả TH-…`; sổ nợ kind `return_cancel` (dương).
- Phiếu `done` tính vào **ngày lập phiếu** (`returns.created_at`); phiếu `cancelled` không tính ở đâu cả.
- Migration mới là `0004`, **chỉ thêm bảng**; không sửa migration `0000`–`0003`.
- **Không thêm thư viện** ở client lẫn server.
- UI dùng component có sẵn (`PageTitle`, `StatStrip`/`Stat`, `ListPanel`, `FilterBar`/`FilterGroup`, `DateRangeFilter`, `MultiChoiceChips`, `Pager`, `EmptyState`, `TableSkeleton`, `CommitInput`, `ConfirmDialog`, shadcn `Dialog`/`Checkbox`/`Badge`/`Button`/`Input`/`Label`/`Table`), icon lucide-react, màu từ token (`text-warning`, `text-destructive`, `text-muted-foreground`). Không viết mã màu.
- Mạng công ty chặn TLS: lệnh npm cần `NODE_EXTRA_CA_CERTS=<repo>/.certs/corp-root.pem`; **không bao giờ** tắt kiểm tra TLS.
- Không dùng/kill cổng 5173/5174; kiểm trên trình duyệt **không ghi** vào `data/grocery.db` (skill `browser-verify`: chặn POST, stub GET). Server dev khởi động lại sẽ tự chạy migration `0004` trên DB dev (chỉ tạo hai bảng rỗng): đó là việc bình thường, ghi vào CLAUDE.md.
- Chạy test/typecheck từ **gốc repo** (`npm test`, `npm run typecheck`) để `shared` được build trước. Chạy một file server: `npm run build -w shared` (nếu vừa sửa shared) rồi `cd server && npx vitest run <file>`. Một file shared: `cd shared && npx vitest run <file>`.

## Review Focus

1. **Trả nhiều lần cho cùng một dòng có giảm giá** (ví dụ 1 lon rồi 1 lon, hoặc 0,2 kg rồi 0,15 kg) → tổng các lần hoàn phải bằng đúng giá trị dòng, cả đơn trả hết thì bằng `payable`, không lệch đồng nào → test "trả nhiều lần đến hết" và "hàng cân" ở Task 2, `lineValues`/`refundFor` ở Task 1.
2. **Khách ghi nợ đã trả hết nợ rồi mới mang hàng lại** (nợ hiện tại 0 hoặc âm) → hoàn tiền mặt, không đẩy nợ âm thêm → test `splitRefund` ở Task 1 và "nợ của khách nhỏ hơn tiền hoàn" ở Task 2.
3. **Hủy phiếu trả của khách đã từng trả nợ** → bút toán bù `return_cancel` là số dương, không được làm mới mốc *nợ lâu* ở Tổng quan → test ở Task 3 (sửa `owingSince`).
4. **Trả hàng của một ngày cũ, xem báo cáo hôm nay và ngày cũ** → ngày bán giữ nguyên số; ngày trả có doanh thu/tiền mặt âm nếu không bán gì, vẫn `revenue = cash + transfer + debt`; trang Báo cáo không hiện "chưa có hóa đơn" khi kỳ chỉ có phiếu trả → test số thuần ở Task 3, `ProfitTab` ở Task 6.
5. **Bấm Hủy hóa đơn khi đơn đã có phiếu trả** (kể cả gọi API thẳng) → 409, tồn và nợ không bị cộng hai lần; giao diện khóa nút kèm lời giải thích → test ở Task 2 và Task 4, trình duyệt ở Task 7.

---

## Cấu trúc file

| File | Việc |
|---|---|
| `shared/src/return-math.ts` (mới) + `return-math.test.ts` (mới) | `QTY_EPS`, `roundQty`, `remainingQty`, `lineValues`, `refundFor`, `splitRefund`, `returnAmounts` |
| `shared/src/schemas/return.ts` (mới) | `returnInputSchema`, `ReturnInput`, `ReturnInputBody` |
| `shared/src/schemas/list-filters.ts` (sửa) | `returnListFields`, `returnListQuerySchema`, `ReturnListQuery` |
| `shared/src/types.ts` (sửa) | `ReturnSummary`, `ReturnSummaryRow`, `ReturnItem`, `ReturnDetail`, `ReturnList`; thêm trường cho `OrderItem`, `OrderSummary`, `OrderDetail`, `DaySummary`, `ProfitRow`, `DebtReport`; `DebtTxKind` |
| `shared/src/index.ts` (sửa) | export 2 module mới |
| `server/src/db/schema.ts` (sửa) | bảng `returns`, `return_items`; enum `kind` thêm 2 giá trị |
| `server/drizzle/0004_*.sql` + `meta/` (sinh) | migration |
| `server/src/db/migration-0004.test.ts` (mới) | dữ liệu cũ còn nguyên |
| `server/src/services/return-rows.ts` (mới) | `refundedSql`, `returnedQtySql`, `returnRows`, `returnItemsOf`, `returnSummary` |
| `server/src/services/returns.ts` (mới) + `returns.test.ts` (mới) | `getReturn`, `createReturn`, `cancelReturn`, `listReturns`, `listReturnsForExport` |
| `server/src/services/orders.ts` (sửa) | `refunded`, `returnedQty`, `returns`, `customerDebt`; chặn hủy; `daySummary.returns` |
| `server/src/services/daily-code.ts` (sửa) | bảng `'returns'` |
| `server/src/services/movements.ts` (sửa) | `CODE_IN_NOTE` thêm `TH` |
| `server/src/services/reports.ts` (sửa) | số thuần lãi lỗ, mặt hàng, `returnDebt` |
| `server/src/services/overview.ts` (sửa) | `owingSince` bỏ `return_cancel` |
| `server/src/services/exports.ts`, `report-exports.ts` (sửa) | cột *Trả hàng*; `exportReturnsXlsx` |
| `server/src/routes/returns.ts` (mới) + `returns-api.test.ts` (mới), `routes/index.ts` (sửa) | `/api/returns` |
| Test có sẵn (sửa kỳ vọng): `orders.test.ts`, `orders-api.test.ts`, `reports.test.ts`, `exports.test.ts`, `report-exports.test.ts`, `overview.test.ts` | thêm trường mới |
| `client/src/api/returns.ts` (mới) | hook |
| `client/src/components/MoneyLine.tsx` (mới) | dòng nhãn – tiền dùng chung |
| `client/src/components/receipt/receipt-data.ts`, `Receipt.tsx`, `PrintProvider.tsx` (sửa) | phiếu in trả hàng |
| `client/src/pages/returns/ReturnDialog.tsx`, `ReturnDetailDialog.tsx`, `ReturnTable.tsx`, `ReturnsPage.tsx` (mới) | lập phiếu, chi tiết, bảng, trang |
| `client/src/pages/orders/OrderDetailDialog.tsx`, `OrderTable.tsx`, `OrdersPage.tsx` (sửa) | nút Trả hàng, phiếu của đơn, nhãn, số thuần |
| `client/src/pages/reports/ProfitTab.tsx`, `DebtTab.tsx` (sửa) | cột Trả hàng, hint trừ nợ |
| `client/src/pages/customers/CustomerDetailDialog.tsx` (sửa) | nhãn sổ nợ |
| `client/src/router.tsx` (sửa) | menu + route `/returns` |
| `package.json`, `README.md`, `CLAUDE.md`, `.claude/rules/database.md` (sửa) | 0.11.0, tài liệu |

---

### Task 1: Shared – công thức tiền hoàn, schema, types mới

**Files:**
- Create: `shared/src/return-math.ts`, `shared/src/return-math.test.ts`, `shared/src/schemas/return.ts`
- Modify: `shared/src/schemas/list-filters.ts` (thêm sau khối `importListQuerySchema`), `shared/src/types.ts` (thêm cuối file), `shared/src/index.ts`

**Interfaces:**
- Produces: `QTY_EPS`, `roundQty(n)`, `remainingQty(qty, returnedQty)`, `lineValues(amounts, discount)`, `refundFor(value, qty, before, now)`, `splitRefund(refund, paymentMethod, customerDebt) → { debtReduced, cashRefund }`, `returnAmounts(lines, discount, picks: Map<id, qty>) → Map<id, amount>`; `returnInputSchema`/`ReturnInput`/`ReturnInputBody`; `returnListFields`/`returnListQuerySchema`/`ReturnListQuery`; types `ReturnSummary`, `ReturnSummaryRow`, `ReturnItem`, `ReturnDetail`, `ReturnList`.

- [ ] **Step 1: Viết test `shared/src/return-math.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { lineValues, refundFor, remainingQty, returnAmounts, splitRefund } from './return-math.js';

describe('lineValues', () => {
  it('chia giảm giá theo tỷ lệ, phần lẻ cho dòng có phần thập phân lớn nhất; tổng = tiền hàng − giảm giá', () => {
    expect(lineValues([24000, 280000, 5000], 9000)).toEqual([23301, 271845, 4854]);
    expect(lineValues([12000, 24000, 30000], 1000)).toEqual([11818, 23636, 29546]);
  });

  it('không dòng nào âm, kể cả dòng 0 đồng; không giảm giá hoặc tổng 0 thì giữ nguyên', () => {
    expect(lineValues([3, 3, 0], 1)).toEqual([2, 3, 0]);
    expect(lineValues([5000, 5000], 10000)).toEqual([0, 0]);
    expect(lineValues([12000, 5000], 0)).toEqual([12000, 5000]);
    expect(lineValues([0, 0], 0)).toEqual([0, 0]);
  });
});

describe('refundFor', () => {
  it('trả nhiều lần cộng lại bằng trả một lần; trả hết đúng bằng giá trị dòng', () => {
    expect(refundFor(23301, 2, 0, 1)).toBe(11651);
    expect(refundFor(23301, 2, 1, 1)).toBe(11650);
    expect(refundFor(23301, 2, 0, 2)).toBe(23301);
  });

  it('hàng cân: 0,2 rồi 0,15 kg của 0,35 kg cộng lại đúng giá trị dòng dù số thực lệch', () => {
    const a = refundFor(35000, 0.35, 0, 0.2);
    const b = refundFor(35000, 0.35, 0.2, 0.15);
    expect(a).toBe(20000);
    expect(a + b).toBe(35000);
  });
});

describe('remainingQty', () => {
  it('làm tròn 3 chữ số, không âm', () => {
    expect(remainingQty(0.35, 0.2)).toBe(0.15);
    expect(remainingQty(3, 1)).toBe(2);
    expect(remainingQty(2, 2.0000001)).toBe(0);
  });
});

describe('splitRefund', () => {
  it('đơn ghi nợ trừ nợ hiện tại trước, phần dư tiền mặt; nợ 0 hoặc âm thì trả tiền mặt hết', () => {
    expect(splitRefund(30000, 'debt', 50000)).toEqual({ debtReduced: 30000, cashRefund: 0 });
    expect(splitRefund(30000, 'debt', 10000)).toEqual({ debtReduced: 10000, cashRefund: 20000 });
    expect(splitRefund(30000, 'debt', 0)).toEqual({ debtReduced: 0, cashRefund: 30000 });
    expect(splitRefund(30000, 'debt', -5000)).toEqual({ debtReduced: 0, cashRefund: 30000 });
  });

  it('đơn tiền mặt / chuyển khoản luôn trả tiền mặt', () => {
    expect(splitRefund(30000, 'cash', 50000)).toEqual({ debtReduced: 0, cashRefund: 30000 });
    expect(splitRefund(30000, 'transfer', null)).toEqual({ debtReduced: 0, cashRefund: 30000 });
  });
});

describe('returnAmounts', () => {
  it('chỉ dòng có số lượng > 0, theo giá trị sau giảm giá và số đã trả', () => {
    const lines = [
      { id: 1, qty: 2, amount: 24000, returnedQty: 1 },
      { id: 2, qty: 1, amount: 12000, returnedQty: 0 },
      { id: 3, qty: 1, amount: 5000, returnedQty: 0 },
    ];
    expect(returnAmounts(lines, 0, new Map([[1, 1], [2, 0]]))).toEqual(new Map([[1, 12000]]));
  });
});
```

- [ ] **Step 2: Chạy test, thấy lỗi**

Run: `cd shared && npx vitest run src/return-math.test.ts`
Expected: FAIL, không tìm thấy module `./return-math.js`.

- [ ] **Step 3: Tạo `shared/src/return-math.ts`**

```ts
import type { PaymentMethod } from './types.js';

/** Sai số khi so số lượng thực (hàng cân). */
export const QTY_EPS = 1e-9;

/** Làm tròn số lượng 3 chữ số (0,2 + 0,15 → 0,35). */
export const roundQty = (n: number) => Math.round(n * 1000) / 1000;

/** Số còn trả được của một dòng hóa đơn (theo đơn vị lúc bán). */
export const remainingQty = (qty: number, returnedQty: number) => Math.max(roundQty(qty - returnedQty), 0);

/**
 * Giá trị sau giảm giá của từng dòng: chia giảm giá của đơn theo tỷ lệ thành tiền, phần lẻ (từng đồng) cho các dòng có
 * phần thập phân lớn nhất (dòng trước thắng khi bằng nhau). Σ kết quả = Σ amounts − discount; không dòng nào âm.
 */
export function lineValues(amounts: number[], discount: number): number[] {
  const total = amounts.reduce((s, a) => s + a, 0);
  if (total <= 0 || discount <= 0) return [...amounts];
  const exact = amounts.map((a) => (discount * a) / total);
  const shares = exact.map((e) => Math.floor(e));
  let left = discount - shares.reduce((s, x) => s + x, 0);
  const byFraction = exact.map((e, i) => ({ i, frac: e - Math.floor(e) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of byFraction) {
    if (left <= 0) break;
    shares[i] = shares[i]! + 1;
    left -= 1;
  }
  return amounts.map((a, i) => a - shares[i]!);
}

/**
 * Tiền hoàn khi trả thêm `now` của dòng có giá trị `value`, mua `qty`, đã trả `before`. Tính theo lũy kế nên trả nhiều
 * lần cộng lại bằng trả một lần; trả tới hết dòng thì đúng bằng `value`.
 */
export function refundFor(value: number, qty: number, before: number, now: number): number {
  const upTo = (q: number) => (q >= qty - QTY_EPS ? value : Math.round((value * q) / qty));
  return upTo(before + now) - upTo(before);
}

export interface RefundSplit {
  debtReduced: number;
  cashRefund: number;
}

/** Đơn ghi nợ: trừ vào nợ hiện tại của khách trước (nợ ≤ 0 thì không trừ), phần dư trả tiền mặt; đơn khác: tiền mặt hết. */
export function splitRefund(refund: number, paymentMethod: PaymentMethod, customerDebt: number | null): RefundSplit {
  const debtReduced = paymentMethod === 'debt' ? Math.min(refund, Math.max(customerDebt ?? 0, 0)) : 0;
  return { debtReduced, cashRefund: refund - debtReduced };
}

export interface ReturnableLine {
  id: number;
  qty: number;
  amount: number;
  returnedQty: number;
}

/** Tiền hoàn từng dòng đang chọn (`picks`: id dòng → số lượng trả); dòng không chọn hoặc 0 không có trong kết quả. */
export function returnAmounts(lines: ReturnableLine[], discount: number, picks: Map<number, number>): Map<number, number> {
  const values = lineValues(lines.map((l) => l.amount), discount);
  const out = new Map<number, number>();
  lines.forEach((l, i) => {
    const q = picks.get(l.id) ?? 0;
    if (q > 0) out.set(l.id, refundFor(values[i]!, l.qty, l.returnedQty, q));
  });
  return out;
}
```

- [ ] **Step 4: Chạy test, thấy qua**

Run: `cd shared && npx vitest run src/return-math.test.ts`
Expected: PASS (10 test).

- [ ] **Step 5: Tạo `shared/src/schemas/return.ts`**

```ts
import { z } from 'zod';

/** Một dòng trả: dòng hóa đơn gốc, số lượng theo đơn vị lúc bán. */
export const returnItemInputSchema = z.object({
  orderItemId: z.number().int().positive(),
  qty: z.number().positive().max(100_000),
  /** Cộng lại tồn; món ngoài luôn bỏ qua. */
  restock: z.boolean().default(true),
});

export const returnInputSchema = z.object({
  orderId: z.number().int().positive(),
  items: z.array(returnItemInputSchema).min(1, 'chưa chọn món nào để trả'),
  note: z
    .string()
    .trim()
    .max(200)
    .nullish()
    .transform((v) => v || null),
});
export type ReturnInput = z.output<typeof returnInputSchema>;
/** Kiểu body client gửi lên (trước khi zod điền mặc định). */
export type ReturnInputBody = z.input<typeof returnInputSchema>;
```

- [ ] **Step 6: Thêm bộ lọc danh sách vào `shared/src/schemas/list-filters.ts`**, ngay sau dòng `export type ImportListQuery = z.output<typeof importListQuerySchema>;`:

```ts

export const returnListFields = { ...rangeFields, q: search, status: csvEnum(DOC_STATUSES), page };
export const returnListQuerySchema = z.object(returnListFields).superRefine((q, ctx) => {
  const message = rangeError(q);
  if (message) ctx.addIssue({ code: 'custom', message });
});
export type ReturnListQuery = z.output<typeof returnListQuerySchema>;
```

- [ ] **Step 7: Thêm types mới vào cuối `shared/src/types.ts`**

```ts

/** Phiếu trả chưa hủy trong một khoảng ngày: refund = cash + debt. */
export interface ReturnSummary {
  count: number;
  refund: number;
  /** Tiền mặt chi ra từ két. */
  cash: number;
  /** Phần trừ vào nợ khách. */
  debt: number;
}

export interface ReturnSummaryRow {
  id: number;
  code: string;
  orderId: number;
  orderCode: string;
  /** Khách của đơn ghi nợ (tên hiện tại); đơn khác null. */
  customerId: number | null;
  customerName: string | null;
  refund: number;
  debtReduced: number;
  cashRefund: number;
  note: string | null;
  status: 'done' | 'cancelled';
  itemCount: number;
  createdAt: string;
  cancelledAt: string | null;
}

/** Dòng phiếu trả; tên, đơn vị, giá, hệ số lấy từ dòng hóa đơn gốc. */
export interface ReturnItem {
  id: number;
  orderItemId: number;
  productId: number | null;
  productName: string;
  unit: string;
  /** Theo đơn vị lúc bán. */
  qty: number;
  price: number;
  factor: number;
  restock: boolean;
  /** Tiền hoàn của dòng (đã trừ phần giảm giá phân bổ). */
  amount: number;
  /** qty × giá vốn lúc bán. */
  cost: number;
}

export interface ReturnDetail extends ReturnSummaryRow {
  items: ReturnItem[];
}

export interface ReturnList {
  returns: ReturnSummaryRow[];
  summary: ReturnSummary;
  /** Số phiếu khớp mọi bộ lọc; returns chỉ là trang hiện tại. */
  total: number;
  page: number;
  pageSize: number;
}
```

- [ ] **Step 8: Export trong `shared/src/index.ts`**: thêm `export * from './return-math.js';` ngay sau dòng `export * from './import-draft.js';`, và `export * from './schemas/return.js';` ngay sau dòng `export * from './schemas/overview.js';`.

- [ ] **Step 9: Typecheck và test toàn bộ**

Run: `npm run typecheck && npm test`
Expected: không lỗi; mọi test cũ vẫn qua.

---

### Task 2: Server – bảng, migration, lập/xem/hủy phiếu trả, hóa đơn biết phiếu trả

**Files:**
- Modify: `server/src/db/schema.ts`, `server/src/services/orders.ts`, `server/src/services/daily-code.ts:22`, `server/src/services/movements.ts:8`, `shared/src/types.ts` (`OrderItem`, `OrderSummary`, `OrderDetail`, `DebtTxKind`), `client/src/pages/customers/CustomerDetailDialog.tsx:15-21`
- Create: `server/drizzle/0004_*.sql` (sinh), `server/src/db/migration-0004.test.ts`, `server/src/services/return-rows.ts`, `server/src/services/returns.ts`, `server/src/services/returns.test.ts`

**Interfaces:**
- Consumes (Task 1): `roundQty`, `remainingQty`, `returnAmounts`, `splitRefund`, `QTY_EPS`, `ReturnInput`, `ReturnDetail`, `ReturnSummaryRow`, `ReturnItem`, `ReturnSummary`.
- Produces: bảng `returns`, `returnItems` (drizzle); `return-rows.ts`: `refundedSql`, `returnedQtySql`, `returnRows(db, where, page?)`, `returnItemsOf(db, ids)`, `returnSummary(db, start, end)`; `returns.ts`: `getReturn(db, id)`, `createReturn(db, input, clock?)`, `cancelReturn(db, id, clock?)`; `OrderItem.returnedQty`, `OrderSummary.refunded`, `OrderDetail.returns`, `OrderDetail.customerDebt`; `cancelOrder` ném 409 khi còn phiếu trả.

- [ ] **Step 1: Sửa `server/src/db/schema.ts`**

Trong `debtTransactions`, đổi dòng enum `kind`:

```ts
    kind: text('kind', { enum: ['opening', 'order', 'order_cancel', 'payment', 'manual', 'return', 'return_cancel'] }).notNull().default('manual'),
```

Thêm hai bảng ngay sau khối `export const orderItems = sqliteTable(…);` (trước `export const imports`):

```ts

export const returns = sqliteTable(
  'returns',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    code: text('code').notNull().unique(), // TH-20261001-0001
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id),
    refund: integer('refund').notNull(), // tổng hoàn = Σ return_items.amount
    debtReduced: integer('debt_reduced').notNull().default(0), // phần trừ vào nợ khách
    cashRefund: integer('cash_refund').notNull().default(0), // phần trả tiền mặt
    note: text('note'),
    status: text('status', { enum: ['done', 'cancelled'] }).notNull().default('done'),
    createdAt: createdAt(),
    cancelledAt: text('cancelled_at'),
  },
  (t) => [index('returns_created_idx').on(t.createdAt), index('returns_order_idx').on(t.orderId)],
);

export const returnItems = sqliteTable(
  'return_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    returnId: integer('return_id')
      .notNull()
      .references(() => returns.id, { onDelete: 'cascade' }),
    orderItemId: integer('order_item_id')
      .notNull()
      .references(() => orderItems.id),
    qty: real('qty').notNull(), // theo đơn vị lúc bán
    restock: integer('restock', { mode: 'boolean' }).notNull().default(true),
    amount: integer('amount').notNull(), // tiền hoàn của dòng (đã trừ giảm giá phân bổ)
    cost: integer('cost').notNull(), // round(qty × cost_price lúc bán), không nhân factor như báo cáo
  },
  (t) => [index('return_items_return_idx').on(t.returnId), index('return_items_order_item_idx').on(t.orderItemId)],
);
```

- [ ] **Step 2: Sinh migration và soát SQL**

Run: `npm run db:generate`
Expected: có file mới `server/drizzle/0004_<tên>.sql`, `meta/0004_snapshot.json`, `_journal.json` thêm `idx: 4`. Mở file SQL: chỉ có `CREATE TABLE \`returns\``, `CREATE TABLE \`return_items\``, `CREATE UNIQUE INDEX \`returns_code_unique\``, 4 `CREATE INDEX`. **Không** có `ALTER`, `DROP`, `INSERT`, `__new_`. Nếu có thì dừng lại và đọc `.claude/rules/database.md` trước khi đi tiếp.

- [ ] **Step 3: Viết `server/src/db/migration-0004.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { migrationsFolder, partialMigrations } from './test-migrations.js';

describe('migration 0004', () => {
  it('chạy được trên DB 0.10.0 có hóa đơn và sổ nợ; dữ liệu cũ còn nguyên, bảng phiếu trả rỗng', () => {
    const sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    const db = drizzle(sqlite);
    migrate(db, { migrationsFolder: partialMigrations(4) });
    sqlite.exec(`
      INSERT INTO products (id, name, stock, cost_price) VALUES (1, 'Bia', 5, 9000);
      INSERT INTO customers (id, name, debt) VALUES (1, 'Chị Lan', 12000);
      INSERT INTO orders (id, code, total, paid, payment_method, customer_id) VALUES (1, 'HD-20260929-0001', 12000, 0, 'debt', 1);
      INSERT INTO order_items (order_id, product_id, product_name, unit, qty, price, cost_price, factor, amount)
        VALUES (1, 1, 'Bia', 'lon', 1, 12000, 9000, 1, 12000);
      INSERT INTO debt_transactions (customer_id, order_id, amount, kind) VALUES (1, 1, 12000, 'order');
    `);
    migrate(db, { migrationsFolder });
    expect(sqlite.prepare('SELECT code, total, status FROM orders').all()).toEqual([{ code: 'HD-20260929-0001', total: 12000, status: 'done' }]);
    expect(sqlite.prepare('SELECT count(*) AS n FROM order_items').get()).toEqual({ n: 1 });
    expect(sqlite.prepare('SELECT amount, kind FROM debt_transactions').all()).toEqual([{ amount: 12000, kind: 'order' }]);
    expect(sqlite.prepare('SELECT count(*) AS n FROM returns').get()).toEqual({ n: 0 });
    expect(sqlite.prepare('SELECT count(*) AS n FROM return_items').get()).toEqual({ n: 0 });
    expect(sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });
});
```

Run: `cd server && npx vitest run src/db/migration-0004.test.ts`
Expected: PASS.

- [ ] **Step 4: Sửa types có sẵn trong `shared/src/types.ts`**

Trong `interface OrderItem`, thêm sau dòng `amount: number;`:

```ts
  /** Đã trả ở các phiếu trả chưa hủy (theo đơn vị lúc bán). */
  returnedQty: number;
```

Trong `interface OrderSummary`, thêm sau dòng `itemCount: number;`:

```ts
  /** Σ tiền hoàn của các phiếu trả chưa hủy. */
  refunded: number;
```

Trong `interface OrderDetail`, thêm sau dòng `debt: OrderDebt | null;`:

```ts
  /** Mọi phiếu trả của đơn, kể cả đã hủy, mới nhất trước. */
  returns: ReturnSummaryRow[];
  /** Nợ hiện tại của khách (đơn ghi nợ); đơn không có khách: null. */
  customerDebt: number | null;
```

Đổi dòng `export type DebtTxKind = …`:

```ts
export type DebtTxKind = 'opening' | 'order' | 'order_cancel' | 'payment' | 'manual' | 'return' | 'return_cancel';
```

- [ ] **Step 5: Nhãn sổ nợ ở client** (để typecheck không vỡ vì `Record<DebtTxKind, string>`): trong `client/src/pages/customers/CustomerDetailDialog.tsx`, thêm sau dòng `  manual: 'Ghi nợ tay',`:

```ts
  return: 'Trả hàng',
  return_cancel: 'Hủy phiếu trả',
```

- [ ] **Step 6: `daily-code.ts` và `movements.ts`**

`server/src/services/daily-code.ts`: đổi `table: 'orders' | 'imports' | 'stocktakes',` thành `table: 'orders' | 'imports' | 'stocktakes' | 'returns',`.

`server/src/services/movements.ts`: đổi dòng `CODE_IN_NOTE` thành:

```ts
const CODE_IN_NOTE = /\b(?:HD|PN|KK|TH)-\d{8}-\d+\b/;
```

- [ ] **Step 7: Tạo `server/src/services/return-rows.ts`**

```ts
import { and, asc, desc, eq, gte, inArray, lt, sql, type SQL } from 'drizzle-orm';
import type { ReturnItem, ReturnSummary, ReturnSummaryRow } from '@tiny-pos/shared';
import type { DbOrTx } from '../db/connection.js';
import { customers, orderItems, orders, returnItems, returns } from '../db/schema.js';

// Truy vấn đọc phiếu trả dùng chung cho orders.ts và returns.ts; chỉ phụ thuộc schema để hai service không import vòng.
// Viết tên bảng cứng trong sql``: drizzle bỏ tiền tố bảng khi render cột.

/** Σ tiền hoàn các phiếu trả chưa hủy của đơn; làm cột trong select từ `orders`. */
export const refundedSql = sql<number>`(select coalesce(sum(refund), 0) from returns where returns.order_id = orders.id and returns.status = 'done')`;

/** Σ số lượng đã trả (phiếu chưa hủy) của dòng hóa đơn; làm cột trong select từ `order_items`. */
export const returnedQtySql = sql<number>`(select coalesce(sum(return_items.qty), 0) from return_items
  join returns on returns.id = return_items.return_id where return_items.order_item_id = order_items.id and returns.status = 'done')`;

const itemCountSql = sql<number>`(select count(*) from return_items where return_items.return_id = returns.id)`;

/** Phiếu trả khớp điều kiện (kèm mã hóa đơn, khách hiện tại, số dòng), mới nhất trước. */
export function returnRows(db: DbOrTx, where: SQL | undefined, page?: { limit: number; offset: number }): ReturnSummaryRow[] {
  const q = db
    .select({ r: returns, orderCode: orders.code, customerId: orders.customerId, customerName: customers.name, itemCount: itemCountSql })
    .from(returns)
    .innerJoin(orders, eq(returns.orderId, orders.id))
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(where)
    .orderBy(desc(returns.id));
  const rows = page ? q.limit(page.limit).offset(page.offset).all() : q.all();
  return rows.map(({ r, ...x }) => ({ ...r, ...x, itemCount: Number(x.itemCount) }));
}

/** Dòng của các phiếu `ids` (lấy theo lô vì SQLite giới hạn số tham số), theo thứ tự lập. */
export function returnItemsOf(db: DbOrTx, ids: number[]): Map<number, ReturnItem[]> {
  const out = new Map<number, ReturnItem[]>();
  for (let i = 0; i < ids.length; i += 500) {
    const batch = db
      .select({
        returnId: returnItems.returnId,
        id: returnItems.id,
        orderItemId: returnItems.orderItemId,
        productId: orderItems.productId,
        productName: orderItems.productName,
        unit: orderItems.unit,
        qty: returnItems.qty,
        price: orderItems.price,
        factor: orderItems.factor,
        restock: returnItems.restock,
        amount: returnItems.amount,
        cost: returnItems.cost,
      })
      .from(returnItems)
      .innerJoin(orderItems, eq(returnItems.orderItemId, orderItems.id))
      .where(inArray(returnItems.returnId, ids.slice(i, i + 500)))
      .orderBy(asc(returnItems.id))
      .all();
    for (const { returnId, ...it } of batch) {
      const list = out.get(returnId);
      if (list) list.push(it);
      else out.set(returnId, [it]);
    }
  }
  return out;
}

/** Phiếu trả chưa hủy trong [start, end) (ISO UTC). daySummary và trang Trả hàng dùng chung để số luôn khớp. */
export function returnSummary(db: DbOrTx, start: string, end: string): ReturnSummary {
  const r = db
    .select({
      count: sql<number>`count(*)`,
      refund: sql<number>`coalesce(sum(${returns.refund}), 0)`,
      cash: sql<number>`coalesce(sum(${returns.cashRefund}), 0)`,
      debt: sql<number>`coalesce(sum(${returns.debtReduced}), 0)`,
    })
    .from(returns)
    .where(and(eq(returns.status, 'done'), gte(returns.createdAt, start), lt(returns.createdAt, end)))
    .get();
  return { count: Number(r?.count ?? 0), refund: Number(r?.refund ?? 0), cash: Number(r?.cash ?? 0), debt: Number(r?.debt ?? 0) };
}
```

- [ ] **Step 8: Sửa `server/src/services/orders.ts`**

1. Dòng import từ `@tiny-pos/shared`: thêm `roundQty,` ngay sau `resolveRange,`.
2. Dòng import schema đổi thành: `import { customers, debtTransactions, orderItems, orders, productUnits, products, returns } from '../db/schema.js';`
3. Thêm sau dòng `import { nextDailyCode, resolveClock, type Clock } from './daily-code.js';`:

```ts
import { refundedSql, returnedQtySql, returnRows } from './return-rows.js';
```

4. `toSummary`: đổi chữ ký thành `function toSummary(o: OrderRow, itemCount: number, customerName: string | null, refunded: number): OrderSummary {` và thêm `    refunded,` ngay sau dòng `    itemCount,`.
5. `orderItemColumns`: thêm `  returnedQty: returnedQtySql,` ngay sau dòng `  amount: orderItems.amount,`.
6. Thay toàn bộ thân `getOrder`:

```ts
export function getOrder(db: DbOrTx, id: number): OrderDetail {
  const r = db
    .select({ order: orders, customerName: customers.name, customerDebt: customers.debt, refunded: refundedSql })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(orders.id, id))
    .get();
  if (!r) throw new NotFoundError('Không tìm thấy hóa đơn');
  const o = r.order;
  const items = db
    .select(orderItemColumns)
    .from(orderItems)
    .where(eq(orderItems.orderId, id))
    .orderBy(asc(orderItems.id))
    .all()
    .map((it) => ({ ...it, returnedQty: roundQty(Number(it.returnedQty)) }));
  return {
    ...toSummary(o, items.length, r.customerName, Number(r.refunded)),
    items,
    debt: orderDebt(db, o),
    returns: returnRows(db, eq(returns.orderId, id)),
    customerDebt: r.customerDebt,
  };
}
```

7. `listOrders` và `recentOrders`: trong `.select({ order: orders, itemCount, customerName: customers.name })` thêm `, refunded: refundedSql`; trong `.map((r) => toSummary(r.order, Number(r.itemCount), r.customerName))` đổi thành `.map((r) => toSummary(r.order, Number(r.itemCount), r.customerName, Number(r.refunded)))`.
8. `listOrdersForExport`: đổi `.select({ order: orders, customerName: customers.name })` thành `.select({ order: orders, customerName: customers.name, refunded: refundedSql })`; dòng `return { ...toSummary(r.order, items.length, r.customerName), items, debt: null };` đổi thành:

```ts
      return { ...toSummary(r.order, items.length, r.customerName, Number(r.refunded)), items, debt: null, returns: [], customerDebt: null };
```

9. `cancelOrder`: thêm ngay sau dòng `if (o.status === 'cancelled') throw new ConflictError('Hóa đơn đã hủy');`:

```ts
    if (o.returns.some((r) => r.status === 'done')) throw new ConflictError('Hóa đơn đã có phiếu trả, hãy hủy phiếu trả trước');
```

- [ ] **Step 9: Viết test `server/src/services/returns.test.ts`**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import {
  customerCreateSchema,
  customerPaymentSchema,
  orderInputSchema,
  productInputSchema,
  productUnitInputSchema,
  returnInputSchema,
} from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { stockMovements } from '../db/schema.js';
import { createTestDb } from '../db/test-db.js';
import { collectDebt, createCustomer, getCustomer, listCustomerTransactions } from './customers.js';
import { cancelOrder, createOrder, getOrder } from './orders.js';
import { createUnit } from './product-units.js';
import { createProduct, getProduct } from './products.js';
import { cancelReturn, createReturn } from './returns.js';

const VN = 420;
const at = (iso: string) => ({ now: new Date(iso), tzOffsetMin: VN });
const D29 = at('2026-09-29T03:00:00.000Z'); // 10:00 ngày 29/9 giờ VN: ngày bán
const D30 = at('2026-09-30T03:00:00.000Z'); // 10:00 ngày 30/9 giờ VN: ngày trả

let db: Db;
beforeEach(() => {
  db = createTestDb();
});
const product = (o: Record<string, unknown>) => createProduct(db, productInputSchema.parse(o));
const order = (o: Record<string, unknown>, clock = D29) =>
  createOrder(db, orderInputSchema.parse({ paymentMethod: 'cash', paid: 10_000_000, ...o }), clock);
const ret = (o: Record<string, unknown>, clock = D30) => createReturn(db, returnInputSchema.parse(o), clock);
const movements = () =>
  db
    .select()
    .from(stockMovements)
    .all()
    .filter((m) => m.type !== 'sale')
    .map((m) => [m.type, m.productId, m.qty, m.note]);

/** Bia 12.000 (vốn 10.000), thùng 24 lon 280.000; đơn tiền mặt 2 lon + 1 thùng + 1 túi đá 5.000, giảm 9.000 → phải trả 300.000. */
function seedCashOrder() {
  const bia = product({ name: 'Bia', unit: 'lon', sellPrice: 12000, costPrice: 10000, stock: 100 });
  const crate = createUnit(db, bia.id, productUnitInputSchema.parse({ name: 'Thùng', factor: 24, sellPrice: 280000 }));
  const o = order({
    discount: 9000,
    items: [
      { productId: bia.id, qty: 2, price: 12000 },
      { productId: bia.id, unitId: crate.id, qty: 1, price: 280000 },
      { name: 'Túi đá', qty: 1, price: 5000 },
    ],
  });
  const [lon, thung, da] = o.items.map((i) => i.id) as [number, number, number];
  return { bia, o, lon, thung, da };
}

describe('createReturn', () => {
  it('trả một phần đơn tiền mặt: mã TH theo ngày trả, tiền hoàn sau giảm giá, hoàn tiền mặt, nhập lại kho theo factor', () => {
    const { bia, o, lon } = seedCashOrder();
    const r = ret({ orderId: o.id, items: [{ orderItemId: lon, qty: 1 }], note: 'Lon móp' });
    expect(r).toMatchObject({
      code: 'TH-20260930-0001',
      orderId: o.id,
      orderCode: o.code,
      refund: 11651,
      debtReduced: 0,
      cashRefund: 11651,
      status: 'done',
      itemCount: 1,
      note: 'Lon móp',
      createdAt: '2026-09-30T03:00:00.000Z',
    });
    expect(r.items).toMatchObject([{ orderItemId: lon, productName: 'Bia', unit: 'lon', qty: 1, restock: true, amount: 11651, cost: 10000 }]);
    expect(getProduct(db, bia.id).stock).toBe(75);
    expect(movements()).toEqual([['return', bia.id, 1, 'Trả hàng TH-20260930-0001']]);
    const after = getOrder(db, o.id);
    expect(after.items.map((i) => i.returnedQty)).toEqual([1, 0, 0]);
    expect(after).toMatchObject({ refunded: 11651, customerDebt: null });
    expect(after.returns.map((x) => x.code)).toEqual(['TH-20260930-0001']);
  });

  it('trả nhiều lần đến hết: tổng hoàn đúng bằng số phải trả; thùng không nhập kho thì không cộng tồn; món ngoài không nhập kho', () => {
    const { bia, o, lon, thung, da } = seedCashOrder();
    const a = ret({ orderId: o.id, items: [{ orderItemId: lon, qty: 1 }] });
    const b = ret({ orderId: o.id, items: [{ orderItemId: lon, qty: 1 }, { orderItemId: da, qty: 1 }] });
    const c = ret({ orderId: o.id, items: [{ orderItemId: thung, qty: 1, restock: false }] });
    expect([a.refund, b.refund, c.refund]).toEqual([11651, 16504, 271845]);
    expect(a.refund + b.refund + c.refund).toBe(o.payable);
    expect(b.code).toBe('TH-20260930-0002');
    expect(b.items.find((i) => i.orderItemId === da)).toMatchObject({ productId: null, restock: false, amount: 4854 });
    expect(c.items[0]).toMatchObject({ restock: false, cost: 240000 });
    expect(getProduct(db, bia.id).stock).toBe(76);
    expect(getOrder(db, o.id).refunded).toBe(300000);
  });

  it('400: vượt số còn lại, dòng không thuộc hóa đơn, trùng dòng; 404 hóa đơn không có; 409 hóa đơn đã hủy', () => {
    const { o, lon } = seedCashOrder();
    ret({ orderId: o.id, items: [{ orderItemId: lon, qty: 1 }] });
    expect(() => ret({ orderId: o.id, items: [{ orderItemId: lon, qty: 2 }] })).toThrow('Số lượng trả vượt số còn lại của Bia');
    expect(() => ret({ orderId: o.id, items: [{ orderItemId: 9999, qty: 1 }] })).toThrow('Dòng trả hàng không hợp lệ');
    expect(() =>
      ret({ orderId: o.id, items: [{ orderItemId: lon, qty: 0.5 }, { orderItemId: lon, qty: 0.5 }] }),
    ).toThrow('Dòng trả hàng không hợp lệ');
    expect(() => ret({ orderId: 9999, items: [{ orderItemId: lon, qty: 1 }] })).toThrow('Không tìm thấy hóa đơn');
    const other = order({ items: [{ name: 'Kẹo', qty: 1, price: 1000 }] });
    cancelOrder(db, other.id, D29);
    expect(() => ret({ orderId: other.id, items: [{ orderItemId: other.items[0]!.id, qty: 1 }] })).toThrow(
      'Hóa đơn đã hủy, không trả hàng được',
    );
    expect(getOrder(db, o.id).returns).toHaveLength(1); // các lần lỗi không lưu gì
  });

  it('hàng cân trả số lẻ hai lần: cộng lại đúng thành tiền, lần ba báo vượt', () => {
    const thit = product({ name: 'Thịt', unit: 'kg', sellPrice: 100000, costPrice: 80000, isWeighed: true, stock: 5 });
    const o = order({ items: [{ productId: thit.id, qty: 0.35, price: 100000 }] });
    const line = o.items[0]!.id;
    const a = ret({ orderId: o.id, items: [{ orderItemId: line, qty: 0.2 }] });
    const b = ret({ orderId: o.id, items: [{ orderItemId: line, qty: 0.15 }] });
    expect(a.refund + b.refund).toBe(35000);
    expect(getProduct(db, thit.id).stock).toBeCloseTo(5);
    expect(getOrder(db, o.id).items[0]!.returnedQty).toBe(0.35);
    expect(() => ret({ orderId: o.id, items: [{ orderItemId: line, qty: 0.001 }] })).toThrow('Số lượng trả vượt số còn lại của Thịt');
  });
});

describe('trả hàng đơn ghi nợ', () => {
  const lan = () => createCustomer(db, customerCreateSchema.parse({ name: 'Chị Lan' }));

  it('trừ nợ hiện tại trước, phần dư trả tiền mặt; sổ nợ dòng return âm', () => {
    const bia = product({ name: 'Bia', unit: 'lon', sellPrice: 12000, costPrice: 10000, stock: 100 });
    const c = lan();
    const o = order({ paymentMethod: 'debt', customerId: c.id, paid: 4000, items: [{ productId: bia.id, qty: 2, price: 12000 }] }); // nợ 20.000
    const r = ret({ orderId: o.id, items: [{ orderItemId: o.items[0]!.id, qty: 2 }] });
    expect(r).toMatchObject({ refund: 24000, debtReduced: 20000, cashRefund: 4000, customerId: c.id, customerName: 'Chị Lan' });
    expect(getCustomer(db, c.id).debt).toBe(0);
    expect(listCustomerTransactions(db, c.id)[0]).toMatchObject({
      kind: 'return',
      amount: -20000,
      orderId: o.id,
      note: `Trả hàng ${r.code}`,
      createdAt: '2026-09-30T03:00:00.000Z',
    });
  });

  it('nợ của khách lớn hơn tiền hoàn: trừ nợ hết, không chi tiền mặt; khách đã hết nợ thì trả tiền mặt', () => {
    const c = lan();
    const big = order({ paymentMethod: 'debt', customerId: c.id, paid: 0, items: [{ name: 'Gạo', qty: 1, price: 50000 }] });
    const small = order({ paymentMethod: 'debt', customerId: c.id, paid: 0, items: [{ name: 'Muối', qty: 1, price: 10000 }] });
    expect(ret({ orderId: small.id, items: [{ orderItemId: small.items[0]!.id, qty: 1 }] })).toMatchObject({ debtReduced: 10000, cashRefund: 0 });
    collectDebt(db, c.id, customerPaymentSchema.parse({ amount: 50000, method: 'cash' }), D30);
    expect(ret({ orderId: big.id, items: [{ orderItemId: big.items[0]!.id, qty: 1 }] })).toMatchObject({ debtReduced: 0, cashRefund: 50000 });
    expect(getCustomer(db, c.id).debt).toBe(0);
  });
});

describe('cancelReturn', () => {
  it('trừ lại tồn đã nhập kho bằng adjust, cộng lại nợ đã trừ (return_cancel); phiếu còn với trạng thái Đã hủy; hủy lần hai 409', () => {
    const bia = product({ name: 'Bia', unit: 'lon', sellPrice: 12000, costPrice: 10000, stock: 100 });
    const c = createCustomer(db, customerCreateSchema.parse({ name: 'Chị Lan' }));
    const o = order({ paymentMethod: 'debt', customerId: c.id, paid: 0, items: [{ productId: bia.id, qty: 2, price: 12000 }] });
    const r = ret({ orderId: o.id, items: [{ orderItemId: o.items[0]!.id, qty: 1 }] });
    expect(getProduct(db, bia.id).stock).toBe(99);
    expect(getCustomer(db, c.id).debt).toBe(12000);
    expect(cancelReturn(db, r.id, D30)).toMatchObject({ status: 'cancelled', cancelledAt: '2026-09-30T03:00:00.000Z' });
    expect(getProduct(db, bia.id).stock).toBe(98);
    expect(getCustomer(db, c.id).debt).toBe(24000);
    expect(listCustomerTransactions(db, c.id)[0]).toMatchObject({ kind: 'return_cancel', amount: 12000, note: `Hủy phiếu trả ${r.code}` });
    expect(movements()).toEqual([
      ['return', bia.id, 1, `Trả hàng ${r.code}`],
      ['adjust', bia.id, -1, `Hủy phiếu trả ${r.code}`],
    ]);
    const after = getOrder(db, o.id);
    expect(after.refunded).toBe(0);
    expect(after.items[0]!.returnedQty).toBe(0);
    expect(after.returns.map((x) => x.status)).toEqual(['cancelled']);
    expect(() => cancelReturn(db, r.id, D30)).toThrow('Phiếu trả đã hủy');
    expect(() => cancelReturn(db, 9999, D30)).toThrow('Không tìm thấy phiếu trả');
  });

  it('hóa đơn còn phiếu trả thì không hủy được; hủy phiếu trả xong thì hủy được, tồn về như trước khi bán', () => {
    const { bia, o, lon } = seedCashOrder();
    const r = ret({ orderId: o.id, items: [{ orderItemId: lon, qty: 1 }] });
    expect(() => cancelOrder(db, o.id, D30)).toThrow('Hóa đơn đã có phiếu trả, hãy hủy phiếu trả trước');
    expect(getProduct(db, bia.id).stock).toBe(75);
    cancelReturn(db, r.id, D30);
    cancelOrder(db, o.id, D30);
    expect(getProduct(db, bia.id).stock).toBe(100);
  });
});
```

- [ ] **Step 10: Chạy test, thấy lỗi**

Run: `npm run build -w shared && cd server && npx vitest run src/services/returns.test.ts`
Expected: FAIL, không tìm thấy `./returns.js`.

- [ ] **Step 11: Tạo `server/src/services/returns.ts`**

```ts
import { eq } from 'drizzle-orm';
import { localDate, QTY_EPS, remainingQty, returnAmounts, roundQty, splitRefund, type ReturnDetail, type ReturnInput } from '@tiny-pos/shared';
import type { Db, DbOrTx } from '../db/connection.js';
import { returnItems, returns } from '../db/schema.js';
import { BadRequestError, ConflictError, NotFoundError } from '../errors.js';
import { recordCustomerDebtTx } from './customer-ledger.js';
import { nextDailyCode, resolveClock, type Clock } from './daily-code.js';
import { getOrder } from './orders.js';
import { returnItemsOf, returnRows } from './return-rows.js';
import { recordMovement } from './stock.js';

const INVALID_LINE = 'Dòng trả hàng không hợp lệ';

export function getReturn(db: DbOrTx, id: number): ReturnDetail {
  const [row] = returnRows(db, eq(returns.id, id));
  if (!row) throw new NotFoundError('Không tìm thấy phiếu trả');
  return { ...row, items: returnItemsOf(db, [id]).get(id) ?? [] };
}

/**
 * Lập phiếu trả cho hóa đơn `done`, tính vào ngày lập phiếu: tiền hoàn theo giá trị sau giảm giá của dòng (return-math),
 * đơn ghi nợ trừ nợ hiện tại của khách trước rồi mới trả tiền mặt, dòng nhập lại kho ghi movement `return`.
 */
export function createReturn(db: Db, input: ReturnInput, clock?: Clock): ReturnDetail {
  const { now, tz } = resolveClock(clock);
  return db.transaction((tx) => {
    const o = getOrder(tx, input.orderId);
    if (o.status !== 'done') throw new ConflictError('Hóa đơn đã hủy, không trả hàng được');
    if (!input.items.length) throw new BadRequestError('Chưa chọn món nào để trả');
    if (new Set(input.items.map((l) => l.orderItemId)).size !== input.items.length) throw new BadRequestError(INVALID_LINE);
    const picks = new Map<number, number>();
    const lines = input.items.map((l) => {
      const it = o.items.find((i) => i.id === l.orderItemId);
      if (!it) throw new BadRequestError(INVALID_LINE);
      const qty = roundQty(l.qty);
      if (qty <= 0) throw new BadRequestError(INVALID_LINE);
      if (qty > remainingQty(it.qty, it.returnedQty) + QTY_EPS) throw new BadRequestError(`Số lượng trả vượt số còn lại của ${it.productName}`);
      picks.set(it.id, qty);
      return { it, qty, restock: l.restock && it.productId !== null };
    });
    const amounts = returnAmounts(o.items, o.discount, picks);
    const refund = lines.reduce((s, l) => s + amounts.get(l.it.id)!, 0);
    const { debtReduced, cashRefund } = splitRefund(refund, o.paymentMethod, o.customerDebt);
    const code = nextDailyCode(tx, 'returns', 'TH', localDate(now, tz), 4);
    const { id } = tx
      .insert(returns)
      .values({ code, orderId: o.id, refund, debtReduced, cashRefund, note: input.note, createdAt: now.toISOString() })
      .returning({ id: returns.id })
      .get();
    for (const l of lines) {
      tx.insert(returnItems)
        .values({ returnId: id, orderItemId: l.it.id, qty: l.qty, restock: l.restock, amount: amounts.get(l.it.id)!, cost: Math.round(l.qty * l.it.costPrice) })
        .run();
      if (l.restock) recordMovement(tx, { productId: l.it.productId!, qty: l.qty * l.it.factor, type: 'return', refId: id, note: `Trả hàng ${code}` });
    }
    if (debtReduced > 0)
      recordCustomerDebtTx(tx, {
        customerId: o.customerId!,
        amount: -debtReduced,
        kind: 'return',
        orderId: o.id,
        note: `Trả hàng ${code}`,
        createdAt: now.toISOString(),
      });
    return getReturn(tx, id);
  });
}

/** Hủy phiếu trả: trừ lại tồn đã nhập kho (movement adjust), cộng lại nợ đã trừ; phiếu giữ lại với trạng thái cancelled. */
export function cancelReturn(db: Db, id: number, clock?: Clock): ReturnDetail {
  const { now } = resolveClock(clock);
  return db.transaction((tx) => {
    const r = getReturn(tx, id);
    if (r.status === 'cancelled') throw new ConflictError('Phiếu trả đã hủy');
    for (const it of r.items) {
      if (!it.restock || it.productId === null) continue;
      recordMovement(tx, { productId: it.productId, qty: -it.qty * it.factor, type: 'adjust', refId: id, note: `Hủy phiếu trả ${r.code}` });
    }
    if (r.debtReduced > 0 && r.customerId !== null)
      recordCustomerDebtTx(tx, {
        customerId: r.customerId,
        amount: r.debtReduced,
        kind: 'return_cancel',
        orderId: r.orderId,
        note: `Hủy phiếu trả ${r.code}`,
        createdAt: now.toISOString(),
      });
    tx.update(returns).set({ status: 'cancelled', cancelledAt: now.toISOString() }).where(eq(returns.id, id)).run();
    return getReturn(tx, id);
  });
}
```

- [ ] **Step 12: Chạy test, thấy qua**

Run: `cd server && npx vitest run src/services/returns.test.ts src/db/migration-0004.test.ts`
Expected: PASS (9 test).

- [ ] **Step 13: Toàn bộ test và typecheck**

Run: `npm run typecheck && npm test`
Expected: không lỗi. (`daySummary` chưa đổi nên các test `summary).toEqual` cũ vẫn qua.)

---

### Task 3: Server – két, báo cáo số thuần, Tổng quan, cột Excel

**Files:**
- Modify: `shared/src/types.ts` (`DaySummary`, `ProfitRow`, `DebtReport`), `server/src/services/orders.ts` (`daySummary`), `server/src/services/reports.ts`, `server/src/services/overview.ts:53-61`, `server/src/services/exports.ts` (`ORDER_COLUMNS`, `exportOrdersXlsx`), `server/src/services/report-exports.ts` (`PROFIT_COLUMNS`, `exportProfitReportXlsx`)
- Test (sửa kỳ vọng): `server/src/services/orders.test.ts:161,298-305`, `server/src/routes/orders-api.test.ts:40`, `server/src/services/reports.test.ts` (imports, `TOTAL_29`, dòng 84, 228, thêm describe), `server/src/services/exports.test.ts:79-110` (+1 test), `server/src/services/report-exports.test.ts:37-42`, `server/src/services/overview.test.ts` (+1 test)

**Interfaces:**
- Consumes: `returnSummary` (Task 2), `createReturn`, `cancelReturn` (Task 2), bảng `returns`, `returnItems`.
- Produces: `DaySummary.returns: ReturnSummary`; `ProfitRow.returns: number` và `revenue/cost/profit/cash/debt` là số thuần; `DebtReport.period.returnDebt: number`; `ProductSalesRow` số thuần; cột Excel *Trả hàng*.

- [ ] **Step 1: Sửa types trong `shared/src/types.ts`**

`interface DaySummary`: thêm sau dòng `debtCollected: { cash: number; transfer: number };`:

```ts
  /** Phiếu trả chưa hủy trong ngày (ngày lập phiếu); các số trên là bán ra, chưa trừ phần trả. */
  returns: ReturnSummary;
```

`interface ProfitRow`: đổi comment của `revenue` và `cost`, thêm `returns` sau `debtCollected`:

```ts
  /** Σ (total − discount) của đơn hoàn tất − tiền hoàn của phiếu trả trong kỳ. */
  revenue: number;
  /** Σ qty × costPrice của dòng (giá vốn lúc bán, theo đơn vị bán) − giá vốn phần trả có nhập lại kho. */
  cost: number;
```

```ts
  /** Tiền hoàn của phiếu trả trong kỳ (ngày lập phiếu); cash / debt đã trừ phần tương ứng. */
  returns: number;
```

`interface DebtReport`: đổi dòng `period` thành:

```ts
  /** Ghi nợ mới và thu nợ trong khoảng (bằng DaySummary cùng khoảng); returnDebt: phần nợ trừ do trả hàng. */
  period: { debt: number; collected: { cash: number; transfer: number }; returnDebt: number };
```

- [ ] **Step 2: Sửa kỳ vọng test có sẵn (sẽ đỏ cho tới khi xong Step 5)**

- `server/src/services/orders.test.ts:161`: thêm `, returns: { count: 0, refund: 0, cash: 0, debt: 0 }` vào cuối object kỳ vọng (sau `debtCollected: { cash: 0, transfer: 0 }`).
- `server/src/services/orders.test.ts:298-305`: thêm dòng `      returns: { count: 0, refund: 0, cash: 0, debt: 0 },` sau dòng `      debtCollected: { cash: 50000, transfer: 30000 },`.
- `server/src/routes/orders-api.test.ts:40`: thêm `, returns: { count: 0, refund: 0, cash: 0, debt: 0 }` sau `debtCollected: { cash: 0, transfer: 0 }`.
- `server/src/services/reports.test.ts`: trong `TOTAL_29` thêm dòng `  returns: 0,` sau dòng `  debtCollected: { cash: 0, transfer: 4000 },`; dòng 84 thêm `, returns: { count: 0, refund: 0, cash: 0, debt: 0 }` sau `debtCollected: { cash: 0, transfer: 4000 }`; dòng 228 đổi thành `expect(r.period).toEqual({ debt: 7000, collected: { cash: 20000, transfer: 4000 }, returnDebt: 0 });`.
- `server/src/services/report-exports.test.ts:37-42` đổi thành:

```ts
    expect(s!.rows).toEqual([
      ['Kỳ', 'Số đơn', 'Doanh thu', 'Trả hàng', 'Giá vốn', 'Lãi gộp', 'Tiền mặt', 'Chuyển khoản', 'Ghi nợ', 'Thu nợ TM', 'Thu nợ CK'],
      ['29/09/2026', 2, 45000, 0, 30000, 15000, 30000, 0, 15000, 0, 0],
      ['28/09/2026', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      ['Tổng', 2, 45000, 0, 30000, 15000, 30000, 0, 15000, 0, 0],
    ]);
```

- `server/src/services/exports.test.ts:100-104` (sheet *Hóa đơn*) đổi thành:

```ts
    expect(head!.rows).toEqual([
      ['Mã', 'Ngày giờ', 'Khách', 'Hình thức', 'Tiền hàng', 'Giảm giá', 'Phải trả', 'Đã trả', 'Còn nợ', 'Trả hàng', 'Số món', 'Trạng thái', 'Hủy lúc'],
      ['HD-20260929-0002', '2026-09-29T10:00:00.000Z', 'Cô Ba', 'Ghi nợ', 15000, 0, 15000, 5000, 10000, 0, 1, 'Hoàn tất'],
      ['HD-20260929-0001', '2026-09-29T10:00:00.000Z', null, 'Tiền mặt', 30000, 1000, 29000, 29000, null, 0, 1, 'Đã hủy', '2026-09-29T17:00:00.000Z'],
    ]);
```

- [ ] **Step 3: Thêm test mới**

`server/src/services/reports.test.ts`: thêm `getOrder` vào dòng `import { cancelOrder, createOrder, listOrders } from './orders.js';`, thêm `returnInputSchema` vào khối import `@tiny-pos/shared` (sau `reportQuerySchema,`), thêm `import type { OrderDetail } from '@tiny-pos/shared';` sau khối đó và `import { createReturn } from './returns.js';` sau dòng import `./reports.js`. Thêm cuối file:

```ts

describe('trả hàng trong báo cáo', () => {
  const D30 = at('2026-09-30T03:00:00.000Z'); // 10:00 ngày 30/9 giờ VN
  const VIEW30 = at('2026-09-30T10:00:00.000Z');

  /**
   * Ngày 30 trả: 1 lon của đơn tiền mặt (nhập kho; giá trị dòng 23.000 sau giảm giá → hoàn 11.500), cả thùng của đơn CK
   * (hỏng, không nhập kho → hoàn 280.000, giá vốn không trừ), 1 lon của đơn ghi nợ (Lan còn nợ 3.000 → trừ nợ 3.000, tiền mặt 9.000).
   * → hoàn 303.500, tiền mặt 300.500, trừ nợ 3.000, giá vốn trừ 20.000.
   */
  function seedReturns() {
    seedSales();
    const done = listOrders(db, orderListQuerySchema.parse({ date: '2026-09-29', status: 'done' }), VIEW).orders.map((o) => getOrder(db, o.id));
    const back = (o: OrderDetail, restock = true) =>
      createReturn(db, returnInputSchema.parse({ orderId: o.id, items: [{ orderItemId: o.items[0]!.id, qty: 1, restock }] }), D30);
    back(done.find((o) => o.discount === 1000)!);
    back(done.find((o) => o.paymentMethod === 'transfer')!, false);
    back(done.find((o) => o.paymentMethod === 'debt')!);
  }

  it('lãi lỗ: ngày bán không đổi; ngày trả trừ doanh thu, tiền mặt, ghi nợ; giá vốn chỉ trừ hàng nhập lại kho; vẫn revenue = cash + transfer + debt', () => {
    seedReturns();
    const r = profitReport(db, q({ from: '2026-09-29', to: '2026-09-30' }), VIEW30);
    const [d30, d29] = r.rows;
    expect(d29).toEqual({ ...TOTAL_29, period: '2026-09-29' });
    expect(d30).toEqual({
      period: '2026-09-30',
      orders: 0,
      revenue: -303500,
      cost: -20000,
      profit: -283500,
      cash: -300500,
      transfer: 0,
      debt: -3000,
      debtCollected: { cash: 0, transfer: 0 },
      returns: 303500,
    });
    expect(r.total).toMatchObject({ orders: 4, returns: 303500, revenue: 41500, cost: 250000, profit: -208500, cash: -242500, transfer: 280000, debt: 4000 });
    expect(r.total.revenue).toBe(r.total.cash + r.total.transfer + r.total.debt);
  });

  it('daySummary ngày trả có returns; các số bán ra giữ nguyên nghĩa', () => {
    seedReturns();
    expect(listOrders(db, orderListQuerySchema.parse({ date: '2026-09-30' }), VIEW30).summary).toEqual({
      count: 0,
      total: 0,
      cash: 0,
      transfer: 0,
      debt: 0,
      debtCollected: { cash: 0, transfer: 0 },
      returns: { count: 3, refund: 303500, cash: 300500, debt: 3000 },
    });
  });

  it('mặt hàng: bán chạy trừ phần trả trong kỳ (doanh thu trước giảm giá, giá vốn chỉ phần nhập kho); kỳ chỉ có trả thì không có dòng', () => {
    seedReturns();
    const both = productReport(db, productReportQuerySchema.parse({ from: '2026-09-29', to: '2026-09-30' }), VIEW30);
    expect(both.topSelling.find((x) => x.name === 'Bia')).toMatchObject({ qty: 1, revenue: 12000, profit: -238000 });
    const only30 = productReport(db, productReportQuerySchema.parse({ from: '2026-09-30', to: '2026-09-30' }), VIEW30);
    expect(only30.topSelling).toEqual([]);
  });

  it('công nợ: returnDebt là phần trừ nợ do trả hàng trong kỳ', () => {
    seedReturns();
    expect(debtReport(db, q({ from: '2026-09-30', to: '2026-09-30' }), VIEW30).period).toEqual({
      debt: 0,
      collected: { cash: 0, transfer: 0 },
      returnDebt: 3000,
    });
  });
});
```

`server/src/services/overview.test.ts`: thêm `returnInputSchema,` vào khối import `@tiny-pos/shared` (sau `productViewQuerySchema,`), thêm `import { cancelReturn, createReturn } from './returns.js';` sau dòng import `./products.js`. Thêm vào cuối `describe` chứa test "khách: … nợ lâu …" (ngay sau test đó):

```ts

  it('hủy phiếu trả không làm mới mốc nợ lâu: bút toán bù return_cancel không tính là ghi nợ mới', () => {
    const c = createCustomer(db, customerCreateSchema.parse({ name: 'Chị Lan' }));
    const o = order({ paymentMethod: 'debt', customerId: c.id, paid: 0, items: [{ name: 'Gạo', qty: 2, price: 25000 }] }, daysAgo(40));
    collectDebt(db, c.id, customerPaymentSchema.parse({ amount: 10000, method: 'cash' }), daysAgo(35));
    const r = createReturn(db, returnInputSchema.parse({ orderId: o.id, items: [{ orderItemId: o.items[0]!.id, qty: 1 }] }), NOON);
    cancelReturn(db, r.id, NOON);
    expect(overview(db, NOON).customers).toMatchObject({ overdueCount: 1, overdueTotal: 40000 });
  });
```

`server/src/services/exports.test.ts`: thêm `returnInputSchema,` vào khối import shared (sau `productViewQuerySchema,`), thêm `import { createReturn } from './returns.js';` sau dòng import `./products.js`. Thêm vào trong `describe('exportOrdersXlsx', …)`, sau test có sẵn:

```ts

  it('cột Trả hàng là tổng hoàn của phiếu trả chưa hủy', async () => {
    const a = product({ name: 'Sữa', sellPrice: 15000, costPrice: 10000 });
    const o = createOrder(db, orderInputSchema.parse({ paymentMethod: 'cash', paid: 100000, items: [{ productId: a.id, qty: 2, price: 15000 }] }), MORNING);
    createReturn(db, returnInputSchema.parse({ orderId: o.id, items: [{ orderItemId: o.items[0]!.id, qty: 1 }] }), MORNING);
    const f = await exportOrdersXlsx(db, orderListQuerySchema.parse({ from: '2026-09-29', to: '2026-09-29' }), CLOCK);
    const [head] = await readWorkbook(f.buffer);
    expect(head!.rows[1]![9]).toBe(15000);
  });
```

- [ ] **Step 4: Chạy test, thấy lỗi**

Run: `npm run build -w shared && cd server && npx vitest run src/services/reports.test.ts src/services/orders.test.ts src/services/overview.test.ts src/services/exports.test.ts src/services/report-exports.test.ts src/routes/orders-api.test.ts`
Expected: FAIL ở các kỳ vọng mới (thiếu `returns`, `returnDebt`, cột *Trả hàng*, số thuần, nợ lâu).

- [ ] **Step 5: Cài đặt**

`server/src/services/orders.ts`: dòng import `./return-rows.js` đổi thành `import { refundedSql, returnedQtySql, returnRows, returnSummary } from './return-rows.js';`; trong `daySummary`, thêm dòng cuối object trả về (sau `debtCollected: { … },`):

```ts
    returns: returnSummary(db, start, end),
```

`server/src/services/reports.ts`:
1. Dòng import schema đổi thành `import { customers, debtTransactions, orderItems, orders, products, returnItems, returns, suppliers } from '../db/schema.js';`
2. `emptyRow`: thêm `  returns: 0,` sau dòng `  debtCollected: { cash: 0, transfer: 0 },`.
3. Trong `profitReport`, ngay sau vòng `for (const c of collected) { … }`, thêm:

```ts

  // Phiếu trả tính vào ngày lập phiếu: trừ doanh thu, tiền mặt, ghi nợ; giá vốn chỉ trừ phần đã nhập lại kho (hàng hỏng thành lỗ)
  const restockCost = sql<number>`(select coalesce(sum(cost), 0) from return_items where return_items.return_id = returns.id and return_items.restock = 1)`;
  const returned = db
    .select({ refund: returns.refund, cash: returns.cashRefund, debt: returns.debtReduced, createdAt: returns.createdAt, cost: restockCost })
    .from(returns)
    .where(and(eq(returns.status, 'done'), gte(returns.createdAt, r.start), lt(returns.createdAt, r.end)))
    .all();
  for (const x of returned) {
    const row = rows.get(periodOf(x.createdAt))!;
    const c = Number(x.cost);
    row.returns += x.refund;
    row.revenue -= x.refund;
    row.cost -= c;
    row.profit -= x.refund - c;
    row.cash -= x.cash;
    row.debt -= x.debt;
  }
```

4. Thay object `total` trong `profitReport`:

```ts
  const total: ProfitRow = {
    period: '',
    orders: s.count,
    revenue: s.total - s.returns.refund,
    cost: totalCost,
    profit: s.total - s.returns.refund - totalCost,
    cash: s.cash - s.returns.cash,
    transfer: s.transfer,
    debt: s.debt - s.returns.debt,
    debtCollected: s.debtCollected,
    returns: s.returns.refund,
  };
```

5. Trong `productReport`, ngay sau truy vấn `const sold = …all();`, thêm:

```ts
  // Phần trả trong kỳ (ngày lập phiếu) trừ vào món đã bán trong kỳ; doanh thu cùng cơ sở trước giảm giá như order_items.amount
  const returned = new Map(
    db
      .select({
        productId: orderItems.productId,
        qty: sql<number>`sum(return_items.qty * order_items.factor)`,
        revenue: sql<number>`sum(order_items.amount * return_items.qty / order_items.qty)`,
        cost: sql<number>`sum(case when return_items.restock = 1 then return_items.cost else 0 end)`,
      })
      .from(returnItems)
      .innerJoin(returns, eq(returnItems.returnId, returns.id))
      .innerJoin(orderItems, eq(returnItems.orderItemId, orderItems.id))
      .where(and(eq(returns.status, 'done'), gte(returns.createdAt, r.start), lt(returns.createdAt, r.end)))
      .groupBy(orderItems.productId)
      .all()
      .map((x) => [x.productId, x] as const),
  );
```

   và trong `sold.map((s) => { … })` thay ba dòng `const revenue = Number(s.revenue);` / `qty: Number(s.qty),` / `profit: revenue - Math.round(Number(s.cost)),` bằng:

```ts
    const back = returned.get(s.productId);
    const revenue = Number(s.revenue) - Math.round(Number(back?.revenue ?? 0));
```

```ts
      qty: Number(s.qty) - Number(back?.qty ?? 0),
```

```ts
      profit: revenue - (Math.round(Number(s.cost)) - Number(back?.cost ?? 0)),
```

6. `debtReport`: dòng `period: { debt: s.debt, collected: s.debtCollected },` đổi thành `period: { debt: s.debt, collected: s.debtCollected, returnDebt: s.returns.debt },`.

`server/src/services/overview.ts`, trong `customerDebt`: dòng `owingSince` đổi `and amount > 0` thành `and amount > 0 and kind <> 'return_cancel'`; comment phía trên hàm thêm câu cuối: `Bút toán bù khi hủy phiếu trả (return_cancel) không phải ghi nợ mới nên không làm mới mốc.`

`server/src/services/exports.ts`: trong `ORDER_COLUMNS` thêm `  col('Trả hàng', 12, 'money'),` sau dòng `  col('Còn nợ', 12, 'money'),`; trong `exportOrdersXlsx` dòng `isDebt ? o.payable - o.paid : null, o.itemCount, STATUS_LABEL[o.status], o.cancelledAt];` đổi thành `isDebt ? o.payable - o.paid : null, o.refunded, o.itemCount, STATUS_LABEL[o.status], o.cancelledAt];`.

`server/src/services/report-exports.ts`: trong `PROFIT_COLUMNS` thêm `  col('Trả hàng', 14, 'money'),` sau dòng `  col('Doanh thu', 14, 'money'),`; trong `exportProfitReportXlsx` đổi `[label, x.orders, x.revenue, x.cost,` thành `[label, x.orders, x.revenue, x.returns, x.cost,`.

- [ ] **Step 6: Chạy test, thấy qua**

Run: `cd server && npx vitest run src/services/reports.test.ts src/services/orders.test.ts src/services/overview.test.ts src/services/exports.test.ts src/services/report-exports.test.ts src/routes/orders-api.test.ts`
Expected: PASS.

- [ ] **Step 7: Toàn bộ**

Run: `npm run typecheck && npm test`
Expected: không lỗi.

---

### Task 4: Server – danh sách, xuất Excel, API `/api/returns`

**Files:**
- Modify: `server/src/services/returns.ts` (thêm), `server/src/services/exports.ts` (thêm), `server/src/routes/index.ts`
- Create: `server/src/routes/returns.ts`, `server/src/routes/returns-api.test.ts`
- Test: `server/src/services/returns.test.ts` (thêm describe), `server/src/services/exports.test.ts` (thêm describe)

**Interfaces:**
- Consumes: `returnRows`, `returnItemsOf`, `returnSummary` (Task 2), `likeTerm` (orders.ts), `ReturnListQuery`, `ReturnList`, `MAX_EXPORT_ROWS`, `PAGE_SIZE`, `resolveRange`, `localDayRange`.
- Produces: `listReturns(db, query, clock?) → ReturnList`, `listReturnsForExport(db, query, clock?, maxRows?) → { from, to, returns: ReturnDetail[] }`, `exportReturnsXlsx(db, query, clock?) → XlsxFile`; route `GET /api/returns`, `GET /api/returns/export.xlsx`, `GET /api/returns/:id`, `POST /api/returns`, `POST /api/returns/:id/cancel`.

- [ ] **Step 1: Viết test**

`server/src/services/returns.test.ts`: thêm `returnListQuerySchema,` vào khối import shared (sau `returnInputSchema,`), đổi dòng import `./returns.js` thành `import { cancelReturn, createReturn, listReturns } from './returns.js';`. Thêm cuối file:

```ts

describe('listReturns', () => {
  it('lọc theo ngày VN của phiếu, trạng thái, tìm mã phiếu / mã hóa đơn / tên món không dấu; summary chỉ theo ngày, bỏ phiếu hủy', () => {
    const { o, lon, da } = seedCashOrder();
    const a = ret({ orderId: o.id, items: [{ orderItemId: lon, qty: 1 }] });
    const b = ret({ orderId: o.id, items: [{ orderItemId: da, qty: 1 }] });
    cancelReturn(db, b.id, D30);
    ret({ orderId: o.id, items: [{ orderItemId: lon, qty: 1 }] }, at('2026-10-01T03:00:00.000Z'));
    const list = (q: Record<string, unknown>) => listReturns(db, returnListQuerySchema.parse(q), D30);
    const day = list({});
    expect(day.returns.map((r) => r.code)).toEqual([b.code, a.code]);
    expect(day.summary).toEqual({ count: 1, refund: 11651, cash: 11651, debt: 0 });
    expect(day).toMatchObject({ total: 2, page: 1, pageSize: 50 });
    expect(list({ status: 'cancelled' }).returns.map((r) => r.id)).toEqual([b.id]);
    expect(list({ q: 'tui da' }).returns.map((r) => r.id)).toEqual([b.id]);
    expect(list({ q: o.code }).total).toBe(2);
    expect(list({ q: a.code.toLowerCase() }).returns.map((r) => r.id)).toEqual([a.id]);
    expect(list({ q: '%' }).total).toBe(0);
    expect(list({ from: '2026-09-30', to: '2026-10-01' }).total).toBe(3);
  });
});
```

`server/src/services/exports.test.ts`: thêm `returnListQuerySchema,` vào khối import shared, thêm `exportReturnsXlsx` vào dòng import `./exports.js`. Thêm cuối file:

```ts

describe('exportReturnsXlsx', () => {
  it('sheet Phiếu trả + Chi tiết theo bộ lọc; nhập kho Có/Không; tên file theo khoảng ngày', async () => {
    const a = product({ name: 'Sữa', sellPrice: 15000, costPrice: 10000, stock: 10 });
    const o = createOrder(db, orderInputSchema.parse({ paymentMethod: 'cash', paid: 100000, items: [{ productId: a.id, qty: 2, price: 15000 }] }), MORNING);
    createReturn(db, returnInputSchema.parse({ orderId: o.id, items: [{ orderItemId: o.items[0]!.id, qty: 1, restock: false }], note: 'Hỏng' }), MORNING);
    const f = await exportReturnsXlsx(db, returnListQuerySchema.parse({ from: '2026-09-29', to: '2026-09-29' }), CLOCK);
    expect(f.filename).toBe('tra-hang-20260929.xlsx');
    const [head, detail] = await readWorkbook(f.buffer);
    expect(head!.name).toBe('Phiếu trả');
    expect(head!.rows).toEqual([
      ['Mã', 'Ngày giờ', 'Hóa đơn', 'Khách', 'Tổng hoàn', 'Trừ nợ', 'Tiền mặt', 'Số món', 'Trạng thái', 'Hủy lúc', 'Ghi chú'],
      ['TH-20260929-0001', '2026-09-29T10:00:00.000Z', 'HD-20260929-0001', null, 15000, 0, 15000, 1, 'Hoàn tất', null, 'Hỏng'],
    ]);
    expect(detail!.name).toBe('Chi tiết');
    expect(detail!.rows).toEqual([
      ['Mã phiếu', 'Ngày giờ', 'Trạng thái', 'Tên hàng', 'Đơn vị', 'SL', 'Tiền hoàn', 'Nhập kho'],
      ['TH-20260929-0001', '2026-09-29T10:00:00.000Z', 'Hoàn tất', 'Sữa', 'cái', 1, 15000, 'Không'],
    ]);
  });
});
```

`server/src/routes/returns-api.test.ts`:

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

describe('API trả hàng', () => {
  it('lập phiếu, danh sách hôm nay, chi tiết, hóa đơn biết phiếu trả, chặn hủy hóa đơn, hủy phiếu, hủy lần hai 409', async () => {
    const p = await call('POST', '/api/products', { name: 'Nước suối', sellPrice: 5000, stock: 10 });
    const o = await call('POST', '/api/orders', { items: [{ productId: p.json.id, qty: 2, price: 5000 }], paymentMethod: 'cash', paid: 10000 });
    const created = await call('POST', '/api/returns', { orderId: o.json.id, items: [{ orderItemId: o.json.items[0].id, qty: 1 }] });
    expect(created.status).toBe(201);
    expect(created.json).toMatchObject({ refund: 5000, cashRefund: 5000, orderCode: o.json.code });
    expect(created.json.code).toMatch(/^TH-\d{8}-0001$/);
    expect((await call('GET', `/api/products/${p.json.id}`)).json.stock).toBe(9);

    const list = await call('GET', '/api/returns');
    expect(list.json.returns.map((r: { id: number }) => r.id)).toEqual([created.json.id]);
    expect(list.json.summary).toEqual({ count: 1, refund: 5000, cash: 5000, debt: 0 });
    expect((await call('GET', '/api/orders')).json.summary.returns).toEqual({ count: 1, refund: 5000, cash: 5000, debt: 0 });
    expect((await call('GET', `/api/returns/${created.json.id}`)).json.items).toHaveLength(1);
    expect((await call('GET', `/api/orders/${o.json.id}`)).json).toMatchObject({ refunded: 5000, items: [{ returnedQty: 1 }] });

    expect((await call('POST', `/api/orders/${o.json.id}/cancel`)).status).toBe(409);
    expect((await call('POST', `/api/returns/${created.json.id}/cancel`)).json.status).toBe('cancelled');
    expect((await call('POST', `/api/returns/${created.json.id}/cancel`)).status).toBe(409);
  });

  it('400 khi không có món hoặc vượt số; 404 hóa đơn / phiếu không có; xuất Excel', async () => {
    const o = await call('POST', '/api/orders', { items: [{ name: 'Đá', qty: 1, price: 2000 }], paymentMethod: 'cash', paid: 2000 });
    expect((await call('POST', '/api/returns', { orderId: o.json.id, items: [] })).status).toBe(400);
    const over = await call('POST', '/api/returns', { orderId: o.json.id, items: [{ orderItemId: o.json.items[0].id, qty: 2 }] });
    expect(over).toMatchObject({ status: 400, json: { error: 'Số lượng trả vượt số còn lại của Đá' } });
    expect((await call('POST', '/api/returns', { orderId: 9999, items: [{ orderItemId: 1, qty: 1 }] })).status).toBe(404);
    expect((await call('GET', '/api/returns/9999')).status).toBe(404);
    const res = await fetch(`${base}/api/returns/export.xlsx`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('spreadsheetml');
  });
});
```

- [ ] **Step 2: Chạy test, thấy lỗi**

Run: `cd server && npx vitest run src/services/returns.test.ts src/services/exports.test.ts src/routes/returns-api.test.ts`
Expected: FAIL (`listReturns`, `exportReturnsXlsx` chưa có; `/api/returns` trả 404).

- [ ] **Step 3: Thêm vào `server/src/services/returns.ts`**

Đổi các dòng import đầu file thành:

```ts
import { and, count, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import {
  localDate,
  localDayRange,
  MAX_EXPORT_ROWS,
  PAGE_SIZE,
  QTY_EPS,
  remainingQty,
  resolveRange,
  returnAmounts,
  roundQty,
  splitRefund,
  type ReturnDetail,
  type ReturnInput,
  type ReturnList,
  type ReturnListQuery,
} from '@tiny-pos/shared';
import type { Db, DbOrTx } from '../db/connection.js';
import { orders, returnItems, returns } from '../db/schema.js';
import { BadRequestError, ConflictError, NotFoundError } from '../errors.js';
import { recordCustomerDebtTx } from './customer-ledger.js';
import { nextDailyCode, resolveClock, type Clock } from './daily-code.js';
import { getOrder, likeTerm } from './orders.js';
import { returnItemsOf, returnRows, returnSummary } from './return-rows.js';
import { recordMovement } from './stock.js';
```

(File mới tạo trong đợt này nên viết lại khối import là được.) Thêm cuối file:

```ts

/** Điều kiện lọc phiếu trả dùng chung cho danh sách và file xuất; tìm theo mã phiếu, mã hóa đơn, tên món (không dấu). */
function returnFilter(query: ReturnListQuery, clock?: Clock) {
  const { now, tz } = resolveClock(clock);
  const { from, to } = resolveRange(query, localDate(now, tz));
  const start = localDayRange(from, tz).start;
  const end = localDayRange(to, tz).end;
  const term = likeTerm(query.q);
  const where = and(
    gte(returns.createdAt, start),
    lt(returns.createdAt, end),
    query.status?.length ? inArray(returns.status, query.status) : undefined,
    // Viết tên bảng cứng: drizzle bỏ tiền tố bảng trong sql``
    term
      ? sql`(vn_fold(returns.code) like ${term} escape '\\' or vn_fold(orders.code) like ${term} escape '\\' or exists (select 1 from return_items
          join order_items on order_items.id = return_items.order_item_id
          where return_items.return_id = returns.id and vn_fold(order_items.product_name) like ${term} escape '\\'))`
      : undefined,
  );
  return { from, to, start, end, where };
}

const countReturns = (db: Db, where: ReturnType<typeof returnFilter>['where']) =>
  db.select({ n: count() }).from(returns).innerJoin(orders, eq(returns.orderId, orders.id)).where(where).get()?.n ?? 0;

export function listReturns(db: Db, query: ReturnListQuery, clock?: Clock): ReturnList {
  const { start, end, where } = returnFilter(query, clock);
  const page = query.page ?? 1;
  return {
    returns: returnRows(db, where, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    summary: returnSummary(db, start, end),
    total: countReturns(db, where),
    page,
    pageSize: PAGE_SIZE,
  };
}

/** Mọi phiếu trả khớp bộ lọc (không phân trang), mới nhất trước, kèm dòng; quá `maxRows` thì báo lỗi. */
export function listReturnsForExport(
  db: Db,
  query: ReturnListQuery,
  clock?: Clock,
  maxRows = MAX_EXPORT_ROWS,
): { from: string; to: string; returns: ReturnDetail[] } {
  const { from, to, where } = returnFilter(query, clock);
  if (countReturns(db, where) > maxRows) throw new BadRequestError('Quá nhiều phiếu trả, hãy chọn khoảng ngày ngắn hơn');
  const rows = returnRows(db, where);
  const itemsOf = returnItemsOf(db, rows.map((r) => r.id));
  return { from, to, returns: rows.map((r) => ({ ...r, items: itemsOf.get(r.id) ?? [] })) };
}
```

- [ ] **Step 4: Thêm vào `server/src/services/exports.ts`**

Thêm `type ReturnListQuery,` vào khối import `@tiny-pos/shared` (sau `type ProductView,`), thêm `import { listReturnsForExport } from './returns.js';` sau dòng `import { listProducts } from './products.js';`. Thêm ngay sau hàm `exportOrdersXlsx`:

```ts

const RETURN_COLUMNS = [
  col('Mã', 18),
  col('Ngày giờ', 17, 'datetime'),
  col('Hóa đơn', 18),
  col('Khách', 22),
  col('Tổng hoàn', 12, 'money'),
  col('Trừ nợ', 12, 'money'),
  col('Tiền mặt', 12, 'money'),
  col('Số món', 8, 'qty'),
  col('Trạng thái', 11),
  col('Hủy lúc', 17, 'datetime'),
  col('Ghi chú', 30),
];
const RETURN_ITEM_COLUMNS = [
  col('Mã phiếu', 18),
  col('Ngày giờ', 17, 'datetime'),
  col('Trạng thái', 11),
  col('Tên hàng', 32),
  col('Đơn vị', 10),
  col('SL', 8, 'qty'),
  col('Tiền hoàn', 12, 'money'),
  col('Nhập kho', 10),
];

export async function exportReturnsXlsx(db: Db, query: ReturnListQuery, clock?: Clock): Promise<XlsxFile> {
  const { now, tz } = resolveClock(clock);
  const { from, to, returns } = listReturnsForExport(db, query, { now, tzOffsetMin: tz });
  const rows = returns.map((r) => [r.code, r.createdAt, r.orderCode, r.customerName, r.refund, r.debtReduced, r.cashRefund, r.itemCount,
    STATUS_LABEL[r.status], r.cancelledAt, r.note]);
  const items = returns.flatMap((r) =>
    r.items.map((it) => [r.code, r.createdAt, STATUS_LABEL[r.status], it.productName, it.unit, it.qty, it.amount, it.restock ? 'Có' : 'Không']),
  );
  return build(
    rangeName('tra-hang', from, to),
    [
      { name: 'Phiếu trả', columns: RETURN_COLUMNS, rows },
      { name: 'Chi tiết', columns: RETURN_ITEM_COLUMNS, rows: items },
    ],
    tz,
  );
}
```

- [ ] **Step 5: Tạo `server/src/routes/returns.ts`**

```ts
import { Router } from 'express';
import { returnInputSchema, returnListQuerySchema, type ReturnListQuery } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { intParam, validateBody, validateQuery } from '../middleware/validate.js';
import { exportReturnsXlsx } from '../services/exports.js';
import { cancelReturn, createReturn, getReturn, listReturns } from '../services/returns.js';
import { sendXlsx } from './send-xlsx.js';

export function returnsRouter(db: Db): Router {
  const r = Router();
  r.get('/', validateQuery(returnListQuerySchema), (_req, res) => {
    res.json(listReturns(db, res.locals['query'] as ReturnListQuery));
  });
  r.get('/export.xlsx', validateQuery(returnListQuerySchema), async (_req, res) =>
    sendXlsx(res, await exportReturnsXlsx(db, res.locals['query'] as ReturnListQuery)),
  );
  r.get('/:id', (req, res) => res.json(getReturn(db, intParam(req, 'id'))));
  r.post('/', validateBody(returnInputSchema), (req, res) => res.status(201).json(createReturn(db, req.body)));
  r.post('/:id/cancel', (req, res) => res.json(cancelReturn(db, intParam(req, 'id'))));
  return r;
}
```

`server/src/routes/index.ts`: thêm `import { returnsRouter } from './returns.js';` sau dòng `import { ordersRouter } from './orders.js';`, và `  r.use('/returns', returnsRouter(db));` sau dòng `  r.use('/orders', ordersRouter(db));`.

- [ ] **Step 6: Chạy test, thấy qua**

Run: `cd server && npx vitest run src/services/returns.test.ts src/services/exports.test.ts src/routes/returns-api.test.ts`
Expected: PASS.

- [ ] **Step 7: Toàn bộ**

Run: `npm run typecheck && npm test`
Expected: không lỗi.

---

### Task 5: Client – hook, phiếu in, hộp lập phiếu, chi tiết phiếu, nút Trả hàng trong hóa đơn

**Files:**
- Create: `client/src/api/returns.ts`, `client/src/components/MoneyLine.tsx`, `client/src/pages/returns/ReturnDialog.tsx`, `client/src/pages/returns/ReturnDetailDialog.tsx`
- Modify: `client/src/components/receipt/receipt-data.ts`, `client/src/components/receipt/Receipt.tsx`, `client/src/components/receipt/PrintProvider.tsx`, `client/src/pages/orders/OrderDetailDialog.tsx`

**Interfaces:**
- Consumes: API Task 4; `remainingQty`, `returnAmounts`, `roundQty`, `splitRefund`, types `OrderDetail`, `ReturnDetail`, `ReturnList`, `ReturnInputBody`.
- Produces: `useReturns(params)`, `useReturn(id)`, `useCreateReturn()`, `useCancelReturn()`, `ReturnListParams`; `MoneyLine`; `ReturnReceiptData`, `receiptFromReturn(r)`, `ReturnReceipt`; `ReturnDialog({ order, open, onClose })`, `ReturnDetailDialog({ id, onClose, onOpenOrder? })`.

- [ ] **Step 1: Tạo `client/src/api/returns.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DocStatus, ReturnDetail, ReturnInputBody, ReturnList } from '@tiny-pos/shared';
import { api, queryString } from './client';

export interface ReturnListParams {
  from: string;
  to: string;
  q?: string;
  status?: DocStatus[];
  page?: number;
}

export const useReturns = (p: ReturnListParams) =>
  useQuery({ queryKey: ['returns', 'list', p], queryFn: () => api<ReturnList>(`/returns${queryString({ ...p })}`), placeholderData: (prev) => prev });

export const useReturn = (id: number | null) =>
  useQuery({ queryKey: ['returns', 'detail', id], queryFn: () => api<ReturnDetail>(`/returns/${id}`), enabled: id !== null });

/** Phiếu trả đổi tồn, nợ khách, số đã trả của hóa đơn gốc và số liệu báo cáo. */
function useInvalidateReturns() {
  const qc = useQueryClient();
  return () => {
    for (const key of ['returns', 'orders', 'products', 'customers', 'reports']) void qc.invalidateQueries({ queryKey: [key] });
  };
}

export function useCreateReturn() {
  const invalidate = useInvalidateReturns();
  return useMutation({ mutationFn: (input: ReturnInputBody) => api<ReturnDetail>('/returns', { json: input }), onSuccess: invalidate });
}

export function useCancelReturn() {
  const invalidate = useInvalidateReturns();
  return useMutation({ mutationFn: (id: number) => api<ReturnDetail>(`/returns/${id}/cancel`, { method: 'POST' }), onSuccess: invalidate });
}
```

- [ ] **Step 2: Tạo `client/src/components/MoneyLine.tsx`** (chuyển `Line` của `OrderDetailDialog` ra dùng chung)

```tsx
/** Một dòng "nhãn – số tiền" trong hộp chi tiết chứng từ; `strong` là dòng tổng. */
export function MoneyLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? 'flex justify-between text-lg font-semibold' : 'flex justify-between text-muted-foreground'}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
```

- [ ] **Step 3: Phiếu in trả hàng**

`client/src/components/receipt/receipt-data.ts`: dòng import đầu file thêm `type ReturnDetail,` sau `type PaymentMethod`. Đổi dòng `export type PrintData = ReceiptData | DebtReceiptData;` thành `export type PrintData = ReceiptData | DebtReceiptData | ReturnReceiptData;`. Thêm cuối file:

```ts

/** Phiếu trả hàng 80mm: khách giữ làm bằng đã nhận tiền hoàn / được trừ nợ. */
export interface ReturnReceiptData {
  kind: 'return';
  code: string;
  orderCode: string;
  createdAt: string;
  customerName: string | null;
  items: ReceiptItem[];
  refund: number;
  debtReduced: number;
  cashRefund: number;
  /** Phiếu đã hủy: in lại phải ghi rõ. */
  cancelled: boolean;
}

export function receiptFromReturn(r: ReturnDetail): ReturnReceiptData {
  return {
    kind: 'return',
    code: r.code,
    orderCode: r.orderCode,
    createdAt: r.createdAt,
    customerName: r.customerName,
    items: r.items.map((i) => ({ name: i.productName, unit: i.unit, qty: i.qty, price: i.price, amount: i.amount })),
    refund: r.refund,
    debtReduced: r.debtReduced,
    cashRefund: r.cashRefund,
    cancelled: r.status === 'cancelled',
  };
}
```

`client/src/components/receipt/Receipt.tsx`: dòng `import type { DebtReceiptData, ReceiptData } from './receipt-data';` đổi thành `import type { DebtReceiptData, ReceiptData, ReturnReceiptData } from './receipt-data';`. Thêm cuối file:

```tsx

/** Phiếu trả hàng 80mm; tiền từng dòng là tiền hoàn (đã trừ phần giảm giá của hóa đơn). */
export function ReturnReceipt({ data, settings }: { data: ReturnReceiptData; settings: Settings }) {
  return (
    <div style={page}>
      <StoreHeader settings={settings} />
      <div style={rule} />
      <div style={{ ...center, fontWeight: 700 }}>{data.cancelled ? 'PHIẾU TRẢ HÀNG ĐÃ HỦY' : 'PHIẾU TRẢ HÀNG'}</div>
      <div style={center}>{data.code}</div>
      <div style={center}>{timeLabel(data.createdAt)}</div>
      <div style={center}>HĐ gốc: {data.orderCode}</div>
      {data.customerName && <div style={{ ...center, overflowWrap: 'anywhere' }}>Khách: {data.customerName}</div>}
      <div style={rule} />
      {data.items.map((it, i) => (
        <div key={i} style={{ marginBottom: '3px' }}>
          <div>{it.name}</div>
          <Row label={`${formatQty(it.qty)} ${it.unit} × ${formatMoney(it.price)}`} value={formatMoney(it.amount)} />
        </div>
      ))}
      <div style={rule} />
      <Row label="Tổng hoàn" value={formatMoney(data.refund)} strong />
      {data.debtReduced > 0 && <Row label="Trừ nợ" value={formatMoney(data.debtReduced)} />}
      <Row label="Trả tiền mặt" value={formatMoney(data.cashRefund)} />
      <div style={rule} />
      {settings.receiptFooter && <div style={center}>{settings.receiptFooter}</div>}
    </div>
  );
}
```

`client/src/components/receipt/PrintProvider.tsx`: dòng `import { DebtReceipt, Receipt } from './Receipt';` đổi thành `import { DebtReceipt, Receipt, ReturnReceipt } from './Receipt';`. Thay khối

```tsx
          'kind' in job.data ? (
            <DebtReceipt data={job.data} settings={settings ?? SETTINGS_DEFAULTS} />
          ) : (
```

bằng

```tsx
          'kind' in job.data ? (
            job.data.kind === 'return' ? (
              <ReturnReceipt data={job.data} settings={settings ?? SETTINGS_DEFAULTS} />
            ) : (
              <DebtReceipt data={job.data} settings={settings ?? SETTINGS_DEFAULTS} />
            )
          ) : (
```

- [ ] **Step 4: Tạo `client/src/pages/returns/ReturnDetailDialog.tsx`**

```tsx
import { Ban, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney, formatQty } from '@tiny-pos/shared';
import { useCancelReturn, useReturn } from '@/api/returns';
import { useConfirm } from '@/components/ConfirmDialog';
import { MoneyLine } from '@/components/MoneyLine';
import { usePrint } from '@/components/receipt/PrintProvider';
import { receiptFromReturn } from '@/components/receipt/receipt-data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/** Chi tiết phiếu trả: các dòng, hóa đơn gốc, in, hủy phiếu. Có `onOpenOrder` thì mã hóa đơn bấm được. */
export function ReturnDetailDialog({ id, onClose, onOpenOrder }: { id: number | null; onClose: () => void; onOpenOrder?: (orderId: number) => void }) {
  const { data: r } = useReturn(id);
  const cancel = useCancelReturn();
  const confirm = useConfirm();
  const print = usePrint();

  const onCancel = async () => {
    if (!r) return;
    const ok = await confirm({
      title: `Hủy phiếu trả ${r.code}?`,
      description: 'Tồn của món đã nhập kho bị trừ lại; nợ đã trừ của khách được cộng lại. Phiếu vẫn được giữ với trạng thái Đã hủy.',
      confirmText: 'Hủy phiếu',
      cancelText: 'Không',
      destructive: true,
    });
    if (!ok) return;
    cancel.mutate(r.id, { onSuccess: () => toast.success(`Đã hủy ${r.code}`), onError: (e) => toast.error(e.message) });
  };

  return (
    <Dialog open={id !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono text-xl">
            {r?.code ?? 'Phiếu trả'}
            {r?.status === 'cancelled' && <Badge variant="secondary">Đã hủy</Badge>}
          </DialogTitle>
          <DialogDescription className="text-base">
            {r && `${new Date(r.createdAt).toLocaleString('vi-VN')}${r.customerName ? ` · ${r.customerName}` : ''}`}
          </DialogDescription>
        </DialogHeader>
        {r && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Hóa đơn gốc</span>
              {onOpenOrder ? (
                <Button variant="link" className="h-auto p-0 font-mono text-base" onClick={() => onOpenOrder(r.orderId)}>
                  {r.orderCode}
                </Button>
              ) : (
                <span className="font-mono">{r.orderCode}</span>
              )}
            </div>
            <ul className="divide-y rounded-xl border">
              {r.items.map((it) => (
                <li key={it.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="font-medium">{it.productName}</div>
                    <div className="text-sm text-muted-foreground tabular-nums">
                      {formatQty(it.qty)} {it.unit}
                      {it.productId !== null && !it.restock && ' · không nhập kho'}
                    </div>
                  </div>
                  <div className="font-semibold tabular-nums">{formatMoney(it.amount)}</div>
                </li>
              ))}
            </ul>
            <div className="space-y-1">
              <MoneyLine label="Tổng hoàn" value={formatMoney(r.refund)} strong />
              {r.debtReduced > 0 && <MoneyLine label="Trừ nợ khách" value={formatMoney(r.debtReduced)} />}
              <MoneyLine label="Trả tiền mặt" value={formatMoney(r.cashRefund)} />
            </div>
            {r.note && <p className="text-sm text-muted-foreground">Ghi chú: {r.note}</p>}
          </div>
        )}
        <DialogFooter>
          {r?.status === 'done' && (
            <Button variant="outline" className="h-11 text-base text-destructive" disabled={cancel.isPending} onClick={() => void onCancel()}>
              <Ban data-icon="inline-start" />
              Hủy phiếu
            </Button>
          )}
          <Button className="h-11 text-base" disabled={!r} onClick={() => r && void print(receiptFromReturn(r))}>
            <Printer data-icon="inline-start" />
            In phiếu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: Tạo `client/src/pages/returns/ReturnDialog.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney, formatQty, remainingQty, returnAmounts, roundQty, splitRefund, type OrderDetail } from '@tiny-pos/shared';
import { useCreateReturn } from '@/api/returns';
import { CommitInput } from '@/components/CommitInput';
import { MoneyLine } from '@/components/MoneyLine';
import { usePrint } from '@/components/receipt/PrintProvider';
import { receiptFromReturn } from '@/components/receipt/receipt-data';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Pick {
  qty: number;
  restock: boolean;
}
const NONE: Pick = { qty: 0, restock: true };

/** Lập phiếu trả cho một hóa đơn: số lượng từng món (≤ phần còn lại), có nhập lại kho hay không; tiền hoàn tính sẵn như server. */
export function ReturnDialog({ order, open, onClose }: { order: OrderDetail; open: boolean; onClose: () => void }) {
  const [picks, setPicks] = useState<Record<number, Pick>>({});
  const [note, setNote] = useState('');
  const create = useCreateReturn();
  const print = usePrint();

  useEffect(() => {
    if (!open) return;
    setPicks({});
    setNote('');
  }, [open]);

  const setPick = (id: number, p: Partial<Pick>) => setPicks((s) => ({ ...s, [id]: { ...NONE, ...s[id], ...p } }));
  const amounts = useMemo(
    () => returnAmounts(order.items, order.discount, new Map(order.items.map((it) => [it.id, picks[it.id]?.qty ?? 0]))),
    [order, picks],
  );
  const refund = [...amounts.values()].reduce((s, a) => s + a, 0);
  const split = splitRefund(refund, order.paymentMethod, order.customerDebt);
  const chosen = order.items.filter((it) => (picks[it.id]?.qty ?? 0) > 0);

  const fillAll = () =>
    setPicks((s) => Object.fromEntries(order.items.map((it) => [it.id, { ...NONE, ...s[it.id], qty: remainingQty(it.qty, it.returnedQty) }])));

  const onSave = () =>
    create.mutate(
      { orderId: order.id, note, items: chosen.map((it) => ({ orderItemId: it.id, qty: picks[it.id]!.qty, restock: picks[it.id]!.restock })) },
      {
        onSuccess: (r) => {
          toast.success(`Đã lập ${r.code}`, { action: { label: 'In phiếu', onClick: () => void print(receiptFromReturn(r)) } });
          onClose();
        },
        onError: (e) => toast.error(e.message),
      },
    );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Trả hàng · {order.code}</DialogTitle>
          <DialogDescription className="text-base">Chọn số lượng khách trả. Bỏ chọn "Nhập lại kho" với hàng hỏng, hết hạn.</DialogDescription>
        </DialogHeader>
        <ul className="divide-y rounded-xl border">
          {order.items.map((it) => {
            const left = remainingQty(it.qty, it.returnedQty);
            const p = picks[it.id] ?? NONE;
            return (
              <li key={it.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{it.productName}</div>
                  <div className="text-sm text-muted-foreground tabular-nums">
                    Đã mua {formatQty(it.qty)} {it.unit}
                    {it.returnedQty > 0 && ` · đã trả ${formatQty(it.returnedQty)}`}
                  </div>
                </div>
                {left > 0 ? (
                  <>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-11"
                        aria-label={`Bớt ${it.productName}`}
                        disabled={p.qty <= 0}
                        onClick={() => setPick(it.id, { qty: Math.max(roundQty(p.qty - 1), 0) })}
                      >
                        <Minus />
                      </Button>
                      <CommitInput
                        value={p.qty}
                        onCommit={(n) => setPick(it.id, { qty: Math.min(roundQty(n), left) })}
                        className="h-11 w-20 text-right text-base"
                        aria-label={`Số lượng trả ${it.productName}`}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-11"
                        aria-label={`Thêm ${it.productName}`}
                        disabled={p.qty >= left}
                        onClick={() => setPick(it.id, { qty: Math.min(roundQty(p.qty + 1), left) })}
                      >
                        <Plus />
                      </Button>
                    </div>
                    {it.productId !== null && (
                      <Label className="flex items-center gap-2 text-sm">
                        <Checkbox checked={p.restock} onCheckedChange={(v) => setPick(it.id, { restock: v === true })} />
                        Nhập lại kho
                      </Label>
                    )}
                    <div className="w-24 text-right font-semibold tabular-nums">{formatMoney(amounts.get(it.id) ?? 0)}</div>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">Đã trả hết</span>
                )}
              </li>
            );
          })}
        </ul>
        <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Lý do trả (không bắt buộc)" className="h-11 text-base" />
        <div className="space-y-1">
          <MoneyLine label="Tổng hoàn" value={formatMoney(refund)} strong />
          {split.debtReduced > 0 && <MoneyLine label="Trừ nợ khách" value={formatMoney(split.debtReduced)} />}
          <MoneyLine label="Trả tiền mặt" value={formatMoney(split.cashRefund)} />
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-11 text-base" onClick={fillAll}>
            Trả hết
          </Button>
          <Button className="h-11 text-base" disabled={!chosen.length || create.isPending} onClick={onSave}>
            <Undo2 data-icon="inline-start" />
            Lập phiếu trả
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 6: Sửa `client/src/pages/orders/OrderDetailDialog.tsx`**

1. Thêm `import { useState } from 'react';` làm dòng đầu file. Dòng `import { Ban, Printer } from 'lucide-react';` → `import { Ban, Printer, Undo2 } from 'lucide-react';`. Dòng `import { formatMoney, formatQty } from '@tiny-pos/shared';` → `import { formatMoney, formatQty, remainingQty } from '@tiny-pos/shared';`.
2. Thêm sau dòng `import { useConfirm } from '@/components/ConfirmDialog';`: `import { MoneyLine as Line } from '@/components/MoneyLine';`. Thêm sau dòng `import { Dialog, … } from '@/components/ui/dialog';`:

```ts
import { cn } from '@/lib/utils';
import { ReturnDetailDialog } from '../returns/ReturnDetailDialog';
import { ReturnDialog } from '../returns/ReturnDialog';
```

3. Xóa hàm `function Line({ … }) { … }` (8 dòng) cùng dòng trống sau nó.
4. Sau dòng `  const print = usePrint();` thêm:

```ts
  const [returning, setReturning] = useState(false);
  const [returnId, setReturnId] = useState<number | null>(null);
  const hasReturns = !!o?.returns.some((r) => r.status === 'done');
  const canReturn = o?.status === 'done' && o.items.some((it) => remainingQty(it.qty, it.returnedQty) > 0);
```

5. Trong danh sách món, ngay sau `</div>` đóng dòng `{formatQty(it.qty)} {it.unit} × {formatMoney(it.price)}`, thêm:

```tsx
                    {it.returnedQty > 0 && (
                      <div className="text-sm text-warning tabular-nums">
                        Đã trả {formatQty(it.returnedQty)} {it.unit}
                      </div>
                    )}
```

6. Ngay sau `</div>` đóng khối `<div className="space-y-1">` (các dòng tiền), trước `</div>` của `space-y-4`, thêm:

```tsx
            {o.returns.length > 0 && (
              <div className="space-y-1">
                <div className="text-sm font-semibold">Phiếu trả</div>
                <ul className="divide-y rounded-xl border">
                  {o.returns.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-muted/40"
                        onClick={() => setReturnId(r.id)}
                      >
                        <span className={cn('font-mono', r.status === 'cancelled' && 'text-muted-foreground line-through')}>{r.code}</span>
                        <span className="text-sm text-muted-foreground">{new Date(r.createdAt).toLocaleString('vi-VN')}</span>
                        {r.status === 'cancelled' ? (
                          <Badge variant="secondary">Đã hủy</Badge>
                        ) : (
                          <span className="font-semibold tabular-nums">{formatMoney(r.refund)}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
```

7. Ngay trước `<DialogFooter>` thêm:

```tsx
        {o?.status === 'done' && hasReturns && <p className="text-sm text-muted-foreground">Hủy các phiếu trả trước khi hủy hóa đơn.</p>}
```

8. Nút *Hủy đơn*: `disabled={cancel.isPending}` → `disabled={cancel.isPending || hasReturns}`. Ngay trước nút *In lại* thêm:

```tsx
          {canReturn && (
            <Button variant="outline" className="h-11 text-base" onClick={() => setReturning(true)}>
              <Undo2 data-icon="inline-start" />
              Trả hàng
            </Button>
          )}
```

9. Ngay trước `</DialogContent>` thêm (hộp con lồng trong hộp hóa đơn, như `CustomerDetailDialog` lồng `OrderDetailDialog`; không phải bọc fragment và thụt lề lại):

```tsx
        {o && <ReturnDialog order={o} open={returning} onClose={() => setReturning(false)} />}
        <ReturnDetailDialog id={returnId} onClose={() => setReturnId(null)} />
```

- [ ] **Step 7: Typecheck và build client**

Run: `npm run typecheck && npm run build -w client`
Expected: không lỗi. (Kiểm trên trình duyệt làm ở Task 7, sau khi có trang `/returns`.)

---

### Task 6: Client – trang Trả hàng, menu, số thuần ở Hóa đơn và Báo cáo

**Files:**
- Create: `client/src/pages/returns/ReturnTable.tsx`, `client/src/pages/returns/ReturnsPage.tsx`
- Modify: `client/src/pages/orders/OrderTable.tsx`, `client/src/pages/orders/OrdersPage.tsx`, `client/src/pages/reports/ProfitTab.tsx`, `client/src/pages/reports/DebtTab.tsx`, `client/src/router.tsx`

**Interfaces:**
- Consumes: `useReturns`, `ReturnDetailDialog` (Task 5), `OrderDetailDialog`, `returnListFields` (Task 1), `DaySummary.returns`, `ProfitRow.returns`, `DebtReport.period.returnDebt`, `OrderSummary.refunded`.
- Produces: route `/returns`, mục menu *Trả hàng*; `time`, `dayTime` export từ `OrderTable.tsx`.

- [ ] **Step 1: `OrderTable.tsx`**: đổi `const time = (iso: string) =>` thành `export const time = (iso: string) =>` và `const dayTime = (iso: string) => {` thành `export const dayTime = (iso: string) => {`. Ô trạng thái: dòng

```tsx
              <TableCell className="px-4 py-3">{cancelled ? <Badge variant="secondary">Đã hủy</Badge> : <Badge>Hoàn tất</Badge>}</TableCell>
```

đổi thành

```tsx
              <TableCell className="px-4 py-3">
                {cancelled ? <Badge variant="secondary">Đã hủy</Badge> : <Badge>Hoàn tất</Badge>}
                {o.refunded > 0 && <Badge variant="outline" className="ml-1">Có trả hàng</Badge>}
              </TableCell>
```

- [ ] **Step 2: Tạo `client/src/pages/returns/ReturnTable.tsx`**

```tsx
import { formatMoney, type ReturnSummaryRow } from '@tiny-pos/shared';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { dayTime, time } from '../orders/OrderTable';

/** Bảng phiếu trả; xem nhiều ngày thì cột thời gian ghi cả ngày. Bấm vào hàng để xem chi tiết. */
export function ReturnTable({ rows, onOpen, showDate = false }: { rows: ReturnSummaryRow[]; onOpen: (id: number) => void; showDate?: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <TableHead className="px-4">Mã</TableHead>
          <TableHead className="px-4">{showDate ? 'Thời gian' : 'Giờ'}</TableHead>
          <TableHead className="px-4">Hóa đơn</TableHead>
          <TableHead className="px-4 text-right">Số món</TableHead>
          <TableHead className="px-4 text-right">Tổng hoàn</TableHead>
          <TableHead className="px-4">Trạng thái</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const cancelled = r.status === 'cancelled';
          return (
            <TableRow key={r.id} className={cn('cursor-pointer', cancelled && 'text-muted-foreground')} onClick={() => onOpen(r.id)}>
              <TableCell className={cn('px-4 py-3 font-mono', cancelled && 'line-through')}>{r.code}</TableCell>
              <TableCell className="px-4 py-3 tabular-nums">{showDate ? dayTime(r.createdAt) : time(r.createdAt)}</TableCell>
              <TableCell className="px-4 py-3 font-mono">{r.orderCode}</TableCell>
              <TableCell className="px-4 py-3 text-right tabular-nums">{r.itemCount}</TableCell>
              <TableCell className={cn('px-4 py-3 text-right font-semibold tabular-nums', cancelled && 'line-through')}>{formatMoney(r.refund)}</TableCell>
              <TableCell className="px-4 py-3">{cancelled ? <Badge variant="secondary">Đã hủy</Badge> : <Badge>Hoàn tất</Badge>}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 3: Tạo `client/src/pages/returns/ReturnsPage.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Undo2 } from 'lucide-react';
import { DOC_STATUSES, formatMoney, resolveRange, returnListFields, validRange, type DocStatus } from '@tiny-pos/shared';
import { useReturns } from '@/api/returns';
import { EmptyState } from '@/components/EmptyState';
import { MultiChoiceChips } from '@/components/filters/ChoiceChips';
import { DateRangeFilter, rangeChipLabel } from '@/components/filters/DateRangeFilter';
import { FilterBar, FilterGroup, type FilterChip } from '@/components/filters/FilterBar';
import { PageTitle } from '@/components/layout/PageTitle';
import { ListPanel } from '@/components/ListPanel';
import { Pager } from '@/components/Pager';
import { Stat, StatStrip } from '@/components/StatStrip';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Button } from '@/components/ui/button';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useExportAction } from '@/hooks/useExportAction';
import { today as todayOf } from '@/lib/today';
import { OrderDetailDialog } from '../orders/OrderDetailDialog';
import { ReturnDetailDialog } from './ReturnDetailDialog';
import { ReturnTable } from './ReturnTable';

const STATUS_LABEL: Record<DocStatus, string> = { done: 'Hoàn tất', cancelled: 'Đã hủy' };
const STATUS_OPTIONS = DOC_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }));

export function ReturnsPage() {
  const [openId, setOpenId] = useState<number | null>(null);
  const [orderId, setOrderId] = useState<number | null>(null);
  const { filters: f, set, clear } = useUrlFilters(returnListFields);
  const exportAction = useExportAction('/returns/export.xlsx');
  const today = todayOf();
  const picked = resolveRange(f, today);
  // Khoảng sai trên URL (sửa tay) thì về hôm nay, không báo lỗi
  const range = validRange(picked.from, picked.to) ? picked : { from: today, to: today };
  const isToday = range.from === today && range.to === today;
  const { data, isLoading } = useReturns({ ...range, q: f.q, status: f.status, page: f.page });
  const s = data?.summary;

  // Lọc hẹp lại làm trang hiện tại vượt số trang → về trang cuối có dữ liệu
  useEffect(() => {
    if (data && data.page > 1 && !data.returns.length && data.total > 0) set({ page: Math.ceil(data.total / data.pageSize) });
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const status = f.status ?? [];
  const chips: FilterChip[] = [
    { key: 'range', label: rangeChipLabel(range.from, range.to, today), onRemove: isToday ? undefined : () => set({ from: undefined, to: undefined, date: undefined }) },
    ...status.map((st) => ({ key: `st-${st}`, label: STATUS_LABEL[st], onRemove: () => set({ status: status.filter((x) => x !== st) }) })),
  ];
  const activeCount = (isToday ? 0 : 1) + (status.length ? 1 : 0);
  const filtered = activeCount > 0 || !!f.q;

  return (
    <>
      <PageTitle title="Trả hàng" count={data ? `${data.total} phiếu` : undefined} actions={[exportAction]} />
      <StatStrip cols={4}>
        <Stat label="Số phiếu" value={String(s?.count ?? 0)} hint="Không tính phiếu đã hủy" />
        <Stat label="Tổng hoàn" value={formatMoney(s?.refund ?? 0)} />
        <Stat label="Hoàn tiền mặt" value={formatMoney(s?.cash ?? 0)} hint="Tiền chi ra từ két" />
        <Stat label="Trừ nợ" value={formatMoney(s?.debt ?? 0)} hint="Trừ vào nợ khách" />
      </StatStrip>
      <ListPanel
        toolbar={
          <FilterBar
            search={{ value: f.q ?? '', onChange: (q) => set({ q }), placeholder: 'Mã phiếu, mã hóa đơn hoặc tên hàng…' }}
            activeCount={activeCount}
            chips={chips}
            onClearAll={clear}
            resultLabel={`Xem ${data?.total ?? 0} phiếu`}
          >
            <FilterGroup label="Thời gian">
              <DateRangeFilter
                from={range.from}
                to={range.to}
                today={today}
                // Hôm nay không ghi ngày vào URL: máy quầy để qua đêm thì sáng hôm sau vẫn là hôm nay
                onChange={(r) => set(r.from === today && r.to === today ? { from: undefined, to: undefined, date: undefined } : { ...r, date: undefined })}
              />
            </FilterGroup>
            <FilterGroup label="Trạng thái">
              <MultiChoiceChips<DocStatus> label="Trạng thái" options={STATUS_OPTIONS} value={status} onChange={(v) => set({ status: v })} />
            </FilterGroup>
          </FilterBar>
        }
        footer={data && data.total > 0 && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={(page) => set({ page })} noun="phiếu" />}
      >
        {isLoading ? (
          <TableSkeleton />
        ) : data?.returns.length ? (
          <ReturnTable rows={data.returns} onOpen={setOpenId} showDate={range.from !== range.to} />
        ) : filtered ? (
          <EmptyState
            icon={Undo2}
            title="Không có phiếu trả khớp bộ lọc"
            description="Thử bỏ bớt lọc hoặc đổi khoảng thời gian."
            action={
              <Button variant="outline" onClick={clear}>
                Xóa lọc
              </Button>
            }
          />
        ) : (
          <EmptyState icon={Undo2} title="Chưa có phiếu trả" description="Khách trả hàng: mở hóa đơn ở trang Hóa đơn rồi bấm Trả hàng." />
        )}
      </ListPanel>
      <ReturnDetailDialog
        id={openId}
        onClose={() => setOpenId(null)}
        onOpenOrder={(id) => {
          setOpenId(null);
          setOrderId(id);
        }}
      />
      <OrderDetailDialog id={orderId} onClose={() => setOrderId(null)} />
    </>
  );
}
```

- [ ] **Step 4: `client/src/router.tsx`**: dòng import lucide thêm `Undo2` sau `Truck,` (giữ nguyên các tên khác); thêm `import { ReturnsPage } from './pages/returns/ReturnsPage';` sau dòng `import { ReportsPage } from './pages/reports/ReportsPage';`; trong `NAV` thêm sau dòng `/orders`:

```ts
  { to: '/returns', label: 'Trả hàng', icon: Undo2, group: 'sell' },
```

   trong `AppRoutes` thêm sau dòng route `/orders`:

```tsx
      <Route path="/returns" element={<ReturnsPage />} />
```

- [ ] **Step 5: `client/src/pages/orders/OrdersPage.tsx`**: sau dòng `const collected = (s?.debtCollected.cash ?? 0) + (s?.debtCollected.transfer ?? 0);` thêm:

```ts
  // Phiếu trả trong khoảng: Doanh thu và Tiền mặt hiện số thuần để khớp két (Báo cáo dùng cùng công thức)
  const ret = s?.returns ?? { count: 0, refund: 0, cash: 0, debt: 0 };
```

   hai dòng `Stat` *Doanh thu* và *Tiền mặt* đổi thành:

```tsx
        <Stat
          label="Doanh thu"
          value={formatMoney((s?.total ?? 0) - ret.refund)}
          hint={ret.count ? `Bán ${formatMoney(s?.total ?? 0)} · Trả ${formatMoney(ret.refund)}` : undefined}
        />
        <Stat
          label="Tiền mặt"
          value={formatMoney((s?.cash ?? 0) - ret.cash)}
          hint={ret.count ? `Đã trừ hoàn ${formatMoney(ret.cash)}` : undefined}
        />
```

- [ ] **Step 6: `client/src/pages/reports/ProfitTab.tsx`**
  - Comment `// Điện thoại chỉ đủ chỗ 4 cột: ẩn Giá vốn và ba cột hình thức (đều đã có ở StatStrip)` → `// Điện thoại chỉ đủ chỗ 4 cột: ẩn Giá vốn, Trả hàng và ba cột hình thức (đều đã có ở StatStrip)`.
  - Trong `Row`, sau ô *Doanh thu* (`{formatMoney(r.revenue)}`) thêm: ``<TableCell className={`${MONEY} ${MOBILE_HIDDEN} ${cls}`}>{formatMoney(r.returns)}</TableCell>``.
  - Header: sau ``<TableHead className={`${HEAD} text-right`}>Doanh thu</TableHead>`` thêm ``<TableHead className={`${HEAD} text-right ${MOBILE_HIDDEN}`}>Trả hàng</TableHead>``.
  - Stat *Doanh thu* hint `"Đơn hoàn tất, đã trừ giảm giá"` → `"Đơn hoàn tất, đã trừ giảm giá và trả hàng"`; Stat *Giá vốn* hint `"Giá vốn lúc bán"` → `"Giá vốn lúc bán, trừ hàng trả nhập lại kho"`.
  - Điều kiện trống `data.total.orders === 0 ?` → `data.total.orders === 0 && data.total.returns === 0 ?`.

- [ ] **Step 7: `client/src/pages/reports/DebtTab.tsx`**: Stat *Ghi nợ trong kỳ* `hint="Phần khách còn thiếu trên hóa đơn"` đổi thành:

```tsx
hint={p?.returnDebt ? `Phần khách còn thiếu · trả hàng trừ ${formatMoney(p.returnDebt)}` : 'Phần khách còn thiếu trên hóa đơn'}
```

- [ ] **Step 8: Typecheck và build**

Run: `npm run typecheck && npm run build -w client`
Expected: không lỗi.

---

### Task 7: Kiểm tra trên trình duyệt, tài liệu, phiên bản, commit

**Files:**
- Modify: `package.json` (`"version": "0.11.0"`), `README.md`, `CLAUDE.md`, `.claude/rules/database.md`

- [ ] **Step 1: Kiểm tra tự động toàn bộ**

Run: `npm run typecheck && npm test && npm run build`
Expected: không lỗi; ghi lại số test qua.

- [ ] **Step 2: Kiểm trên trình duyệt bằng skill `browser-verify`** (chặn mọi POST, stub GET khi cần dữ liệu). Server dev khởi động lại sẽ chạy migration `0004` trên DB dev (chỉ tạo bảng rỗng). Kiểm và báo lại thứ đã quan sát:
  1. `/orders`: mở một hóa đơn có sẵn → nút *Trả hàng* hiện; bấm → hộp *Trả hàng · HD-…*; bấm `+` hai lần trên một dòng (không vượt số đã mua), bỏ *Nhập lại kho* → *Tổng hoàn* đổi; *Trả hết* điền đủ; bấm *Lập phiếu trả* → body POST `/api/returns` bị chặn có đúng `orderId`, `items[].qty`, `restock: false`, `note`.
  2. Stub `GET /api/orders/:id` trả một đơn ghi nợ có `customerDebt: 3000`, `discount > 0`, `items[0].returnedQty: 1`, `returns: [{… status: 'done'}]` → dòng "Đã trả 1 …" màu cảnh báo; khối *Phiếu trả*; nút *Hủy đơn* bị khóa và dòng "Hủy các phiếu trả trước khi hủy hóa đơn."; trong hộp trả hàng chọn 1 món → "Trừ nợ khách 3.000", "Trả tiền mặt" là phần dư.
  3. `/returns`: menu *Trả hàng* ngay dưới *Hóa đơn*; stub `GET /api/returns` một phiếu `done` và một `cancelled` → bảng, StatStrip; bấm dòng → chi tiết; bấm mã hóa đơn → mở hộp hóa đơn; *In phiếu* gọi `window.print` (stub) và `#print-root` có "PHIẾU TRẢ HÀNG"; *Hủy phiếu* → hộp xác nhận → POST `/cancel` bị chặn.
  4. `/orders` với stub `summary.returns.count > 0` → *Doanh thu* / *Tiền mặt* là số thuần, hint "Bán … · Trả …"; `/reports` có cột *Trả hàng* (máy tính), không có ở 390px.
  5. Điện thoại 390×844: hộp trả hàng không cuộn ngang (`scrollWidth ≤ 390`), nút `+`/`−` cao ≥ 44px; không có `CONSOLE ERROR` / `PAGE ERROR`.

- [ ] **Step 3: Tài liệu và phiên bản**
  - `package.json` gốc: `"version": "0.10.0"` → `"version": "0.11.0"`.
  - `README.md`: thêm sau dòng *Trang Tổng quan* trong mục *Chạy thật*:
    `- Khách trả hàng: *Hóa đơn* → bấm vào đơn → *Trả hàng*; danh sách phiếu ở *Trả hàng* (menu Bán hàng). Phiếu tính vào ngày trả, hủy được.`
    và thêm cuối file:

```markdown

## Kiểm thử thủ công – Trả hàng 0.11.0

1. *Hóa đơn* → mở đơn tiền mặt có giảm giá → *Trả hàng* → trả 1 món, giữ *Nhập lại kho* → toast "Đã lập TH-…", bấm *In phiếu* ra "PHIẾU TRẢ HÀNG"; tồn sản phẩm tăng đúng (thùng tăng 24 lon); chi tiết đơn có "Đã trả …" và khối *Phiếu trả*.
2. Trả tiếp đến hết đơn (có dòng bỏ *Nhập lại kho*) → tổng các phiếu bằng đúng *Phải trả* của đơn; món bỏ nhập kho không cộng tồn; nút *Trả hàng* biến mất.
3. Đơn ghi nợ: khách còn nợ ít hơn tiền hoàn → hộp hiện "Trừ nợ khách" bằng số nợ, phần dư "Trả tiền mặt"; sổ nợ của khách có dòng *Trả hàng*.
4. Đơn còn phiếu trả: nút *Hủy đơn* bị khóa. *Trả hàng* → mở phiếu → *Hủy phiếu* → tồn và nợ về như trước, sổ nợ có *Hủy phiếu trả*; lúc này hủy được hóa đơn.
5. Trả hàng hôm nay cho đơn hôm qua: *Hóa đơn* hôm nay *Doanh thu*/*Tiền mặt* đã trừ, hint "Bán … · Trả …"; *Báo cáo* hôm qua không đổi, hôm nay có cột *Trả hàng*; *Tổng quan* hôm nay khớp *Hóa đơn*.
6. *Trả hàng*: lọc ngày / trạng thái / tìm "tui da" ra phiếu có Túi đá; *Xuất Excel* ra 2 sheet *Phiếu trả*, *Chi tiết*.
```

  - `CLAUDE.md`:
    - Cuối đoạn *Đã xong*: `gốc vẫn vào Bán hàng).` → `gốc vẫn vào Bán hàng), Trả hàng 0.11.0 (phiếu \`TH\` gắn hóa đơn \`done\`, \`services/returns.ts\` + \`return-rows.ts\`, tiền hoàn theo giá trị sau giảm giá ở \`shared/return-math.ts\`, đơn ghi nợ trừ nợ trước rồi trả tiền mặt, trang \`/returns\`).`
    - Bất biến *Mã chứng từ*: `` `KK-YYYYMMDD-NN` (kiểm kê). `` → `` `KK-YYYYMMDD-NN` (kiểm kê), `TH-YYYYMMDD-NNNN` (phiếu trả). ``
    - Thêm bất biến ngay sau dòng *Chứng từ không sửa, chỉ hủy*: `- **Trả hàng** chỉ qua \`services/returns.ts\`: gắn hóa đơn \`done\`, mỗi dòng ≤ số đã mua − số đã trả; tính vào ngày lập phiếu; hóa đơn còn phiếu trả chưa hủy thì không hủy được.`
    - Bất biến *Báo cáo chỉ đọc*: sau `tính từ hóa đơn \`done\` và snapshot \`cost_price\` trên dòng hóa đơn (không nhân \`factor\`)` thêm `, trừ phiếu trả \`done\` theo ngày lập phiếu (giá vốn chỉ trừ phần nhập lại kho)`.
    - *Migration*: `DB dev đã chạy tới \`0003\`` → `DB dev đã chạy tới \`0004\``.
  - `.claude/rules/database.md`: `(\`0000\`–\`0003\`)` → `(\`0000\`–\`0004\`)`; `tiếp theo là \`0004\`` → `tiếp theo là \`0005\``.

- [ ] **Step 4: Soát diff (skill `check`)**

Run: `git status --short && git diff --stat`
Expected: file có sẵn chỉ đổi đúng các dòng trong kế hoạch; không file cũ nào có số dòng đổi lớn bất thường (`orders.ts`, `reports.ts`, `OrderDetailDialog.tsx` vài chục dòng là hợp lý). Hunk nào chỉ là format thì hoàn tác.

- [ ] **Step 5: Commit một lần**

```bash
git add -A
git commit -m "feat: trả hàng 0.11.0 – phiếu trả theo hóa đơn, hoàn tiền/trừ nợ, nhập lại kho, báo cáo số thuần

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Trước `git add -A`, xem lại `git status` để chắc không có file tạm (ảnh chụp, script playwright nằm ở scratchpad, không trong repo).
