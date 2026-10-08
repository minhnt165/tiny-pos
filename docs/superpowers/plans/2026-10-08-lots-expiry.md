# Lô hàng, giá vốn FIFO và hạn sử dụng (0.17.0) – Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mỗi dòng phiếu nhập là một lô (số còn, giá vốn, hạn dùng); bán hàng tự trừ lô hết hạn sớm nhất trước và chụp giá vốn thật của lô vào dòng hóa đơn; Tổng quan cảnh báo lô sắp hết hạn; trang Lô hàng xem và bỏ hàng hết hạn.

**Architecture:** Hai bảng mới `lots` và `lot_movements` (migration `0008`, kèm tạo lô "Tồn đầu" cho tồn hiện có). Chỉ `recordMovement` (`services/stock.ts`) biết lô: mỗi movement được tách thành các dòng `lot_movements` bằng hàm thuần trong `shared/lot-math.ts` (FEFO khi xuất, bù lô âm khi nhập, đảo đúng lô khi hủy). Bất biến mới: Σ `lots.remaining` = `products.stock`. Các service nghiệp vụ chỉ truyền thêm `newLot` / `lotId` / `reverseOf`; `createOrder` lấy giá vốn dòng từ kết quả phân bổ. `services/lots.ts` phục vụ trang Lô hàng, chi tiết lô của sản phẩm, thẻ Sắp hết hạn trên Tổng quan và nút Bỏ hàng.

**Tech Stack:** TypeScript ESM, Express 5, drizzle-orm + drizzle-kit + better-sqlite3, vitest, zod 4; React 19 + TanStack Query 5 + react-router 7 + shadcn/ui (có sẵn `select`, `popover`, `calendar`, `alert-dialog`, `badge`) + lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-08-tiny-pos-lots-expiry-design.md`

## Global Constraints

- Text UI, thông báo lỗi API, comment code, commit message: **tiếng Việt**.
- **Không format lại file có sẵn**: diff chỉ chứa dòng cần đổi; không chạy prettier/eslint lên file cũ; theo phong cách xung quanh (2 space, nháy đơn, có `;`, dòng ≤ ~130 ký tự). Thêm tên vào dòng import có sẵn được, không sắp xếp lại import.
- **Git**: làm trên `master`. Các task **không commit riêng**; cả đợt 0.17.0 là **một commit** ở Task 9: `feat: lô hàng 0.17.0 – mỗi dòng nhập một lô, bán trừ lô hết hạn sớm trước, giá vốn theo lô, hạn sử dụng và trang Lô hàng`.
- **Bất biến**: mọi thay đổi tồn qua `recordMovement`; sau mỗi movement, với mỗi sản phẩm Σ `lots.remaining` = `products.stock` (sai số ≤ 1e-6). Không `update lots set remaining` ngoài `stock.ts`.
- Thứ tự FEFO: `expires_on` tăng dần, `null` cuối, cùng hạn thì `id` nhỏ trước. Xuất thiếu thì trừ âm vào **lô cuối** theo thứ tự đó; sản phẩm chưa có lô thì tạo lô "Tồn đầu" (`qty_in = 0`, `cost_price = products.cost_price`). Cộng vào bù lô âm về 0 theo FEFO trước, dư mới vào đích (lô mới khi nhập; lô `id` lớn nhất khi khác).
- Giá vốn dòng hóa đơn = `lineCostPrice(alloc, qty × factor, factor)` = `round(round(Σ |qty_i| × cost_i / qtyBase) × factor)`, không âm; món ngoài giữ 0. `products.cost_price` vẫn = giá nhập gần nhất.
- Hạn dùng: cột `expires_on` dạng `YYYY-MM-DD`, null = không hạn, không chặn ngày quá khứ. Ngưỡng cảnh báo `settings.expiryWarnDays` mặc định 30 (1–365).
- Thông báo lỗi nguyên văn: `'Lô không thuộc sản phẩm này'` (400), `'Lô đã hết hàng'` (409), `'Không tìm thấy lô'` (404).
- Migration: **không sửa** `0000`–`0007`; migration mới `0008` sinh bằng `npm run db:generate` rồi **thêm** câu `INSERT` tạo lô tồn đầu vào cuối file SQL; snapshot `meta/` giữ như drizzle sinh. Có test migration.
- Khôi phục bản sao: `copyTables` chép `lots`, `lot_movements` như bảng thường; sau khi chép gọi `seedOpeningLots` cho sản phẩm có tồn mà chưa có lô.
- Không đụng `remote/` ngoài việc nó vẫn compile (`Overview` thêm trường `expiring`), không đụng `label-window.ts`, `PosShell`, service worker, `exports.ts`.
- UI dùng component có sẵn (`PageTitle`, `ListPanel`, `StatStrip`/`Stat`, `FilterBar`/`FilterGroup`, `MultiChoiceChips`, `Pager`, `EmptyState`, `TableSkeleton`, `ProductAvatar`, `Badge`, `Button`, `Select*`, `Popover`, `Calendar`, `useConfirm`, `TextField`), icon lucide, màu từ token (`text-warning`, `text-destructive`, `text-muted-foreground`). Không viết mã màu.
- Mạng công ty chặn TLS: `npx shadcn`/`npm install` cần `NODE_EXTRA_CA_CERTS=<repo>/.certs/corp-root.pem`; **không bao giờ** tắt kiểm tra TLS. Task này không cần cài gói mới.
- Không dùng/kill cổng 5173/5174. Kiểm trên trình duyệt **không ghi** vào `data/grocery.db`: chạy server build với `DB_FILE` tạm trong scratchpad, cổng riêng (3099).
- Chạy test/typecheck từ **gốc repo** (`npm test`, `npm run typecheck`) để `shared` được build trước. Một file server: `npm run build -w shared` rồi `cd server && npx vitest run <file>`. Một file shared: `cd shared && npx vitest run <file>`.

## Review Focus

Những tình huống spec ngụ ý nhưng dễ vỡ; mỗi dòng đã được gắn test vào task sở hữu:

1. **Hàng cân bán gối hai lô** (0,3 kg khi lô A còn 0,1): số làm tròn 3 chữ số, Σ lô = tồn không lệch vì sai số nhị phân → Task 1 (`allocateOut` số thực) và Task 3 (bất biến với số lẻ).
2. **Nhập hàng khi nhiều lô đang âm**: bù theo FEFO rồi mới vào lô mới; lô mới có thể nhận 0 → Task 1 (`allocateIn` nhiều lô âm) và Task 4 (test nhập sau khi bán âm).
3. **Hủy hóa đơn sau khi lô đã bị bỏ hàng** (`remaining = 0`): cộng lại đúng lô đó, lô dương trở lại, không rơi vào lô khác → Task 4 (orders).
4. **Chứng từ lập trước 0.17.0** (movement không có `lot_movements`): hủy không lỗi, dùng luật tự động → Task 3 (`reverseOf` movement rỗng).
5. **Cài đặt lưu trong DB là chuỗi** (`"30"`): `getSettings` không được rơi về mặc định toàn bộ → Task 1 (schema `coerce`) và Task 5 (test settings đọc lại).
6. **Khôi phục bản sao trước 0.17.0**: bảng `lots` rỗng sau khi chép → tạo lô tồn đầu, Σ lô = tồn → Task 5 (backups).

## Cấu trúc file

**Tạo mới**

| File | Trách nhiệm |
|---|---|
| `shared/src/lot-math.ts` (+`.test.ts`) | Hàm thuần: `sortFefo`, `allocateOut`, `allocateIn`, `lineCostPrice`, `daysLeft`, `lotState` |
| `shared/src/schemas/lot.ts` | `LOT_STATES`, `lotDisposeSchema` |
| `server/drizzle/0008_*.sql` | Bảng `lots`, `lot_movements`, cột mới, `INSERT` lô tồn đầu |
| `server/src/db/opening-lots.ts` | `seedOpeningLots(sqlite)` dùng khi khôi phục bản sao (cùng câu SQL với migration) |
| `server/src/db/migration-0008.test.ts` | Migration chạy trên DB 0007 có dữ liệu |
| `server/src/services/stock.test.ts` | `recordMovement` với lô, bất biến, `reverseOf` |
| `server/src/services/lots.ts` (+`.test.ts`) | `listLots`, `productLots`, `expiringOverview`, `disposeLot`, `getLot` |
| `server/src/routes/lots.ts` | `GET /api/lots`, `POST /api/lots/:id/dispose` |
| `client/src/api/lots.ts` | `useLots`, `useProductLots`, `useDisposeLot` |
| `client/src/components/OptionalDateField.tsx` | Ô ngày cho phép trống (hạn dùng) |
| `client/src/pages/lots/LotsPage.tsx`, `LotTable.tsx`, `lot-labels.ts` | Trang Lô hàng |
| `client/src/pages/supplier-returns/LotSelect.tsx` | Ô chọn lô trên dòng trả NCC |
| `client/src/pages/overview/ExpiringList.tsx` | Thẻ Sắp hết hạn |

**Sửa**

| File | Thay đổi |
|---|---|
| `shared/src/types.ts` | `LotState`, `LotRow`, `LotList`, `ProductLot`; `ImportItem.expiresOn`; `SupplierReturnItem.lotId/lotExpiresOn`; `Overview.expiring` |
| `shared/src/schemas/import.ts`, `supplier-return.ts`, `settings.ts`, `common.ts`, `list-filters.ts`, `index.ts` | `expiresOn`, `lotId`, `expiryWarnDays`, nhãn, `lotListQuerySchema`, export |
| `shared/src/import-draft.ts`, `supplier-return-draft.ts` | `expiresOn` / `lotId` trên dòng nháp |
| `server/src/db/schema.ts` | Bảng và cột mới |
| `server/src/services/stock.ts` | Phân bổ lô trong `recordMovement` |
| `server/src/services/imports.ts`, `orders.ts`, `returns.ts`, `supplier-returns.ts`, `reports.ts`, `overview.ts`, `settings.ts`, `backups.ts` | Dùng lô |
| `server/src/routes/index.ts`, `products.ts` | Route lô |
| `client/src/pages/imports/ImportLineRow.tsx`, `ImportLinesTable.tsx`, `ImportDetailDialog.tsx` | Cột Hạn dùng |
| `client/src/pages/supplier-returns/SupplierReturnLinesTable.tsx`, `SupplierReturnDetailDialog.tsx` | Chọn lô, hiện hạn |
| `client/src/router.tsx`, `pages/products/ProductTable.tsx`, `pages/overview/OverviewPage.tsx`, `AlertsCard.tsx`, `pages/settings/SettingsPage.tsx` | Menu, route, thẻ, cảnh báo, ô ngưỡng |
| `package.json`, `README.md`, `CLAUDE.md`, `.claude/rules/database.md` | 0.17.0, tài liệu |

Spec có hai điểm điều chỉnh khi lên kế hoạch (đã ghi vào spec): không có trang chi tiết sản phẩm nên thẻ *Lô hàng* của sản phẩm là mục menu **Lô hàng** trên dòng sản phẩm mở `/lots?productId=…`; hộp xác nhận Bỏ hàng dùng `useConfirm` sẵn có, không có ô ghi chú (API vẫn nhận `note`).

---

### Task 1: `shared` – hàm thuần lô, kiểu, schema, nháp

**Files:**
- Create: `shared/src/lot-math.ts`, `shared/src/lot-math.test.ts`, `shared/src/schemas/lot.ts`
- Modify: `shared/src/types.ts`, `shared/src/schemas/import.ts`, `shared/src/schemas/supplier-return.ts`, `shared/src/schemas/settings.ts`, `shared/src/schemas/common.ts`, `shared/src/schemas/list-filters.ts`, `shared/src/index.ts`, `shared/src/import-draft.ts`, `shared/src/supplier-return-draft.ts`
- Test: `shared/src/lot-math.test.ts`, `shared/src/schemas/inventory.test.ts`, `shared/src/schemas/order.test.ts`, `shared/src/schemas/list-filters.test.ts`

**Interfaces:**
- Produces: `LotBalance`, `LotDelta`, `sortFefo`, `allocateOut(lots, qty): LotDelta[]` (qty dương, trả về delta **âm**), `allocateIn(lots, qty, targetId): LotDelta[]` (delta dương), `lineCostPrice(alloc, qtyBase, factor)`, `daysLeft(expiresOn, today)`, `lotState(lot, today, warnDays)`; kiểu `LotState`, `LotRow`, `LotList`, `ProductLot`; `LOT_STATES`, `lotDisposeSchema`, `lotListFields`, `lotListQuerySchema`, `LotListQuery`; `importItemInputSchema.expiresOn`, `supplierReturnItemInputSchema.lotId`, `settingsInputSchema.expiryWarnDays`; `DraftLine.expiresOn`, `SupplierReturnLine.lotId`, action `{ type: 'setLot'; key; lotId }`.

- [ ] **Step 1: Viết test `lot-math` (đỏ)**

```ts
// shared/src/lot-math.test.ts
import { describe, expect, it } from 'vitest';
import { allocateIn, allocateOut, daysLeft, lineCostPrice, lotState, sortFefo, type LotBalance } from './lot-math.js';

const lot = (id: number, remaining: number, expiresOn: string | null = null, costPrice = 1000): LotBalance => ({ id, remaining, costPrice, expiresOn });

describe('sortFefo', () => {
  it('hạn gần trước, không hạn cuối, cùng hạn theo id', () => {
    const lots = [lot(3, 1, null), lot(2, 1, '2026-12-01'), lot(5, 1, '2026-10-20'), lot(4, 1, '2026-10-20')];
    expect(sortFefo(lots).map((l) => l.id)).toEqual([4, 5, 2, 3]);
  });
});

describe('allocateOut', () => {
  it('đủ hàng: trừ lô hạn gần trước, gối sang lô sau; bỏ qua lô 0/âm khi còn lô dương', () => {
    const lots = [lot(1, 0, '2026-10-01'), lot(2, 3, '2026-10-20'), lot(3, 10, null), lot(4, -2, '2026-11-01')];
    expect(allocateOut(lots, 5)).toEqual([
      { lotId: 2, qty: -3 },
      { lotId: 3, qty: -2 },
    ]);
  });
  it('thiếu hàng: phần thiếu trừ âm vào lô cuối theo FEFO (lô không hạn)', () => {
    expect(allocateOut([lot(1, 2, '2026-10-20'), lot(2, 1, null)], 5)).toEqual([
      { lotId: 1, qty: -2 },
      { lotId: 2, qty: -3 },
    ]);
  });
  it('mọi lô đều hết: trừ hết vào lô cuối', () => {
    expect(allocateOut([lot(1, 0, '2026-10-20'), lot(2, -1, null)], 4)).toEqual([{ lotId: 2, qty: -4 }]);
  });
  it('danh sách rỗng → []', () => {
    expect(allocateOut([], 3)).toEqual([]);
  });
  it('hàng cân: 0,3 kg khi lô A còn 0,1 → 0,1 + 0,2, không rác nhị phân', () => {
    expect(allocateOut([lot(1, 0.1, '2026-10-20'), lot(2, 5, null)], 0.3)).toEqual([
      { lotId: 1, qty: -0.1 },
      { lotId: 2, qty: -0.2 },
    ]);
  });
});

describe('allocateIn', () => {
  it('không lô âm → toàn bộ vào đích', () => {
    expect(allocateIn([lot(1, 2), lot(2, 0)], 10, 2)).toEqual([{ lotId: 2, qty: 10 }]);
  });
  it('bù lô âm theo FEFO về 0 rồi dư vào đích', () => {
    const lots = [lot(1, -3, '2026-10-20'), lot(2, -1, null), lot(3, 0, '2026-12-01')];
    expect(allocateIn(lots, 10, 3)).toEqual([
      { lotId: 1, qty: 3 },
      { lotId: 2, qty: 1 },
      { lotId: 3, qty: 6 },
    ]);
  });
  it('cộng ít hơn tổng âm → đích nhận 0 (không có dòng cho đích)', () => {
    expect(allocateIn([lot(1, -5, '2026-10-20'), lot(2, 0, null)], 2, 2)).toEqual([{ lotId: 1, qty: 2 }]);
  });
  it('đích chính là lô âm → một dòng gộp', () => {
    expect(allocateIn([lot(1, -2, null)], 5, 1)).toEqual([{ lotId: 1, qty: 5 }]);
  });
});

describe('lineCostPrice', () => {
  it('một lô: giá vốn lô × factor', () => {
    expect(lineCostPrice([{ qty: -24, costPrice: 10000 }], 24, 24)).toBe(240000);
  });
  it('hai lô: bình quân theo số trừ, làm tròn theo đơn vị gốc trước rồi nhân factor', () => {
    expect(lineCostPrice([{ qty: -3, costPrice: 8000 }, { qty: -2, costPrice: 9000 }], 5, 1)).toBe(8400);
    expect(lineCostPrice([{ qty: -1, costPrice: 8000 }, { qty: -2, costPrice: 9000 }], 3, 1)).toBe(8667);
  });
  it('qty 0 → 0; không âm', () => {
    expect(lineCostPrice([], 0, 1)).toBe(0);
    expect(lineCostPrice([{ qty: -1, costPrice: 0 }], 1, 1)).toBe(0);
  });
});

describe('daysLeft / lotState', () => {
  const today = '2026-10-08';
  it('daysLeft: hôm nay 0, mai 1, hôm qua -1, không hạn null', () => {
    expect(daysLeft('2026-10-08', today)).toBe(0);
    expect(daysLeft('2026-10-09', today)).toBe(1);
    expect(daysLeft('2026-10-07', today)).toBe(-1);
    expect(daysLeft(null, today)).toBeNull();
  });
  it('lotState theo ngưỡng 30 ngày', () => {
    expect(lotState({ remaining: 0, expiresOn: '2026-10-01' }, today, 30)).toBe('empty');
    expect(lotState({ remaining: -1, expiresOn: null }, today, 30)).toBe('empty');
    expect(lotState({ remaining: 1, expiresOn: null }, today, 30)).toBe('ok');
    expect(lotState({ remaining: 1, expiresOn: '2026-10-07' }, today, 30)).toBe('expired');
    expect(lotState({ remaining: 1, expiresOn: '2026-10-08' }, today, 30)).toBe('expiring');
    expect(lotState({ remaining: 1, expiresOn: '2026-11-07' }, today, 30)).toBe('expiring');
    expect(lotState({ remaining: 1, expiresOn: '2026-11-08' }, today, 30)).toBe('ok');
  });
});
```

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `cd shared && npx vitest run src/lot-math.test.ts`
Expected: FAIL – `Cannot find module './lot-math.js'`.

- [ ] **Step 3: Viết `lot-math.ts`**

```ts
// shared/src/lot-math.ts
import { QTY_EPS, roundQty } from './return-math.js';
import type { LotState } from './types.js';

/** Số dư một lô, đủ để quyết định thứ tự trừ và giá vốn. */
export interface LotBalance {
  id: number;
  remaining: number;
  costPrice: number;
  expiresOn: string | null;
}

/** Một phần của movement rơi vào một lô: cùng dấu với movement. */
export interface LotDelta {
  lotId: number;
  qty: number;
}

const DAY = 86_400_000;

/** Thứ tự trừ hàng: hết hạn sớm trước, không hạn cuối, cùng hạn thì lô nhập trước (id nhỏ) trước. */
export function sortFefo(lots: LotBalance[]): LotBalance[] {
  return [...lots].sort((a, b) => {
    if (a.expiresOn !== b.expiresOn) {
      if (a.expiresOn === null) return 1;
      if (b.expiresOn === null) return -1;
      return a.expiresOn < b.expiresOn ? -1 : 1;
    }
    return a.id - b.id;
  });
}

/**
 * Trừ `qty` (> 0) khỏi các lô theo FEFO, chỉ lấy phần dương; còn thiếu thì trừ nốt vào lô cuối (cho âm).
 * Danh sách rỗng → [] (caller tạo lô tồn đầu rồi gọi lại). Delta trả về là số âm.
 */
export function allocateOut(lots: LotBalance[], qty: number): LotDelta[] {
  const order = sortFefo(lots);
  if (!order.length) return [];
  const out: LotDelta[] = [];
  let left = roundQty(qty);
  for (const l of order) {
    if (left <= QTY_EPS) break;
    if (l.remaining <= QTY_EPS) continue;
    const take = roundQty(Math.min(l.remaining, left));
    out.push({ lotId: l.id, qty: -take });
    left = roundQty(left - take);
  }
  if (left > QTY_EPS) {
    const last = order[order.length - 1]!;
    const prev = out.find((o) => o.lotId === last.id);
    if (prev) prev.qty = roundQty(prev.qty - left);
    else out.push({ lotId: last.id, qty: -left });
  }
  return out;
}

/** Cộng `qty` (> 0): bù các lô âm về 0 theo FEFO, phần dư vào `targetId`. Delta dương. */
export function allocateIn(lots: LotBalance[], qty: number, targetId: number): LotDelta[] {
  const out: LotDelta[] = [];
  let left = roundQty(qty);
  for (const l of sortFefo(lots)) {
    if (left <= QTY_EPS) break;
    if (l.remaining >= -QTY_EPS) continue;
    const fill = roundQty(Math.min(-l.remaining, left));
    out.push({ lotId: l.id, qty: fill });
    left = roundQty(left - fill);
  }
  if (left > QTY_EPS) {
    const t = out.find((o) => o.lotId === targetId);
    if (t) t.qty = roundQty(t.qty + left);
    else out.push({ lotId: targetId, qty: left });
  }
  return out;
}

/** Giá vốn 1 đơn vị bán từ phân bổ: làm tròn theo đơn vị gốc rồi nhân hệ số (như cách cũ round(cost × factor)). */
export function lineCostPrice(alloc: { qty: number; costPrice: number }[], qtyBase: number, factor: number): number {
  if (qtyBase <= QTY_EPS) return 0;
  const total = alloc.reduce((s, a) => s + Math.abs(a.qty) * a.costPrice, 0);
  return Math.max(0, Math.round(Math.round(total / qtyBase) * factor));
}

/** Số ngày từ `today` tới hạn (âm = đã quá hạn); null khi không hạn. */
export function daysLeft(expiresOn: string | null, today: string): number | null {
  if (expiresOn === null) return null;
  return Math.round((Date.parse(`${expiresOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);
}

/** Trạng thái lô để lọc/tô màu; hết hàng thắng mọi trạng thái hạn. */
export function lotState(lot: { remaining: number; expiresOn: string | null }, today: string, warnDays: number): LotState {
  if (lot.remaining <= QTY_EPS) return 'empty';
  const d = daysLeft(lot.expiresOn, today);
  if (d === null) return 'ok';
  if (d < 0) return 'expired';
  return d <= warnDays ? 'expiring' : 'ok';
}
```

- [ ] **Step 4: Thêm kiểu vào `types.ts`**

Thêm sau `StockMovement` (khoảng dòng 235):

```ts
export type LotState = 'ok' | 'expiring' | 'expired' | 'empty';

/** Một lô hàng trong danh sách Lô hàng / Tổng quan. */
export interface LotRow {
  id: number;
  productId: number;
  productName: string;
  unit: string;
  image: string | null;
  /** Phiếu nhập tạo lô; null = lô tồn đầu. */
  importId: number | null;
  importCode: string | null;
  qtyIn: number;
  remaining: number;
  costPrice: number;
  expiresOn: string | null;
  /** Số ngày tới hạn theo ngày địa phương hôm nay; âm = đã quá hạn; null = không hạn. */
  daysLeft: number | null;
  state: LotState;
  createdAt: string;
}

export interface LotList {
  lots: LotRow[];
  total: number;
  page: number;
  pageSize: number;
  /** Đếm trên mọi lô còn hàng khớp q/productId, không theo lọc trạng thái. */
  summary: { expiringCount: number; expiredCount: number; stockValue: number };
}

/** Lô còn hàng của một sản phẩm, theo FEFO: ô chọn lô khi trả NCC. */
export interface ProductLot {
  id: number;
  importCode: string | null;
  remaining: number;
  costPrice: number;
  expiresOn: string | null;
  daysLeft: number | null;
}
```

Trong `ImportItem` thêm sau `amount`: `/** Hạn dùng của lô tạo từ dòng này, "YYYY-MM-DD" hoặc null. */ expiresOn: string | null;`.
Trong `SupplierReturnItem` thêm sau `amount`: `/** Lô người dùng chọn; null = trừ tự động. */ lotId: number | null; lotExpiresOn: string | null;`.
Trong `Overview` thêm sau `lowStock`: `/** Lô còn hàng sắp/đã hết hạn theo settings.expiryWarnDays; items quá hạn trước, cắt theo giới hạn. */ expiring: { count: number; expiredCount: number; items: LotRow[] };`.

- [ ] **Step 5: Schema**

`shared/src/schemas/lot.ts` (mới):

```ts
import { z } from 'zod';
import type { LotState } from '../types.js';
import { nullableText } from './common.js';

export const LOT_STATES = ['ok', 'expiring', 'expired', 'empty'] as const satisfies readonly LotState[];

/** Bỏ hàng hết hạn: trừ hết số còn của lô, ghi chú tùy chọn. */
export const lotDisposeSchema = z.object({ note: nullableText(200) });
export type LotDispose = z.output<typeof lotDisposeSchema>;
```

`shared/src/schemas/list-filters.ts`: thêm `import { LOT_STATES } from './lot.js';` và cuối file:

```ts
/** Danh sách lô: mặc định (không `state`) là mọi lô còn hàng; `empty` chỉ hiện khi chọn. */
export const lotListFields = { q: search, productId: positiveId, state: csvEnum(LOT_STATES), page };
export const lotListQuerySchema = z.object(lotListFields);
export type LotListQuery = z.output<typeof lotListQuerySchema>;
```

`shared/src/schemas/import.ts`: thêm `import { isoDate } from './list-filters.js';` và trong `importItemInputSchema` sau `sellPrice`:

```ts
  /** Hạn dùng của lô, "YYYY-MM-DD"; null = không hạn. Không chặn ngày quá khứ. */
  expiresOn: isoDate.nullish().transform((v) => v ?? null),
```

`shared/src/schemas/supplier-return.ts`: trong `supplierReturnItemInputSchema` sau `unitPrice`: `/** Lô muốn trừ; null = tự động (hết hạn sớm trước). */ lotId: optionalId,`.

`shared/src/schemas/settings.ts`: sau `labelShowPrice`: `/** Báo lô sắp hết hạn trước bao nhiêu ngày; DB lưu chuỗi nên coerce. */ expiryWarnDays: z.coerce.number().int().min(1).max(365).default(30),`.

`shared/src/schemas/common.ts` `FIELD_LABELS` thêm: `expiresOn: 'Hạn dùng', lotId: 'Lô', expiryWarnDays: 'Báo hết hạn trước', state: 'Trạng thái',` (nếu `state` chưa có).

`shared/src/index.ts`: thêm `export * from './lot-math.js';` sau `inventory-math` và `export * from './schemas/lot.js';` sau `schemas/supplier-return`.

- [ ] **Step 6: Nháp phiếu nhập và trả NCC**

`shared/src/import-draft.ts`:
- `draftLineSchema` thêm `expiresOn: z.string().nullable().default(null),` (nháp cũ trong localStorage không có trường này vẫn parse được).
- `DraftAction` update: `patch: Partial<Pick<DraftLine, 'qty' | 'unitCost' | 'sellPrice' | 'expiresOn'>>`.
- Trong `case 'add'`, `base` thêm `expiresOn: null,`.
- `toImportInput` items thêm `expiresOn: l.expiresOn,`.

`shared/src/supplier-return-draft.ts`:
- `lineSchema` thêm `lotId: z.number().int().nullable().default(null),`.
- `SupplierReturnAction` thêm `| { type: 'setLot'; key: string; lotId: number | null }`.
- `base` thêm `lotId: null,`; `withUnit` giữ `lotId`.
- Reducer thêm `case 'setLot': return { ...d, lines: d.lines.map((l) => (l.key === a.key ? { ...l, lotId: a.lotId } : l)) };`.
- `toSupplierReturnInput` items thêm `lotId: l.lotId`.
- Gộp dòng trùng (`same`) chỉ khi cùng `lotId` nữa: `l.productId === p.id && l.unitId === line.unitId && l.lotId === null`.

- [ ] **Step 7: Test schema (đỏ rồi xanh)**

`shared/src/schemas/inventory.test.ts`: trong test mặc định của `importInputSchema`, kết quả mong đợi của item thêm `expiresOn: null`; thêm test:

```ts
  it('hạn dùng: nhận YYYY-MM-DD kể cả quá khứ, từ chối ngày không có thật', () => {
    expect(importInputSchema.parse({ paid: 0, items: [{ productId: 1, qty: 1, unitCost: 1, expiresOn: '2025-01-31' }] }).items[0]!.expiresOn).toBe('2025-01-31');
    expect(importInputSchema.safeParse({ paid: 0, items: [{ productId: 1, qty: 1, unitCost: 1, expiresOn: '2026-02-30' }] }).success).toBe(false);
  });
```

`shared/src/schemas/order.test.ts` (`settingsInputSchema`): `SETTINGS_DEFAULTS` thêm `expiryWarnDays: 30`; thêm `expect(settingsInputSchema.parse({ expiryWarnDays: '45' }).expiryWarnDays).toBe(45);` và `expect(settingsInputSchema.safeParse({ expiryWarnDays: 0 }).success).toBe(false);`.

`shared/src/schemas/list-filters.test.ts` thêm:

```ts
describe('lotListQuerySchema', () => {
  it('state csv, productId số, mặc định page 1', () => {
    expect(lotListQuerySchema.parse({ state: 'expired,expiring', productId: '3' })).toEqual({ q: undefined, productId: 3, state: ['expired', 'expiring'], page: 1 });
    expect(lotListQuerySchema.safeParse({ state: 'gone' }).success).toBe(false);
  });
});
```

`shared/src/import-draft.test.ts`: trong `describe('draftTotals / toImportInput')`, kết quả `toImportInput(d)` mỗi item thêm `expiresOn: null`; thêm test:

```ts
  it('update expiresOn: lưu trên dòng và gửi theo body; null = không hạn', () => {
    let d = importDraftReducer(EMPTY_IMPORT_DRAFT, { type: 'add', product: bia, unitId: null });
    const key = d.lines[0]!.key;
    d = importDraftReducer(d, { type: 'update', key, patch: { expiresOn: '2026-12-31' } });
    expect(d.lines[0]!.expiresOn).toBe('2026-12-31');
    expect(toImportInput(d).items[0]!.expiresOn).toBe('2026-12-31');
    d = importDraftReducer(d, { type: 'update', key, patch: { expiresOn: null } });
    expect(toImportInput(d).items[0]!.expiresOn).toBeNull();
  });
```
(`bia` là sản phẩm mẫu đã có trong file test; nếu tên khác thì dùng biến sẵn có.) Trong `parseImportDraft`, thêm expect nháp cũ không có `expiresOn` vẫn parse được và nhận `null`.

`shared/src/supplier-return-draft.test.ts`: dòng 76 kết quả item thêm `lotId: null`; thêm test:

```ts
  it('setLot: đổi lô của dòng, gửi lotId; thêm cùng sản phẩm khi dòng đã chọn lô → dòng mới', () => {
    let d = supplierReturnDraftReducer(EMPTY_SUPPLIER_RETURN_DRAFT, { type: 'add', product: bia, unitId: null });
    const key = d.lines[0]!.key;
    d = supplierReturnDraftReducer(d, { type: 'setLot', key, lotId: 7 });
    expect(toSupplierReturnInput(d, 5).items[0]).toMatchObject({ lotId: 7 });
    d = supplierReturnDraftReducer(d, { type: 'add', product: bia, unitId: null });
    expect(d.lines).toHaveLength(2);
    expect(d.lines[1]!.lotId).toBeNull();
  });
```

Run: `cd shared && npx vitest run`
Expected: PASS toàn bộ.

- [ ] **Step 8: Build shared, typecheck**

Run: `npm run build -w shared && npm run typecheck`
Expected: server/client/remote báo lỗi ở chỗ chưa có trường mới (`Overview.expiring`, `ImportItem.expiresOn`, `SupplierReturnItem.lotId`) – đó là việc của Task 4–5. Ghi lại danh sách lỗi; không được có lỗi trong `shared`.

---

### Task 2: Schema DB và migration `0008`

**Files:**
- Modify: `server/src/db/schema.ts`
- Create: `server/drizzle/0008_<tên drizzle sinh>.sql` (+ `meta/0008_snapshot.json`, `_journal.json` do drizzle cập nhật), `server/src/db/opening-lots.ts`, `server/src/db/migration-0008.test.ts`

**Interfaces:**
- Produces: bảng drizzle `lots`, `lotMovements`; cột `importItems.expiresOn`, `supplierReturnItems.lotId`; `OPENING_LOTS_SQL`, `seedOpeningLots(sqlite: Database.Database): void`.

- [ ] **Step 1: Sửa `schema.ts`**

`importItems` thêm sau `amount`: `expiresOn: text('expires_on'), // hạn dùng của lô tạo từ dòng này, 'YYYY-MM-DD'; null = không hạn`.

`supplierReturnItems` thêm sau `amount`: `lotId: integer('lot_id').references(() => lots.id), // lô người dùng chọn; null = trừ tự động`.

Thêm sau `stockMovements`:

```ts
/**
 * Lô hàng: mỗi dòng phiếu nhập một lô; lô "Tồn đầu" (import_item_id null) cho tồn có trước 0.17.0 hoặc sản phẩm chưa nhập qua phiếu.
 * Chỉ đổi qua recordMovement (services/stock.ts); Σ remaining của một sản phẩm luôn = products.stock.
 */
export const lots = sqliteTable(
  'lots',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    importItemId: integer('import_item_id').references(() => importItems.id),
    qtyIn: real('qty_in').notNull(), // số nhập, đơn vị gốc
    remaining: real('remaining').notNull(), // số còn, đơn vị gốc, có thể âm
    costPrice: integer('cost_price').notNull(), // giá vốn 1 đơn vị gốc
    expiresOn: text('expires_on'), // 'YYYY-MM-DD'; null = không hạn
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [index('lots_product_idx').on(t.productId, t.expiresOn, t.id), index('lots_expires_idx').on(t.expiresOn)],
);

/** Một movement tách theo lô; qty cùng dấu với movement. */
export const lotMovements = sqliteTable(
  'lot_movements',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    movementId: integer('movement_id')
      .notNull()
      .references(() => stockMovements.id, { onDelete: 'cascade' }),
    lotId: integer('lot_id')
      .notNull()
      .references(() => lots.id),
    qty: real('qty').notNull(),
  },
  (t) => [index('lot_movements_movement_idx').on(t.movementId), index('lot_movements_lot_idx').on(t.lotId)],
);
```

`lots` tham chiếu `importItems` và `supplierReturnItems` tham chiếu `lots`: đặt `lots` **sau** `importItems` và **trước** `supplierReturns` trong file để tránh dùng trước khi khai báo (hoặc dùng hàm `() => lots.id`, drizzle cho phép tham chiếu muộn qua callback – giữ callback là đủ, không cần đổi vị trí bảng cũ).

- [ ] **Step 2: Sinh migration và soát SQL**

Run: `npm run db:generate`
Expected: file `server/drizzle/0008_*.sql` có `CREATE TABLE lots`, `CREATE TABLE lot_movements`, 4 `CREATE INDEX`, `ALTER TABLE import_items ADD expires_on text;`, `ALTER TABLE supplier_return_items ADD lot_id integer REFERENCES lots(id);`. Không có câu dựng lại bảng. Nếu drizzle sinh `ALTER … NOT NULL` không default thì sửa tay theo `.claude/rules/database.md`.

Thêm vào **cuối** file SQL:

```sql
--> statement-breakpoint
INSERT INTO `lots` (`product_id`, `import_item_id`, `qty_in`, `remaining`, `cost_price`, `expires_on`, `note`, `created_at`)
SELECT `id`, NULL, `stock`, `stock`, `cost_price`, NULL, 'Tồn đầu', `updated_at` FROM `products` WHERE `stock` <> 0;
```

- [ ] **Step 3: `opening-lots.ts`**

```ts
// server/src/db/opening-lots.ts
import type Database from 'better-sqlite3';

/** Cùng câu với migration 0008: mỗi sản phẩm có tồn mà chưa có lô nhận một lô "Tồn đầu" bằng tồn và giá vốn hiện tại. */
export const OPENING_LOTS_SQL = `insert into lots (product_id, import_item_id, qty_in, remaining, cost_price, expires_on, note, created_at)
  select id, null, stock, stock, cost_price, null, 'Tồn đầu', updated_at from products
  where stock <> 0 and not exists (select 1 from lots where lots.product_id = products.id)`;

/** Dùng sau khi khôi phục bản sao từ phiên bản chưa có lô (migration không chạy lại trên dữ liệu chép vào). */
export function seedOpeningLots(sqlite: Database.Database): number {
  return sqlite.prepare(OPENING_LOTS_SQL).run().changes;
}
```

- [ ] **Step 4: Test migration (đỏ → xanh)**

```ts
// server/src/db/migration-0008.test.ts
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { migrationsFolder, partialMigrations } from './test-migrations.js';

describe('migration 0008', () => {
  it('tạo lô Tồn đầu cho sản phẩm có tồn khác 0; tồn 0 không có lô; dữ liệu cũ nguyên', () => {
    const sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    const db = drizzle(sqlite);
    migrate(db, { migrationsFolder: partialMigrations(8) });
    sqlite.exec(`
      INSERT INTO products (id, name, stock, cost_price, updated_at) VALUES (1, 'Bia', 5, 9000, '2026-10-01T00:00:00.000Z');
      INSERT INTO products (id, name, stock, cost_price) VALUES (2, 'Mì', 0, 3000);
      INSERT INTO products (id, name, stock, cost_price) VALUES (3, 'Đường', -2, 20000);
      INSERT INTO imports (id, code, supplier_name, total) VALUES (1, 'PN-20261001-0001', 'Đại lý', 45000);
      INSERT INTO import_items (import_id, product_id, qty, cost_price) VALUES (1, 1, 5, 9000);
    `);
    migrate(db, { migrationsFolder });
    expect(sqlite.prepare('SELECT product_id, import_item_id, qty_in, remaining, cost_price, expires_on, note, created_at FROM lots ORDER BY product_id').all()).toEqual([
      { product_id: 1, import_item_id: null, qty_in: 5, remaining: 5, cost_price: 9000, expires_on: null, note: 'Tồn đầu', created_at: '2026-10-01T00:00:00.000Z' },
      { product_id: 3, import_item_id: null, qty_in: -2, remaining: -2, cost_price: 20000, expires_on: null, note: 'Tồn đầu', created_at: expect.any(String) },
    ]);
    expect(sqlite.prepare('SELECT expires_on FROM import_items').all()).toEqual([{ expires_on: null }]);
    expect(sqlite.prepare('SELECT count(*) AS n FROM lot_movements').get()).toEqual({ n: 0 });
    expect(sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });
});
```

Run: `cd server && npx vitest run src/db/migration-0008.test.ts`
Expected: PASS. Chạy thêm `npx vitest run src/db` để các test migration cũ vẫn xanh.

---

### Task 3: `recordMovement` biết lô (`services/stock.ts`)

**Files:**
- Modify: `server/src/services/stock.ts`
- Create: `server/src/services/stock.test.ts`

**Interfaces:**
- Consumes: `allocateIn`, `allocateOut`, `roundQty`, `QTY_EPS`, `LotBalance` từ `@tiny-pos/shared`; bảng `lots`, `lotMovements`.
- Produces:

```ts
export interface NewLot { importItemId: number | null; costPrice: number; expiresOn: string | null }
export interface MovementInput {
  productId: number; qty: number; type: MovementType; refId?: number | null; note?: string | null;
  newLot?: NewLot;      // qty > 0: tạo lô mới rồi cộng vào (sau khi bù lô âm)
  lotId?: number;       // trừ/cộng thẳng một lô (trả NCC chọn lô, bỏ hàng)
  reverseOf?: number;   // đảo movement cũ theo đúng lô; movement cũ không có phân bổ → luật tự động
}
export interface LotAlloc { lotId: number; qty: number; costPrice: number }
export interface MovementResult { movementId: number; alloc: LotAlloc[] }
export function recordMovement(tx: DbOrTx, m: MovementInput): MovementResult;
export function adjustStockTo(tx: DbOrTx, productId: number, target: number, note: string): void; // không đổi chữ ký
export function lotBalances(tx: DbOrTx, productId: number): LotBalance[];
export function assertLotInvariant(tx: DbOrTx, productId: number): void; // ném Error nếu Σ remaining ≠ stock (dùng trong test)
```

- [ ] **Step 1: Viết test (đỏ)**

```ts
// server/src/services/stock.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { productInputSchema } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { lotMovements, lots, stockMovements } from '../db/schema.js';
import { createTestDb } from '../db/test-db.js';
import { createProduct, getProduct } from './products.js';
import { assertLotInvariant, lotBalances, recordMovement } from './stock.js';

let db: Db;
beforeEach(() => {
  db = createTestDb();
});
const product = (o: Record<string, unknown>) => createProduct(db, productInputSchema.parse(o));
const lotsOf = (productId: number) =>
  db.select({ id: lots.id, qtyIn: lots.qtyIn, remaining: lots.remaining, costPrice: lots.costPrice, expiresOn: lots.expiresOn, note: lots.note })
    .from(lots).where(eq(lots.productId, productId)).orderBy(lots.id).all();
const allocOf = (movementId: number) =>
  db.select({ lotId: lotMovements.lotId, qty: lotMovements.qty }).from(lotMovements).where(eq(lotMovements.movementId, movementId)).all();
const importLot = (productId: number, qty: number, costPrice: number, expiresOn: string | null = null) =>
  recordMovement(db, { productId, qty, type: 'import', newLot: { importItemId: null, costPrice, expiresOn } });

describe('recordMovement với lô', () => {
  it('createProduct có tồn → lô Tồn đầu bằng tồn và giá vốn; tồn 0 → chưa có lô', () => {
    const p = product({ name: 'Bia', costPrice: 9000, sellPrice: 12000, stock: 10 });
    expect(lotsOf(p.id)).toMatchObject([{ qtyIn: 0, remaining: 10, costPrice: 9000, expiresOn: null, note: 'Tồn đầu' }]);
    const q = product({ name: 'Mì', costPrice: 3000, sellPrice: 4000 });
    expect(lotsOf(q.id)).toEqual([]);
    assertLotInvariant(db, p.id);
  });

  it('nhập tạo lô mới với hạn; bán trừ FEFO gối hai lô, trả về alloc kèm giá vốn', () => {
    const p = product({ name: 'Sữa', costPrice: 8000, sellPrice: 10000, stock: 3 }); // lô 1: 3 @8000, không hạn
    importLot(p.id, 10, 9000, '2026-10-20'); // lô 2: hạn gần → trừ trước
    const r = recordMovement(db, { productId: p.id, qty: -12, type: 'sale', refId: 1 });
    expect(r.alloc).toEqual([
      { lotId: 2, qty: -10, costPrice: 9000 },
      { lotId: 1, qty: -2, costPrice: 8000 },
    ]);
    expect(lotsOf(p.id)).toMatchObject([{ remaining: 1 }, { remaining: 0 }]);
    expect(getProduct(db, p.id).stock).toBe(1);
    expect(allocOf(r.movementId)).toEqual([{ lotId: 2, qty: -10 }, { lotId: 1, qty: -2 }]);
    assertLotInvariant(db, p.id);
  });

  it('bán vượt: trừ âm vào lô cuối FEFO; sản phẩm chưa có lô → tạo Tồn đầu rồi trừ âm', () => {
    const p = product({ name: 'Đường', costPrice: 20000, sellPrice: 25000 });
    const r = recordMovement(db, { productId: p.id, qty: -2, type: 'sale' });
    expect(lotsOf(p.id)).toMatchObject([{ qtyIn: 0, remaining: -2, costPrice: 20000, note: 'Tồn đầu' }]);
    expect(r.alloc).toEqual([{ lotId: 1, qty: -2, costPrice: 20000 }]);
    assertLotInvariant(db, p.id);
  });

  it('nhập khi lô âm: bù về 0 rồi dư vào lô mới (remaining < qtyIn)', () => {
    const p = product({ name: 'Đường', costPrice: 20000, sellPrice: 25000 });
    recordMovement(db, { productId: p.id, qty: -3, type: 'sale' });
    importLot(p.id, 20, 21000);
    expect(lotsOf(p.id)).toMatchObject([{ remaining: 0 }, { qtyIn: 20, remaining: 17, costPrice: 21000 }]);
    expect(getProduct(db, p.id).stock).toBe(17);
    assertLotInvariant(db, p.id);
  });

  it('cộng không có đích (kiểm kê thừa): bù âm rồi vào lô mới nhất', () => {
    const p = product({ name: 'Kẹo', costPrice: 500, sellPrice: 1000, stock: 2 });
    importLot(p.id, 5, 600, '2026-12-01');
    recordMovement(db, { productId: p.id, qty: -9, type: 'sale' }); // lô 2 (hạn) trừ 5, lô 1 trừ 4 → -2
    recordMovement(db, { productId: p.id, qty: 3, type: 'adjust', note: 'Kiểm kê' });
    expect(lotsOf(p.id)).toMatchObject([{ remaining: 0 }, { remaining: 1 }]);
    assertLotInvariant(db, p.id);
  });

  it('lotId: trừ thẳng lô đó kể cả âm; lô của sản phẩm khác → 400', () => {
    const p = product({ name: 'A', costPrice: 1, sellPrice: 2, stock: 1 });
    const q = product({ name: 'B', costPrice: 1, sellPrice: 2, stock: 1 });
    const [lotQ] = lotsOf(q.id);
    recordMovement(db, { productId: q.id, qty: -3, type: 'supplier_return', lotId: lotQ!.id });
    expect(lotsOf(q.id)).toMatchObject([{ remaining: -2 }]);
    expect(() => recordMovement(db, { productId: p.id, qty: -1, type: 'supplier_return', lotId: lotQ!.id })).toThrow('Lô không thuộc sản phẩm này');
    assertLotInvariant(db, q.id);
  });

  it('reverseOf: cộng lại đúng lô đã trừ, kể cả khi lô đó đã bị trừ tiếp; một phần chia tỷ lệ', () => {
    const p = product({ name: 'Sữa', costPrice: 8000, sellPrice: 10000, stock: 4 });
    importLot(p.id, 6, 9000, '2026-10-20');
    const sale = recordMovement(db, { productId: p.id, qty: -8, type: 'sale', refId: 1 }); // lô2 -6, lô1 -2
    recordMovement(db, { productId: p.id, qty: -2, type: 'sale', refId: 2 }); // lô1 -2 → lô1 = 0
    const back = recordMovement(db, { productId: p.id, qty: 4, type: 'return', refId: 1, reverseOf: sale.movementId });
    expect(back.alloc).toEqual([{ lotId: 2, qty: 3, costPrice: 9000 }, { lotId: 1, qty: 1, costPrice: 8000 }]);
    expect(lotsOf(p.id)).toMatchObject([{ remaining: 1 }, { remaining: 3 }]);
    recordMovement(db, { productId: p.id, qty: 4, type: 'return', refId: 1, reverseOf: sale.movementId });
    expect(lotsOf(p.id)).toMatchObject([{ remaining: 2 }, { remaining: 6 }]);
    assertLotInvariant(db, p.id);
  });

  it('reverseOf movement không có phân bổ (chứng từ cũ) → luật tự động', () => {
    const p = product({ name: 'Cũ', costPrice: 1000, sellPrice: 2000, stock: 5 });
    const { id } = db.insert(stockMovements).values({ productId: p.id, qty: -2, type: 'sale', refId: 9 }).returning({ id: stockMovements.id }).get();
    const r = recordMovement(db, { productId: p.id, qty: 2, type: 'return', refId: 9, reverseOf: id });
    expect(r.alloc).toEqual([{ lotId: 1, qty: 2, costPrice: 1000 }]);
    expect(lotsOf(p.id)).toMatchObject([{ remaining: 7 }]);
  });

  it('hàng cân: 0,3 kg gối hai lô, không rác nhị phân, bất biến đúng', () => {
    const p = product({ name: 'Gạo', unit: 'kg', isWeighed: true, costPrice: 15000, sellPrice: 18000, stock: 0.1 });
    importLot(p.id, 5, 16000, null);
    const r = recordMovement(db, { productId: p.id, qty: -0.3, type: 'sale' });
    expect(r.alloc).toEqual([{ lotId: 1, qty: -0.1, costPrice: 15000 }, { lotId: 2, qty: -0.2, costPrice: 16000 }]);
    expect(lotsOf(p.id)).toMatchObject([{ remaining: 0 }, { remaining: 4.8 }]);
    assertLotInvariant(db, p.id);
  });
});
```

Lưu ý `lotsOf(...)[0]` với lô Tồn đầu của sản phẩm tạo trước có id 1: id lô tăng toàn cục trong DB test, nên trong test "lotId" lô của `q` có id 2. Viết expect theo `lotQ!.id` như trên, không giả định số.

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `npm run build -w shared && cd server && npx vitest run src/services/stock.test.ts`
Expected: FAIL – `recordMovement` không nhận `newLot`, không export `assertLotInvariant`.

- [ ] **Step 3: Viết `stock.ts`**

```ts
import { asc, eq, sql } from 'drizzle-orm';
import { allocateIn, allocateOut, QTY_EPS, roundQty, type LotBalance, type MovementType } from '@tiny-pos/shared';
import type { DbOrTx } from '../db/connection.js';
import { lotMovements, lots, products, stockMovements } from '../db/schema.js';
import { BadRequestError, NotFoundError } from '../errors.js';

export type { MovementType };

export interface NewLot {
  importItemId: number | null;
  costPrice: number;
  expiresOn: string | null;
}

export interface MovementInput {
  productId: number;
  qty: number;
  type: MovementType;
  refId?: number | null;
  note?: string | null;
  /** Nhập: tạo lô mới rồi cộng vào (sau khi bù lô âm). */
  newLot?: NewLot;
  /** Trừ/cộng thẳng một lô (trả NCC chọn lô, bỏ hàng). */
  lotId?: number;
  /** Đảo một movement trước đó theo đúng lô nó đã dùng; movement gốc không có phân bổ → luật tự động. */
  reverseOf?: number;
}

export interface LotAlloc {
  lotId: number;
  qty: number;
  costPrice: number;
}

export interface MovementResult {
  movementId: number;
  alloc: LotAlloc[];
}

export function lotBalances(tx: DbOrTx, productId: number): LotBalance[] {
  return tx
    .select({ id: lots.id, remaining: lots.remaining, costPrice: lots.costPrice, expiresOn: lots.expiresOn })
    .from(lots)
    .where(eq(lots.productId, productId))
    .orderBy(asc(lots.id))
    .all();
}

/** Lô "Tồn đầu": sản phẩm chưa có lô nào mà đã có thay đổi tồn (tạo sản phẩm có tồn, bán khi chưa nhập). */
function openingLot(tx: DbOrTx, productId: number): LotBalance {
  const p = tx.select({ costPrice: products.costPrice }).from(products).where(eq(products.id, productId)).get();
  if (!p) throw new NotFoundError('Không tìm thấy sản phẩm');
  const { id } = tx
    .insert(lots)
    .values({ productId, importItemId: null, qtyIn: 0, remaining: 0, costPrice: p.costPrice, expiresOn: null, note: 'Tồn đầu' })
    .returning({ id: lots.id })
    .get();
  return { id, remaining: 0, costPrice: p.costPrice, expiresOn: null };
}

/** Phân bổ ngược của một movement cũ, chia tỷ lệ khi đảo một phần; sai số làm tròn dồn vào dòng cuối. */
function reverseAlloc(tx: DbOrTx, movementId: number, qty: number): { lotId: number; qty: number }[] | null {
  const rows = tx.select({ lotId: lotMovements.lotId, qty: lotMovements.qty }).from(lotMovements).where(eq(lotMovements.movementId, movementId)).orderBy(asc(lotMovements.id)).all();
  if (!rows.length) return null;
  const total = rows.reduce((s, r) => s + Math.abs(r.qty), 0);
  const want = Math.abs(qty);
  const sign = Math.sign(qty);
  let acc = 0;
  const out = rows.map((r, i) => {
    const part = i === rows.length - 1 ? roundQty(want - acc) : roundQty((Math.abs(r.qty) * want) / total);
    acc = roundQty(acc + part);
    return { lotId: r.lotId, qty: sign * part };
  });
  return out.filter((o) => Math.abs(o.qty) > QTY_EPS);
}

function allocate(tx: DbOrTx, m: MovementInput): LotAlloc[] {
  if (Math.abs(m.qty) <= QTY_EPS) return [];
  let balances = lotBalances(tx, m.productId);
  const withCost = (xs: { lotId: number; qty: number }[]): LotAlloc[] =>
    xs.map((x) => ({ ...x, costPrice: balances.find((b) => b.id === x.lotId)!.costPrice }));
  if (m.reverseOf !== undefined) {
    const r = reverseAlloc(tx, m.reverseOf, m.qty);
    if (r) return withCost(r);
  }
  if (m.lotId !== undefined) {
    const lot = balances.find((b) => b.id === m.lotId);
    if (!lot) throw new BadRequestError('Lô không thuộc sản phẩm này');
    return [{ lotId: lot.id, qty: roundQty(m.qty), costPrice: lot.costPrice }];
  }
  if (m.qty > 0 && m.newLot) {
    const { id } = tx
      .insert(lots)
      .values({ productId: m.productId, importItemId: m.newLot.importItemId, qtyIn: roundQty(m.qty), remaining: 0, costPrice: m.newLot.costPrice, expiresOn: m.newLot.expiresOn })
      .returning({ id: lots.id })
      .get();
    balances = [...balances, { id, remaining: 0, costPrice: m.newLot.costPrice, expiresOn: m.newLot.expiresOn }];
    return withCost(allocateIn(balances, m.qty, id));
  }
  if (!balances.length) balances = [openingLot(tx, m.productId)];
  if (m.qty > 0) return withCost(allocateIn(balances, m.qty, Math.max(...balances.map((b) => b.id))));
  return withCost(allocateOut(balances, -m.qty));
}

/** Cách DUY NHẤT để đổi tồn kho: ghi movement, tách theo lô (lot_movements + lots.remaining), rồi cộng dồn vào products.stock. */
export function recordMovement(tx: DbOrTx, m: MovementInput): MovementResult {
  const { id: movementId } = tx
    .insert(stockMovements)
    .values({ productId: m.productId, qty: m.qty, type: m.type, refId: m.refId ?? null, note: m.note ?? null })
    .returning({ id: stockMovements.id })
    .get();
  const alloc = allocate(tx, m);
  for (const a of alloc) {
    tx.insert(lotMovements).values({ movementId, lotId: a.lotId, qty: a.qty }).run();
    tx.update(lots)
      .set({ remaining: sql`round(${lots.remaining} + ${a.qty}, 3)` })
      .where(eq(lots.id, a.lotId))
      .run();
  }
  tx.update(products)
    .set({ stock: sql`${products.stock} + ${m.qty}` })
    .where(eq(products.id, m.productId))
    .run();
  return { movementId, alloc };
}

/** Đưa tồn về đúng `target` bằng 1 movement adjust (kiểm kê, sửa tay). */
export function adjustStockTo(tx: DbOrTx, productId: number, target: number, note: string): void {
  const row = tx.select({ stock: products.stock }).from(products).where(eq(products.id, productId)).get();
  if (!row) throw new NotFoundError('Không tìm thấy sản phẩm');
  const diff = target - row.stock;
  if (Math.abs(diff) < 1e-9) return;
  recordMovement(tx, { productId, qty: diff, type: 'adjust', note });
}

/** Kiểm bất biến Σ lots.remaining = products.stock (test và tự kiểm). */
export function assertLotInvariant(tx: DbOrTx, productId: number): void {
  const stock = tx.select({ stock: products.stock }).from(products).where(eq(products.id, productId)).get()?.stock ?? 0;
  const sum = lotBalances(tx, productId).reduce((s, l) => s + l.remaining, 0);
  if (Math.abs(sum - stock) > 1e-6) throw new Error(`Lô lệch tồn: sản phẩm #${productId} Σ lô ${sum} ≠ tồn ${stock}`);
}
```

`products.stock` cộng dồn như cũ (không làm tròn) nên có thể lệch 1e-15 so với Σ lô đã `round(…, 3)`; `assertLotInvariant` chấp nhận ≤ 1e-6. Giữ nguyên cách cộng `stock` để không đổi hành vi test cũ.

Kiểm `MovementType` còn được import ở đâu từ `stock.ts` (`grep -rn "from './stock.js'" server/src`): giữ `export type { MovementType }` để không phải sửa chỗ khác.

- [ ] **Step 4: Chạy test, xác nhận xanh; test cũ còn xanh**

Run: `cd server && npx vitest run src/services/stock.test.ts src/services/products.test.ts src/services/stocktakes.test.ts`
Expected: PASS. Test cũ của `stocktakes` lọc movement theo note nên không bị ảnh hưởng.

---

### Task 4: Nhập, bán, trả, trả NCC, báo cáo dùng lô

**Files:**
- Modify: `server/src/services/imports.ts`, `orders.ts`, `returns.ts`, `supplier-returns.ts`, `reports.ts`
- Test: `server/src/services/imports.test.ts`, `orders.test.ts`, `returns.test.ts`, `supplier-returns.test.ts`, `reports.test.ts`

**Interfaces:**
- Consumes: `recordMovement` (Task 3), `lineCostPrice` (Task 1), `ImportInput.items[].expiresOn`, `SupplierReturnInput.items[].lotId`.
- Produces: `ImportItem.expiresOn`, `SupplierReturnItem.lotId/lotExpiresOn` trả về đúng; hàm nội bộ `refMovements(tx, type, refId)` dùng chung (đặt trong `stock.ts`, export):

```ts
/** Movement của một chứng từ theo thứ tự ghi, để hủy đảo đúng lô từng dòng. */
export function refMovements(tx: DbOrTx, type: MovementType, refId: number): { id: number; productId: number }[];
```

- [ ] **Step 1: Thêm `refMovements` vào `stock.ts`**

```ts
export function refMovements(tx: DbOrTx, type: MovementType, refId: number): { id: number; productId: number }[] {
  return tx
    .select({ id: stockMovements.id, productId: stockMovements.productId })
    .from(stockMovements)
    .where(and(eq(stockMovements.type, type), eq(stockMovements.refId, refId)))
    .orderBy(asc(stockMovements.id))
    .all();
}
```
(thêm `and` vào import drizzle). Ghép dòng chứng từ với movement theo **thứ tự**: dòng thứ i (chỉ các dòng có `productId`) ↔ movement thứ i; nếu `productId` không khớp thì bỏ `reverseOf` (rơi về tự động). Viết helper nhỏ trong `stock.ts`:

```ts
/** id movement thứ `i` của chứng từ nếu đúng sản phẩm; không khớp (dữ liệu lạ) → undefined để rơi về luật tự động. */
export const movementAt = (moves: { id: number; productId: number }[], i: number, productId: number): number | undefined =>
  moves[i]?.productId === productId ? moves[i]!.id : undefined;
```

- [ ] **Step 2: Test imports (đỏ)**

Trong `imports.test.ts` sửa test đầu: `r.items` toMatchObject thêm `expiresOn: null`; thêm:

```ts
  it('mỗi dòng một lô với hạn dùng; hủy phiếu trừ đúng lô, đã bán bớt thì lô âm', () => {
    const p = product({ name: 'Sữa', unit: 'hộp', costPrice: 8000, sellPrice: 10000, stock: 2 });
    const r = imp({
      paid: 170000,
      items: [
        { productId: p.id, qty: 10, unitCost: 9000, expiresOn: '2026-11-30' },
        { productId: p.id, qty: 10, unitCost: 8000, expiresOn: null },
      ],
    });
    expect(r.items.map((i) => i.expiresOn)).toEqual(['2026-11-30', null]);
    const lotRows = db.select().from(lots).where(eq(lots.productId, p.id)).orderBy(lots.id).all();
    expect(lotRows).toMatchObject([
      { qtyIn: 0, remaining: 2, costPrice: 8000, note: 'Tồn đầu' },
      { importItemId: r.items[0]!.id, qtyIn: 10, remaining: 10, costPrice: 9000, expiresOn: '2026-11-30' },
      { importItemId: r.items[1]!.id, qtyIn: 10, remaining: 10, costPrice: 8000, expiresOn: null },
    ]);
    // bán 12: lô hạn 30/11 trừ 10, rồi lô Tồn đầu (không hạn, id nhỏ hơn) trừ 2
    createOrder(db, orderInputSchema.parse({ items: [{ productId: p.id, qty: 12, price: 10000 }], paymentMethod: 'cash', paid: 200000 }), MORNING);
    cancelImport(db, r.id, MORNING);
    expect(db.select().from(lots).where(eq(lots.productId, p.id)).orderBy(lots.id).all().map((l) => l.remaining)).toEqual([0, -10, 0]);
    expect(getProduct(db, p.id).stock).toBe(-10);
    assertLotInvariant(db, p.id);
  });
```
(import `lots` từ schema, `assertLotInvariant` từ `./stock.js`.)

- [ ] **Step 3: Sửa `imports.ts`**

- `ResolvedLine` thêm `expiresOn: string | null;` và `resolveLine` trả `expiresOn: it.expiresOn`.
- `importItemColumns` thêm `expiresOn: importItems.expiresOn,`.
- `createImport`: trong vòng `for (const l of lines)` chèn dòng với `.returning({ id: importItems.id }).get()` thêm `expiresOn: l.expiresOn`, rồi
  `recordMovement(tx, { productId: l.productId, qty: l.qty * l.factor, type: 'import', refId: id, note: \`Nhập ${code}\`, newLot: { importItemId: item.id, costPrice: l.costPrice, expiresOn: l.expiresOn } });`
- `cancelImport`: trước vòng lặp `const moves = refMovements(tx, 'import', id);` và trong lặp `r.items.forEach((it, i) => recordMovement(tx, { …như cũ…, reverseOf: movementAt(moves, i, it.productId) }))`. Sửa comment: "Hủy: trừ lại đúng lô của phiếu (đã bán bớt thì lô âm) và phần nợ đã ghi; giá vốn/giá bán giữ nguyên."

Run: `cd server && npx vitest run src/services/imports.test.ts` → PASS.

- [ ] **Step 4: Test orders (đỏ)**

Trong `orders.test.ts` thêm:

```ts
  it('giá vốn dòng theo lô đã trừ (gối hai lô); hủy đơn cộng lại đúng lô kể cả lô đã bị bỏ hàng', () => {
    const p = product({ name: 'Sữa', costPrice: 8000, sellPrice: 10000, stock: 3 }); // Tồn đầu 3 @8000
    createImport(db, importInputSchema.parse({ paid: 18000, items: [{ productId: p.id, qty: 2, unitCost: 9000, expiresOn: '2026-10-20' }] }), MORNING);
    const o = order({ items: [{ productId: p.id, qty: 5, price: 10000 }] }); // lô hạn 2 @9000 + Tồn đầu 3 @8000
    expect(o.items[0]).toMatchObject({ costPrice: 8400, amount: 50000 });
    const lotRows = () => db.select({ remaining: lots.remaining }).from(lots).where(eq(lots.productId, p.id)).orderBy(lots.id).all().map((l) => l.remaining);
    expect(lotRows()).toEqual([0, 0]);
    // bỏ hàng lô hạn (giả lập): trừ thêm 1 → -1 ; hủy đơn vẫn cộng lại đúng 2 vào lô đó
    recordMovement(db, { productId: p.id, qty: -1, type: 'adjust', lotId: 2 });
    cancelOrder(db, o.id);
    expect(lotRows()).toEqual([3, 1]);
    expect(getProduct(db, p.id).stock).toBe(4);
  });
  it('bán khi chưa có lô: vẫn bán, giá vốn = giá nhập gần nhất, lô Tồn đầu âm', () => {
    const p = product({ name: 'Đường', costPrice: 20000, sellPrice: 25000 });
    const o = order({ items: [{ productId: p.id, qty: 2, price: 25000 }] });
    expect(o.items[0]!.costPrice).toBe(20000);
    expect(getProduct(db, p.id).stock).toBe(-2);
  });
```
(import `createImport`, `importInputSchema`, `lots`, `recordMovement`, `eq`.) Lô id 2 là lô nhập vì DB test mới mỗi `beforeEach`.

- [ ] **Step 5: Sửa `orders.ts`**

- Import `lineCostPrice` từ shared; `recordMovement`, `refMovements`, `movementAt` từ `./stock.js`.
- `createOrder`: thay vòng lặp bằng

```ts
    for (const l of lines) {
      const { isWeighed: _w, ...snapshot } = l;
      // Không kiểm tra tồn: cho bán âm, số kho sửa khi kiểm kê. Ghi movement trước để lấy giá vốn thật của các lô đã trừ.
      let costPrice = 0;
      if (l.productId !== null) {
        const { alloc } = recordMovement(tx, { productId: l.productId, qty: -l.qty * l.factor, type: 'sale', refId: id });
        costPrice = lineCostPrice(alloc, l.qty * l.factor, l.factor);
      }
      tx.insert(orderItems)
        .values({ ...snapshot, costPrice, orderId: id, amount: lineAmount(l) })
        .run();
    }
```
  `resolveLine` vẫn trả `costPrice: Math.round(p.costPrice * factor)` (giữ cho `cartTotals`/kiểu), nhưng giá ghi vào dòng là `costPrice` từ lô.
- `cancelOrder`: `const moves = refMovements(tx, 'sale', id); let i = 0;` và trong lặp các dòng có `productId`: `recordMovement(tx, { …, reverseOf: movementAt(moves, i++, it.productId) })`.

Run: `cd server && npx vitest run src/services/orders.test.ts` → PASS (các test cũ có `costPrice` 10000/240000 vẫn đúng vì lô Tồn đầu mang giá vốn của sản phẩm).

- [ ] **Step 6: Test và sửa returns**

Test thêm vào `returns.test.ts`:

```ts
  it('trả một phần nhập lại kho: cộng đúng tỷ lệ vào các lô dòng đã trừ; hủy phiếu trả trừ lại đúng lô', () => {
    const p = product({ name: 'Sữa', costPrice: 8000, sellPrice: 10000, stock: 2 });
    createImport(db, importInputSchema.parse({ paid: 18000, items: [{ productId: p.id, qty: 2, unitCost: 9000, expiresOn: '2026-10-20' }] }), D29);
    const o = order({ items: [{ productId: p.id, qty: 4, price: 10000 }] }); // lô hạn -2, Tồn đầu -2
    const r = ret({ orderId: o.id, items: [{ orderItemId: o.items[0]!.id, qty: 2, restock: true }] });
    const rem = () => db.select({ remaining: lots.remaining }).from(lots).where(eq(lots.productId, p.id)).orderBy(lots.id).all().map((l) => l.remaining);
    expect(rem()).toEqual([1, 1]);
    cancelReturn(db, r.id, D30);
    expect(rem()).toEqual([0, 0]);
  });
```

Sửa `returns.ts`:
- `createReturn`: trước vòng lặp `const saleMoves = refMovements(tx, 'sale', o.id); const stockLines = o.items.filter((i) => i.productId !== null);` và dòng `restock`:
  `recordMovement(tx, { …, reverseOf: movementAt(saleMoves, stockLines.indexOf(l.it), l.it.productId!) })`.
- `cancelReturn`: `const moves = refMovements(tx, 'return', id); let i = 0;` và trong lặp các dòng `restock`: `reverseOf: movementAt(moves, i++, it.productId)`.

Run: `cd server && npx vitest run src/services/returns.test.ts` → PASS.

- [ ] **Step 7: Test và sửa supplier-returns**

Test thêm vào `supplier-returns.test.ts`:

```ts
  it('chọn lô: trừ thẳng lô đó (được âm), lưu lotId và hạn; không chọn thì FEFO; hủy cộng lại đúng lô', () => {
    const p = product({ name: 'Sữa', costPrice: 8000, sellPrice: 10000, stock: 5 });
    const s = supplier();
    createImport(db, importInputSchema.parse({ supplierId: s.id, paid: 0, items: [{ productId: p.id, qty: 3, unitCost: 9000, expiresOn: '2026-10-20' }] }), D29);
    const [opening, dated] = db.select({ id: lots.id }).from(lots).where(eq(lots.productId, p.id)).orderBy(lots.id).all();
    const r = ret({ supplierId: s.id, items: [{ productId: p.id, qty: 4, unitPrice: 9000, lotId: dated!.id }] });
    expect(r.items[0]).toMatchObject({ lotId: dated!.id, lotExpiresOn: '2026-10-20' });
    const rem = () => db.select({ remaining: lots.remaining }).from(lots).where(eq(lots.productId, p.id)).orderBy(lots.id).all().map((l) => l.remaining);
    expect(rem()).toEqual([5, -1]);
    expect(() => ret({ supplierId: s.id, items: [{ productId: p.id, qty: 1, unitPrice: 9000, lotId: 9999 }] })).toThrow('Lô không thuộc sản phẩm này');
    cancelSupplierReturn(db, r.id, D30);
    expect(rem()).toEqual([5, 3]);
    void opening;
  });
```

Sửa `supplier-returns.ts`:
- `itemColumns` thêm `lotId: supplierReturnItems.lotId, lotExpiresOn: lots.expiresOn,`; `itemsOf` thêm `.leftJoin(lots, eq(supplierReturnItems.lotId, lots.id))` (import `lots`).
- `resolveLine` trả thêm `lotId: it.lotId`.
- `createSupplierReturn`: `recordMovement(tx, { …, lotId: l.lotId ?? undefined })`; dòng chèn `{ returnId: id, ...l }` đã mang `lotId`.
- `cancelSupplierReturn`: `const moves = refMovements(tx, 'supplier_return', id);` và `reverseOf: movementAt(moves, i, it.productId)` theo chỉ số dòng.

Run: `cd server && npx vitest run src/services/supplier-returns.test.ts` → PASS.

- [ ] **Step 8: Báo cáo tồn theo lô**

`reports.ts` trong `stockReport`: thay giá trị vốn bằng Σ lô dương:

```ts
  // Giá trị vốn theo lô (chỉ lô dương): giá vốn thật của từng lần nhập, không phải giá nhập gần nhất × tồn
  const lotValue = new Map(
    db
      .select({ productId: lots.productId, value: sql<number>`sum(${lots.remaining} * ${lots.costPrice})` })
      .from(lots)
      .where(gt(lots.remaining, 0))
      .groupBy(lots.productId)
      .all()
      .map((r) => [r.productId, Math.round(Number(r.value))] as const),
  );
  const costOf = (p: { id: number }) => lotValue.get(p.id) ?? 0;
```
và dùng `value: costOf(p)` cho `slowAll`, `costValue: inStock.reduce((s, p) => s + costOf(p), 0)`. `sellValue`, `lowCount`, `outCount` giữ nguyên. Import `lots`, `gt`.

Cập nhật `reports.test.ts`: chạy test, nếu `costValue` đổi so với 11000 thì **tính tay** từ các lô trong kịch bản test (tồn đầu × giá vốn lúc tạo + các phiếu nhập) rồi sửa số mong đợi; ghi chú trong test vì sao.

Run: `cd server && npx vitest run src/services/reports.test.ts` → PASS.

- [ ] **Step 9: Toàn bộ test server**

Run: `cd server && npx vitest run`
Expected: PASS, trừ `overview`/`backups`/API test chưa có `expiring` (Task 5). Ghi lại các test còn đỏ.

---

### Task 5: `services/lots.ts`, route, Tổng quan, Cài đặt, khôi phục bản sao

**Files:**
- Create: `server/src/services/lots.ts`, `server/src/services/lots.test.ts`, `server/src/routes/lots.ts`
- Modify: `server/src/services/overview.ts`, `server/src/services/settings.ts` (không đổi code, chỉ test), `server/src/services/backups.ts`, `server/src/routes/index.ts`, `server/src/routes/products.ts`
- Test: `server/src/services/lots.test.ts`, `overview.test.ts`, `backups.test.ts`, `settings.test.ts`, `routes/overview-api.test.ts`, `routes/inventory-api.test.ts`

**Interfaces:**
- Produces:

```ts
export function getLot(db: DbOrTx, id: number, clock?: Clock): LotRow;                 // 404 'Không tìm thấy lô'
export function listLots(db: Db, query: LotListQuery, clock?: Clock): LotList;
export function productLots(db: DbOrTx, productId: number, clock?: Clock): ProductLot[]; // remaining > 0, FEFO
export function expiringOverview(db: Db, limit: number, clock?: Clock): Overview['expiring'];
export function disposeLot(db: Db, id: number, input: LotDispose, clock?: Clock): LotRow; // 409 'Lô đã hết hàng'
```
Route: `GET /api/lots`, `POST /api/lots/:id/dispose`, `GET /api/products/:id/lots`.

- [ ] **Step 1: Test lots (đỏ)**

```ts
// server/src/services/lots.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { importInputSchema, lotListQuerySchema, productInputSchema, settingsInputSchema } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { createTestDb } from '../db/test-db.js';
import { createImport } from './imports.js';
import { disposeLot, expiringOverview, listLots, productLots } from './lots.js';
import { createProduct, getProduct } from './products.js';
import { saveSettings } from './settings.js';

const VN = 420;
const at = (iso: string) => ({ now: new Date(iso), tzOffsetMin: VN });
const TODAY = at('2026-10-08T03:00:00.000Z'); // 10:00 ngày 8/10 giờ VN

let db: Db;
beforeEach(() => {
  db = createTestDb();
});
const product = (o: Record<string, unknown>) => createProduct(db, productInputSchema.parse(o));
// Không ghi NCC thì phải trả đủ: paid = Σ qty × unitCost
const imp = (items: { productId: number; qty: number; unitCost: number; expiresOn?: string | null }[]) =>
  createImport(db, importInputSchema.parse({ paid: items.reduce((s, i) => s + i.qty * i.unitCost, 0), items }), TODAY);
const list = (q: Record<string, unknown> = {}) => listLots(db, lotListQuerySchema.parse(q), TODAY);

/** Sữa: Tồn đầu 2 (không hạn), lô quá hạn 1/10, lô 20/10 (sắp), lô 1/1/2027 (ổn); Mì: tồn 0 không lô. */
function seed() {
  const sua = product({ name: 'Sữa tươi', unit: 'hộp', costPrice: 8000, sellPrice: 10000, stock: 2 });
  const mi = product({ name: 'Mì', costPrice: 3000, sellPrice: 4000 });
  imp([
    { productId: sua.id, qty: 3, unitCost: 9000, expiresOn: '2026-10-01' },
    { productId: sua.id, qty: 4, unitCost: 9500, expiresOn: '2026-10-20' },
    { productId: sua.id, qty: 5, unitCost: 9900, expiresOn: '2027-01-01' },
  ]);
  return { sua, mi };
}

describe('listLots', () => {
  it('mặc định chỉ lô còn hàng, quá hạn trước rồi hạn gần, không hạn cuối; summary không theo lọc trạng thái', () => {
    seed();
    const r = list();
    expect(r.lots.map((l) => [l.expiresOn, l.remaining, l.state, l.daysLeft])).toEqual([
      ['2026-10-01', 3, 'expired', -7],
      ['2026-10-20', 4, 'expiring', 12],
      ['2027-01-01', 5, 'ok', 85],
      [null, 2, 'ok', null],
    ]);
    expect(r.lots[0]).toMatchObject({ productName: 'Sữa tươi', unit: 'hộp', importCode: expect.stringMatching(/^PN-20261008-0001$/), qtyIn: 3, costPrice: 9000 });
    expect(r.lots[3]).toMatchObject({ importId: null, importCode: null });
    expect(r.summary).toEqual({ expiringCount: 1, expiredCount: 1, stockValue: 3 * 9000 + 4 * 9500 + 5 * 9900 + 2 * 8000 });
    expect(r.total).toBe(4);
  });
  it('lọc state, q (không dấu), productId; lô hết hàng chỉ hiện khi chọn empty', () => {
    const { sua } = seed();
    expect(list({ state: 'expired,expiring' }).lots.map((l) => l.expiresOn)).toEqual(['2026-10-01', '2026-10-20']);
    expect(list({ q: 'sua tuoi' }).total).toBe(4);
    expect(list({ q: 'mi' }).total).toBe(0);
    expect(list({ productId: sua.id + 1 }).total).toBe(0);
    disposeLot(db, list({ state: 'expired' }).lots[0]!.id, { note: null }, TODAY);
    expect(list().total).toBe(3);
    expect(list({ state: 'empty' }).lots).toMatchObject([{ expiresOn: '2026-10-01', remaining: 0, state: 'empty' }]);
  });
  it('ngưỡng expiryWarnDays từ cài đặt', () => {
    seed();
    saveSettings(db, settingsInputSchema.parse({ expiryWarnDays: 90 }));
    expect(list().summary.expiringCount).toBe(2);
  });
});

describe('productLots / expiringOverview / disposeLot', () => {
  it('productLots: chỉ lô dương theo FEFO', () => {
    const { sua, mi } = seed();
    expect(productLots(db, sua.id, TODAY).map((l) => l.expiresOn)).toEqual(['2026-10-01', '2026-10-20', '2027-01-01', null]);
    expect(productLots(db, mi.id, TODAY)).toEqual([]);
  });
  it('expiringOverview: đếm và cắt theo giới hạn, quá hạn trước', () => {
    seed();
    const e = expiringOverview(db, 1, TODAY);
    expect(e).toMatchObject({ count: 1, expiredCount: 1 });
    expect(e.items.map((l) => l.state)).toEqual(['expired']);
  });
  it('disposeLot: movement adjust trừ hết số còn, ghi chú có mã phiếu; lô hết → 409', () => {
    const { sua } = seed();
    const lot = list({ state: 'expired' }).lots[0]!;
    const r = disposeLot(db, lot.id, { note: 'mốc' }, TODAY);
    expect(r).toMatchObject({ remaining: 0, state: 'empty' });
    expect(getProduct(db, sua.id).stock).toBe(11);
    expect(() => disposeLot(db, lot.id, { note: null }, TODAY)).toThrow('Lô đã hết hàng');
    expect(() => disposeLot(db, 9999, { note: null }, TODAY)).toThrow('Không tìm thấy lô');
  });
});
```

- [ ] **Step 2: Viết `lots.ts`**

```ts
// server/src/services/lots.ts
import { and, asc, count, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import {
  daysLeft,
  localDate,
  lotState,
  PAGE_SIZE,
  QTY_EPS,
  shiftDate,
  type LotDispose,
  type LotList,
  type LotListQuery,
  type LotRow,
  type LotState,
  type Overview,
  type ProductLot,
} from '@tiny-pos/shared';
import type { Db, DbOrTx } from '../db/connection.js';
import { importItems, imports, lots, products } from '../db/schema.js';
import { ConflictError, NotFoundError } from '../errors.js';
import { resolveClock, type Clock } from './daily-code.js';
import { likeTerm } from './orders.js';
import { getSettings } from './settings.js';
import { recordMovement } from './stock.js';

const columns = {
  id: lots.id,
  productId: lots.productId,
  productName: products.name,
  unit: products.unit,
  image: products.image,
  importId: imports.id,
  importCode: imports.code,
  qtyIn: lots.qtyIn,
  remaining: lots.remaining,
  costPrice: lots.costPrice,
  expiresOn: lots.expiresOn,
  createdAt: lots.createdAt,
};

/** Trạng thái tính trong SQL để lọc và phân trang ở server; cùng luật với lotState (shared). */
function stateSql(today: string, warnUntil: string) {
  return sql<LotState>`case when lots.remaining <= ${QTY_EPS} then 'empty'
    when lots.expires_on is null then 'ok'
    when lots.expires_on < ${today} then 'expired'
    when lots.expires_on <= ${warnUntil} then 'expiring'
    else 'ok' end`;
}

function base(db: DbOrTx) {
  return db
    .select(columns)
    .from(lots)
    .innerJoin(products, eq(lots.productId, products.id))
    .leftJoin(importItems, eq(lots.importItemId, importItems.id))
    .leftJoin(imports, eq(importItems.importId, imports.id));
}

type Raw = Omit<LotRow, 'daysLeft' | 'state'> & { importId: number | null };

function toRow(r: Raw, today: string, warnDays: number): LotRow {
  return { ...r, daysLeft: daysLeft(r.expiresOn, today), state: lotState(r, today, warnDays) };
}

function context(db: DbOrTx, clock?: Clock) {
  const { now, tz } = resolveClock(clock);
  const today = localDate(now, tz);
  const warnDays = getSettings(db).expiryWarnDays;
  return { today, warnDays, warnUntil: shiftDate(today, warnDays) };
}

// Quá hạn trước (hạn nhỏ nhất), rồi hạn gần, không hạn cuối, mới nhất trước
const fefoOrder = [sql`${lots.expiresOn} is null`, asc(lots.expiresOn), desc(lots.id)];

export function getLot(db: DbOrTx, id: number, clock?: Clock): LotRow {
  const r = base(db).where(eq(lots.id, id)).get();
  if (!r) throw new NotFoundError('Không tìm thấy lô');
  const c = context(db, clock);
  return toRow(r, c.today, c.warnDays);
}

export function listLots(db: Db, query: LotListQuery, clock?: Clock): LotList {
  const c = context(db, clock);
  const state = stateSql(c.today, c.warnUntil);
  const term = likeTerm(query.q);
  // Viết tên bảng cứng trong sql``: drizzle bỏ tiền tố bảng khi render cột
  const scope = and(
    query.productId ? eq(lots.productId, query.productId) : undefined,
    term ? sql`vn_fold(products.name) like ${term} escape '\\'` : undefined,
  );
  const states = query.state ?? ['ok', 'expiring', 'expired'];
  const where = and(scope, inArray(state, states));
  const page = query.page ?? 1;
  const total = db.select({ n: count() }).from(lots).innerJoin(products, eq(lots.productId, products.id)).where(where).get()?.n ?? 0;
  const rows = base(db).where(where).orderBy(...fefoOrder).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE).all();
  const sum = db
    .select({
      expiring: sql<number>`sum(case when ${state} = 'expiring' then 1 else 0 end)`,
      expired: sql<number>`sum(case when ${state} = 'expired' then 1 else 0 end)`,
      value: sql<number>`coalesce(sum(case when lots.remaining > 0 then lots.remaining * lots.cost_price else 0 end), 0)`,
    })
    .from(lots)
    .innerJoin(products, eq(lots.productId, products.id))
    .where(scope)
    .get();
  return {
    lots: rows.map((r) => toRow(r, c.today, c.warnDays)),
    total,
    page,
    pageSize: PAGE_SIZE,
    summary: { expiringCount: Number(sum?.expiring ?? 0), expiredCount: Number(sum?.expired ?? 0), stockValue: Math.round(Number(sum?.value ?? 0)) },
  };
}

/** Lô còn hàng của một sản phẩm theo FEFO (hạn gần trước, không hạn cuối, cùng hạn thì cũ trước). */
export function productLots(db: DbOrTx, productId: number, clock?: Clock): ProductLot[] {
  const p = db.select({ id: products.id }).from(products).where(eq(products.id, productId)).get();
  if (!p) throw new NotFoundError('Không tìm thấy sản phẩm');
  const { today } = context(db, clock);
  return db
    .select({ id: lots.id, importCode: imports.code, remaining: lots.remaining, costPrice: lots.costPrice, expiresOn: lots.expiresOn })
    .from(lots)
    .leftJoin(importItems, eq(lots.importItemId, importItems.id))
    .leftJoin(imports, eq(importItems.importId, imports.id))
    .where(and(eq(lots.productId, productId), gt(lots.remaining, QTY_EPS)))
    .orderBy(sql`${lots.expiresOn} is null`, asc(lots.expiresOn), asc(lots.id))
    .all()
    .map((l) => ({ ...l, daysLeft: daysLeft(l.expiresOn, today) }));
}

/** Thẻ Sắp hết hạn trên Tổng quan: lô còn hàng quá hạn hoặc trong ngưỡng; items quá hạn trước, cắt theo limit. */
export function expiringOverview(db: Db, limit: number, clock?: Clock): Overview['expiring'] {
  const c = context(db, clock);
  const state = stateSql(c.today, c.warnUntil);
  const where = inArray(state, ['expired', 'expiring']);
  const items = base(db).where(where).orderBy(...fefoOrder).limit(limit).all().map((r) => toRow(r, c.today, c.warnDays));
  const n = db
    .select({ expiring: sql<number>`sum(case when ${state} = 'expiring' then 1 else 0 end)`, expired: sql<number>`sum(case when ${state} = 'expired' then 1 else 0 end)` })
    .from(lots)
    .get();
  return { count: Number(n?.expiring ?? 0), expiredCount: Number(n?.expired ?? 0), items };
}

/** Bỏ hàng (hết hạn, hỏng): một movement adjust trừ hết số còn của đúng lô đó. */
export function disposeLot(db: Db, id: number, input: LotDispose, clock?: Clock): LotRow {
  return db.transaction((tx) => {
    const lot = getLot(tx, id, clock);
    if (lot.remaining <= QTY_EPS) throw new ConflictError('Lô đã hết hàng');
    const note = `Bỏ hàng ${lot.importCode ?? 'tồn đầu'}${input.note ? `: ${input.note}` : ''}`;
    recordMovement(tx, { productId: lot.productId, qty: -lot.remaining, type: 'adjust', lotId: lot.id, note });
    return getLot(tx, id, clock);
  });
}
```

`QTY_EPS` nhúng vào SQL qua tham số: drizzle bind số `1e-9` được. Nếu `inArray(state, …)` với biểu thức `sql` gây lỗi kiểu, dùng `sql\`${state} in (${sql.join(states.map((s) => sql\`${s}\`), sql\`, \`)})\``.

Lưu ý `count()` trong `listLots` dùng cùng `where` nên phải join `products` (vì `scope` tham chiếu `products.name`).

- [ ] **Step 3: Route**

```ts
// server/src/routes/lots.ts
import { Router } from 'express';
import { lotDisposeSchema, lotListQuerySchema, type LotListQuery } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { intParam, validateBody, validateQuery } from '../middleware/validate.js';
import { disposeLot, listLots } from '../services/lots.js';

export function lotsRouter(db: Db): Router {
  const r = Router();
  r.get('/', validateQuery(lotListQuerySchema), (_req, res) => res.json(listLots(db, res.locals['query'] as LotListQuery)));
  r.post('/:id/dispose', validateBody(lotDisposeSchema), (req, res) => res.json(disposeLot(db, intParam(req, 'id'), req.body)));
  return r;
}
```

`routes/index.ts`: `import { lotsRouter } from './lots.js';` và `r.use('/lots', lotsRouter(db));` sau `/stocktakes`.
`routes/products.ts`: `import { productLots } from '../services/lots.js';` và sau route `/:id/movements`: `r.get('/:id/lots', (req, res) => res.json(productLots(db, intParam(req, 'id'))));`.

- [ ] **Step 4: Tổng quan**

`overview.ts`: import `expiringOverview` từ `./lots.js`; `OverviewLimits` thêm `expiring: number` (mặc định `OVERVIEW_LOW_STOCK_ROWS`); trong `overview()` thêm `expiring: expiringOverview(db, lim.expiring, clock),` sau `lowStock`.

`overview.test.ts` test "DB trống" thêm `expiring: { count: 0, expiredCount: 0, items: [] }` vào `toMatchObject`; `routes/overview-api.test.ts` tương tự nếu dùng `toEqual`. Thêm test:

```ts
  it('expiring: lô quá hạn và trong ngưỡng, không tính lô hết hàng', () => {
    const p = product({ name: 'Sữa', costPrice: 8000, sellPrice: 10000 });
    createImport(db, importInputSchema.parse({ paid: 27000, items: [
      { productId: p.id, qty: 1, unitCost: 9000, expiresOn: '2026-09-01' },
      { productId: p.id, qty: 1, unitCost: 9000, expiresOn: '2026-10-10' },
      { productId: p.id, qty: 1, unitCost: 9000, expiresOn: '2027-01-01' },
    ] }), NOON);
    order({ items: [{ productId: p.id, qty: 1, price: 10000 }] }); // trừ lô quá hạn 1/9 → hết
    expect(overview(db, NOON).expiring).toMatchObject({ count: 1, expiredCount: 0, items: [{ expiresOn: '2026-10-10', state: 'expiring' }] });
  });
```

- [ ] **Step 5: Cài đặt – test đọc lại**

`settings.test.ts` thêm (không cần sửa `services/settings.ts` vì schema đã `coerce`):

```ts
  it('expiryWarnDays: lưu số, DB giữ chuỗi, đọc lại ra số; chỉ có khóa này trong DB thì các khóa khác vẫn mặc định', () => {
    const db = createTestDb();
    saveSettings(db, settingsInputSchema.parse({ expiryWarnDays: 45 }));
    expect(db.select().from(settings).all()).toContainEqual({ key: 'expiryWarnDays', value: '45' });
    expect(getSettings(db).expiryWarnDays).toBe(45);
    const db2 = createTestDb();
    db2.insert(settings).values({ key: 'expiryWarnDays', value: '7' }).run();
    expect(getSettings(db2)).toEqual({ ...SETTINGS_DEFAULTS, expiryWarnDays: 7 });
  });
```

- [ ] **Step 6: Khôi phục bản sao**

`backups.ts`: import `seedOpeningLots` từ `../db/opening-lots.js`; trong `copyTables`, sau vòng `for (const t of tables)` và phần `sqlite_sequence`, trước `foreign_key_check`: 
```ts
          // Bản sao từ phiên bản chưa có lô: tạo lô Tồn đầu như migration 0008 (migration không chạy lại trên dữ liệu chép vào)
          seedOpeningLots(sqlite);
```

`backups.test.ts` thêm vào `describe('backups: khôi phục')` (import `migrate` từ `drizzle-orm/better-sqlite3/migrator`, `drizzle`, `partialMigrations` từ `../db/test-migrations.js`, `lots` từ schema, `assertLotInvariant` từ `./stock.js`; `Database` đã có):

```ts
  it('bản sao trước 0.17.0 (chưa có bảng lots) → sau khôi phục mỗi sản phẩm có tồn nhận một lô Tồn đầu', async () => {
    const snap = await svc.create('manual'); // chỉ để có tên file hợp lệ trong thư mục sao lưu
    const file = path.join(dir(), snap.name);
    fs.rmSync(file);
    const old = new Database(file);
    old.pragma('foreign_keys = ON');
    migrate(drizzle(old), { migrationsFolder: partialMigrations(8) });
    old.exec(`INSERT INTO products (id, name, stock, cost_price) VALUES (1, 'Bia cũ', 4, 9000), (2, 'Mì cũ', 0, 3000);`);
    old.close();
    await svc.restore(snap.name);
    expect(db.select({ productId: lots.productId, remaining: lots.remaining, costPrice: lots.costPrice, note: lots.note }).from(lots).all()).toEqual([
      { productId: 1, remaining: 4, costPrice: 9000, note: 'Tồn đầu' },
    ]);
    assertLotInvariant(db, 1);
  });
```
Test hiện có "restore: về đúng dữ liệu bản sao" vẫn xanh (bản sao mới đã có `lots`, `seedOpeningLots` không thêm gì vì sản phẩm đã có lô).

- [ ] **Step 7: Test API**

`routes/inventory-api.test.ts` thêm test mới trong `describe` có sẵn (dùng `call`):

```ts
  it('lô hàng: danh sách, lô của sản phẩm, bỏ hàng, lỗi', async () => {
    const p = await call('POST', '/api/products', { name: 'Sữa API', costPrice: 8000, sellPrice: 10000 });
    const im = await call('POST', '/api/imports', { paid: 9000, items: [{ productId: p.json.id, qty: 1, unitCost: 9000, expiresOn: '2026-01-01' }] });
    expect(im.status).toBe(201);
    expect(im.json.items[0].expiresOn).toBe('2026-01-01');
    const list = await call('GET', `/api/lots?productId=${p.json.id}`);
    expect(list.status).toBe(200);
    expect(list.json.lots).toMatchObject([{ productId: p.json.id, remaining: 1, expiresOn: '2026-01-01', state: 'expired' }]);
    const mine = await call('GET', `/api/products/${p.json.id}/lots`);
    expect(mine.json).toMatchObject([{ remaining: 1 }]);
    const lotId = list.json.lots[0].id;
    expect((await call('POST', `/api/lots/${lotId}/dispose`, {})).json).toMatchObject({ remaining: 0, state: 'empty' });
    expect((await call('POST', `/api/lots/${lotId}/dispose`, {})).status).toBe(409);
    expect((await call('GET', '/api/lots?state=gone')).status).toBe(400);
    expect((await call('POST', '/api/lots/9999/dispose', {})).status).toBe(404);
  });
```

- [ ] **Step 8: Chạy toàn bộ**

Run: `npm run typecheck && npm test`
Expected: `shared` và `server` PASS toàn bộ; `client`/`remote` typecheck có thể còn lỗi ở `ImportItem`/`SupplierReturnItem` chưa dùng (không có – chỉ thêm trường) → nếu typecheck client xanh thì tốt, Task 6–8 làm UI.

---

### Task 6: Client – phiếu nhập có Hạn dùng, trả NCC chọn lô

**Files:**
- Create: `client/src/components/OptionalDateField.tsx`, `client/src/api/lots.ts`, `client/src/pages/supplier-returns/LotSelect.tsx`
- Modify: `client/src/pages/imports/ImportLineRow.tsx`, `ImportLinesTable.tsx`, `ImportDetailDialog.tsx`, `client/src/pages/supplier-returns/SupplierReturnLinesTable.tsx`, `SupplierReturnDetailDialog.tsx`

**Interfaces:**
- Produces: `OptionalDateField({ value: string | null; onChange(v: string | null); 'aria-label'?; className?; placeholder? })`; `useLots(params: LotListParams)`, `useProductLots(productId: number | null)`, `useDisposeLot()`; `LotSelect({ productId, value, onChange })`.

- [ ] **Step 1: `api/lots.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LotList, LotRow, LotState, ProductLot } from '@tiny-pos/shared';
import { api, queryString } from './client';

export interface LotListParams {
  q?: string;
  productId?: number;
  state?: LotState[];
  page?: number;
}

export const useLots = (p: LotListParams) =>
  useQuery({ queryKey: ['lots', 'list', p], queryFn: () => api<LotList>(`/lots${queryString({ ...p })}`), placeholderData: (prev) => prev });

/** Lô còn hàng của một sản phẩm (ô chọn lô khi trả NCC). */
export const useProductLots = (productId: number | null) =>
  useQuery({ queryKey: ['lots', 'product', productId], queryFn: () => api<ProductLot[]>(`/products/${productId}/lots`), enabled: productId !== null });

/** Bỏ hàng đổi tồn; Tổng quan nằm dưới ['reports']. */
export function useDisposeLot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: number; note?: string }) => api<LotRow>(`/lots/${id}/dispose`, { json: { note: note ?? null } }),
    onSuccess: () => {
      for (const key of ['lots', 'products', 'reports']) void qc.invalidateQueries({ queryKey: [key] });
    },
  });
}
```

Phiếu nhập/trả NCC/hóa đơn/trả hàng/kiểm kê đổi lô: thêm `'lots'` vào danh sách invalidate của `useInvalidateImports` (`api/imports.ts`), `useInvalidateSupplierReturns` (`api/supplier-returns.ts`), và hàm tương ứng trong `api/orders.ts`, `api/returns.ts`, `api/stocktakes.ts` (mỗi chỗ thêm một phần tử vào mảng key có sẵn).

- [ ] **Step 2: `OptionalDateField`**

```tsx
// client/src/components/OptionalDateField.tsx
import { useState } from 'react';
import { CalendarDays, X } from 'lucide-react';
import { vi } from 'react-day-picker/locale';
import { formatDateVn } from '@tiny-pos/shared';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface Props {
  /** "YYYY-MM-DD" hoặc null = chưa chọn. */
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
}

const toDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
};
const toYmd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Ô ngày cho phép để trống (hạn dùng): bấm chọn trên lịch, nút × xóa. Không chặn ngày quá khứ. */
export function OptionalDateField({ value, onChange, placeholder = 'Không hạn', className, 'aria-label': ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const selected = value ? toDate(value) : undefined;
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" aria-label={ariaLabel} className={cn('h-11 flex-1 justify-start gap-2 px-3 text-base tabular-nums md:h-10', !value && 'text-muted-foreground')}>
            <CalendarDays data-icon="inline-start" className="max-sm:hidden" />
            {value ? formatDateVn(value) : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            locale={vi}
            weekStartsOn={1}
            selected={selected}
            defaultMonth={selected}
            onSelect={(d) => {
              onChange(d ? toYmd(d) : null);
              setOpen(false);
            }}
            autoFocus
          />
        </PopoverContent>
      </Popover>
      {value && (
        <Button variant="ghost" size="icon-lg" className="size-11 md:size-10" aria-label="Bỏ hạn dùng" onClick={() => onChange(null)}>
          <X />
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Cột Hạn dùng trên phiếu nhập**

`ImportLineRow.tsx`: `update` nhận thêm `'expiresOn'` trong `Pick`; thêm ô sau ô Giá bán (trước nút xóa):

```tsx
      <TableCell className="px-2 py-2">
        <OptionalDateField aria-label="Hạn dùng" value={line.expiresOn} onChange={(expiresOn) => update({ expiresOn })} className="w-44" />
      </TableCell>
```
(import `OptionalDateField`). `ImportLinesTable.tsx` thêm `<TableHead className="w-48 px-2">Hạn dùng</TableHead>` trước `<TableHead className="w-12" />`.

`ImportDetailDialog.tsx`: dòng chữ phụ thêm `{it.expiresOn && ` · HSD ${formatDateVn(it.expiresOn)}`}` (import `formatDateVn`). Mô tả hộp hủy phiếu đổi thành: `'Tồn kho được trừ lại đúng lô của phiếu (đã bán bớt thì lô âm, tự bù khi nhập tiếp); nợ nhà cung cấp trừ lại; giá vốn, giá bán giữ nguyên.'`.

- [ ] **Step 4: `LotSelect` và dòng trả NCC**

```tsx
// client/src/pages/supplier-returns/LotSelect.tsx
import { formatDateVn, formatQty, type ProductLot } from '@tiny-pos/shared';
import { useProductLots } from '@/api/lots';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const AUTO = '__auto__';

export function lotLabel(l: ProductLot): string {
  return `${l.importCode ?? 'Tồn đầu'} · ${l.expiresOn ? `HSD ${formatDateVn(l.expiresOn)}` : 'không hạn'} · còn ${formatQty(l.remaining)}`;
}

/** Chọn lô để trừ khi trả NCC; "Tự động" = hết hạn sớm trước (như bán hàng). */
export function LotSelect({ productId, value, onChange }: { productId: number; value: number | null; onChange: (lotId: number | null) => void }) {
  const { data: lots = [] } = useProductLots(productId);
  return (
    <Select value={value === null ? AUTO : String(value)} onValueChange={(v) => v !== '' && onChange(v === AUTO ? null : Number(v))}>
      <SelectTrigger aria-label="Lô" className="h-11 w-full bg-card text-base data-[size=default]:h-11 md:h-10 md:data-[size=default]:h-10">
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" sideOffset={4}>
        <SelectItem value={AUTO} className="py-2 text-base">
          Tự động (hết hạn sớm trước)
        </SelectItem>
        {lots.map((l) => (
          <SelectItem key={l.id} value={String(l.id)} className="py-2 text-base">
            {lotLabel(l)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

`SupplierReturnLinesTable.tsx` `LineRow`: thêm ô sau ô Đơn vị:

```tsx
      <TableCell className="px-2 py-2">
        <LotSelect productId={line.productId} value={line.lotId} onChange={(lotId) => dispatch({ type: 'setLot', key: line.key, lotId })} />
        {overLot && <div className="mt-0.5 text-xs text-warning">vượt số còn của lô</div>}
      </TableCell>
```
với `const { data: productLotsData = [] } = useProductLots(line.productId); const chosen = productLotsData.find((l) => l.id === line.lotId); const overLot = chosen !== undefined && line.qty * lineOption(line).factor > chosen.remaining + 1e-9;` (import `useProductLots`, `lineOption`). Header thêm `<TableHead className="w-64 px-2">Lô</TableHead>` sau Đơn vị.

`SupplierReturnDetailDialog.tsx`: chữ phụ dòng thêm `{it.lotExpiresOn && ` · lô HSD ${formatDateVn(it.lotExpiresOn)}`}`.

- [ ] **Step 5: Typecheck client**

Run: `npm run typecheck -w client`
Expected: PASS.

---

### Task 7: Client – trang Lô hàng, menu sản phẩm, Tổng quan, Cài đặt

**Files:**
- Create: `client/src/pages/lots/LotsPage.tsx`, `client/src/pages/lots/LotTable.tsx`, `client/src/pages/lots/lot-labels.ts`, `client/src/pages/overview/ExpiringList.tsx`
- Modify: `client/src/router.tsx`, `client/src/pages/products/ProductTable.tsx`, `client/src/pages/overview/OverviewPage.tsx`, `client/src/pages/overview/AlertsCard.tsx`, `client/src/pages/settings/SettingsPage.tsx`

- [ ] **Step 1: Nhãn trạng thái**

```ts
// client/src/pages/lots/lot-labels.ts
import type { LotState } from '@tiny-pos/shared';

export const LOT_STATE_LABEL: Record<LotState, string> = { ok: 'Còn hạn', expiring: 'Sắp hết hạn', expired: 'Đã hết hạn', empty: 'Hết hàng' };

/** Chữ nhỏ cạnh hạn: "còn 12 ngày" / "quá 7 ngày" / "hôm nay". */
export function daysLabel(daysLeft: number | null): string {
  if (daysLeft === null) return 'không hạn';
  if (daysLeft === 0) return 'hết hạn hôm nay';
  return daysLeft > 0 ? `còn ${daysLeft} ngày` : `quá ${-daysLeft} ngày`;
}
```

- [ ] **Step 2: `LotTable`**

```tsx
// client/src/pages/lots/LotTable.tsx
import { Trash2 } from 'lucide-react';
import { formatDateVn, formatMoney, formatQty, type LotRow } from '@tiny-pos/shared';
import { ProductAvatar } from '@/components/ProductAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { daysLabel, LOT_STATE_LABEL } from './lot-labels';

const CELL = 'px-3 py-2 md:px-4';
const NUM = `${CELL} text-right tabular-nums whitespace-nowrap`;

function ExpiryBadge({ l }: { l: LotRow }) {
  if (l.expiresOn === null) return <span className="text-muted-foreground">Không hạn</span>;
  const variant = l.state === 'expired' ? 'destructive' : l.state === 'expiring' ? 'outline' : 'secondary';
  return (
    <span className="flex flex-col items-start gap-0.5">
      <Badge variant={variant} className={cn(l.state === 'expiring' && 'border-warning text-warning')}>
        {formatDateVn(l.expiresOn)}
      </Badge>
      <span className="text-xs text-muted-foreground">{daysLabel(l.daysLeft)}</span>
    </span>
  );
}

/** Bảng lô; cột phiếu/giá vốn ẩn trên điện thoại. Nút Bỏ hàng chỉ với lô còn hàng. */
export function LotTable({ rows, onOpenImport, onDispose }: { rows: LotRow[]; onOpenImport: (importId: number) => void; onDispose: (l: LotRow) => void }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <TableHead className={CELL}>Sản phẩm</TableHead>
          <TableHead className={`${CELL} max-md:hidden`}>Phiếu nhập</TableHead>
          <TableHead className={CELL}>Hạn dùng</TableHead>
          <TableHead className={`${CELL} text-right`}>Còn</TableHead>
          <TableHead className={`${CELL} text-right max-md:hidden`}>Giá vốn</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((l) => (
          <TableRow key={l.id} className={cn(l.state === 'empty' && 'text-muted-foreground')}>
            <TableCell className={`${CELL} font-medium`}>
              <span className="flex min-w-0 items-center gap-2">
                <ProductAvatar name={l.productName} image={l.image} className="size-8 shrink-0" />
                <span className="truncate">{l.productName}</span>
              </span>
            </TableCell>
            <TableCell className={`${CELL} max-md:hidden`}>
              {l.importId !== null ? (
                <Button variant="link" className="h-auto p-0 font-mono" onClick={() => onOpenImport(l.importId!)}>
                  {l.importCode}
                </Button>
              ) : (
                <span className="text-muted-foreground">Tồn đầu</span>
              )}
            </TableCell>
            <TableCell className={CELL}>
              <ExpiryBadge l={l} />
              {l.state === 'empty' && <Badge variant="secondary" className="ml-2">{LOT_STATE_LABEL.empty}</Badge>}
            </TableCell>
            <TableCell className={cn(NUM, 'font-semibold', l.remaining < 0 && 'text-destructive')}>
              {formatQty(l.remaining)} <span className="font-normal text-muted-foreground">{l.unit}</span>
            </TableCell>
            <TableCell className={`${NUM} max-md:hidden`}>{formatMoney(l.costPrice)}</TableCell>
            <TableCell className="py-2 pr-2">
              {l.remaining > 0 && (
                <Button variant="ghost" size="icon-lg" className="size-11 text-destructive" aria-label="Bỏ hàng" title="Bỏ hàng" onClick={() => onDispose(l)}>
                  <Trash2 />
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

`border-warning`: kiểm `client/src/index.css` có token `--warning`/class `text-warning` (đã dùng ở `StatStrip`). Nếu không có `border-warning`, dùng `className="text-warning"` với `variant="outline"`.

- [ ] **Step 3: `LotsPage`**

```tsx
// client/src/pages/lots/LotsPage.tsx
import { useEffect, useState } from 'react';
import { Layers } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney, formatQty, LOT_STATES, lotListFields, type LotRow, type LotState } from '@tiny-pos/shared';
import { useDisposeLot, useLots } from '@/api/lots';
import { useProduct } from '@/api/products';
import { useConfirm } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { MultiChoiceChips } from '@/components/filters/ChoiceChips';
import { FilterBar, FilterGroup, type FilterChip } from '@/components/filters/FilterBar';
import { PageTitle } from '@/components/layout/PageTitle';
import { ListPanel } from '@/components/ListPanel';
import { Pager } from '@/components/Pager';
import { Stat, StatStrip } from '@/components/StatStrip';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Button } from '@/components/ui/button';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { ImportDetailDialog } from '../imports/ImportDetailDialog';
import { LotTable } from './LotTable';
import { LOT_STATE_LABEL } from './lot-labels';

const STATE_OPTIONS = LOT_STATES.map((s) => ({ value: s, label: LOT_STATE_LABEL[s] }));

/** Trang Lô hàng: mọi lô còn hàng (mặc định), lọc trạng thái/sản phẩm, bỏ hàng hết hạn. */
export function LotsPage() {
  const [importId, setImportId] = useState<number | null>(null);
  const { filters: f, set, clear } = useUrlFilters(lotListFields);
  const { data, isLoading } = useLots({ q: f.q, productId: f.productId, state: f.state, page: f.page });
  const { data: product } = useProduct(f.productId ?? null);
  const dispose = useDisposeLot();
  const confirm = useConfirm();

  useEffect(() => {
    if (data && data.page > 1 && !data.lots.length && data.total > 0) set({ page: Math.ceil(data.total / data.pageSize) });
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const onDispose = async (l: LotRow) => {
    const ok = await confirm({
      title: `Bỏ ${formatQty(l.remaining)} ${l.unit} ${l.productName}?`,
      description: `Trừ hết số còn của lô ${l.importCode ?? 'tồn đầu'} khỏi kho (ghi điều chỉnh "Bỏ hàng"). Không hoàn tác được.`,
      confirmText: 'Bỏ hàng',
      cancelText: 'Không',
      destructive: true,
    });
    if (!ok) return;
    dispose.mutate({ id: l.id }, { onSuccess: () => toast.success(`Đã bỏ lô ${l.importCode ?? 'tồn đầu'} của ${l.productName}`), onError: (e) => toast.error(e.message) });
  };

  const state = f.state ?? [];
  const chips: FilterChip[] = [
    ...(f.productId ? [{ key: 'product', label: `Sản phẩm: ${product?.name ?? '…'}`, onRemove: () => set({ productId: undefined }) }] : []),
    ...state.map((s) => ({ key: `st-${s}`, label: LOT_STATE_LABEL[s], onRemove: () => set({ state: state.filter((x) => x !== s) }) })),
  ];
  const activeCount = (f.productId ? 1 : 0) + (state.length ? 1 : 0);
  const filtered = activeCount > 0 || !!f.q;
  const s = data?.summary;

  return (
    <>
      <PageTitle title="Lô hàng" count={data ? `${data.total} lô` : undefined} />
      <StatStrip cols={3}>
        <Stat label="Sắp hết hạn" value={String(s?.expiringCount ?? 0)} tone={s?.expiringCount ? 'warning' : 'default'} hint="Lô còn hàng trong ngưỡng cảnh báo" />
        <Stat label="Đã hết hạn" value={String(s?.expiredCount ?? 0)} tone={s?.expiredCount ? 'danger' : 'default'} hint="Lô còn hàng đã quá hạn" />
        <Stat label="Giá trị tồn" value={formatMoney(s?.stockValue ?? 0)} hint="Σ số còn × giá vốn lô" />
      </StatStrip>
      <ListPanel
        toolbar={
          <FilterBar
            search={{ value: f.q ?? '', onChange: (q) => set({ q }), placeholder: 'Tên sản phẩm…' }}
            activeCount={activeCount}
            chips={chips}
            onClearAll={clear}
            resultLabel={`Xem ${data?.total ?? 0} lô`}
          >
            <FilterGroup label="Trạng thái">
              <MultiChoiceChips<LotState> label="Trạng thái" options={STATE_OPTIONS} value={state} onChange={(v) => set({ state: v })} />
            </FilterGroup>
          </FilterBar>
        }
        footer={data && data.total > 0 && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={(page) => set({ page })} noun="lô" />}
      >
        {isLoading ? (
          <TableSkeleton />
        ) : data?.lots.length ? (
          <LotTable rows={data.lots} onOpenImport={setImportId} onDispose={(l) => void onDispose(l)} />
        ) : filtered ? (
          <EmptyState icon={Layers} title="Không có lô khớp bộ lọc" description="Thử bỏ bớt lọc." action={<Button variant="outline" onClick={clear}>Xóa lọc</Button>} />
        ) : (
          <EmptyState icon={Layers} title="Chưa có lô nào" description="Nhập hàng bằng phiếu nhập, mỗi dòng sẽ thành một lô có hạn dùng riêng." />
        )}
      </ListPanel>
      <ImportDetailDialog id={importId} onClose={() => setImportId(null)} />
    </>
  );
}
```

- [ ] **Step 4: Route, menu, mục menu sản phẩm**

`router.tsx`: import `Layers` vào dòng import lucide có sẵn; `import { LotsPage } from './pages/lots/LotsPage';`; `NAV` thêm `{ to: '/lots', label: 'Lô hàng', icon: Layers, group: 'stock' },` ngay sau `Nhập hàng`; `<Route path="/lots" element={<LotsPage />} />` sau `/imports/new`.

`pages/products/ProductTable.tsx` `ProductMenu`: thêm `Layers` vào import lucide; sau mục *Lịch sử tồn*:
```tsx
        <DropdownMenuItem onSelect={() => navigate(`/lots?productId=${p.id}`)}>
          <Layers />
          Lô hàng
        </DropdownMenuItem>
```

- [ ] **Step 5: Tổng quan**

```tsx
// client/src/pages/overview/ExpiringList.tsx
import { CalendarClock } from 'lucide-react';
import { Link } from 'react-router';
import { formatDateVn, formatQty, type Overview } from '@tiny-pos/shared';
import { EmptyState } from '@/components/EmptyState';
import { ListPanel } from '@/components/ListPanel';
import { ProductAvatar } from '@/components/ProductAvatar';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { daysLabel } from '../lots/lot-labels';

const CELL = 'px-3 py-2 md:px-4';

/** Lô còn hàng đã/sắp hết hạn, quá hạn trước; "và n lô nữa" khi quá giới hạn. */
export function ExpiringList({ expiring, loading }: { expiring: Overview['expiring'] | undefined; loading: boolean }) {
  const total = expiring ? expiring.count + expiring.expiredCount : 0;
  const more = expiring ? total - expiring.items.length : 0;
  return (
    <ListPanel
      toolbar={
        <>
          <h2 className="text-sm font-semibold">Sắp hết hạn</h2>
          {expiring && <span className="text-sm text-muted-foreground">{total} lô</span>}
          <Button variant="outline" size="sm" className="ml-auto" asChild>
            <Link to="/lots?state=expired,expiring">Xem tất cả</Link>
          </Button>
        </>
      }
      footer={more > 0 ? <div className="border-t px-4 py-2 text-sm text-muted-foreground">và {more} lô nữa</div> : undefined}
    >
      {loading || !expiring ? (
        <TableSkeleton rows={5} />
      ) : expiring.items.length === 0 ? (
        <EmptyState icon={CalendarClock} title="Không có lô nào sắp hết hạn" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className={CELL}>Mặt hàng</TableHead>
              <TableHead className={CELL}>Hạn</TableHead>
              <TableHead className={`${CELL} text-right`}>Còn</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expiring.items.map((l) => (
              <TableRow key={l.id}>
                <TableCell className={`${CELL} font-medium`}>
                  <span className="flex min-w-0 items-center gap-2">
                    <ProductAvatar name={l.productName} image={l.image} className="size-8 shrink-0" />
                    <span className="truncate">{l.productName}</span>
                  </span>
                </TableCell>
                <TableCell className={cn(CELL, 'tabular-nums', l.state === 'expired' ? 'text-destructive' : 'text-warning')}>
                  {l.expiresOn && formatDateVn(l.expiresOn)} <span className="text-xs text-muted-foreground">{daysLabel(l.daysLeft)}</span>
                </TableCell>
                <TableCell className={`${CELL} text-right font-semibold tabular-nums`}>
                  {formatQty(l.remaining)} <span className="font-normal text-muted-foreground">{l.unit}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </ListPanel>
  );
}
```

`OverviewPage.tsx`: import và đặt `<ExpiringList expiring={data?.expiring} loading={loading} />` ngay sau `<LowStockList … />` trong lưới.

`AlertsCard.tsx` `buildAlerts`: import `CalendarClock`; sau cảnh báo *sắp hết* (`low`) thêm:
```ts
  if (o.expiring.expiredCount > 0) list.push({ key: 'expired', icon: CalendarClock, text: `${o.expiring.expiredCount} lô đã hết hạn còn trong kho`, tone: 'destructive', to: '/lots?state=expired', action: 'Xem' });
  if (o.expiring.count > 0) list.push({ key: 'expiring', icon: CalendarClock, text: `${o.expiring.count} lô sắp hết hạn`, tone: 'warning', to: '/lots?state=expiring', action: 'Xem' });
```
(`remote/src/blocks/Alerts.tsx` có `buildAlerts` riêng, **không** sửa.)

- [ ] **Step 6: Cài đặt**

`SettingsPage.tsx` thẻ *Cửa hàng*, sau `receiptFooter`:
```tsx
          <TextField
            id="st-expiry-warn"
            label="Báo hết hạn trước"
            type="number"
            inputMode="numeric"
            min={1}
            max={365}
            suffix="ngày"
            hint="Lô có hạn dùng trong khoảng này hiện ở thẻ Sắp hết hạn trên Tổng quan"
            value={form.expiryWarnDays}
            onChange={(e) => set('expiryWarnDays', Number(e.target.value) || 30)}
          />
```

- [ ] **Step 7: Typecheck và build**

Run: `npm run typecheck && npm run build`
Expected: PASS (client build ra `client/dist`).

---

### Task 8: Kiểm trên trình duyệt

**Files:** không sửa code trừ khi phát hiện lỗi.

- [ ] **Step 1: Chạy server build với DB tạm**

Run (PowerShell, từ gốc repo, sau `npm run build`):
```powershell
$env:DB_FILE = "$env:TEMP\tiny-pos-lots-test.db"; $env:PORT = "3099"; node server/dist/index.js
```
(kiểm biến `DB_FILE` trong `server/src/index.ts`; nếu tên khác thì dùng đúng tên). Nạp dữ liệu mẫu vào DB tạm nếu `npm run seed` nhận `DB_FILE`, hoặc tạo tay vài sản phẩm + phiếu nhập có hạn qua giao diện.

- [ ] **Step 2: Kiểm theo skill `browser-verify` trỏ `http://localhost:3099` (được phép ghi vì là DB tạm), cỡ máy tính và điện thoại**

- `/imports/new`: thêm dòng, cột **Hạn dùng** hiện "Không hạn", chọn ngày → hiện dd/mm/yyyy, nút × xóa; lưu phiếu → chi tiết phiếu có `· HSD …`.
- `/lots`: 3 ô số liệu; bảng quá hạn trước; chip lọc trạng thái, chip sản phẩm khi vào từ menu sản phẩm (`/lots?productId=`); bấm mã phiếu mở chi tiết; nút Bỏ hàng → hộp xác nhận → số còn về 0, lô biến mất khỏi mặc định, hiện khi chọn *Hết hàng*.
- `/products`: menu ⋯ có *Lô hàng* dẫn tới `/lots?productId=…`.
- `/supplier-returns/new`: dòng có ô **Lô** mặc định "Tự động…", chọn lô có hạn, tăng số lượng quá số còn → chữ cảnh báo; lưu → chi tiết hiện `· lô HSD …`.
- `/overview`: thẻ *Sắp hết hạn* và dòng cảnh báo trong *Cần chú ý* (tạo một phiếu nhập hạn trong quá khứ để thấy đỏ).
- `/settings`: ô *Báo hết hạn trước* lưu được; đổi 90 → Tổng quan đếm nhiều hơn.
- `/pos` và `/sell`: bán sản phẩm có nhiều lô, kiểm `/lots` thấy lô hạn gần trừ trước; Báo cáo lãi lỗ dùng giá vốn lô (so với `/orders` chi tiết dòng).

Chụp màn hình trang `/lots` và `/overview` ở hai cỡ, lưu vào scratchpad. Sửa lỗi phát hiện rồi lặp lại bước này.

- [ ] **Step 3: Dừng server, xóa DB tạm**

---

### Task 9: Phiên bản, tài liệu, kiểm tra, commit

**Files:**
- Modify: `package.json` (gốc), `README.md`, `CLAUDE.md`, `.claude/rules/database.md`

- [ ] **Step 1: Version `0.17.0`** trong `package.json` gốc (`"version": "0.17.0"`).

- [ ] **Step 2: README** – thêm trước mục *Kiểm thử thủ công Giai đoạn 1* một mục ngắn cho chủ tiệm và cuối file một mục kiểm thử:

```markdown
## Lô hàng và hạn sử dụng (0.17.0)

- Mỗi dòng trên phiếu nhập là một **lô**: ghi hạn dùng ở cột *Hạn dùng* (để trống nếu hàng không có hạn).
- Khi bán, phần mềm tự trừ lô **hết hạn sớm nhất trước**; lãi lỗ tính theo giá nhập thật của lô đã bán.
- Trang **Kho hàng → Lô hàng** liệt kê lô còn hàng, lọc *Sắp hết hạn* / *Đã hết hạn*; nút thùng rác để **bỏ hàng** hết hạn.
- Tổng quan có thẻ *Sắp hết hạn*; đổi ngưỡng ngày ở *Cài đặt → Cửa hàng → Báo hết hạn trước*.
- Trả hàng cho nhà cung cấp có thể chọn đúng lô cần trả.
```

```markdown
## Kiểm thử thủ công – Lô hàng & hạn sử dụng 0.17.0

1. Nhập 2 dòng cùng sản phẩm, một dòng có hạn gần, một không hạn → `/lots` hiện 2 lô (+ lô Tồn đầu nếu sản phẩm đã có tồn).
2. Bán quá số lô hạn gần → lô đó về 0 trước, lô không hạn bị trừ tiếp; chi tiết hóa đơn có giá vốn bình quân.
3. Hủy hóa đơn → các lô cộng lại đúng số đã trừ.
4. Hủy phiếu nhập đã bán bớt → lô âm; nhập lại → lô âm về 0, lô mới nhận phần dư.
5. Bỏ hàng lô hết hạn → tồn giảm, lịch sử tồn có dòng "Bỏ hàng PN-…".
6. Khôi phục bản sao cũ (trước 0.17.0) → mỗi sản phẩm có tồn có một lô Tồn đầu.
```

- [ ] **Step 3: CLAUDE.md và rule database**

CLAUDE.md: cuối danh sách *Đã xong* thêm: `Lô hàng & hạn sử dụng 0.17.0 (bảng `lots`/`lot_movements`, mỗi dòng nhập một lô có `expires_on`; `recordMovement` tách movement theo lô: xuất FEFO qua `shared/lot-math.ts`, nhập bù lô âm, hủy đảo theo `reverseOf`; giá vốn dòng hóa đơn từ lô đã trừ; `services/lots.ts`, trang `/lots`, thẻ Sắp hết hạn, `settings.expiryWarnDays`; khôi phục bản sao cũ tạo lô Tồn đầu qua `seedOpeningLots`)`.

Bất biến nghiệp vụ thêm: `- **Lô hàng** chỉ đổi qua `recordMovement`: Σ `lots.remaining` của một sản phẩm = `products.stock`; xuất trừ lô hết hạn sớm nhất trước (không hạn cuối), thiếu thì âm vào lô cuối; cộng bù lô âm trước; hủy chứng từ đảo đúng lô (`reverseOf`); giá vốn dòng hóa đơn = bình quân lô đã trừ (`lineCostPrice`), `products.cost_price` vẫn là giá nhập gần nhất.`

Dòng Migration: `DB dev đã chạy tới `0008``. `.claude/rules/database.md`: `0000`–`0008`, tiếp theo `0009`.

- [ ] **Step 4: Chạy skill `check`** (typecheck, test, build client, soát diff không format lại file cũ). Xem `git diff --stat`; file cũ có số dòng đổi lớn bất thường (`schema.ts`, `stock.ts` là hợp lý) thì mở kiểm.

- [ ] **Step 5: Commit một lần**

```bash
git add -A
git commit -m "feat: lô hàng 0.17.0 – mỗi dòng nhập một lô, bán trừ lô hết hạn sớm trước, giá vốn theo lô, hạn sử dụng và trang Lô hàng

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
(`data/` không trong git nên `git add -A` an toàn; kiểm `git status` trước.)
