# Giai đoạn 8 – Trả hàng nhà cung cấp và in tem mã vạch (0.12.0) – Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chủ tiệm lập phiếu trả hàng cho nhà cung cấp `TN-YYYYMMDD-NNNN` (trừ tồn, trừ nợ NCC trước, phần dư NCC trả tiền mặt, hủy được) và in tem mã vạch ra máy in decal riêng, tự cấp mã EAN-13 nội bộ `20…` cho hàng chưa có mã.

**Architecture:** Hai bảng mới `supplier_returns` + `supplier_return_items` (migration `0005`, chỉ thêm bảng). Logic thuần ở `shared/` (`ean.ts`, `labels.ts`, `supplier-return-math.ts`, `supplier-return-draft.ts`), client dùng để hiện trước, server tính lại khi lưu. Server `services/supplier-returns.ts` (lập/xem/hủy/lọc/xuất) và `services/labels.ts` (cấp mã, dựng URL trang in); cửa sổ in tem mở bằng `label-window.ts` (spawn Chrome/Edge hồ sơ riêng `data/label-browser`, không `--kiosk-printing`), chỉ gắn ở bản build trên Windows. Client: màn lập phiếu + trang danh sách Trả NCC, trang In tem, trang in `/labels/print` ngoài `AppShell` (vẽ tem vào `#print-root`, `@page label` theo khổ trong Cài đặt).

**Tech Stack:** TypeScript ESM, Express 5, drizzle-orm + better-sqlite3, zod 4, vitest, exceljs (đã có), React 19 + TanStack Query 5 + react-router 7, shadcn/ui, lucide-react, **`jsbarcode`** (thư viện mới duy nhất, chỉ ở `client`).

**Spec:** `docs/superpowers/specs/2026-10-01-tiny-pos-supplier-returns-labels-design.md`

## Global Constraints

- Text UI, thông báo lỗi API, comment code, commit message: **tiếng Việt**.
- **Không format lại file có sẵn**: diff chỉ chứa dòng cần đổi; không chạy prettier/eslint; theo phong cách xung quanh (2 space, nháy đơn, có `;`, dòng ≤ ~130 ký tự). Không sắp xếp lại import của code không liên quan; thêm tên vào dòng import có sẵn là được.
- **Git**: làm trên `master`, **không commit từng task**; cả đợt là **một commit** ở Task 7: `feat: trả hàng NCC và in tem mã vạch 0.12.0 – phiếu TN, trừ nợ NCC, cấp mã EAN-13 nội bộ, cửa sổ in tem riêng`.
- **Tiền** số nguyên đồng, trần `MAX_MONEY` (1 tỷ); **số lượng** là số thực theo đơn vị đã chọn; tồn đổi theo `qty × factor` (đơn vị gốc).
- Tồn chỉ đổi qua `recordMovement`, nợ NCC chỉ qua `recordSupplierTx`, **cùng transaction** với phiếu. Lập phiếu: movement `supplier_return` `−qty × factor`, note `Trả NCC TN-…`; sổ nợ NCC `−debtReduced`, note `Trả NCC TN-…`. Hủy: movement `adjust` `+qty × factor`, note `Hủy phiếu trả NCC TN-…`; sổ nợ `+debtReduced`, cùng note.
- Trả NCC **không đổi giá vốn**, **không** vào `daySummary`/báo cáo lãi lỗ.
- Mã nội bộ: `'20' + seq (10 chữ số) + số kiểm tra`, `seq` = lớn nhất trong các mã `20…` 13 số hợp lệ ở `products` + `product_units`, cộng 1. Không ghi đè mã đã có.
- Migration mới là `0005`, **chỉ thêm bảng**; không sửa migration `0000`–`0004`.
- Thư viện mới **chỉ** `jsbarcode` ở `client` (kèm `@types/jsbarcode` nếu gói không có sẵn kiểu). Server không thêm gì.
- UI dùng component có sẵn (`PageTitle`, `StatStrip`/`Stat`, `ListPanel`, `FilterBar`/`FilterGroup`, `DateRangeFilter`, `MultiChoiceChips`, `ToolbarSelect`, `SelectField`, `Pager`, `EmptyState`, `TableSkeleton`, `CommitInput`, `ConfirmDialog`, `MoneyLine`, `ProductSearch`, shadcn `Dialog`/`Badge`/`Button`/`Input`/`Table`/`Select`/`Switch`/`Card`/`DropdownMenu`), icon lucide-react, màu từ token (`text-warning`, `text-destructive`, `text-muted-foreground`). Không viết mã màu trong trang; trang in tem/phiếu in dùng đen trắng `#000`/`#fff` như `Receipt.tsx`.
- Mạng công ty chặn TLS: lệnh npm cần `NODE_EXTRA_CA_CERTS=<repo>/.certs/corp-root.pem`; **không bao giờ** tắt kiểm tra TLS.
- Không dùng/kill cổng 5173/5174; kiểm trên trình duyệt **không ghi** vào `data/grocery.db` (skill `browser-verify`: chặn POST, stub GET). Server dev khởi động lại sẽ tự chạy migration `0005` trên DB dev (chỉ tạo hai bảng rỗng): việc bình thường, ghi vào CLAUDE.md.
- Chạy test/typecheck từ **gốc repo** (`npm test`, `npm run typecheck`) để `shared` được build trước. Một file server: `npm run build -w shared` (nếu vừa sửa shared) rồi `cd server && npx vitest run <file>`. Một file shared: `cd shared && npx vitest run <file>`.

## Review Focus

1. **Hủy phiếu đã trừ nợ của NCC vừa bị xóa** (xóa NCC chỉ được khi nợ 0, nên sau khi trả hàng trừ hết nợ thì xóa được) → hủy phải bị chặn 409, không để nợ treo trên NCC đã xóa; phiếu không trừ nợ thì vẫn hủy được → test ở Task 2.
2. **Trả hàng khi NCC đang nợ ngược tiệm** (nợ âm) hoặc nợ 0 → toàn bộ là NCC trả tiền mặt, nợ không bị đẩy âm thêm → test `splitSupplierRefund` ở Task 1 và "NCC nợ 0" ở Task 2.
3. **Mã vạch nhập tay trùng dải 20…** (một sản phẩm đã có mã `2000000000046` gõ tay, hoặc mã `20…` sai số kiểm tra / không đủ 13 số) → mã cấp mới nối tiếp sau mã hợp lệ lớn nhất, không đụng mã đã có, mã sai định dạng bị bỏ qua → test ở Task 3.
4. **In tem cho cùng một sản phẩm hai dòng / sản phẩm vừa được cấp mã** (bấm in lần hai) → không cấp mã lần nữa, URL trang in giữ nguyên số tem → test "gọi lại không đổi mã" ở Task 3.
5. **Trang in tem trên giấy decal**: `@page label` đúng khổ chọn, mỗi tem (hoặc mỗi hàng 2 tem) một trang, hóa đơn 80mm vẫn in khổ cũ → kiểm bằng PDF Chrome ở Task 7 (`page.pdf({ preferCSSPageSize: true })`, đo kích thước trang).

---

## Cấu trúc file

| File | Việc |
|---|---|
| `shared/src/ean.ts` (mới) + `ean.test.ts` (mới) | `eanCheckDigit`, `isValidEan13`, `isValidEan8`, `internalEan13`, `internalSeq`, `barcodeFormat`, `INTERNAL_MAX_SEQ` |
| `shared/src/labels.ts` (mới) + `labels.test.ts` (mới) | `LABEL_SIZES`, `LabelSize`, `LABEL_LAYOUT`, `MAX_LABELS`, `LabelItemRef`, `formatLabelItems`, `parseLabelItems`, `importLabelRefs`, `SAMPLE_LABEL_CODE` |
| `shared/src/supplier-return-math.ts` (mới) | `splitSupplierRefund` |
| `shared/src/supplier-return-draft.ts` (mới) + `supplier-return-draft.test.ts` (mới) | nháp phiếu trả NCC: reducer, tổng, body gửi, đọc localStorage, `overStock` |
| `shared/src/schemas/supplier-return.ts` (mới), `schemas/label.ts` (mới) | `supplierReturnInputSchema`, `labelPrintInputSchema` |
| `shared/src/schemas/list-filters.ts` (sửa) | `supplierReturnListFields`, `supplierReturnListQuerySchema`, `SupplierReturnListQuery` |
| `shared/src/schemas/settings.ts` (sửa) | `labelSize`, `labelShowPrice` |
| `shared/src/types.ts` (sửa) | `MovementType` thêm `supplier_return`; types phiếu trả NCC, `LabelPrintResult` |
| `shared/src/index.ts` (sửa) | export module mới |
| `server/src/db/schema.ts` (sửa) | bảng `supplier_returns`, `supplier_return_items`; enum `stock_movements.type` |
| `server/drizzle/0005_*.sql` + `meta/` (sinh) | migration |
| `server/src/db/migration-0005.test.ts` (mới) | dữ liệu cũ còn nguyên |
| `server/src/services/stock.ts`, `daily-code.ts`, `movements.ts`, `settings.ts` (sửa) | loại movement, bảng mã, `TN` trong `CODE_IN_NOTE`, đọc `labelShowPrice` |
| `server/src/services/supplier-returns.ts` (mới) + `supplier-returns.test.ts` (mới) | lập/xem/hủy/lọc/xuất |
| `server/src/services/labels.ts` (mới) + `labels.test.ts` (mới) | `assignBarcodes`, `printLabels`, `printSampleLabel`, `LabelDeps`, `NO_LABEL_WINDOW` |
| `server/src/label-window.ts` (mới) + `label-window.test.ts` (mới) | `findBrowser`, `createLabelOpener` |
| `server/src/services/exports.ts` (sửa) | `exportSupplierReturnsXlsx` |
| `server/src/routes/supplier-returns.ts`, `routes/labels.ts` (mới), `routes/index.ts`, `app.ts`, `index.ts` (sửa) | API + gắn cửa sổ in tem |
| `server/src/routes/supplier-returns-api.test.ts` (mới) | API trả NCC + in tem |
| `client/src/api/supplier-returns.ts`, `api/labels.ts` (mới) | hook |
| `client/src/components/UnitSelect.tsx` (mới), `pages/imports/ImportLineRow.tsx`, `SupplierPicker.tsx` (sửa) | tách ô chọn đơn vị; `allowNone` |
| `client/src/components/receipt/receipt-data.ts`, `Receipt.tsx`, `PrintProvider.tsx` (sửa) | phiếu in trả NCC |
| `client/src/pages/supplier-returns/*` (mới) | `useSupplierReturnDraft`, `SupplierReturnLinesTable`, `SupplierReturnFooter`, `SupplierReturnFormPage`, `SupplierReturnTable`, `SupplierReturnDetailDialog`, `SupplierReturnsPage` |
| `client/src/pages/labels/*` (mới) | `LabelSheet`, `LabelPrintPage`, `LabelsPage` |
| `client/src/router.tsx`, `App.tsx` (sửa) | menu, route, trang in ngoài khung |
| `client/src/pages/suppliers/SupplierDetailDialog.tsx`, `products/StockHistoryDialog.tsx`, `products/ProductTable.tsx`, `imports/ImportDetailDialog.tsx`, `settings/SettingsPage.tsx` (sửa) | nút Trả hàng, nhãn Trả NCC, In tem, thẻ Tem mã vạch |
| `client/package.json` (sửa) | `jsbarcode` |
| `package.json`, `README.md`, `CLAUDE.md`, `.claude/rules/database.md` (sửa) | 0.12.0, tài liệu |

---

### Task 1: Shared – mã EAN, tem, tiền trả NCC, nháp phiếu, schema, types

**Files:**
- Create: `shared/src/ean.ts`, `shared/src/ean.test.ts`, `shared/src/labels.ts`, `shared/src/labels.test.ts`, `shared/src/supplier-return-math.ts`, `shared/src/supplier-return-draft.ts`, `shared/src/supplier-return-draft.test.ts`, `shared/src/schemas/supplier-return.ts`, `shared/src/schemas/label.ts`
- Modify: `shared/src/schemas/list-filters.ts` (thêm sau khối `returnListQuerySchema`), `shared/src/schemas/settings.ts`, `shared/src/types.ts` (dòng `MovementType` + thêm cuối file), `shared/src/index.ts`

**Interfaces:**
- Produces: `eanCheckDigit(body12: string): number`, `isValidEan13(code)`, `isValidEan8(code)`, `internalEan13(seq: number): string`, `internalSeq(code: string): number | null`, `barcodeFormat(code): 'EAN13' | 'EAN8' | 'CODE128'`, `INTERNAL_MAX_SEQ`; `LABEL_SIZES`, `LabelSize`, `LABEL_LAYOUT: Record<LabelSize, { pageW; pageH; labelW; labelH; cols; label }>`, `MAX_LABELS = 500`, `LabelItemRef { productId; unitId: number | null; copies }`, `formatLabelItems(refs): string`, `parseLabelItems(s: string | null): LabelItemRef[]`, `importLabelRefs(items: { productId; qty; factor }[]): LabelItemRef[]`, `SAMPLE_LABEL_CODE = '2000000000015'`; `splitSupplierRefund(total, supplierDebt) → { debtReduced, cashReceived }`; `SupplierReturnDraft`, `SupplierReturnLine`, `SupplierReturnAction`, `EMPTY_SUPPLIER_RETURN_DRAFT`, `supplierReturnDraftReducer`, `supplierReturnTotals(d, supplierDebt)`, `toSupplierReturnInput(d, supplierId)`, `parseSupplierReturnDraft(raw)`, `lineOption(l)`, `overStock(l)`; `supplierReturnInputSchema`/`SupplierReturnInput`/`SupplierReturnInputBody`; `labelPrintInputSchema`/`LabelPrintInput`/`LabelPrintInputBody`; `supplierReturnListFields`/`supplierReturnListQuerySchema`/`SupplierReturnListQuery`; `Settings.labelSize`, `Settings.labelShowPrice`; types `SupplierReturnItem`, `SupplierReturnSummary`, `SupplierReturnDetail`, `SupplierReturnTotals`, `SupplierReturnList`, `LabelPrintResult`; `MovementType` có `'supplier_return'`.

- [ ] **Step 1: Viết test `shared/src/ean.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { barcodeFormat, eanCheckDigit, internalEan13, internalSeq, isValidEan13, isValidEan8 } from './ean.js';

describe('số kiểm tra EAN', () => {
  it('đúng với mã EAN-13 và EAN-8 thật', () => {
    expect(eanCheckDigit('400638133393')).toBe(1);
    expect(isValidEan13('4006381333931')).toBe(true);
    expect(isValidEan13('4006381333932')).toBe(false);
    expect(isValidEan8('96385074')).toBe(true);
    expect(isValidEan8('96385075')).toBe(false);
  });

  it('chỉ nhận đúng 12 chữ số', () => {
    expect(() => eanCheckDigit('12345')).toThrow();
    expect(() => eanCheckDigit('40063813339a')).toThrow();
  });
});

describe('mã nội bộ 20…', () => {
  it('đệm 10 chữ số, thêm số kiểm tra, hợp lệ EAN-13', () => {
    expect(internalEan13(1)).toBe('2000000000015');
    expect(internalEan13(4)).toBe('2000000000046');
    expect(isValidEan13(internalEan13(9_999_999_999))).toBe(true);
    expect(() => internalEan13(0)).toThrow();
    expect(() => internalEan13(10_000_000_000)).toThrow();
  });

  it('đọc lại số thứ tự; mã ngoài dải, sai số kiểm tra hoặc sai độ dài trả null', () => {
    expect(internalSeq('2000000000046')).toBe(4);
    expect(internalSeq('2000000000047')).toBeNull();
    expect(internalSeq('8934567890128')).toBeNull();
    expect(internalSeq('200000000004')).toBeNull();
  });
});

describe('barcodeFormat', () => {
  it('EAN-13 / EAN-8 hợp lệ, còn lại CODE128', () => {
    expect(barcodeFormat('4006381333931')).toBe('EAN13');
    expect(barcodeFormat('96385074')).toBe('EAN8');
    expect(barcodeFormat('4006381333932')).toBe('CODE128');
    expect(barcodeFormat('SP-001')).toBe('CODE128');
  });
});
```

- [ ] **Step 2: Viết test `shared/src/labels.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { formatLabelItems, importLabelRefs, MAX_LABELS, parseLabelItems } from './labels.js';

describe('chuỗi tem trên URL', () => {
  it('đi rồi về giữ nguyên; đơn vị gốc ghi 0', () => {
    const refs = [
      { productId: 12, unitId: null, copies: 3 },
      { productId: 15, unitId: 4, copies: 10 },
    ];
    expect(formatLabelItems(refs)).toBe('12.0x3,15.4x10');
    expect(parseLabelItems('12.0x3,15.4x10')).toEqual(refs);
  });

  it('bỏ phần hỏng, số tem 0 hoặc quá MAX_LABELS; rỗng/null ra mảng rỗng', () => {
    expect(parseLabelItems('12.0x3,abc,0.0x1,7.0x0,8.0x' + (MAX_LABELS + 1))).toEqual([{ productId: 12, unitId: null, copies: 3 }]);
    expect(parseLabelItems('')).toEqual([]);
    expect(parseLabelItems(null)).toEqual([]);
  });
});

describe('importLabelRefs', () => {
  it('quy về đơn vị gốc, cộng dòng trùng sản phẩm; số lẻ (hàng cân) ra 1 tem; chặn trần', () => {
    expect(
      importLabelRefs([
        { productId: 1, qty: 2, factor: 24 },
        { productId: 1, qty: 3, factor: 1 },
        { productId: 2, qty: 2.5, factor: 1 },
        { productId: 3, qty: 30, factor: 24 },
      ]),
    ).toEqual([
      { productId: 1, unitId: null, copies: 51 },
      { productId: 2, unitId: null, copies: 1 },
      { productId: 3, unitId: null, copies: MAX_LABELS },
    ]);
  });
});
```

- [ ] **Step 3: Viết test `shared/src/supplier-return-draft.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { splitSupplierRefund } from './supplier-return-math.js';
import {
  EMPTY_SUPPLIER_RETURN_DRAFT,
  overStock,
  parseSupplierReturnDraft,
  supplierReturnDraftReducer as reduce,
  supplierReturnTotals,
  toSupplierReturnInput,
  type SupplierReturnDraft,
} from './supplier-return-draft.js';
import type { ProductWithUnits } from './types.js';

const beer: ProductWithUnits = {
  id: 1,
  barcode: '893',
  name: 'Bia Tiger',
  unit: 'lon',
  costPrice: 10000,
  sellPrice: 12000,
  stock: 30,
  isWeighed: false,
  categoryId: null,
  minStock: 0,
  isActive: true,
  createdAt: '',
  updatedAt: '',
  categoryName: null,
  units: [{ id: 7, productId: 1, name: 'Thùng', barcode: '894', factor: 24, sellPrice: 280000 }],
};
const add = (d: SupplierReturnDraft, unitId: number | null = null) => reduce(d, { type: 'add', product: beer, unitId });

describe('splitSupplierRefund', () => {
  it('trừ nợ hiện tại trước, phần dư NCC trả tiền mặt; nợ 0 hoặc âm thì tiền mặt hết', () => {
    expect(splitSupplierRefund(30000, 50000)).toEqual({ debtReduced: 30000, cashReceived: 0 });
    expect(splitSupplierRefund(30000, 10000)).toEqual({ debtReduced: 10000, cashReceived: 20000 });
    expect(splitSupplierRefund(30000, 0)).toEqual({ debtReduced: 0, cashReceived: 30000 });
    expect(splitSupplierRefund(30000, -5000)).toEqual({ debtReduced: 0, cashReceived: 30000 });
  });
});

describe('supplierReturnDraftReducer', () => {
  it('thêm dòng: giá trả mặc định = giá vốn × hệ số; thêm lại cùng đơn vị thì +1', () => {
    let d = add(EMPTY_SUPPLIER_RETURN_DRAFT, 7);
    expect(d.lines).toMatchObject([{ productId: 1, unitId: 7, qty: 1, unitPrice: 240000, stock: 30, baseUnit: 'lon' }]);
    d = add(d, 7);
    expect(d.lines).toHaveLength(1);
    expect(d.lines[0]!.qty).toBe(2);
  });

  it('đổi đơn vị tính lại giá trả; sửa số lượng ≤ 0 thì xóa dòng; giá làm tròn, không âm', () => {
    let d = add(EMPTY_SUPPLIER_RETURN_DRAFT, 7);
    const key = d.lines[0]!.key;
    d = reduce(d, { type: 'setUnit', key, unitId: null });
    expect(d.lines[0]).toMatchObject({ unitId: null, unitPrice: 10000 });
    d = reduce(d, { type: 'update', key, patch: { unitPrice: -5 } });
    expect(d.lines[0]!.unitPrice).toBe(0);
    d = reduce(d, { type: 'update', key, patch: { unitPrice: 8999.6 } });
    expect(d.lines[0]!.unitPrice).toBe(9000);
    expect(reduce(d, { type: 'update', key, patch: { qty: 0 } }).lines).toEqual([]);
  });

  it('cảnh báo trả quá tồn theo đơn vị gốc', () => {
    const d = add(EMPTY_SUPPLIER_RETURN_DRAFT, 7); // 1 thùng = 24 lon, tồn 30
    expect(overStock(d.lines[0]!)).toBe(false);
    const d2 = reduce(d, { type: 'update', key: d.lines[0]!.key, patch: { qty: 2 } });
    expect(overStock(d2.lines[0]!)).toBe(true);
  });

  it('tổng, chia trừ nợ / tiền mặt, body gửi lên', () => {
    let d = add(EMPTY_SUPPLIER_RETURN_DRAFT, null);
    d = reduce(d, { type: 'update', key: d.lines[0]!.key, patch: { qty: 3 } });
    d = reduce(d, { type: 'setNote', note: '  Hết hạn ' });
    expect(supplierReturnTotals(d, 20000)).toEqual({ total: 30000, debtReduced: 20000, cashReceived: 10000 });
    expect(toSupplierReturnInput(d, 5)).toEqual({ supplierId: 5, note: 'Hết hạn', items: [{ productId: 1, unitId: null, qty: 3, unitPrice: 10000 }] });
  });

  it('đọc nháp hỏng ra phiếu trống; clear về trống', () => {
    expect(parseSupplierReturnDraft('{"x":1')).toEqual(EMPTY_SUPPLIER_RETURN_DRAFT);
    expect(parseSupplierReturnDraft(null)).toEqual(EMPTY_SUPPLIER_RETURN_DRAFT);
    const d = add(EMPTY_SUPPLIER_RETURN_DRAFT);
    expect(parseSupplierReturnDraft(JSON.stringify(d))).toEqual(d);
    expect(reduce(d, { type: 'clear' })).toEqual(EMPTY_SUPPLIER_RETURN_DRAFT);
  });
});
```

- [ ] **Step 4: Chạy để thấy fail**

Run: `cd shared && npx vitest run src/ean.test.ts src/labels.test.ts src/supplier-return-draft.test.ts`
Expected: FAIL – không tìm thấy module `./ean.js`, `./labels.js`, `./supplier-return-math.js`, `./supplier-return-draft.js`.

- [ ] **Step 5: Viết `shared/src/ean.ts`**

```ts
/** Mã nội bộ: 10 chữ số thứ tự sau tiền tố 20 (dải EAN dành cho cửa hàng tự dùng). */
export const INTERNAL_MAX_SEQ = 9_999_999_999;
const INTERNAL_RE = /^20\d{11}$/;

/** Số kiểm tra EAN: tính từ phải sang, chữ số sát số kiểm tra nhân 3, xen kẽ nhân 1. */
function checkDigit(body: string): number {
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const d = Number(body[body.length - 1 - i]);
    sum += i % 2 === 0 ? d * 3 : d;
  }
  return (10 - (sum % 10)) % 10;
}

export function eanCheckDigit(body12: string): number {
  if (!/^\d{12}$/.test(body12)) throw new RangeError('Cần đúng 12 chữ số');
  return checkDigit(body12);
}

export const isValidEan13 = (code: string): boolean => /^\d{13}$/.test(code) && checkDigit(code.slice(0, 12)) === Number(code[12]);
export const isValidEan8 = (code: string): boolean => /^\d{8}$/.test(code) && checkDigit(code.slice(0, 7)) === Number(code[7]);

/** Mã EAN-13 nội bộ thứ `seq` (1 … INTERNAL_MAX_SEQ). */
export function internalEan13(seq: number): string {
  if (!Number.isInteger(seq) || seq < 1 || seq > INTERNAL_MAX_SEQ) throw new RangeError('Số thứ tự mã nội bộ không hợp lệ');
  const body = `20${String(seq).padStart(10, '0')}`;
  return body + checkDigit(body);
}

/** Số thứ tự của một mã nội bộ hợp lệ; mã khác trả null. */
export function internalSeq(code: string): number | null {
  return INTERNAL_RE.test(code) && isValidEan13(code) ? Number(code.slice(2, 12)) : null;
}

export type BarcodeFormat = 'EAN13' | 'EAN8' | 'CODE128';

/** Kiểu vạch để vẽ tem: mã EAN hợp lệ vẽ đúng chuẩn EAN, còn lại Code128 (nhận mọi ký tự ASCII). */
export function barcodeFormat(code: string): BarcodeFormat {
  if (isValidEan13(code)) return 'EAN13';
  if (isValidEan8(code)) return 'EAN8';
  return 'CODE128';
}
```

- [ ] **Step 6: Viết `shared/src/labels.ts`**

```ts
export const LABEL_SIZES = ['40x30', '50x30', '35x22x2'] as const;
export type LabelSize = (typeof LABEL_SIZES)[number];

/** Khổ trang in (mm), khổ một tem và số tem trên một hàng của cuộn decal. */
export const LABEL_LAYOUT: Record<LabelSize, { pageW: number; pageH: number; labelW: number; labelH: number; cols: number; label: string }> = {
  '40x30': { pageW: 40, pageH: 30, labelW: 40, labelH: 30, cols: 1, label: '40 × 30 mm' },
  '50x30': { pageW: 50, pageH: 30, labelW: 50, labelH: 30, cols: 1, label: '50 × 30 mm' },
  '35x22x2': { pageW: 72, pageH: 22, labelW: 35, labelH: 22, cols: 2, label: '35 × 22 mm, 2 tem/hàng (cuộn 72 mm)' },
};

/** Tối đa số tem mỗi lần in. */
export const MAX_LABELS = 500;
/** Mã của tem mẫu (In thử) – mã nội bộ thứ 1. */
export const SAMPLE_LABEL_CODE = '2000000000015';

export interface LabelItemRef {
  productId: number;
  /** null = đơn vị gốc. */
  unitId: number | null;
  copies: number;
}

/** "12.0x3,15.4x10": sản phẩm.đơn vị (0 = gốc) x số tem; dùng cho ?i= của trang in và ?add= của trang In tem. */
export const formatLabelItems = (refs: LabelItemRef[]): string => refs.map((r) => `${r.productId}.${r.unitId ?? 0}x${r.copies}`).join(',');

export function parseLabelItems(s: string | null): LabelItemRef[] {
  if (!s) return [];
  const out: LabelItemRef[] = [];
  for (const part of s.split(',')) {
    const m = /^(\d+)\.(\d+)x(\d+)$/.exec(part.trim());
    if (!m) continue;
    const [productId, unitId, copies] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (productId < 1 || copies < 1 || copies > MAX_LABELS) continue;
    out.push({ productId, unitId: unitId || null, copies });
  }
  return out;
}

/** Tem cho các dòng phiếu nhập: quy về đơn vị gốc, cộng dòng cùng sản phẩm; số lẻ (hàng cân) thì 1 tem. */
export function importLabelRefs(items: { productId: number; qty: number; factor: number }[]): LabelItemRef[] {
  const total = new Map<number, number>();
  for (const it of items) total.set(it.productId, (total.get(it.productId) ?? 0) + it.qty * it.factor);
  return [...total].map(([productId, n]) => {
    const whole = Math.abs(n - Math.round(n)) < 1e-9;
    return { productId, unitId: null, copies: Math.min(MAX_LABELS, whole ? Math.max(1, Math.round(n)) : 1) };
  });
}
```

- [ ] **Step 7: Viết `shared/src/supplier-return-math.ts`**

```ts
/** NCC bù cho hàng trả: trừ vào nợ hiện tại (nếu dương) trước, phần dư NCC trả tiền mặt. */
export function splitSupplierRefund(total: number, supplierDebt: number): { debtReduced: number; cashReceived: number } {
  const debtReduced = Math.min(total, Math.max(supplierDebt, 0));
  return { debtReduced, cashReceived: total - debtReduced };
}
```

- [ ] **Step 8: Viết `shared/src/schemas/supplier-return.ts` và `shared/src/schemas/label.ts`**

```ts
// shared/src/schemas/supplier-return.ts
import { z } from 'zod';
import { nullableText } from './common.js';
import { MAX_MONEY, optionalId } from './order.js';

/** Một dòng trả NCC: số lượng và giá trả theo đơn vị đã chọn (gốc hoặc thùng/lốc). */
export const supplierReturnItemInputSchema = z.object({
  productId: z.number().int().positive(),
  unitId: optionalId,
  qty: z.number().positive().max(100_000),
  unitPrice: z.number().int().min(0).max(MAX_MONEY),
});

export const supplierReturnInputSchema = z.object({
  supplierId: z.number().int().positive(),
  note: nullableText(200),
  items: z.array(supplierReturnItemInputSchema).min(1, 'chưa chọn món nào để trả'),
});
export type SupplierReturnInput = z.output<typeof supplierReturnInputSchema>;
export type SupplierReturnInputBody = z.input<typeof supplierReturnInputSchema>;
```

```ts
// shared/src/schemas/label.ts
import { z } from 'zod';
import { MAX_LABELS } from '../labels.js';
import { optionalId } from './order.js';

export const labelPrintInputSchema = z
  .object({
    items: z
      .array(z.object({ productId: z.number().int().positive(), unitId: optionalId, copies: z.number().int().min(1).max(MAX_LABELS) }))
      .min(1, 'chưa chọn tem nào'),
  })
  .refine((v) => v.items.reduce((s, i) => s + i.copies, 0) <= MAX_LABELS, { message: `tối đa ${MAX_LABELS} tem mỗi lần` });
export type LabelPrintInput = z.output<typeof labelPrintInputSchema>;
export type LabelPrintInputBody = z.input<typeof labelPrintInputSchema>;
```

- [ ] **Step 9: Viết `shared/src/supplier-return-draft.ts`**

```ts
import { z } from 'zod';
import { newLineKey } from './cart.js';
import { unitOptions, type UnitOption } from './import-draft.js';
import { importLineAmount } from './inventory-math.js';
import type { SupplierReturnInputBody } from './schemas/supplier-return.js';
import { splitSupplierRefund } from './supplier-return-math.js';
import type { ProductWithUnits } from './types.js';

const optionSchema = z.object({
  id: z.number().int().nullable(),
  name: z.string(),
  factor: z.number().positive(),
  sellPrice: z.number().int().min(0),
});
const lineSchema = z.object({
  key: z.string(),
  productId: z.number().int(),
  name: z.string(),
  isActive: z.boolean(),
  /** Tồn (đơn vị gốc) lúc thêm dòng, để cảnh báo trả quá tồn. */
  stock: z.number(),
  baseUnit: z.string(),
  /** Giá vốn 1 đơn vị gốc lúc thêm dòng, để điền lại giá trả khi đổi đơn vị. */
  baseCost: z.number().int().min(0),
  options: z.array(optionSchema).min(1),
  unitId: z.number().int().nullable(),
  qty: z.number().positive(),
  unitPrice: z.number().int().min(0),
});
const draftSchema = z.object({ supplierId: z.number().int().nullable(), note: z.string(), lines: z.array(lineSchema) });

export type SupplierReturnLine = z.infer<typeof lineSchema>;
export type SupplierReturnDraft = z.infer<typeof draftSchema>;

export const EMPTY_SUPPLIER_RETURN_DRAFT: SupplierReturnDraft = { supplierId: null, note: '', lines: [] };

export type SupplierReturnAction =
  | { type: 'add'; product: ProductWithUnits; unitId: number | null }
  | { type: 'update'; key: string; patch: Partial<Pick<SupplierReturnLine, 'qty' | 'unitPrice'>> }
  | { type: 'setUnit'; key: string; unitId: number | null }
  | { type: 'remove'; key: string }
  | { type: 'setSupplier'; supplierId: number | null }
  | { type: 'setNote'; note: string }
  | { type: 'clear' };

export const lineOption = (l: SupplierReturnLine): UnitOption => l.options.find((o) => o.id === l.unitId) ?? l.options[0]!;

/** Trả nhiều hơn tồn lúc thêm dòng (quy về đơn vị gốc): chỉ cảnh báo, vẫn lưu được. */
export const overStock = (l: SupplierReturnLine): boolean => l.qty * lineOption(l).factor > l.stock + 1e-9;

/** Đặt đơn vị; giá trả điền lại = giá vốn gốc × hệ số. unitId lạ → đơn vị gốc. */
function withUnit(l: SupplierReturnLine, unitId: number | null): SupplierReturnLine {
  const opt = l.options.find((o) => o.id === unitId) ?? l.options[0]!;
  return { ...l, unitId: opt.id, unitPrice: Math.round(l.baseCost * opt.factor) };
}

const money = (n: number) => Math.max(0, Math.round(n));

export function supplierReturnDraftReducer(d: SupplierReturnDraft, a: SupplierReturnAction): SupplierReturnDraft {
  switch (a.type) {
    case 'add': {
      const p = a.product;
      const base: SupplierReturnLine = {
        key: newLineKey(),
        productId: p.id,
        name: p.name,
        isActive: p.isActive,
        stock: p.stock,
        baseUnit: p.unit,
        baseCost: p.costPrice,
        options: unitOptions(p),
        unitId: null,
        qty: 1,
        unitPrice: p.costPrice,
      };
      const line = withUnit(base, a.unitId);
      const same = d.lines.find((l) => l.productId === p.id && l.unitId === line.unitId);
      if (same) return { ...d, lines: d.lines.map((l) => (l === same ? { ...l, qty: l.qty + 1 } : l)) };
      return { ...d, lines: [...d.lines, line] };
    }
    case 'update': {
      if (a.patch.qty !== undefined && a.patch.qty <= 0) return supplierReturnDraftReducer(d, { type: 'remove', key: a.key });
      const patch = { ...a.patch };
      if (patch.unitPrice !== undefined) patch.unitPrice = money(patch.unitPrice);
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
    case 'clear':
      return EMPTY_SUPPLIER_RETURN_DRAFT;
  }
}

export function supplierReturnTotals(d: SupplierReturnDraft, supplierDebt: number): { total: number; debtReduced: number; cashReceived: number } {
  const total = d.lines.reduce((s, l) => s + importLineAmount(l.qty, l.unitPrice), 0);
  return { total, ...splitSupplierRefund(total, supplierDebt) };
}

/** Body gửi POST /api/supplier-returns. */
export function toSupplierReturnInput(d: SupplierReturnDraft, supplierId: number): SupplierReturnInputBody {
  return {
    supplierId,
    note: d.note.trim() || null,
    items: d.lines.map((l) => ({ productId: l.productId, unitId: l.unitId, qty: l.qty, unitPrice: l.unitPrice })),
  };
}

/** Đọc nháp từ localStorage; hỏng hoặc sai cấu trúc thì trả phiếu trống. */
export function parseSupplierReturnDraft(raw: string | null): SupplierReturnDraft {
  if (!raw) return EMPTY_SUPPLIER_RETURN_DRAFT;
  try {
    const r = draftSchema.safeParse(JSON.parse(raw));
    return r.success ? r.data : EMPTY_SUPPLIER_RETURN_DRAFT;
  } catch {
    return EMPTY_SUPPLIER_RETURN_DRAFT;
  }
}
```

- [ ] **Step 10: Bộ lọc, cài đặt, types, index**

`shared/src/schemas/list-filters.ts` – thêm ngay sau dòng `export type ReturnListQuery = …`:

```ts

export const supplierReturnListFields = { ...rangeFields, q: search, status: csvEnum(DOC_STATUSES), supplierId: positiveId, page };
export const supplierReturnListQuerySchema = z.object(supplierReturnListFields).superRefine((q, ctx) => {
  const message = rangeError(q);
  if (message) ctx.addIssue({ code: 'custom', message });
});
export type SupplierReturnListQuery = z.output<typeof supplierReturnListQuerySchema>;
```

`shared/src/schemas/settings.ts` – thêm import và 2 trường (sau `autoPrint`):

```ts
import { LABEL_SIZES } from '../labels.js';
```

```ts
  autoPrint: z.boolean().default(true),
  labelSize: z.enum(LABEL_SIZES).default('40x30'),
  labelShowPrice: z.boolean().default(true),
```

`shared/src/types.ts`:
- Dòng `export type MovementType = 'sale' | 'import' | 'return' | 'adjust';` → `export type MovementType = 'sale' | 'import' | 'return' | 'adjust' | 'supplier_return';`
- Comment `refCode` của `StockMovement`: `HD-…, PN-…, KK-…` → `HD-…, PN-…, KK-…, TH-…, TN-…`.
- Thêm cuối file:

```ts

export interface SupplierReturnItem {
  id: number;
  productId: number;
  productName: string;
  unitName: string;
  factor: number;
  /** Theo đơn vị đã chọn. */
  qty: number;
  /** Giá trả 1 đơn vị đã chọn. */
  unitPrice: number;
  amount: number;
}

export interface SupplierReturnSummary {
  id: number;
  code: string;
  supplierId: number;
  /** Snapshot tên NCC lúc lập phiếu. */
  supplierName: string;
  total: number;
  /** Phần trừ vào nợ NCC. */
  debtReduced: number;
  /** Phần NCC trả tiền mặt = total − debtReduced. */
  cashReceived: number;
  note: string | null;
  status: 'done' | 'cancelled';
  itemCount: number;
  createdAt: string;
  cancelledAt: string | null;
}

export interface SupplierReturnDetail extends SupplierReturnSummary {
  items: SupplierReturnItem[];
}

/** Phiếu trả NCC `done` trong khoảng ngày. */
export interface SupplierReturnTotals {
  count: number;
  total: number;
  debt: number;
  cash: number;
}

export interface SupplierReturnList {
  returns: SupplierReturnSummary[];
  summary: SupplierReturnTotals;
  total: number;
  page: number;
  pageSize: number;
}

/** Kết quả lệnh in tem: server đã mở cửa sổ in ở máy quầy (opened) hay client phải tự mở `url`. */
export interface LabelPrintResult {
  opened: boolean;
  url: string;
}
```

`shared/src/index.ts` – thêm sau `export * from './return-math.js';`:

```ts
export * from './ean.js';
export * from './labels.js';
export * from './supplier-return-math.js';
export * from './supplier-return-draft.js';
```

và sau `export * from './schemas/return.js';`:

```ts
export * from './schemas/supplier-return.js';
export * from './schemas/label.js';
```

- [ ] **Step 11: Chạy test shared và typecheck**

Run: `cd shared && npx vitest run && npx tsc -p tsconfig.json --noEmit`
Expected: PASS toàn bộ test shared (cũ + 3 file mới); tsc không lỗi.

---

### Task 2: Server – bảng, migration, lập/xem/hủy/lọc phiếu trả NCC

**Files:**
- Modify: `server/src/db/schema.ts` (enum `stockMovements.type`; thêm 2 bảng ngay sau khối `importItems`), `server/src/services/stock.ts:6`, `server/src/services/daily-code.ts:22`, `server/src/services/movements.ts:7-8`, `server/src/services/settings.ts:9`
- Create: `server/drizzle/0005_*.sql` (sinh), `server/src/db/migration-0005.test.ts`, `server/src/services/supplier-returns.ts`, `server/src/services/supplier-returns.test.ts`

**Interfaces:**
- Consumes (Task 1): `importLineAmount`, `splitSupplierRefund`, `supplierReturnInputSchema`, `SupplierReturnInput`, `SupplierReturnListQuery`, types `SupplierReturn*`.
- Produces: bảng `supplierReturns`, `supplierReturnItems`; `getSupplierReturn(db: DbOrTx, id): SupplierReturnDetail`, `createSupplierReturn(db: Db, input: SupplierReturnInput, clock?: Clock): SupplierReturnDetail`, `cancelSupplierReturn(db: Db, id, clock?): SupplierReturnDetail`, `listSupplierReturns(db: Db, query: SupplierReturnListQuery, clock?): SupplierReturnList`, `listSupplierReturnsForExport(db, query, clock?, maxRows?): { from; to; returns: SupplierReturnDetail[] }`.

- [ ] **Step 1: Sửa schema**

`server/src/db/schema.ts` – enum của `stockMovements.type`:

```ts
    type: text('type', { enum: ['sale', 'import', 'return', 'adjust', 'supplier_return'] }).notNull(),
```

Thêm sau khối `export const importItems = …});`:

```ts

export const supplierReturns = sqliteTable(
  'supplier_returns',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    code: text('code').notNull().unique(), // TN-20261001-0001
    supplierId: integer('supplier_id')
      .notNull()
      .references(() => suppliers.id),
    supplierName: text('supplier_name').notNull(), // snapshot tên NCC lúc lập
    total: integer('total').notNull(), // Σ supplier_return_items.amount
    debtReduced: integer('debt_reduced').notNull().default(0), // phần trừ vào nợ NCC
    cashReceived: integer('cash_received').notNull().default(0), // phần NCC trả tiền mặt
    note: text('note'),
    status: text('status', { enum: ['done', 'cancelled'] }).notNull().default('done'),
    createdAt: createdAt(),
    cancelledAt: text('cancelled_at'),
  },
  (t) => [index('supplier_returns_created_idx').on(t.createdAt), index('supplier_returns_supplier_idx').on(t.supplierId)],
);

export const supplierReturnItems = sqliteTable(
  'supplier_return_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    returnId: integer('return_id')
      .notNull()
      .references(() => supplierReturns.id, { onDelete: 'cascade' }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    productName: text('product_name').notNull(),
    unitName: text('unit_name').notNull(),
    factor: real('factor').notNull().default(1), // hệ số đơn vị đã chọn
    qty: real('qty').notNull(), // theo đơn vị đã chọn
    unitPrice: integer('unit_price').notNull(), // giá trả 1 đơn vị đã chọn
    amount: integer('amount').notNull(),
  },
  (t) => [index('supplier_return_items_return_idx').on(t.returnId)],
);
```

- [ ] **Step 2: Sinh migration và soát SQL**

Run: `npm run db:generate`
Expected: file mới `server/drizzle/0005_<tên>.sql` chỉ có `CREATE TABLE \`supplier_returns\``, `CREATE TABLE \`supplier_return_items\``, `CREATE UNIQUE INDEX \`supplier_returns_code_unique\``, 3 `CREATE INDEX`. **Không** có `DROP`/`ALTER`/dựng lại `stock_movements` (enum text không sinh CHECK). Nếu có câu đụng bảng cũ thì xóa câu đó khỏi file SQL (giữ snapshot `meta/` như drizzle sinh).

- [ ] **Step 3: Test migration `server/src/db/migration-0005.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { migrationsFolder, partialMigrations } from './test-migrations.js';

describe('migration 0005', () => {
  it('chạy được trên DB 0.11.0 có phiếu nhập và sổ nợ NCC; dữ liệu cũ còn nguyên, bảng trả NCC rỗng', () => {
    const sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    const db = drizzle(sqlite);
    migrate(db, { migrationsFolder: partialMigrations(5) });
    sqlite.exec(`
      INSERT INTO products (id, name, stock, cost_price) VALUES (1, 'Bia', 24, 10000);
      INSERT INTO suppliers (id, name, debt) VALUES (1, 'Đại lý Hùng', 240000);
      INSERT INTO imports (id, code, supplier_id, supplier_name, total, paid) VALUES (1, 'PN-20260929-0001', 1, 'Đại lý Hùng', 240000, 0);
      INSERT INTO import_items (import_id, product_id, product_name, unit_name, factor, qty, unit_cost, cost_price, amount)
        VALUES (1, 1, 'Bia', 'lon', 1, 24, 10000, 10000, 240000);
      INSERT INTO supplier_transactions (supplier_id, import_id, amount, note) VALUES (1, 1, 240000, 'Nhập PN-20260929-0001');
      INSERT INTO stock_movements (product_id, qty, type, ref_id, note) VALUES (1, 24, 'import', 1, 'Nhập PN-20260929-0001');
    `);
    migrate(db, { migrationsFolder });
    expect(sqlite.prepare('SELECT code, total, status FROM imports').all()).toEqual([{ code: 'PN-20260929-0001', total: 240000, status: 'done' }]);
    expect(sqlite.prepare('SELECT debt FROM suppliers').get()).toEqual({ debt: 240000 });
    expect(sqlite.prepare('SELECT qty, type FROM stock_movements').all()).toEqual([{ qty: 24, type: 'import' }]);
    expect(sqlite.prepare('SELECT count(*) AS n FROM supplier_returns').get()).toEqual({ n: 0 });
    expect(sqlite.prepare('SELECT count(*) AS n FROM supplier_return_items').get()).toEqual({ n: 0 });
    expect(sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });
});
```

- [ ] **Step 4: Sửa các chỗ nhỏ có sẵn**

- `server/src/services/stock.ts:6`: `export type MovementType = 'sale' | 'import' | 'return' | 'adjust';` → thêm `| 'supplier_return'`.
- `server/src/services/daily-code.ts:22`: `table: 'orders' | 'imports' | 'stocktakes' | 'returns',` → `table: 'orders' | 'imports' | 'stocktakes' | 'returns' | 'supplier_returns',`.
- `server/src/services/movements.ts:8`: `/\b(?:HD|PN|KK|TH)-\d{8}-\d+\b/` → `/\b(?:HD|PN|KK|TH|TN)-\d{8}-\d+\b/`.
- `server/src/services/settings.ts`, ngay sau dòng `if (typeof raw['autoPrint'] === 'string') …`:

```ts
  if (typeof raw['labelShowPrice'] === 'string') raw['labelShowPrice'] = raw['labelShowPrice'] === '1';
```

- [ ] **Step 5: Viết test `server/src/services/supplier-returns.test.ts`**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import {
  importInputSchema,
  productInputSchema,
  productUnitInputSchema,
  settingsInputSchema,
  supplierInputSchema,
  supplierReturnInputSchema,
  supplierReturnListQuerySchema,
} from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { stockMovements } from '../db/schema.js';
import { createTestDb } from '../db/test-db.js';
import { readWorkbook } from '../xlsx/workbook.js';
import { exportSupplierReturnsXlsx } from './exports.js';
import { createImport } from './imports.js';
import { listMovements } from './movements.js';
import { createUnit } from './product-units.js';
import { createProduct, getProduct, setProductActive } from './products.js';
import { getSettings, saveSettings } from './settings.js';
import { cancelSupplierReturn, createSupplierReturn, getSupplierReturn, listSupplierReturns } from './supplier-returns.js';
import { createSupplier, deleteSupplier, getSupplier, listSupplierTransactions } from './suppliers.js';

const VN = 420;
const at = (iso: string) => ({ now: new Date(iso), tzOffsetMin: VN });
const D29 = at('2026-09-29T03:00:00.000Z'); // 10:00 ngày 29/9 giờ VN: ngày nhập
const D30 = at('2026-09-30T03:00:00.000Z'); // 10:00 ngày 30/9 giờ VN: ngày trả

let db: Db;
beforeEach(() => {
  db = createTestDb();
});
const product = (o: Record<string, unknown>) => createProduct(db, productInputSchema.parse(o));
const supplier = (name = 'Đại lý Hùng') => createSupplier(db, supplierInputSchema.parse({ name }));
const ret = (o: Record<string, unknown>, clock = D30) => createSupplierReturn(db, supplierReturnInputSchema.parse(o), clock);
const list = (q: Record<string, unknown>) => listSupplierReturns(db, supplierReturnListQuerySchema.parse(q), { tzOffsetMin: VN });
const movements = () =>
  db
    .select()
    .from(stockMovements)
    .all()
    .filter((m) => m.type !== 'import' && m.note !== 'Tồn đầu')
    .map((m) => [m.type, m.productId, m.qty, m.note]);

/** Bia lon vốn 10.000, thùng 24 lon; nhập nợ 2 thùng (480.000) của Đại lý Hùng. */
function seed() {
  const bia = product({ name: 'Bia', unit: 'lon', costPrice: 10000, sellPrice: 12000 });
  const crate = createUnit(db, bia.id, productUnitInputSchema.parse({ name: 'Thùng', factor: 24, sellPrice: 280000 }));
  const s = supplier();
  createImport(db, importInputSchema.parse({ supplierId: s.id, paid: 0, items: [{ productId: bia.id, unitId: crate.id, qty: 2, unitCost: 240000 }] }), D29);
  return { bia, crate, s };
}

describe('createSupplierReturn', () => {
  it('trả theo thùng: mã TN theo ngày trả, −qty×factor loại supplier_return, trừ nợ NCC, giá vốn giữ nguyên', () => {
    const { bia, crate, s } = seed();
    const r = ret({ supplierId: s.id, note: 'Hết hạn', items: [{ productId: bia.id, unitId: crate.id, qty: 1, unitPrice: 230000 }] });
    expect(r).toMatchObject({
      code: 'TN-20260930-0001',
      supplierId: s.id,
      supplierName: 'Đại lý Hùng',
      total: 230000,
      debtReduced: 230000,
      cashReceived: 0,
      status: 'done',
      itemCount: 1,
      note: 'Hết hạn',
      createdAt: '2026-09-30T03:00:00.000Z',
    });
    expect(r.items).toMatchObject([{ productId: bia.id, productName: 'Bia', unitName: 'Thùng', factor: 24, qty: 1, unitPrice: 230000, amount: 230000 }]);
    expect(getProduct(db, bia.id)).toMatchObject({ stock: 24, costPrice: 10000 });
    expect(movements()).toEqual([['supplier_return', bia.id, -24, 'Trả NCC TN-20260930-0001']]);
    expect(getSupplier(db, s.id).debt).toBe(250000);
    expect(listSupplierTransactions(db, s.id)[0]).toMatchObject({ amount: -230000, note: 'Trả NCC TN-20260930-0001', importId: null });
    expect(listMovements(db, bia.id, 10)[0]).toMatchObject({ type: 'supplier_return', refCode: 'TN-20260930-0001' });
  });

  it('nợ ít hơn tiền trả: trừ hết nợ, phần dư NCC trả tiền mặt; NCC nợ 0 thì tiền mặt hết', () => {
    const { bia, s } = seed();
    const a = ret({ supplierId: s.id, items: [{ productId: bia.id, qty: 50, unitPrice: 10000 }] });
    expect(a).toMatchObject({ total: 500000, debtReduced: 480000, cashReceived: 20000 });
    expect(getSupplier(db, s.id).debt).toBe(0);
    const other = supplier('Tạp hóa sỉ An');
    const b = ret({ supplierId: other.id, items: [{ productId: bia.id, qty: 1, unitPrice: 10000 }] });
    expect(b).toMatchObject({ code: 'TN-20260930-0002', debtReduced: 0, cashReceived: 10000 });
    expect(listSupplierTransactions(db, other.id)).toEqual([]);
  });

  it('trả quá tồn vẫn lưu (tồn âm); sản phẩm ngừng bán vẫn trả được; hàng cân số lẻ', () => {
    const s = supplier();
    const thit = product({ name: 'Thịt heo', unit: 'kg', isWeighed: true, costPrice: 120000, stock: 0.2 });
    setProductActive(db, thit.id, false);
    const r = ret({ supplierId: s.id, items: [{ productId: thit.id, qty: 0.35, unitPrice: 120000 }] });
    expect(r.total).toBe(42000);
    expect(getProduct(db, thit.id).stock).toBeCloseTo(-0.15, 9);
  });

  it('từ chối: NCC ngừng hoạt động, sản phẩm lạ, đơn vị của sản phẩm khác, tổng vượt trần', () => {
    const { bia, s } = seed();
    const other = product({ name: 'Nước', costPrice: 4000 });
    const otherUnit = createUnit(db, other.id, productUnitInputSchema.parse({ name: 'Lốc', factor: 6, sellPrice: 30000 }));
    const gone = supplier('Đã nghỉ');
    deleteSupplier(db, gone.id);
    expect(() => ret({ supplierId: gone.id, items: [{ productId: bia.id, qty: 1, unitPrice: 1 }] })).toThrow('Nhà cung cấp không còn hoạt động');
    expect(() => ret({ supplierId: 999, items: [{ productId: bia.id, qty: 1, unitPrice: 1 }] })).toThrow('Nhà cung cấp không còn hoạt động');
    expect(() => ret({ supplierId: s.id, items: [{ productId: 999, qty: 1, unitPrice: 1 }] })).toThrow('Sản phẩm không hợp lệ');
    expect(() => ret({ supplierId: s.id, items: [{ productId: bia.id, unitId: otherUnit.id, qty: 1, unitPrice: 1 }] })).toThrow('Đơn vị không hợp lệ');
    expect(() =>
      ret({ supplierId: s.id, items: [{ productId: bia.id, qty: 2, unitPrice: 600_000_000 }] }),
    ).toThrow('Tổng tiền vượt giới hạn');
    expect(movements()).toEqual([]);
    expect(getSupplier(db, s.id).debt).toBe(480000);
  });
});

describe('cancelSupplierReturn', () => {
  it('đưa tồn và nợ về như trước; phiếu giữ lại Đã hủy; hủy hai lần 409', () => {
    const { bia, crate, s } = seed();
    const r = ret({ supplierId: s.id, items: [{ productId: bia.id, unitId: crate.id, qty: 1, unitPrice: 240000 }] });
    const c = cancelSupplierReturn(db, r.id, at('2026-09-30T05:00:00.000Z'));
    expect(c).toMatchObject({ status: 'cancelled', cancelledAt: '2026-09-30T05:00:00.000Z' });
    expect(getProduct(db, bia.id).stock).toBe(48);
    expect(getSupplier(db, s.id).debt).toBe(480000);
    expect(movements()).toEqual([
      ['supplier_return', bia.id, -24, `Trả NCC ${r.code}`],
      ['adjust', bia.id, 24, `Hủy phiếu trả NCC ${r.code}`],
    ]);
    expect(listSupplierTransactions(db, s.id)[0]).toMatchObject({ amount: 240000, note: `Hủy phiếu trả NCC ${r.code}` });
    expect(() => cancelSupplierReturn(db, r.id)).toThrow('Phiếu trả NCC đã hủy');
    expect(() => getSupplierReturn(db, 999)).toThrow('Không tìm thấy phiếu trả NCC');
  });

  it('NCC đã xóa: phiếu có trừ nợ thì không hủy được, phiếu chỉ nhận tiền mặt thì hủy được', () => {
    const { bia, s } = seed();
    const debtReturn = ret({ supplierId: s.id, items: [{ productId: bia.id, qty: 48, unitPrice: 10000 }] }); // trừ hết 480.000
    const cashReturn = ret({ supplierId: s.id, items: [{ productId: bia.id, qty: 1, unitPrice: 10000 }] }); // nợ 0 → tiền mặt
    deleteSupplier(db, s.id);
    expect(() => cancelSupplierReturn(db, debtReturn.id)).toThrow('Nhà cung cấp đã xóa, không hủy được phiếu đã trừ nợ');
    expect(cancelSupplierReturn(db, cashReturn.id).status).toBe('cancelled');
    expect(getSupplier(db, s.id).debt).toBe(0);
  });
});

describe('listSupplierReturns', () => {
  it('lọc ngày (mặc định hôm nay), NCC, trạng thái, tìm không dấu theo mã / tên hàng; summary chỉ theo ngày và phiếu done', () => {
    const { bia, s } = seed();
    const nuoc = product({ name: 'Nước suối', costPrice: 4000 });
    const other = supplier('Tạp hóa sỉ An');
    const a = ret({ supplierId: s.id, items: [{ productId: bia.id, qty: 2, unitPrice: 10000 }] });
    const b = ret({ supplierId: other.id, items: [{ productId: nuoc.id, qty: 5, unitPrice: 4000 }] });
    cancelSupplierReturn(db, b.id);
    ret({ supplierId: s.id, items: [{ productId: bia.id, qty: 1, unitPrice: 10000 }] }, at('2026-10-01T03:00:00.000Z'));

    const day = list({ from: '2026-09-30', to: '2026-09-30' });
    expect(day.returns.map((r) => r.code)).toEqual([b.code, a.code]);
    expect(day.summary).toEqual({ count: 1, total: 20000, debt: 20000, cash: 0 });
    expect(day.total).toBe(2);
    expect(list({ from: '2026-09-30', to: '2026-09-30', supplierId: String(other.id) }).returns.map((r) => r.id)).toEqual([b.id]);
    expect(list({ from: '2026-09-30', to: '2026-09-30', status: 'done' }).returns.map((r) => r.id)).toEqual([a.id]);
    expect(list({ from: '2026-09-30', to: '2026-09-30', q: 'nuoc suoi' }).returns.map((r) => r.id)).toEqual([b.id]);
    expect(list({ from: '2026-09-30', to: '2026-09-30', q: 'TN-20260930-0001' }).returns.map((r) => r.id)).toEqual([a.id]);
    expect(list({ from: '2026-09-29', to: '2026-10-01' }).total).toBe(3);
  });
});

describe('exportSupplierReturnsXlsx', () => {
  it('sheet Phiếu trả NCC + Chi tiết theo bộ lọc; tên file theo khoảng ngày', async () => {
    const { bia, crate, s } = seed();
    ret({ supplierId: s.id, note: 'Móp', items: [{ productId: bia.id, unitId: crate.id, qty: 1, unitPrice: 240000 }] });
    const f = await exportSupplierReturnsXlsx(db, supplierReturnListQuerySchema.parse({ from: '2026-09-30', to: '2026-09-30' }), D30);
    expect(f.filename).toBe('tra-ncc-20260930.xlsx');
    const [head, detail] = await readWorkbook(f.buffer);
    expect(head!.name).toBe('Phiếu trả NCC');
    expect(head!.rows).toEqual([
      ['Mã', 'Ngày giờ', 'NCC', 'Tổng trả', 'Trừ nợ', 'NCC trả tiền mặt', 'Số món', 'Trạng thái', 'Hủy lúc', 'Ghi chú'],
      ['TN-20260930-0001', '2026-09-30T03:00:00.000Z', 'Đại lý Hùng', 240000, 240000, 0, 1, 'Hoàn tất', null, 'Móp'],
    ]);
    expect(detail!.name).toBe('Chi tiết');
    expect(detail!.rows).toEqual([
      ['Mã phiếu', 'Ngày giờ', 'Trạng thái', 'NCC', 'Tên hàng', 'Đơn vị', 'Quy đổi', 'SL', 'Giá trả', 'Thành tiền'],
      ['TN-20260930-0001', '2026-09-30T03:00:00.000Z', 'Hoàn tất', 'Đại lý Hùng', 'Bia', 'Thùng', 24, 1, 240000, 240000],
    ]);
  });
});

describe('cài đặt tem', () => {
  it('mặc định 40×30 có in giá; lưu rồi đọc lại đúng kiểu boolean', () => {
    expect(getSettings(db)).toMatchObject({ labelSize: '40x30', labelShowPrice: true });
    saveSettings(db, settingsInputSchema.parse({ labelSize: '35x22x2', labelShowPrice: false }));
    expect(getSettings(db)).toMatchObject({ labelSize: '35x22x2', labelShowPrice: false });
  });
});
```

- [ ] **Step 6: Chạy để thấy fail**

Run: `npm run build -w shared && cd server && npx vitest run src/services/supplier-returns.test.ts src/db/migration-0005.test.ts`
Expected: migration test PASS; `supplier-returns.test.ts` FAIL vì chưa có `./supplier-returns.js` và `exportSupplierReturnsXlsx`.

- [ ] **Step 7: Viết `server/src/services/supplier-returns.ts`**

```ts
import { and, asc, count, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import {
  importLineAmount,
  localDate,
  localDayRange,
  MAX_EXPORT_ROWS,
  MAX_MONEY,
  PAGE_SIZE,
  resolveRange,
  splitSupplierRefund,
  type SupplierReturnDetail,
  type SupplierReturnInput,
  type SupplierReturnItem,
  type SupplierReturnList,
  type SupplierReturnListQuery,
  type SupplierReturnSummary,
} from '@tiny-pos/shared';
import type { Db, DbOrTx } from '../db/connection.js';
import { productUnits, products, supplierReturnItems, supplierReturns, suppliers } from '../db/schema.js';
import { BadRequestError, ConflictError, NotFoundError } from '../errors.js';
import { nextDailyCode, resolveClock, type Clock } from './daily-code.js';
import { likeTerm } from './orders.js';
import { recordMovement } from './stock.js';
import { recordSupplierTx } from './supplier-ledger.js';

type Row = typeof supplierReturns.$inferSelect;

// Viết tên bảng cứng: drizzle bỏ tiền tố bảng khi render cột trong subquery
const itemCount = sql<number>`(select count(*) from supplier_return_items where supplier_return_items.return_id = supplier_returns.id)`;

function toSummary(r: Row, n: number): SupplierReturnSummary {
  return {
    id: r.id,
    code: r.code,
    supplierId: r.supplierId,
    supplierName: r.supplierName,
    total: r.total,
    debtReduced: r.debtReduced,
    cashReceived: r.cashReceived,
    note: r.note,
    status: r.status,
    itemCount: n,
    createdAt: r.createdAt,
    cancelledAt: r.cancelledAt,
  };
}

const itemColumns = {
  id: supplierReturnItems.id,
  productId: supplierReturnItems.productId,
  productName: supplierReturnItems.productName,
  unitName: supplierReturnItems.unitName,
  factor: supplierReturnItems.factor,
  qty: supplierReturnItems.qty,
  unitPrice: supplierReturnItems.unitPrice,
  amount: supplierReturnItems.amount,
};

/** Dòng của nhiều phiếu, theo lô: SQLite giới hạn số tham số trong một câu lệnh. */
function itemsOf(db: DbOrTx, ids: number[]): Map<number, SupplierReturnItem[]> {
  const out = new Map<number, SupplierReturnItem[]>();
  for (let i = 0; i < ids.length; i += 500) {
    const batch = db
      .select({ returnId: supplierReturnItems.returnId, ...itemColumns })
      .from(supplierReturnItems)
      .where(inArray(supplierReturnItems.returnId, ids.slice(i, i + 500)))
      .orderBy(asc(supplierReturnItems.id))
      .all();
    for (const { returnId, ...it } of batch) {
      const list = out.get(returnId);
      if (list) list.push(it);
      else out.set(returnId, [it]);
    }
  }
  return out;
}

export function getSupplierReturn(db: DbOrTx, id: number): SupplierReturnDetail {
  const r = db.select().from(supplierReturns).where(eq(supplierReturns.id, id)).get();
  if (!r) throw new NotFoundError('Không tìm thấy phiếu trả NCC');
  const items = itemsOf(db, [id]).get(id) ?? [];
  return { ...toSummary(r, items.length), items };
}

/** Sản phẩm ngừng bán vẫn trả được (trả hàng tồn cũ). */
function resolveLine(tx: DbOrTx, it: SupplierReturnInput['items'][number]) {
  const p = tx.select().from(products).where(eq(products.id, it.productId)).get();
  if (!p) throw new BadRequestError('Sản phẩm không hợp lệ');
  let factor = 1;
  let unitName = p.unit;
  if (it.unitId !== null) {
    const u = tx
      .select()
      .from(productUnits)
      .where(and(eq(productUnits.id, it.unitId), eq(productUnits.productId, p.id)))
      .get();
    if (!u) throw new BadRequestError('Đơn vị không hợp lệ');
    factor = u.factor;
    unitName = u.name;
  }
  return { productId: p.id, productName: p.name, unitName, factor, qty: it.qty, unitPrice: it.unitPrice, amount: importLineAmount(it.qty, it.unitPrice) };
}

/**
 * Lập phiếu trả NCC, tính vào ngày lập: trừ tồn theo đơn vị gốc (movement supplier_return, được âm),
 * trừ nợ NCC hiện tại trước, phần dư NCC trả tiền mặt. Giá vốn giữ nguyên.
 */
export function createSupplierReturn(db: Db, input: SupplierReturnInput, clock?: Clock): SupplierReturnDetail {
  const { now, tz } = resolveClock(clock);
  return db.transaction((tx) => {
    const s = tx.select().from(suppliers).where(eq(suppliers.id, input.supplierId)).get();
    if (!s || !s.isActive) throw new BadRequestError('Nhà cung cấp không còn hoạt động');
    if (!input.items.length) throw new BadRequestError('Chưa chọn món nào để trả');
    const lines = input.items.map((it) => resolveLine(tx, it));
    const total = lines.reduce((sum, l) => sum + l.amount, 0);
    if (total > MAX_MONEY) throw new BadRequestError('Tổng tiền vượt giới hạn');
    const { debtReduced, cashReceived } = splitSupplierRefund(total, s.debt);
    const code = nextDailyCode(tx, 'supplier_returns', 'TN', localDate(now, tz), 4);
    const createdAt = now.toISOString();
    const { id } = tx
      .insert(supplierReturns)
      .values({ code, supplierId: s.id, supplierName: s.name, total, debtReduced, cashReceived, note: input.note, createdAt })
      .returning({ id: supplierReturns.id })
      .get();
    for (const l of lines) {
      tx.insert(supplierReturnItems).values({ returnId: id, ...l }).run();
      recordMovement(tx, { productId: l.productId, qty: -l.qty * l.factor, type: 'supplier_return', refId: id, note: `Trả NCC ${code}` });
    }
    if (debtReduced > 0) recordSupplierTx(tx, { supplierId: s.id, amount: -debtReduced, note: `Trả NCC ${code}`, createdAt });
    return getSupplierReturn(tx, id);
  });
}

/** Hủy: cộng lại tồn (movement adjust), cộng lại nợ đã trừ; phiếu giữ lại với trạng thái cancelled. */
export function cancelSupplierReturn(db: Db, id: number, clock?: Clock): SupplierReturnDetail {
  const { now } = resolveClock(clock);
  return db.transaction((tx) => {
    const r = getSupplierReturn(tx, id);
    if (r.status === 'cancelled') throw new ConflictError('Phiếu trả NCC đã hủy');
    // NCC đã xóa không hiện trong danh sách và không trả nợ được: cộng lại nợ cho họ sẽ thành khoản treo
    const active = tx.select({ v: suppliers.isActive }).from(suppliers).where(eq(suppliers.id, r.supplierId)).get()?.v;
    if (r.debtReduced > 0 && !active) throw new ConflictError('Nhà cung cấp đã xóa, không hủy được phiếu đã trừ nợ');
    for (const it of r.items) {
      recordMovement(tx, { productId: it.productId, qty: it.qty * it.factor, type: 'adjust', refId: id, note: `Hủy phiếu trả NCC ${r.code}` });
    }
    if (r.debtReduced > 0)
      recordSupplierTx(tx, { supplierId: r.supplierId, amount: r.debtReduced, note: `Hủy phiếu trả NCC ${r.code}`, createdAt: now.toISOString() });
    tx.update(supplierReturns).set({ status: 'cancelled', cancelledAt: now.toISOString() }).where(eq(supplierReturns.id, id)).run();
    return getSupplierReturn(tx, id);
  });
}

/** Điều kiện lọc dùng chung cho danh sách và file xuất; tìm theo mã phiếu và tên món (không dấu). */
function supplierReturnFilter(query: SupplierReturnListQuery, clock?: Clock) {
  const { now, tz } = resolveClock(clock);
  const { from, to } = resolveRange(query, localDate(now, tz));
  const start = localDayRange(from, tz).start;
  const end = localDayRange(to, tz).end;
  const inRange = and(gte(supplierReturns.createdAt, start), lt(supplierReturns.createdAt, end));
  const term = likeTerm(query.q);
  const where = and(
    inRange,
    query.status?.length ? inArray(supplierReturns.status, query.status) : undefined,
    query.supplierId ? eq(supplierReturns.supplierId, query.supplierId) : undefined,
    // Viết tên bảng cứng như itemCount: drizzle bỏ tiền tố bảng trong sql``
    term
      ? sql`(vn_fold(supplier_returns.code) like ${term} escape '\\' or exists (select 1 from supplier_return_items
          where supplier_return_items.return_id = supplier_returns.id and vn_fold(supplier_return_items.product_name) like ${term} escape '\\'))`
      : undefined,
  );
  return { from, to, inRange, where };
}

export function listSupplierReturns(db: Db, query: SupplierReturnListQuery, clock?: Clock): SupplierReturnList {
  const { inRange, where } = supplierReturnFilter(query, clock);
  const page = query.page ?? 1;
  const total = db.select({ n: count() }).from(supplierReturns).where(where).get()?.n ?? 0;
  const list = db
    .select({ row: supplierReturns, itemCount })
    .from(supplierReturns)
    .where(where)
    .orderBy(desc(supplierReturns.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
    .all()
    .map((r) => toSummary(r.row, Number(r.itemCount)));
  // Số liệu theo khoảng ngày, không theo lọc khác
  const done = db
    .select({ total: supplierReturns.total, debt: supplierReturns.debtReduced, cash: supplierReturns.cashReceived })
    .from(supplierReturns)
    .where(and(inRange, eq(supplierReturns.status, 'done')))
    .all();
  const sum = (k: 'total' | 'debt' | 'cash') => done.reduce((s, r) => s + r[k], 0);
  return { returns: list, summary: { count: done.length, total: sum('total'), debt: sum('debt'), cash: sum('cash') }, total, page, pageSize: PAGE_SIZE };
}

/** Mọi phiếu khớp bộ lọc (không phân trang), mới nhất trước, kèm dòng; quá `maxRows` thì báo lỗi. */
export function listSupplierReturnsForExport(
  db: Db,
  query: SupplierReturnListQuery,
  clock?: Clock,
  maxRows = MAX_EXPORT_ROWS,
): { from: string; to: string; returns: SupplierReturnDetail[] } {
  const { from, to, where } = supplierReturnFilter(query, clock);
  const n = db.select({ n: count() }).from(supplierReturns).where(where).get()?.n ?? 0;
  if (n > maxRows) throw new BadRequestError('Quá nhiều phiếu trả NCC, hãy chọn khoảng ngày ngắn hơn');
  const rows = db.select().from(supplierReturns).where(where).orderBy(desc(supplierReturns.id)).all();
  const items = itemsOf(db, rows.map((r) => r.id));
  return {
    from,
    to,
    returns: rows.map((r) => {
      const list = items.get(r.id) ?? [];
      return { ...toSummary(r, list.length), items: list };
    }),
  };
}
```

- [ ] **Step 8: Thêm `exportSupplierReturnsXlsx` vào `server/src/services/exports.ts`**

Thêm `type SupplierReturnListQuery,` vào khối import `@tiny-pos/shared` (theo thứ tự chữ cái, sau `type ReturnListQuery,`), thêm dòng `import { listSupplierReturnsForExport } from './supplier-returns.js';` sau dòng `import { listReturnsForExport } from './returns.js';`, rồi thêm ngay sau hàm `exportReturnsXlsx`:

```ts

const SUPPLIER_RETURN_COLUMNS = [
  col('Mã', 18),
  col('Ngày giờ', 17, 'datetime'),
  col('NCC', 22),
  col('Tổng trả', 12, 'money'),
  col('Trừ nợ', 12, 'money'),
  col('NCC trả tiền mặt', 14, 'money'),
  col('Số món', 8, 'qty'),
  col('Trạng thái', 11),
  col('Hủy lúc', 17, 'datetime'),
  col('Ghi chú', 28),
];
const SUPPLIER_RETURN_ITEM_COLUMNS = [
  col('Mã phiếu', 18),
  col('Ngày giờ', 17, 'datetime'),
  col('Trạng thái', 11),
  col('NCC', 22),
  col('Tên hàng', 32),
  col('Đơn vị', 12),
  col('Quy đổi', 9, 'qty'),
  col('SL', 8, 'qty'),
  col('Giá trả', 12, 'money'),
  col('Thành tiền', 12, 'money'),
];

export async function exportSupplierReturnsXlsx(db: Db, query: SupplierReturnListQuery, clock?: Clock): Promise<XlsxFile> {
  const { now, tz } = resolveClock(clock);
  const { from, to, returns } = listSupplierReturnsForExport(db, query, { now, tzOffsetMin: tz });
  const rows = returns.map((r) => [r.code, r.createdAt, r.supplierName, r.total, r.debtReduced, r.cashReceived, r.itemCount, STATUS_LABEL[r.status],
    r.cancelledAt, r.note]);
  const items = returns.flatMap((r) =>
    r.items.map((it) => [r.code, r.createdAt, STATUS_LABEL[r.status], r.supplierName, it.productName, it.unitName, it.factor, it.qty, it.unitPrice, it.amount]),
  );
  return build(
    rangeName('tra-ncc', from, to),
    [
      { name: 'Phiếu trả NCC', columns: SUPPLIER_RETURN_COLUMNS, rows },
      { name: 'Chi tiết', columns: SUPPLIER_RETURN_ITEM_COLUMNS, rows: items },
    ],
    tz,
  );
}
```

- [ ] **Step 9: Chạy test**

Run: `cd server && npx vitest run src/services/supplier-returns.test.ts src/db/migration-0005.test.ts src/services/settings.test.ts src/services/movements.test.ts`
Expected: PASS hết.

---

### Task 3: Server – cấp mã nội bộ, in tem, cửa sổ in, API

**Files:**
- Create: `server/src/services/labels.ts`, `server/src/services/labels.test.ts`, `server/src/label-window.ts`, `server/src/label-window.test.ts`, `server/src/routes/supplier-returns.ts`, `server/src/routes/labels.ts`, `server/src/routes/supplier-returns-api.test.ts`
- Modify: `server/src/routes/index.ts`, `server/src/app.ts:10-14`, `server/src/index.ts:7,17`

**Interfaces:**
- Consumes: Task 1 (`internalEan13`, `internalSeq`, `INTERNAL_MAX_SEQ`, `formatLabelItems`, `labelPrintInputSchema`, `LabelPrintInput`, `LabelPrintResult`, `supplierReturnInputSchema`, `supplierReturnListQuerySchema`); Task 2 (service trả NCC, `exportSupplierReturnsXlsx`); `assertBarcodeFree`, `findProductByBarcode` (`services/products.ts`).
- Produces: `type LabelOpener = (url: string) => boolean`, `interface LabelDeps { open: LabelOpener; origin: string }`, `NO_LABEL_WINDOW: LabelDeps`, `assignBarcodes(tx, items)`, `printLabels(db, input, deps): LabelPrintResult`, `printSampleLabel(deps): LabelPrintResult`; `findBrowser(env?, exists?)`, `createLabelOpener(profileDir, browser?)`; `createApp(db, { …, labels?: LabelDeps })`; API `POST /api/labels/print`, `POST /api/labels/sample`, `/api/supplier-returns` (GET, GET export.xlsx, GET :id, POST, POST :id/cancel).

- [ ] **Step 1: Viết test `server/src/services/labels.test.ts`**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { labelPrintInputSchema, productInputSchema, productUnitInputSchema } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { createTestDb } from '../db/test-db.js';
import { assignBarcodes, printLabels, printSampleLabel } from './labels.js';
import { createUnit } from './product-units.js';
import { createProduct, findProductByBarcode, getProduct } from './products.js';

let db: Db;
beforeEach(() => {
  db = createTestDb();
});
const product = (o: Record<string, unknown>) => createProduct(db, productInputSchema.parse(o));
const opened: string[] = [];
const deps = (ok: boolean) => ({ origin: 'http://localhost:3000', open: (url: string) => (opened.push(url), ok) });

describe('assignBarcodes', () => {
  it('cấp mã liên tiếp cho sản phẩm và đơn vị chưa có mã; bỏ qua mã đã có; quét ra đúng hàng', () => {
    const banh = product({ name: 'Bánh bò', sellPrice: 5000 });
    const sua = product({ name: 'Sữa', barcode: '8934567890128', sellPrice: 9000 });
    const loc = createUnit(db, sua.id, productUnitInputSchema.parse({ name: 'Lốc', factor: 4, sellPrice: 34000 }));
    db.transaction((tx) =>
      assignBarcodes(tx, [
        { productId: banh.id, unitId: null },
        { productId: sua.id, unitId: null },
        { productId: sua.id, unitId: loc.id },
      ]),
    );
    expect(getProduct(db, banh.id).barcode).toBe('2000000000015');
    expect(getProduct(db, sua.id).barcode).toBe('8934567890128');
    expect(getProduct(db, sua.id).units[0]!.barcode).toBe('2000000000022');
    expect(findProductByBarcode(db, '2000000000022')).toMatchObject({ product: { id: sua.id }, unit: { id: loc.id } });
  });

  it('nối tiếp sau mã 20… hợp lệ lớn nhất đang có, kể cả mã gõ tay; bỏ qua mã 20… sai số kiểm tra / sai độ dài', () => {
    product({ name: 'Gõ tay', barcode: '2000000000046' });
    product({ name: 'Sai kiểm tra', barcode: '2000000009999' });
    product({ name: 'Ngắn', barcode: '2000000000' });
    const moi = product({ name: 'Mới' });
    db.transaction((tx) => assignBarcodes(tx, [{ productId: moi.id, unitId: null }]));
    expect(getProduct(db, moi.id).barcode).toBe('2000000000053');
  });

  it('sản phẩm lạ hoặc đơn vị không thuộc sản phẩm → 400, không ghi gì', () => {
    const a = product({ name: 'A' });
    const b = product({ name: 'B' });
    const ub = createUnit(db, b.id, productUnitInputSchema.parse({ name: 'Lốc', factor: 6, sellPrice: 1 }));
    expect(() => db.transaction((tx) => assignBarcodes(tx, [{ productId: a.id, unitId: null }, { productId: 999, unitId: null }]))).toThrow(
      'Sản phẩm không hợp lệ',
    );
    expect(() => db.transaction((tx) => assignBarcodes(tx, [{ productId: a.id, unitId: ub.id }]))).toThrow('Sản phẩm không hợp lệ');
    expect(getProduct(db, a.id).barcode).toBeNull();
  });
});

describe('printLabels', () => {
  it('cấp mã rồi gọi opener với URL đầy đủ; trả opened theo opener và url tương đối; gọi lại không đổi mã', () => {
    opened.length = 0;
    const banh = product({ name: 'Bánh bò', sellPrice: 5000 });
    const input = labelPrintInputSchema.parse({ items: [{ productId: banh.id, copies: 3 }] });
    expect(printLabels(db, input, deps(true))).toEqual({ opened: true, url: `/labels/print?i=${banh.id}.0x3` });
    expect(opened).toEqual([`http://localhost:3000/labels/print?i=${banh.id}.0x3`]);
    expect(printLabels(db, input, deps(false))).toEqual({ opened: false, url: `/labels/print?i=${banh.id}.0x3` });
    expect(getProduct(db, banh.id).barcode).toBe('2000000000015');
  });

  it('tem mẫu không đụng DB', () => {
    opened.length = 0;
    expect(printSampleLabel(deps(true))).toEqual({ opened: true, url: '/labels/print?sample=1' });
    expect(opened).toEqual(['http://localhost:3000/labels/print?sample=1']);
  });
});
```

- [ ] **Step 2: Viết test `server/src/label-window.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { createLabelOpener, findBrowser } from './label-window.js';

const env = { ProgramFiles: 'C:\\Program Files', 'ProgramFiles(x86)': 'C:\\Program Files (x86)', LocalAppData: 'C:\\Users\\a\\AppData\\Local' };

describe('findBrowser', () => {
  it('cùng thứ tự với open.vbs: Chrome (Program Files, x86, LocalAppData) rồi Edge', () => {
    const has = (...paths: string[]) => (p: string) => paths.includes(p);
    const chromeLocal = 'C:\\Users\\a\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe';
    const edge86 = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    expect(findBrowser(env, has(chromeLocal, edge86))).toBe(chromeLocal);
    expect(findBrowser(env, has(edge86))).toBe(edge86);
    expect(findBrowser(env, has())).toBeNull();
    expect(findBrowser({}, () => true)).toBeNull();
  });

  it('không có trình duyệt thì opener trả false, không spawn', () => {
    expect(createLabelOpener('C:\\data\\label-browser', null)('http://localhost:3000/labels/print?sample=1')).toBe(false);
  });
});
```

- [ ] **Step 3: Viết test API `server/src/routes/supplier-returns-api.test.ts`**

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { createTestDb } from '../db/test-db.js';
import { createApp } from '../app.js';

const opened: string[] = [];
let server: Server;
let base: string;
beforeAll(async () => {
  server = createApp(createTestDb(), { labels: { origin: 'http://localhost:3000', open: (url) => (opened.push(url), true) } }).listen(0);
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
  return { status: res.status, type: res.headers.get('content-type'), json: text && res.headers.get('content-type')?.includes('json') ? JSON.parse(text) : null };
};

describe('API trả NCC', () => {
  it('lập phiếu, danh sách hôm nay, chi tiết, hủy, hủy lần hai 409, xuất Excel', async () => {
    const p = await call('POST', '/api/products', { name: 'Nước suối', costPrice: 4000, sellPrice: 5000, stock: 10 });
    const s = await call('POST', '/api/suppliers', { name: 'Đại lý Hùng' });
    const created = await call('POST', '/api/supplier-returns', { supplierId: s.json.id, items: [{ productId: p.json.id, qty: 2, unitPrice: 4000 }] });
    expect(created.status).toBe(201);
    expect(created.json).toMatchObject({ total: 8000, debtReduced: 0, cashReceived: 8000, supplierName: 'Đại lý Hùng' });
    expect(created.json.code).toMatch(/^TN-\d{8}-0001$/);
    expect((await call('GET', `/api/products/${p.json.id}`)).json.stock).toBe(8);

    const list = await call('GET', '/api/supplier-returns');
    expect(list.json.returns.map((r: { id: number }) => r.id)).toEqual([created.json.id]);
    expect(list.json.summary).toEqual({ count: 1, total: 8000, debt: 0, cash: 8000 });
    expect((await call('GET', `/api/supplier-returns/${created.json.id}`)).json.items).toHaveLength(1);
    expect((await call('GET', '/api/supplier-returns/export.xlsx')).type).toContain('spreadsheetml');

    expect((await call('POST', `/api/supplier-returns/${created.json.id}/cancel`)).json.status).toBe('cancelled');
    expect((await call('POST', `/api/supplier-returns/${created.json.id}/cancel`)).status).toBe(409);
    expect((await call('GET', `/api/products/${p.json.id}`)).json.stock).toBe(10);
  });

  it('400 khi không có món / NCC lạ / lọc sai; 404 phiếu không có', async () => {
    const s = await call('POST', '/api/suppliers', { name: 'NCC B' });
    expect((await call('POST', '/api/supplier-returns', { supplierId: s.json.id, items: [] })).status).toBe(400);
    expect((await call('POST', '/api/supplier-returns', { supplierId: 999, items: [{ productId: 1, qty: 1, unitPrice: 1 }] })).status).toBe(400);
    expect((await call('GET', '/api/supplier-returns?from=2026-10-02&to=2026-10-01')).status).toBe(400);
    expect((await call('GET', '/api/supplier-returns/999')).status).toBe(404);
  });
});

describe('API in tem', () => {
  it('cấp mã, mở cửa sổ với URL đầy đủ; tem mẫu; 400 khi rỗng hoặc quá 500 tem', async () => {
    opened.length = 0;
    const p = await call('POST', '/api/products', { name: 'Bánh bò', sellPrice: 5000 });
    const r = await call('POST', '/api/labels/print', { items: [{ productId: p.json.id, copies: 2 }] });
    expect(r.json).toEqual({ opened: true, url: `/labels/print?i=${p.json.id}.0x2` });
    expect(opened).toEqual([`http://localhost:3000/labels/print?i=${p.json.id}.0x2`]);
    expect((await call('GET', `/api/products/${p.json.id}`)).json.barcode).toMatch(/^20\d{11}$/);
    expect((await call('POST', '/api/labels/sample')).json).toEqual({ opened: true, url: '/labels/print?sample=1' });
    expect((await call('POST', '/api/labels/print', { items: [] })).status).toBe(400);
    expect((await call('POST', '/api/labels/print', { items: [{ productId: p.json.id, copies: 300 }, { productId: p.json.id, copies: 300 }] })).status).toBe(400);
  });
});
```

- [ ] **Step 4: Chạy để thấy fail**

Run: `cd server && npx vitest run src/services/labels.test.ts src/label-window.test.ts src/routes/supplier-returns-api.test.ts`
Expected: FAIL – chưa có `./labels.js`, `./label-window.js`; `createApp` chưa nhận `labels`, route 404.

- [ ] **Step 5: Viết `server/src/services/labels.ts`**

```ts
import { and, eq, like } from 'drizzle-orm';
import { formatLabelItems, INTERNAL_MAX_SEQ, internalEan13, internalSeq, type LabelPrintInput, type LabelPrintResult } from '@tiny-pos/shared';
import type { Db, DbOrTx } from '../db/connection.js';
import { productUnits, products } from '../db/schema.js';
import { BadRequestError, ConflictError } from '../errors.js';
import { assertBarcodeFree } from './products.js';

/** Mở cửa sổ in tem trên máy quầy; false = không mở được (dev, không có trình duyệt), client tự mở tab. */
export type LabelOpener = (url: string) => boolean;
export interface LabelDeps {
  open: LabelOpener;
  /** Gốc URL cửa sổ in tem mở tới, ví dụ http://localhost:3000. */
  origin: string;
}
export const NO_LABEL_WINDOW: LabelDeps = { open: () => false, origin: '' };

/** Số thứ tự lớn nhất của mã nội bộ 20… hợp lệ đang có trên sản phẩm và đơn vị (kể cả mã gõ tay). */
function maxInternalSeq(tx: DbOrTx): number {
  const codes = [
    ...tx.select({ c: products.barcode }).from(products).where(like(products.barcode, '20%')).all(),
    ...tx.select({ c: productUnits.barcode }).from(productUnits).where(like(productUnits.barcode, '20%')).all(),
  ];
  let max = 0;
  for (const { c } of codes) {
    const seq = c ? internalSeq(c) : null;
    if (seq !== null && seq > max) max = seq;
  }
  return max;
}

/** Cấp mã EAN-13 nội bộ cho sản phẩm/đơn vị chưa có mã, gọi trong transaction; không bao giờ ghi đè mã đã có. */
export function assignBarcodes(tx: DbOrTx, items: { productId: number; unitId: number | null }[]): void {
  let seq = maxInternalSeq(tx);
  const next = () => {
    if (seq >= INTERNAL_MAX_SEQ) throw new ConflictError('Đã hết mã nội bộ để cấp');
    const code = internalEan13(++seq);
    assertBarcodeFree(tx, code);
    return code;
  };
  for (const it of items) {
    if (it.unitId === null) {
      const p = tx.select({ barcode: products.barcode }).from(products).where(eq(products.id, it.productId)).get();
      if (!p) throw new BadRequestError('Sản phẩm không hợp lệ');
      if (p.barcode) continue;
      tx.update(products).set({ barcode: next(), updatedAt: new Date().toISOString() }).where(eq(products.id, it.productId)).run();
    } else {
      const u = tx
        .select({ barcode: productUnits.barcode })
        .from(productUnits)
        .where(and(eq(productUnits.id, it.unitId), eq(productUnits.productId, it.productId)))
        .get();
      if (!u) throw new BadRequestError('Sản phẩm không hợp lệ');
      if (u.barcode) continue;
      tx.update(productUnits).set({ barcode: next() }).where(eq(productUnits.id, it.unitId)).run();
    }
  }
}

/** Cấp mã còn thiếu rồi mở trang in; mở cửa sổ nằm ngoài transaction. */
export function printLabels(db: Db, input: LabelPrintInput, deps: LabelDeps): LabelPrintResult {
  db.transaction((tx) => assignBarcodes(tx, input.items));
  const url = `/labels/print?i=${formatLabelItems(input.items)}`;
  return { opened: deps.open(deps.origin + url), url };
}

/** Tem mẫu cho nút In thử ở Cài đặt; không cần sản phẩm, không ghi DB. */
export function printSampleLabel(deps: LabelDeps): LabelPrintResult {
  const url = '/labels/print?sample=1';
  return { opened: deps.open(deps.origin + url), url };
}
```

- [ ] **Step 6: Viết `server/src/label-window.ts`**

```ts
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { LabelOpener } from './services/labels.js';

const CHROME = ['Google', 'Chrome', 'Application', 'chrome.exe'];
const EDGE = ['Microsoft', 'Edge', 'Application', 'msedge.exe'];

/** Cùng thứ tự với scripts/open.vbs: Chrome (Program Files, x86, LocalAppData) rồi Edge. */
export function findBrowser(env: NodeJS.ProcessEnv = process.env, exists: (p: string) => boolean = fs.existsSync): string | null {
  const pf = env['ProgramFiles'];
  const pf86 = env['ProgramFiles(x86)'];
  const local = env['LocalAppData'] ?? env['LOCALAPPDATA'];
  const candidates = [
    pf && path.win32.join(pf, ...CHROME),
    pf86 && path.win32.join(pf86, ...CHROME),
    local && path.win32.join(local, ...CHROME),
    pf86 && path.win32.join(pf86, ...EDGE),
    pf && path.win32.join(pf, ...EDGE),
  ].filter((p): p is string => !!p);
  return candidates.find((p) => exists(p)) ?? null;
}

/**
 * Cửa sổ trình duyệt thứ hai với hồ sơ riêng, KHÔNG --kiosk-printing: hộp in hiện ra và Chrome nhớ máy in tem đã chọn,
 * còn cửa sổ bán hàng vẫn in hóa đơn thẳng ra máy mặc định.
 */
export function createLabelOpener(profileDir: string, browser: string | null = findBrowser()): LabelOpener {
  return (url) => {
    if (!browser) return false;
    try {
      const child = spawn(browser, [`--app=${url}`, `--user-data-dir=${profileDir}`, '--no-first-run', '--no-default-browser-check'], {
        detached: true,
        stdio: 'ignore',
      });
      child.on('error', () => {}); // lỗi spawn đến sau (mất file, thiếu quyền) không được làm sập server
      child.unref();
      return true;
    } catch {
      return false;
    }
  };
}
```

- [ ] **Step 7: Route và gắn vào app**

`server/src/routes/supplier-returns.ts`:

```ts
import { Router } from 'express';
import { supplierReturnInputSchema, supplierReturnListQuerySchema, type SupplierReturnListQuery } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { intParam, validateBody, validateQuery } from '../middleware/validate.js';
import { exportSupplierReturnsXlsx } from '../services/exports.js';
import { cancelSupplierReturn, createSupplierReturn, getSupplierReturn, listSupplierReturns } from '../services/supplier-returns.js';
import { sendXlsx } from './send-xlsx.js';

export function supplierReturnsRouter(db: Db): Router {
  const r = Router();
  r.get('/', validateQuery(supplierReturnListQuerySchema), (_req, res) => {
    res.json(listSupplierReturns(db, res.locals['query'] as SupplierReturnListQuery));
  });
  r.get('/export.xlsx', validateQuery(supplierReturnListQuerySchema), async (_req, res) =>
    sendXlsx(res, await exportSupplierReturnsXlsx(db, res.locals['query'] as SupplierReturnListQuery)),
  );
  r.get('/:id', (req, res) => res.json(getSupplierReturn(db, intParam(req, 'id'))));
  r.post('/', validateBody(supplierReturnInputSchema), (req, res) => res.status(201).json(createSupplierReturn(db, req.body)));
  r.post('/:id/cancel', (req, res) => res.json(cancelSupplierReturn(db, intParam(req, 'id'))));
  return r;
}
```

`server/src/routes/labels.ts`:

```ts
import { Router } from 'express';
import { labelPrintInputSchema } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { validateBody } from '../middleware/validate.js';
import { printLabels, printSampleLabel, type LabelDeps } from '../services/labels.js';

export function labelsRouter(db: Db, deps: LabelDeps): Router {
  const r = Router();
  r.post('/print', validateBody(labelPrintInputSchema), (req, res) => res.json(printLabels(db, req.body, deps)));
  r.post('/sample', (_req, res) => res.json(printSampleLabel(deps)));
  return r;
}
```

`server/src/routes/index.ts`:
- Thêm import sau `import { returnsRouter } from './returns.js';`: `import { supplierReturnsRouter } from './supplier-returns.js';` và `import { labelsRouter } from './labels.js';`; sau `import type { BackupService } …`: `import { NO_LABEL_WINDOW, type LabelDeps } from '../services/labels.js';`
- Chữ ký: `export function apiRouter(db: Db, deps: { backups?: BackupService } = {}): Router {` → `export function apiRouter(db: Db, deps: { backups?: BackupService; labels?: LabelDeps } = {}): Router {`
- Sau `r.use('/imports', importsRouter(db));` thêm:

```ts
  r.use('/supplier-returns', supplierReturnsRouter(db));
  r.use('/labels', labelsRouter(db, deps.labels ?? NO_LABEL_WINDOW));
```

`server/src/app.ts`:
- Thêm `import type { LabelDeps } from './services/labels.js';` cạnh import `BackupService`.
- `export function createApp(db: Db, opts: { clientDist?: string; backups?: BackupService } = {}): Express {` → `… opts: { clientDist?: string; backups?: BackupService; labels?: LabelDeps } = {} …`
- `app.use('/api', apiRouter(db, { backups: opts.backups }));` → `app.use('/api', apiRouter(db, { backups: opts.backups, labels: opts.labels }));`

`server/src/index.ts`:
- Thêm import sau dòng `createBackupService`: `import { createLabelOpener } from './label-window.js';`
- Thay dòng `const app = createApp(db, { clientDist: path.join(repoRoot, 'client', 'dist'), backups });` bằng:

```ts
// Chỉ bản build trên Windows (máy quầy) mới tự mở cửa sổ in tem; dev (tsx chạy src/) để trình duyệt mở tab mới
const built = path.basename(path.dirname(fileURLToPath(import.meta.url))) === 'dist';
const labels =
  process.platform === 'win32' && built
    ? { open: createLabelOpener(path.join(dataDir, 'label-browser')), origin: `http://localhost:${port}` }
    : undefined;
const app = createApp(db, { clientDist: path.join(repoRoot, 'client', 'dist'), backups, labels });
```

- [ ] **Step 8: Chạy toàn bộ test server + typecheck**

Run: `npm run typecheck && npm test`
Expected: PASS hết (test cũ không đổi kỳ vọng; client typecheck có thể **lỗi** ở `StockHistoryDialog.tsx` vì `Record<MovementType, string>` thiếu `supplier_return` – sửa ngay ở Task 4 Step 1, chấp nhận trong lúc này nếu chỉ còn lỗi đó).

---

### Task 4: Client – hook, ô chọn đơn vị dùng chung, màn lập phiếu trả NCC, phiếu in

**Files:**
- Create: `client/src/api/supplier-returns.ts`, `client/src/components/UnitSelect.tsx`, `client/src/pages/supplier-returns/useSupplierReturnDraft.ts`, `client/src/pages/supplier-returns/SupplierReturnLinesTable.tsx`, `client/src/pages/supplier-returns/SupplierReturnFooter.tsx`, `client/src/pages/supplier-returns/SupplierReturnFormPage.tsx`
- Modify: `client/src/pages/products/StockHistoryDialog.tsx:9`, `client/src/pages/imports/ImportLineRow.tsx`, `client/src/pages/imports/SupplierPicker.tsx`, `client/src/components/receipt/receipt-data.ts`, `client/src/components/receipt/Receipt.tsx`, `client/src/components/receipt/PrintProvider.tsx`

**Interfaces:**
- Consumes: Task 1 (draft, `unitOptions`, `formatQty`, `formatMoney`, types); API Task 3.
- Produces: `useSupplierReturns(p: SupplierReturnListParams)`, `useSupplierReturn(id)`, `useCreateSupplierReturn()`, `useCancelSupplierReturn()`; `<UnitSelect options value onChange />`; `SupplierPicker` prop `allowNone?: boolean` (mặc định `true`); `SupplierReturnReceiptData`, `receiptFromSupplierReturn(r)`, `<SupplierReturnReceipt />`; `<SupplierReturnFormPage />` (route `/supplier-returns/new`, đọc `?supplierId=`).

- [ ] **Step 1: Nhãn lịch sử tồn**

`client/src/pages/products/StockHistoryDialog.tsx:9`:

```ts
const TYPE_LABEL: Record<MovementType, string> = { sale: 'Bán', return: 'Trả', import: 'Nhập', adjust: 'Điều chỉnh', supplier_return: 'Trả NCC' };
```

- [ ] **Step 2: Hook `client/src/api/supplier-returns.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DocStatus, SupplierReturnDetail, SupplierReturnInputBody, SupplierReturnList } from '@tiny-pos/shared';
import { api, queryString } from './client';

export interface SupplierReturnListParams {
  from: string;
  to: string;
  q?: string;
  status?: DocStatus[];
  supplierId?: number;
  page?: number;
}

export const useSupplierReturns = (p: SupplierReturnListParams) =>
  useQuery({
    queryKey: ['supplier-returns', 'list', p],
    queryFn: () => api<SupplierReturnList>(`/supplier-returns${queryString({ ...p })}`),
    placeholderData: (prev) => prev,
  });

export const useSupplierReturn = (id: number | null) =>
  useQuery({ queryKey: ['supplier-returns', 'detail', id], queryFn: () => api<SupplierReturnDetail>(`/supplier-returns/${id}`), enabled: id !== null });

/** Phiếu trả NCC đổi tồn và nợ NCC; Tổng quan đọc tồn thấp và nợ NCC. */
function useInvalidateSupplierReturns() {
  const qc = useQueryClient();
  return () => {
    for (const key of ['supplier-returns', 'products', 'suppliers', 'reports', 'overview']) void qc.invalidateQueries({ queryKey: [key] });
  };
}

export function useCreateSupplierReturn() {
  const invalidate = useInvalidateSupplierReturns();
  return useMutation({
    mutationFn: (input: SupplierReturnInputBody) => api<SupplierReturnDetail>('/supplier-returns', { json: input }),
    onSuccess: invalidate,
  });
}

export function useCancelSupplierReturn() {
  const invalidate = useInvalidateSupplierReturns();
  return useMutation({
    mutationFn: (id: number) => api<SupplierReturnDetail>(`/supplier-returns/${id}/cancel`, { method: 'POST' }),
    onSuccess: invalidate,
  });
}
```

- [ ] **Step 3: Tách ô chọn đơn vị `client/src/components/UnitSelect.tsx`**

```tsx
import { formatQty } from '@tiny-pos/shared';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/** Radix không cho SelectItem value rỗng: đơn vị gốc dùng giá trị thay thế. */
const BASE = '__base__';

export interface UnitChoice {
  id: number | null;
  name: string;
  factor: number;
}

/** Chọn đơn vị gốc hoặc thùng/lốc (kèm hệ số); sản phẩm chỉ có đơn vị gốc thì hiện tên. */
export function UnitSelect({ options, value, onChange }: { options: UnitChoice[]; value: number | null; onChange: (unitId: number | null) => void }) {
  if (options.length <= 1) return <span className="px-2">{options[0]?.name}</span>;
  return (
    <Select value={value === null ? BASE : String(value)} onValueChange={(v) => onChange(v === BASE ? null : Number(v))}>
      <SelectTrigger aria-label="Đơn vị" className="h-11 w-36 text-base data-[size=default]:h-11">
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper">
        {options.map((o) => (
          <SelectItem key={o.id ?? BASE} value={o.id === null ? BASE : String(o.id)} className="py-2 text-base">
            {o.name}
            {o.factor !== 1 && ` (${formatQty(o.factor)})`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

`client/src/pages/imports/ImportLineRow.tsx` – chỉ đổi đúng các dòng sau, phần khác giữ nguyên:
- Dòng import shared: bỏ `formatQty, ` (không còn dùng): `import { currentOption, formatMoney, importLineAmount, marginPercent, type DraftAction, type DraftLine } from '@tiny-pos/shared';`
- Bỏ dòng `import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';`, thêm `import { UnitSelect } from '@/components/UnitSelect';` sau dòng import `CommitInput`.
- Bỏ 2 dòng `/** Radix không cho … */` và `const BASE = '__base__';` (cùng dòng trống sau nó).
- Thay cả khối `{line.options.length > 1 ? ( <Select …> … </Select> ) : ( <span className="px-2">{opt.name}</span> )}` trong ô Đơn vị bằng:

```tsx
        <UnitSelect options={line.options} value={line.unitId} onChange={(unitId) => dispatch({ type: 'setUnit', key: line.key, unitId })} />
```

`client/src/pages/imports/SupplierPicker.tsx` – thêm prop `allowNone`:
- Interface: thêm sau `onChange: …;`:

```ts
  /** Có mục "Không ghi nhà cung cấp" (phiếu nhập); phiếu trả NCC thì bắt buộc chọn. */
  allowNone?: boolean;
```

- `export function SupplierPicker({ value, onChange }: Props) {` → `export function SupplierPicker({ value, onChange, allowNone = true }: Props) {`
- `<span className="truncate">{current ? current.name : 'Không ghi nhà cung cấp'}</span>` → `<span className="truncate">{current ? current.name : allowNone ? 'Không ghi nhà cung cấp' : 'Chọn nhà cung cấp'}</span>`
- Bọc `CommandItem` "Không ghi nhà cung cấp #none" bằng `{allowNone && ( … )}` (giữ nguyên nội dung bên trong).

- [ ] **Step 4: Phiếu in trả NCC**

`client/src/components/receipt/receipt-data.ts`:
- Dòng import đầu: thêm `type SupplierReturnDetail` vào danh sách type import từ `@tiny-pos/shared`.
- `export type PrintData = ReceiptData | DebtReceiptData | ReturnReceiptData;` → `export type PrintData = ReceiptData | DebtReceiptData | ReturnReceiptData | SupplierReturnReceiptData;`
- Thêm cuối file:

```ts

/** Phiếu trả hàng NCC 80mm: người giao hàng của NCC ký nhận. */
export interface SupplierReturnReceiptData {
  kind: 'supplier-return';
  code: string;
  createdAt: string;
  supplierName: string;
  items: ReceiptItem[];
  total: number;
  debtReduced: number;
  cashReceived: number;
  note: string | null;
  cancelled: boolean;
}

export function receiptFromSupplierReturn(r: SupplierReturnDetail): SupplierReturnReceiptData {
  return {
    kind: 'supplier-return',
    code: r.code,
    createdAt: r.createdAt,
    supplierName: r.supplierName,
    items: r.items.map((i) => ({ name: i.productName, unit: i.unitName, qty: i.qty, price: i.unitPrice, amount: i.amount })),
    total: r.total,
    debtReduced: r.debtReduced,
    cashReceived: r.cashReceived,
    note: r.note,
    cancelled: r.status === 'cancelled',
  };
}
```

`client/src/components/receipt/Receipt.tsx`:
- Dòng import type: `import type { DebtReceiptData, ReceiptData, ReturnReceiptData } from './receipt-data';` → thêm `, SupplierReturnReceiptData`.
- Thêm cuối file:

```tsx

/** Phiếu trả hàng NCC 80mm: hai chỗ ký để bên giao (tiệm) và bên nhận (NCC) xác nhận. */
export function SupplierReturnReceipt({ data, settings }: { data: SupplierReturnReceiptData; settings: Settings }) {
  return (
    <div style={page}>
      <StoreHeader settings={settings} />
      <div style={rule} />
      <div style={{ ...center, fontWeight: 700 }}>{data.cancelled ? 'PHIẾU TRẢ HÀNG NCC ĐÃ HỦY' : 'PHIẾU TRẢ HÀNG NHÀ CUNG CẤP'}</div>
      <div style={center}>{data.code}</div>
      <div style={center}>{timeLabel(data.createdAt)}</div>
      <div style={{ ...center, overflowWrap: 'anywhere' }}>NCC: {data.supplierName}</div>
      <div style={rule} />
      {data.items.map((it, i) => (
        <div key={i} style={{ marginBottom: '3px' }}>
          <div>{it.name}</div>
          <Row label={`${formatQty(it.qty)} ${it.unit} × ${formatMoney(it.price)}`} value={formatMoney(it.amount)} />
        </div>
      ))}
      <div style={rule} />
      <Row label="Tổng" value={formatMoney(data.total)} strong />
      {data.debtReduced > 0 && <Row label="Trừ nợ" value={formatMoney(data.debtReduced)} />}
      <Row label="NCC trả tiền mặt" value={formatMoney(data.cashReceived)} />
      {data.note && <div style={{ overflowWrap: 'anywhere' }}>Ghi chú: {data.note}</div>}
      <div style={rule} />
      <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', marginTop: '4px', height: '18mm' }}>
        <span>Bên giao</span>
        <span>Bên nhận</span>
      </div>
    </div>
  );
}
```

`client/src/components/receipt/PrintProvider.tsx`:
- `import { DebtReceipt, Receipt, ReturnReceipt } from './Receipt';` → `import { DebtReceipt, Receipt, ReturnReceipt, SupplierReturnReceipt } from './Receipt';`
- Trong portal, thay `job.data.kind === 'return' ? (` bằng nhánh mới đứng trước:

```tsx
            job.data.kind === 'supplier-return' ? (
              <SupplierReturnReceipt data={job.data} settings={settings ?? SETTINGS_DEFAULTS} />
            ) : job.data.kind === 'return' ? (
```

(các dòng `<ReturnReceipt …/>`, `) : (`, `<DebtReceipt …/>`, `)` sau đó giữ nguyên).

- [ ] **Step 5: Nháp phiếu `client/src/pages/supplier-returns/useSupplierReturnDraft.ts`**

```ts
import { useEffect, useReducer } from 'react';
import { parseSupplierReturnDraft, supplierReturnDraftReducer } from '@tiny-pos/shared';
import { readStorage, writeStorage } from '@/lib/storage';

const KEY = 'tiny-pos.supplier-return-draft';

/** Phiếu trả NCC đang soạn; tự lưu nháp để rời trang/F5 không mất. */
export function useSupplierReturnDraft() {
  const [draft, dispatch] = useReducer(supplierReturnDraftReducer, undefined, () => parseSupplierReturnDraft(readStorage(KEY)));
  useEffect(() => writeStorage(KEY, JSON.stringify(draft)), [draft]);
  return { draft, dispatch };
}
```

- [ ] **Step 6: Bảng dòng `client/src/pages/supplier-returns/SupplierReturnLinesTable.tsx`**

```tsx
import type { Dispatch } from 'react';
import { PackageMinus, Trash2 } from 'lucide-react';
import { formatMoney, formatQty, importLineAmount, overStock, type SupplierReturnAction, type SupplierReturnLine } from '@tiny-pos/shared';
import { CommitInput } from '@/components/CommitInput';
import { EmptyState } from '@/components/EmptyState';
import { UnitSelect } from '@/components/UnitSelect';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Props {
  lines: SupplierReturnLine[];
  dispatch: Dispatch<SupplierReturnAction>;
  onDone: () => void;
}

function LineRow({ line, dispatch, onDone }: { line: SupplierReturnLine; dispatch: Dispatch<SupplierReturnAction>; onDone: () => void }) {
  const update = (patch: Partial<Pick<SupplierReturnLine, 'qty' | 'unitPrice'>>) => dispatch({ type: 'update', key: line.key, patch });
  return (
    <TableRow>
      <TableCell className="px-4 py-2 whitespace-normal">
        <div className="font-medium">{line.name}</div>
        {!line.isActive && <Badge variant="secondary">Ngừng bán</Badge>}
        {overStock(line) && (
          <div className="text-sm text-warning">
            Tồn hiện có {formatQty(line.stock)} {line.baseUnit}
          </div>
        )}
      </TableCell>
      <TableCell className="px-2 py-2">
        <UnitSelect options={line.options} value={line.unitId} onChange={(unitId) => dispatch({ type: 'setUnit', key: line.key, unitId })} />
      </TableCell>
      <TableCell className="px-2 py-2">
        <CommitInput aria-label="Số lượng" value={line.qty} onCommit={(qty) => update({ qty })} onEnter={onDone} className="w-20 text-center" />
      </TableCell>
      <TableCell className="px-2 py-2">
        <CommitInput aria-label="Giá trả" money value={line.unitPrice} onCommit={(unitPrice) => update({ unitPrice })} onEnter={onDone} className="w-32" />
      </TableCell>
      <TableCell className="px-2 py-2 text-right font-semibold tabular-nums">{formatMoney(importLineAmount(line.qty, line.unitPrice))}</TableCell>
      <TableCell className="py-2 pr-2">
        <Button variant="ghost" size="icon-lg" className="size-11" aria-label="Xóa dòng" onClick={() => dispatch({ type: 'remove', key: line.key })}>
          <Trash2 />
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function SupplierReturnLinesTable({ lines, dispatch, onDone }: Props) {
  if (!lines.length)
    return <EmptyState icon={PackageMinus} title="Phiếu trả trống" description="Quét mã vạch hoặc gõ tên hàng cần trả để thêm dòng." />;
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <TableHead className="px-4">Sản phẩm</TableHead>
          <TableHead className="w-40 px-2">Đơn vị</TableHead>
          <TableHead className="w-24 px-2">Số lượng</TableHead>
          <TableHead className="w-36 px-2 text-right">Giá trả</TableHead>
          <TableHead className="w-32 px-2 text-right">Thành tiền</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((l) => (
          <LineRow key={l.key} line={l} dispatch={dispatch} onDone={onDone} />
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 7: Chân phiếu `client/src/pages/supplier-returns/SupplierReturnFooter.tsx`**

```tsx
import { Save } from 'lucide-react';
import { formatMoney } from '@tiny-pos/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  totals: { total: number; debtReduced: number; cashReceived: number };
  hasSupplier: boolean;
  onSave: () => void;
  saving: boolean;
  empty: boolean;
}

export function SupplierReturnFooter({ totals, hasSupplier, onSave, saving, empty }: Props) {
  return (
    <Card className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 gap-0 py-0 md:bottom-4">
      <CardContent className="flex flex-wrap items-end justify-between gap-4 p-4">
        <div>
          <div className="text-sm text-muted-foreground">Tổng trả</div>
          <div className="font-heading text-3xl font-semibold tabular-nums">{formatMoney(totals.total)}</div>
          <div className="text-sm text-muted-foreground tabular-nums">
            {hasSupplier
              ? `Trừ nợ ${formatMoney(totals.debtReduced)} · NCC trả tiền mặt ${formatMoney(totals.cashReceived)}`
              : 'Chọn nhà cung cấp để lưu phiếu'}
          </div>
        </div>
        <Button className="h-14 px-8 text-lg" disabled={empty || !hasSupplier || saving} onClick={onSave}>
          <Save data-icon="inline-start" />
          Lưu phiếu trả
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 8: Màn lập phiếu `client/src/pages/supplier-returns/SupplierReturnFormPage.tsx`**

```tsx
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { supplierReturnTotals, toSupplierReturnInput, type Product, type ProductWithUnits } from '@tiny-pos/shared';
import { ApiError } from '@/api/client';
import { fetchProduct, lookupBarcode } from '@/api/products';
import { useCreateSupplierReturn } from '@/api/supplier-returns';
import { useSuppliers } from '@/api/suppliers';
import { PageTitle } from '@/components/layout/PageTitle';
import { ListPanel } from '@/components/ListPanel';
import { ProductSearch } from '@/components/ProductSearch';
import { usePrint } from '@/components/receipt/PrintProvider';
import { receiptFromSupplierReturn } from '@/components/receipt/receipt-data';
import { Input } from '@/components/ui/input';
import { useScanInput } from '@/hooks/useScanInput';
import { SupplierPicker } from '../imports/SupplierPicker';
import { SupplierReturnFooter } from './SupplierReturnFooter';
import { SupplierReturnLinesTable } from './SupplierReturnLinesTable';
import { useSupplierReturnDraft } from './useSupplierReturnDraft';

const noop = () => {};

export function SupplierReturnFormPage() {
  const [params] = useSearchParams();
  const { draft, dispatch } = useSupplierReturnDraft();
  const { data: suppliers = [] } = useSuppliers();
  const create = useCreateSupplierReturn();
  const navigate = useNavigate();
  const print = usePrint();
  const scan = useScanInput(noop);

  // Mở từ chi tiết NCC: chọn sẵn NCC đó
  const preset = Number(params.get('supplierId')) || null;
  useEffect(() => {
    if (preset) dispatch({ type: 'setSupplier', supplierId: preset });
  }, [preset]);

  const supplier = suppliers.find((s) => s.id === draft.supplierId) ?? null;
  const totals = supplierReturnTotals(draft, supplier?.debt ?? 0);

  const add = (product: ProductWithUnits, unitId: number | null) => dispatch({ type: 'add', product, unitId });
  const onScan = async (code: string) => {
    try {
      const r = await lookupBarcode(code);
      add(await fetchProduct(r.product.id), r.unit?.id ?? null);
    } catch (e) {
      toast.error(e instanceof ApiError && e.status === 404 ? `Không có hàng mã ${code}` : (e as Error).message);
    }
  };
  const onPick = async (p: Product) => {
    try {
      add(await fetchProduct(p.id), null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const save = () => {
    if (!supplier || !draft.lines.length || create.isPending) return;
    create.mutate(toSupplierReturnInput(draft, supplier.id), {
      onSuccess: (r) => {
        dispatch({ type: 'clear' });
        toast.success(`Đã lập ${r.code}`, { action: { label: 'In phiếu', onClick: () => void print(receiptFromSupplierReturn(r)) } });
        navigate('/supplier-returns');
      },
      // Lỗi: giữ nguyên phiếu nháp để sửa rồi lưu lại
      onError: (err) => {
        toast.error(err.message);
        scan.focus();
      },
    });
  };

  return (
    <div className="space-y-3 pb-4">
      <PageTitle title="Lập phiếu trả NCC" back="/supplier-returns" />
      <p className="text-sm text-muted-foreground">Quét hoặc tìm hàng cần trả; giá trả mặc định là giá nhập gần nhất, sửa được.</p>
      <div className="flex flex-wrap items-center gap-3">
        <SupplierPicker allowNone={false} value={draft.supplierId} onChange={(supplierId) => dispatch({ type: 'setSupplier', supplierId })} />
        <Input
          placeholder="Ghi chú phiếu (ví dụ: hết hạn, móp)"
          maxLength={200}
          value={draft.note}
          onChange={(e) => dispatch({ type: 'setNote', note: e.target.value })}
          className="h-11 min-w-0 flex-1 text-base"
        />
      </div>
      <ProductSearch inputRef={scan.ref} includeInactive onScan={(c) => void onScan(c)} onPick={(p) => void onPick(p)} />
      <ListPanel>
        <SupplierReturnLinesTable lines={draft.lines} dispatch={dispatch} onDone={scan.focus} />
      </ListPanel>
      <SupplierReturnFooter totals={totals} hasSupplier={supplier !== null} onSave={save} saving={create.isPending} empty={!draft.lines.length} />
    </div>
  );
}
```

Ghi chú: `useEffect(..., [preset])` theo đúng mẫu `[data]` ở các trang khác; nếu repo có comment `// eslint-disable-line react-hooks/exhaustive-deps` cho mẫu này (xem `ReturnsPage.tsx`) thì thêm y như vậy.

- [ ] **Step 9: Typecheck client**

Run: `npm run typecheck`
Expected: không lỗi (route chưa gắn, nên trang chưa vào được – Task 5 gắn).

---

### Task 5: Client – trang Trả NCC, chi tiết phiếu, menu, nút ở chi tiết NCC

**Files:**
- Create: `client/src/pages/supplier-returns/SupplierReturnTable.tsx`, `client/src/pages/supplier-returns/SupplierReturnDetailDialog.tsx`, `client/src/pages/supplier-returns/SupplierReturnsPage.tsx`
- Modify: `client/src/router.tsx`, `client/src/pages/suppliers/SupplierDetailDialog.tsx`

**Interfaces:**
- Consumes: Task 4 (hook, `receiptFromSupplierReturn`, `SupplierReturnFormPage`); `dayTime`, `time` (`pages/orders/OrderTable`).
- Produces: route `/supplier-returns`, `/supplier-returns/new`; NAV *Trả NCC*.

- [ ] **Step 1: Bảng `client/src/pages/supplier-returns/SupplierReturnTable.tsx`**

```tsx
import { formatMoney, type SupplierReturnSummary } from '@tiny-pos/shared';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { dayTime, time } from '../orders/OrderTable';

/** Bảng phiếu trả NCC; xem nhiều ngày thì cột thời gian ghi cả ngày. Bấm vào hàng để xem chi tiết. */
export function SupplierReturnTable({ rows, onOpen, showDate = false }: { rows: SupplierReturnSummary[]; onOpen: (id: number) => void; showDate?: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <TableHead className="px-4">Mã</TableHead>
          <TableHead className="px-4">{showDate ? 'Thời gian' : 'Giờ'}</TableHead>
          <TableHead className="px-4">Nhà cung cấp</TableHead>
          <TableHead className="px-4 text-right">Số món</TableHead>
          <TableHead className="px-4 text-right">Tổng trả</TableHead>
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
              <TableCell className="px-4 py-3">{r.supplierName}</TableCell>
              <TableCell className="px-4 py-3 text-right tabular-nums">{r.itemCount}</TableCell>
              <TableCell className={cn('px-4 py-3 text-right font-semibold tabular-nums', cancelled && 'line-through')}>{formatMoney(r.total)}</TableCell>
              <TableCell className="px-4 py-3">{cancelled ? <Badge variant="secondary">Đã hủy</Badge> : <Badge>Hoàn tất</Badge>}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 2: Chi tiết `client/src/pages/supplier-returns/SupplierReturnDetailDialog.tsx`**

```tsx
import { Ban, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney, formatQty } from '@tiny-pos/shared';
import { useCancelSupplierReturn, useSupplierReturn } from '@/api/supplier-returns';
import { useConfirm } from '@/components/ConfirmDialog';
import { MoneyLine } from '@/components/MoneyLine';
import { usePrint } from '@/components/receipt/PrintProvider';
import { receiptFromSupplierReturn } from '@/components/receipt/receipt-data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/** Chi tiết phiếu trả NCC: các dòng, in, hủy phiếu. */
export function SupplierReturnDetailDialog({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data: r } = useSupplierReturn(id);
  const cancel = useCancelSupplierReturn();
  const confirm = useConfirm();
  const print = usePrint();

  const onCancel = async () => {
    if (!r) return;
    const ok = await confirm({
      title: `Hủy phiếu trả ${r.code}?`,
      description: 'Tồn được cộng lại; nợ đã trừ của NCC được cộng lại. Phiếu vẫn được giữ với trạng thái Đã hủy.',
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
            {r?.code ?? 'Phiếu trả NCC'}
            {r?.status === 'cancelled' && <Badge variant="secondary">Đã hủy</Badge>}
          </DialogTitle>
          <DialogDescription className="text-base">
            {r && `${new Date(r.createdAt).toLocaleString('vi-VN')} · ${r.supplierName}${r.note ? ` · ${r.note}` : ''}`}
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
                      {formatQty(it.qty)} {it.unitName} × {formatMoney(it.unitPrice)}
                    </div>
                  </div>
                  <div className="font-semibold tabular-nums">{formatMoney(it.amount)}</div>
                </li>
              ))}
            </ul>
            <div className="space-y-1">
              <MoneyLine label="Tổng trả" value={formatMoney(r.total)} strong />
              {r.debtReduced > 0 && <MoneyLine label="Trừ nợ NCC" value={formatMoney(r.debtReduced)} />}
              <MoneyLine label="NCC trả tiền mặt" value={formatMoney(r.cashReceived)} />
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
          <Button className="h-11 text-base" disabled={!r} onClick={() => r && void print(receiptFromSupplierReturn(r))}>
            <Printer data-icon="inline-start" />
            In phiếu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Trang `client/src/pages/supplier-returns/SupplierReturnsPage.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { PackageMinus } from 'lucide-react';
import { DOC_STATUSES, formatMoney, resolveRange, supplierReturnListFields, validRange, type DocStatus } from '@tiny-pos/shared';
import { useSupplierReturns } from '@/api/supplier-returns';
import { useSuppliers } from '@/api/suppliers';
import { EmptyState } from '@/components/EmptyState';
import { MultiChoiceChips } from '@/components/filters/ChoiceChips';
import { DateRangeFilter, rangeChipLabel } from '@/components/filters/DateRangeFilter';
import { FilterBar, FilterGroup, type FilterChip } from '@/components/filters/FilterBar';
import { PageTitle } from '@/components/layout/PageTitle';
import { ListPanel } from '@/components/ListPanel';
import { Pager } from '@/components/Pager';
import { ToolbarSelect } from '@/components/SelectField';
import { Stat, StatStrip } from '@/components/StatStrip';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Button } from '@/components/ui/button';
import { useExportAction } from '@/hooks/useExportAction';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { today as todayOf } from '@/lib/today';
import { SupplierReturnDetailDialog } from './SupplierReturnDetailDialog';
import { SupplierReturnTable } from './SupplierReturnTable';

const STATUS_LABEL: Record<DocStatus, string> = { done: 'Hoàn tất', cancelled: 'Đã hủy' };
const STATUS_OPTIONS = DOC_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }));

export function SupplierReturnsPage() {
  const [openId, setOpenId] = useState<number | null>(null);
  const { filters: f, set, clear } = useUrlFilters(supplierReturnListFields);
  const exportAction = useExportAction('/supplier-returns/export.xlsx');
  const { data: suppliers = [] } = useSuppliers(true);
  const today = todayOf();
  const picked = resolveRange(f, today);
  // Khoảng sai trên URL (sửa tay) thì về hôm nay, không báo lỗi
  const range = validRange(picked.from, picked.to) ? picked : { from: today, to: today };
  const isToday = range.from === today && range.to === today;
  const { data, isLoading } = useSupplierReturns({ ...range, q: f.q, status: f.status, supplierId: f.supplierId, page: f.page });
  const s = data?.summary;

  // Lọc hẹp lại làm trang hiện tại vượt số trang → về trang cuối có dữ liệu
  useEffect(() => {
    if (data && data.page > 1 && !data.returns.length && data.total > 0) set({ page: Math.ceil(data.total / data.pageSize) });
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const status = f.status ?? [];
  const supplierLabel = suppliers.find((x) => x.id === f.supplierId)?.name;
  const chips: FilterChip[] = [
    { key: 'range', label: rangeChipLabel(range.from, range.to, today), onRemove: isToday ? undefined : () => set({ from: undefined, to: undefined, date: undefined }) },
    ...(f.supplierId ? [{ key: 'supplier', label: `NCC: ${supplierLabel ?? '…'}`, onRemove: () => set({ supplierId: undefined }) }] : []),
    ...status.map((st) => ({ key: `st-${st}`, label: STATUS_LABEL[st], onRemove: () => set({ status: status.filter((x) => x !== st) }) })),
  ];
  const activeCount = (isToday ? 0 : 1) + (f.supplierId ? 1 : 0) + (status.length ? 1 : 0);
  const filtered = activeCount > 0 || !!f.q;

  return (
    <>
      <PageTitle
        title="Trả NCC"
        count={data ? `${data.total} phiếu` : undefined}
        actions={[exportAction, { label: 'Lập phiếu trả', icon: PackageMinus, to: '/supplier-returns/new', primary: true }]}
      />
      <StatStrip cols={4}>
        <Stat label="Số phiếu" value={String(s?.count ?? 0)} hint="Không tính phiếu đã hủy" />
        <Stat label="Tổng trả" value={formatMoney(s?.total ?? 0)} />
        <Stat label="Trừ nợ" value={formatMoney(s?.debt ?? 0)} hint="Trừ vào nợ NCC" />
        <Stat label="NCC trả tiền mặt" value={formatMoney(s?.cash ?? 0)} />
      </StatStrip>
      <ListPanel
        toolbar={
          <FilterBar
            search={{ value: f.q ?? '', onChange: (q) => set({ q }), placeholder: 'Mã phiếu hoặc tên hàng…' }}
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
            <FilterGroup label="Nhà cung cấp">
              <ToolbarSelect
                value={f.supplierId === undefined ? '' : String(f.supplierId)}
                onChange={(v) => set({ supplierId: v === '' ? undefined : Number(v) })}
                options={suppliers.map((x) => ({ value: String(x.id), label: x.isActive ? x.name : `${x.name} (đã xóa)` }))}
                emptyLabel="Mọi nhà cung cấp"
                aria-label="Lọc theo nhà cung cấp"
                className="w-full"
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
          <SupplierReturnTable rows={data.returns} onOpen={setOpenId} showDate={range.from !== range.to} />
        ) : filtered ? (
          <EmptyState
            icon={PackageMinus}
            title="Không có phiếu trả NCC khớp bộ lọc"
            description="Thử bỏ bớt lọc hoặc đổi khoảng thời gian."
            action={
              <Button variant="outline" onClick={clear}>
                Xóa lọc
              </Button>
            }
          />
        ) : (
          <EmptyState icon={PackageMinus} title="Chưa có phiếu trả NCC" description="Hàng hết hạn, móp, lỗi trả lại NCC: bấm Lập phiếu trả." />
        )}
      </ListPanel>
      <SupplierReturnDetailDialog id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
```

- [ ] **Step 4: Menu và route `client/src/router.tsx`**

- Dòng import lucide: thêm `PackageMinus,` sau `PackageOpen,` (giữ nguyên thứ tự còn lại).
- Thêm import trang sau `import { SettingsPage } …`: chèn theo thứ tự đã có trong file, gần `SuppliersPage`:

```ts
import { SupplierReturnFormPage } from './pages/supplier-returns/SupplierReturnFormPage';
import { SupplierReturnsPage } from './pages/supplier-returns/SupplierReturnsPage';
```

- NAV: thêm ngay sau dòng `{ to: '/imports', … }`:

```ts
  { to: '/supplier-returns', label: 'Trả NCC', icon: PackageMinus, group: 'stock' },
```

- Routes: thêm ngay sau `<Route path="/imports/new" element={<ImportFormPage />} />`:

```tsx
      <Route path="/supplier-returns" element={<SupplierReturnsPage />} />
      <Route path="/supplier-returns/new" element={<SupplierReturnFormPage />} />
```

- [ ] **Step 5: Nút *Trả hàng* ở `client/src/pages/suppliers/SupplierDetailDialog.tsx`**

- `import { HandCoins, Pencil, Trash2 } from 'lucide-react';` → `import { HandCoins, PackageMinus, Pencil, Trash2 } from 'lucide-react';`
- Thêm `import { useNavigate } from 'react-router';` sau dòng `import { useState } from 'react';`.
- Trong component, sau `const confirm = useConfirm();`: `const navigate = useNavigate();`
- Trong `DialogFooter`, ngay trước nút *Sửa*:

```tsx
              <Button variant="outline" className="h-11 text-base" disabled={!s} onClick={() => s && navigate(`/supplier-returns/new?supplierId=${s.id}`)}>
                <PackageMinus data-icon="inline-start" />
                Trả hàng
              </Button>
```

(Footer chỉ hiện với NCC đang hoạt động, nên NCC đã xóa không có nút này.)

- [ ] **Step 6: Typecheck + build client**

Run: `npm run typecheck && npm run build -w client`
Expected: không lỗi.

---

### Task 6: Client – trang In tem, trang in, lối tắt, thẻ Cài đặt

**Files:**
- Modify: `client/package.json` (thêm `jsbarcode`), `client/src/App.tsx`, `client/src/router.tsx`, `client/src/pages/products/ProductTable.tsx`, `client/src/pages/imports/ImportDetailDialog.tsx`, `client/src/pages/settings/SettingsPage.tsx`
- Create: `client/src/api/labels.ts`, `client/src/pages/labels/LabelSheet.tsx`, `client/src/pages/labels/LabelPrintPage.tsx`, `client/src/pages/labels/LabelsPage.tsx`

**Interfaces:**
- Consumes: Task 1 (`LABEL_LAYOUT`, `LABEL_SIZES`, `MAX_LABELS`, `SAMPLE_LABEL_CODE`, `barcodeFormat`, `formatLabelItems`, `parseLabelItems`, `importLabelRefs`, `unitOptions`, `newLineKey`); API Task 3; `UnitSelect` Task 4.
- Produces: `usePrintLabels()`, `useSampleLabel()`, `openLabelWindow(r: LabelPrintResult)`; route `/labels`, `/labels/print`; NAV *In tem*.

- [ ] **Step 1: Cài `jsbarcode`**

Run: `NODE_EXTRA_CA_CERTS="$PWD/.certs/corp-root.pem" npm install jsbarcode -w client`
Rồi: `npm run typecheck -w client` sau khi viết `LabelSheet.tsx` (Step 3). Nếu tsc báo `Could not find a declaration file for module 'jsbarcode'` thì `NODE_EXTRA_CA_CERTS="$PWD/.certs/corp-root.pem" npm install -D @types/jsbarcode -w client`.
Expected: `client/package.json` có `"jsbarcode"` trong `dependencies`; `package-lock.json` đổi.

- [ ] **Step 2: Hook `client/src/api/labels.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { LabelPrintInputBody, LabelPrintResult } from '@tiny-pos/shared';
import { api } from './client';

/** In tem: server cấp mã cho hàng chưa có mã nên danh sách sản phẩm phải tải lại. */
export function usePrintLabels() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LabelPrintInputBody) => api<LabelPrintResult>('/labels/print', { json: input }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export const useSampleLabel = () => useMutation({ mutationFn: () => api<LabelPrintResult>('/labels/sample', { method: 'POST' }) });

/** Máy quầy: server đã mở cửa sổ in tem riêng. Còn lại (dev, không tìm thấy trình duyệt): mở trang in ở tab mới. */
export function openLabelWindow(r: LabelPrintResult): void {
  if (r.opened) toast.success('Đã mở cửa sổ in tem trên máy quầy');
  else window.open(r.url, '_blank');
}
```

- [ ] **Step 3: Tem `client/src/pages/labels/LabelSheet.tsx`**

```tsx
import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import JsBarcode from 'jsbarcode';
import { barcodeFormat, formatMoney, LABEL_LAYOUT, type LabelSize } from '@tiny-pos/shared';

export interface LabelData {
  name: string;
  /** Đơn vị in sau giá: "/lon", "/kg". */
  unit: string;
  price: number;
  code: string;
}

/** Mã vạch SVG; mã EAN sai (hiếm) thì vẽ lại bằng Code128 để không mất tem. */
function Barcode({ code }: { code: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const opts = { height: 40, width: 2, margin: 0, fontSize: 14, textMargin: 1, background: '#fff', lineColor: '#000' };
    try {
      JsBarcode(ref.current, code, { ...opts, format: barcodeFormat(code) });
    } catch {
      JsBarcode(ref.current, code, { ...opts, format: 'CODE128' });
    }
  }, [code]);
  // jsbarcode đặt viewBox nên co giãn theo khung tem
  return <svg ref={ref} style={{ width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid meet" />;
}

const nameStyle: CSSProperties = {
  fontSize: '8.5pt',
  lineHeight: 1.15,
  fontWeight: 600,
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

function Label({ data, w, h, showPrice }: { data: LabelData; w: number; h: number; showPrice: boolean }) {
  return (
    <div
      style={{
        width: `${w}mm`,
        height: `${h}mm`,
        padding: '1.2mm 1.5mm',
        boxSizing: 'border-box',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5mm',
        fontFamily: 'Arial, Helvetica, sans-serif',
        color: '#000',
        background: '#fff',
      }}
    >
      <div style={nameStyle}>{data.name}</div>
      {showPrice && (
        <div style={{ fontSize: '11pt', fontWeight: 700, lineHeight: 1.1 }}>
          {formatMoney(data.price)}
          <span style={{ fontSize: '7pt', fontWeight: 400 }}>/{data.unit}</span>
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        <Barcode code={data.code} />
      </div>
    </div>
  );
}

/** Các trang tem theo khổ đã chọn: mỗi trang 1 tem, hoặc 1 hàng 2 tem với cuộn 72 mm. */
export function LabelSheets({ labels, size, showPrice }: { labels: LabelData[]; size: LabelSize; showPrice: boolean }) {
  const l = LABEL_LAYOUT[size];
  const pages: LabelData[][] = [];
  for (let i = 0; i < labels.length; i += l.cols) pages.push(labels.slice(i, i + l.cols));
  return (
    <>
      {/* Trang tên "label" riêng: không đụng @page 80mm của hóa đơn trong index.css */}
      <style>{`@page label { size: ${l.pageW}mm ${l.pageH}mm; margin: 0; } .label-page { page: label; break-after: page; }`}</style>
      {pages.map((row, i) => (
        <div key={i} className="label-page" style={{ width: `${l.pageW}mm`, height: `${l.pageH}mm`, display: 'flex', justifyContent: 'space-between', background: '#fff' }}>
          {row.map((d, j) => (
            <Label key={j} data={d} w={l.labelW} h={l.labelH} showPrice={showPrice} />
          ))}
        </div>
      ))}
    </>
  );
}
```

- [ ] **Step 4: Trang in `client/src/pages/labels/LabelPrintPage.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { parseLabelItems, SAMPLE_LABEL_CODE, SETTINGS_DEFAULTS, type ProductWithUnits } from '@tiny-pos/shared';
import { fetchProduct } from '@/api/products';
import { useSettings } from '@/api/settings';
import { Button } from '@/components/ui/button';
import { LabelSheets, type LabelData } from './LabelSheet';

const SAMPLE: LabelData = { name: 'Nước suối 500ml', unit: 'chai', price: 5000, code: SAMPLE_LABEL_CODE };

/** Trải danh sách tem theo số bản; tem thiếu mã (không nên có vì server đã cấp) thì bỏ. */
function expand(refs: ReturnType<typeof parseLabelItems>, products: ProductWithUnits[]): LabelData[] {
  const out: LabelData[] = [];
  for (const r of refs) {
    const p = products.find((x) => x.id === r.productId);
    if (!p) continue;
    const u = r.unitId === null ? undefined : p.units.find((x) => x.id === r.unitId);
    const code = u ? u.barcode : p.barcode;
    if (!code) continue;
    const d = { name: p.name, unit: u?.name ?? p.unit, price: u?.sellPrice ?? p.sellPrice, code };
    for (let i = 0; i < r.copies; i++) out.push(d);
  }
  return out;
}

/**
 * Trang in tem, mở trong cửa sổ riêng (không --kiosk-printing) nên hộp in hiện ra và nhớ máy in tem.
 * Vẽ xong tự in, in xong tự đóng. Tem vẽ vào #print-root vì CSS in chỉ hiện phần tử đó.
 */
export function LabelPrintPage() {
  const [params] = useSearchParams();
  const sample = params.get('sample') === '1';
  const refs = useMemo(() => parseLabelItems(params.get('i')), [params]);
  const ids = [...new Set(refs.map((r) => r.productId))];
  const { data: settings } = useSettings();
  const { data: products, error } = useQuery({
    queryKey: ['products', 'labels', ids],
    queryFn: () => Promise.all(ids.map(fetchProduct)),
    enabled: !sample && ids.length > 0,
  });
  const labels = sample ? [SAMPLE] : products ? expand(refs, products) : [];
  const s = settings ?? SETTINGS_DEFAULTS;
  const ready = !!settings && labels.length > 0;
  const [printed, setPrinted] = useState(false);

  useEffect(() => {
    const close = () => window.close();
    window.addEventListener('afterprint', close);
    return () => window.removeEventListener('afterprint', close);
  }, []);
  useEffect(() => {
    if (!ready || printed) return;
    // Chờ 2 khung hình để SVG mã vạch vẽ xong rồi mới in
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        setPrinted(true);
        window.print();
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [ready, printed]);

  const root = document.getElementById('print-root');
  const sheets = <LabelSheets labels={labels} size={s.labelSize} showPrice={s.labelShowPrice} />;
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-heading text-xl font-semibold">{sample ? 'In thử tem' : `In ${labels.length} tem`}</h1>
        <Button className="h-11 text-base" disabled={!ready} onClick={() => window.print()}>
          <Printer data-icon="inline-start" />
          In lại
        </Button>
      </div>
      {error ? (
        <p className="text-destructive">Không tải được sản phẩm: {(error as Error).message}</p>
      ) : !sample && !refs.length ? (
        <p className="text-muted-foreground">Không có tem nào để in.</p>
      ) : (
        <div className="flex flex-wrap gap-2 rounded-xl border bg-muted/40 p-3">{sheets}</div>
      )}
      {root && ready && createPortal(sheets, root)}
    </div>
  );
}
```

Ghi chú: bản xem trước trên màn hình cũng có class `label-page` nhưng nằm trong `#root` (bị ẩn khi in), nên chỉ bản trong `#print-root` ra giấy.

- [ ] **Step 5: Trang chọn tem `client/src/pages/labels/LabelsPage.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Printer, Tag, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney, MAX_LABELS, newLineKey, parseLabelItems, unitOptions, type Product, type ProductWithUnits } from '@tiny-pos/shared';
import { ApiError } from '@/api/client';
import { openLabelWindow, usePrintLabels } from '@/api/labels';
import { fetchProduct, lookupBarcode } from '@/api/products';
import { CommitInput } from '@/components/CommitInput';
import { EmptyState } from '@/components/EmptyState';
import { PageTitle } from '@/components/layout/PageTitle';
import { ListPanel } from '@/components/ListPanel';
import { ProductSearch } from '@/components/ProductSearch';
import { UnitSelect } from '@/components/UnitSelect';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useScanInput } from '@/hooks/useScanInput';

interface Row {
  key: string;
  product: ProductWithUnits;
  unitId: number | null;
  copies: number;
}

const noop = () => {};
const unitOf = (r: Row) => (r.unitId === null ? undefined : r.product.units.find((u) => u.id === r.unitId));
const clampCopies = (n: number) => Math.min(MAX_LABELS, Math.max(1, Math.round(n)));

export function LabelsPage() {
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<Row[]>([]);
  const printLabels = usePrintLabels();
  const scan = useScanInput(noop);
  const total = rows.reduce((s, r) => s + r.copies, 0);

  const add = (product: ProductWithUnits, unitId: number | null, copies = 1) => {
    // Đơn vị không còn thuộc sản phẩm (đã xóa) thì về đơn vị gốc; hàng cân 1 tem
    const unit = unitId !== null && product.units.some((u) => u.id === unitId) ? unitId : null;
    const n = product.isWeighed ? 1 : copies;
    setRows((rs) => {
      const same = rs.find((r) => r.product.id === product.id && r.unitId === unit);
      if (same) return rs.map((r) => (r === same ? { ...r, copies: clampCopies(r.copies + n) } : r));
      return [...rs, { key: newLineKey(), product, unitId: unit, copies: clampCopies(n) }];
    });
  };

  // Vào từ Sản phẩm / phiếu nhập (?add=…): thêm sẵn các dòng rồi xóa khỏi URL để F5 không thêm lần nữa
  const consumed = useRef(false);
  useEffect(() => {
    if (consumed.current) return;
    consumed.current = true;
    const refs = parseLabelItems(params.get('add'));
    if (!refs.length) return;
    setParams({}, { replace: true });
    for (const r of refs) {
      fetchProduct(r.productId)
        .then((p) => add(p, r.unitId, r.copies))
        .catch((e: Error) => toast.error(e.message));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onScan = async (code: string) => {
    try {
      const r = await lookupBarcode(code);
      add(await fetchProduct(r.product.id), r.unit?.id ?? null);
    } catch (e) {
      toast.error(e instanceof ApiError && e.status === 404 ? `Không có hàng mã ${code}` : (e as Error).message);
    }
  };
  const onPick = async (p: Product) => {
    try {
      add(await fetchProduct(p.id), null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const patch = (key: string, v: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...v } : r)));

  const print = () => {
    if (!rows.length || total > MAX_LABELS || printLabels.isPending) return;
    printLabels.mutate(
      { items: rows.map((r) => ({ productId: r.product.id, unitId: r.unitId, copies: r.copies })) },
      {
        onSuccess: async (res) => {
          openLabelWindow(res);
          // Tải lại để hiện mã vừa cấp (dòng "Sẽ cấp mã mới" đổi thành mã thật)
          const fresh = await Promise.all(rows.map((r) => fetchProduct(r.product.id).catch(() => r.product)));
          setRows((rs) => rs.map((r, i) => ({ ...r, product: fresh[i] ?? r.product })));
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <div className="space-y-3 pb-4">
      <PageTitle
        title="In tem"
        actions={[{ label: `In ${total} tem`, icon: Printer, onClick: print, primary: true, disabled: !rows.length || total > MAX_LABELS || printLabels.isPending }]}
      />
      <p className="text-sm text-muted-foreground">
        Quét hoặc tìm hàng cần in tem. Hàng chưa có mã vạch sẽ được cấp mã nội bộ (bắt đầu bằng 20) khi in.
        {total > MAX_LABELS && <span className="text-destructive"> Tối đa {MAX_LABELS} tem mỗi lần.</span>}
      </p>
      <ProductSearch inputRef={scan.ref} includeInactive onScan={(c) => void onScan(c)} onPick={(p) => void onPick(p)} />
      <ListPanel>
        {!rows.length ? (
          <EmptyState icon={Tag} title="Chưa chọn hàng nào" description="Quét mã hoặc gõ tên để thêm; từ Sản phẩm hay phiếu nhập cũng mở được trang này." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="px-4">Sản phẩm</TableHead>
                <TableHead className="w-40 px-2">Đơn vị</TableHead>
                <TableHead className="px-2">Mã vạch</TableHead>
                <TableHead className="w-28 px-2 text-right">Giá</TableHead>
                <TableHead className="w-24 px-2">Số tem</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const u = unitOf(r);
                const code = u ? u.barcode : r.product.barcode;
                return (
                  <TableRow key={r.key}>
                    <TableCell className="px-4 py-2 font-medium whitespace-normal">{r.product.name}</TableCell>
                    <TableCell className="px-2 py-2">
                      <UnitSelect options={unitOptions(r.product)} value={r.unitId} onChange={(unitId) => patch(r.key, { unitId })} />
                    </TableCell>
                    <TableCell className="px-2 py-2 font-mono">{code ?? <Badge variant="secondary">Sẽ cấp mã mới</Badge>}</TableCell>
                    <TableCell className="px-2 py-2 text-right tabular-nums">{formatMoney(u?.sellPrice ?? r.product.sellPrice)}</TableCell>
                    <TableCell className="px-2 py-2">
                      <CommitInput aria-label="Số tem" value={r.copies} onCommit={(n) => patch(r.key, { copies: clampCopies(n) })} onEnter={scan.focus} className="w-20 text-center" />
                    </TableCell>
                    <TableCell className="py-2 pr-2">
                      <Button variant="ghost" size="icon-lg" className="size-11" aria-label="Xóa dòng" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </ListPanel>
    </div>
  );
}
```

Trước khi viết, mở `client/src/components/layout/PageTitle.tsx` xem kiểu `PageAction` (có `onClick`, `primary`, `disabled`, `to`, `form` – đã dùng ở trang khác); nếu tên trường khác thì theo đúng tên trong file đó.

- [ ] **Step 6: Trang in ngoài khung + route + menu**

`client/src/App.tsx` (thay toàn bộ, file chỉ có 9 dòng):

```tsx
import { useLocation } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';
import { LabelPrintPage } from './pages/labels/LabelPrintPage';
import { AppRoutes } from './router';

export default function App() {
  const { pathname } = useLocation();
  // Trang in tem mở trong cửa sổ riêng: không sidebar/topbar
  if (pathname === '/labels/print') return <LabelPrintPage />;
  return (
    <AppShell>
      <AppRoutes />
    </AppShell>
  );
}
```

`client/src/router.tsx`:
- Dòng import lucide: thêm `Tag,` trước `Truck,`.
- Thêm `import { LabelsPage } from './pages/labels/LabelsPage';` sau `import { ImportsPage } …`.
- NAV: thêm ngay sau dòng `/supplier-returns` (Task 5): `  { to: '/labels', label: 'In tem', icon: Tag, group: 'stock' },`
- Routes: thêm sau `<Route path="/supplier-returns/new" …/>`: `      <Route path="/labels" element={<LabelsPage />} />`

- [ ] **Step 7: Lối tắt In tem**

`client/src/pages/products/ProductTable.tsx` (`ProductMenu`):
- `import { Ban, History, MoreHorizontal, Pencil, RotateCcw } from 'lucide-react';` → thêm `, Tag` sau `RotateCcw`.
- Thêm `import { useNavigate } from 'react-router';` sau `import { useState } from 'react';`.
- Trong `ProductMenu`, sau `const [history, setHistory] = useState(false);`: `const navigate = useNavigate();`
- Ngay sau `DropdownMenuItem` *Lịch sử tồn* (trước `<DropdownMenuSeparator />`):

```tsx
        <DropdownMenuItem onSelect={() => navigate(`/labels?add=${p.id}.0x1`)}>
          <Tag />
          In tem
        </DropdownMenuItem>
```

`client/src/pages/imports/ImportDetailDialog.tsx`:
- `import { Ban } from 'lucide-react';` → `import { Ban, Tag } from 'lucide-react';`
- Thêm `import { useNavigate } from 'react-router';` lên đầu; dòng import shared `import { formatMoney, formatQty } from '@tiny-pos/shared';` → `import { formatLabelItems, formatMoney, formatQty, importLabelRefs } from '@tiny-pos/shared';`
- Sau `const confirm = useConfirm();`: `const navigate = useNavigate();`
- Trong `DialogFooter`, sau khối nút *Hủy phiếu*:

```tsx
          {r && (
            <Button variant="outline" className="h-11 text-base" onClick={() => navigate(`/labels?add=${formatLabelItems(importLabelRefs(r.items))}`)}>
              <Tag data-icon="inline-start" />
              In tem
            </Button>
          )}
```

- [ ] **Step 8: Thẻ *Tem mã vạch* ở `client/src/pages/settings/SettingsPage.tsx`**

- `import { Check, Info, Printer } from 'lucide-react';` → `import { Check, Info, Printer, Tag } from 'lucide-react';`
- `import { BANKS, SETTINGS_DEFAULTS, stripDiacritics, type Settings } from '@tiny-pos/shared';` → `import { BANKS, LABEL_LAYOUT, LABEL_SIZES, SETTINGS_DEFAULTS, stripDiacritics, type LabelSize, type Settings } from '@tiny-pos/shared';`
- Thêm `import { openLabelWindow, useSampleLabel } from '@/api/labels';` trước dòng `import { useSaveSettings, useSettings } from '@/api/settings';`.
- Sau `const bankOptions = …;`: `const labelSizeOptions = LABEL_SIZES.map((s) => ({ value: s, label: LABEL_LAYOUT[s].label }));`
- Trong component, sau `const print = usePrint();`: `const sample = useSampleLabel();`
- Thêm thẻ ngay sau `</Card>` của thẻ *In hóa đơn* (trước `<BackupCard />`):

```tsx
      <Card>
        <CardContent className="space-y-4">
          <SectionTitle>Tem mã vạch</SectionTitle>
          <SelectField id="st-label-size" label="Khổ tem" value={form.labelSize} onChange={(v) => set('labelSize', v as LabelSize)} options={labelSizeOptions} />
          <label className="flex items-center justify-between gap-4">
            <span>
              <span className="block font-medium">In giá trên tem</span>
              <span className="text-sm text-muted-foreground">Tắt nếu chỉ cần mã vạch</span>
            </span>
            <Switch checked={form.labelShowPrice} onCheckedChange={(v) => set('labelShowPrice', v)} />
          </label>
          <Button
            type="button"
            variant="outline"
            className="h-11 text-base"
            disabled={sample.isPending}
            onClick={() => sample.mutate(undefined, { onSuccess: openLabelWindow, onError: (e) => toast.error(e.message) })}
          >
            <Tag data-icon="inline-start" />
            In thử 1 tem
          </Button>
          <p className="text-sm text-muted-foreground">
            In thử dùng khổ đã lưu. Tem in ra máy in tem riêng: lần đầu chọn máy tem trong hộp in, các lần sau tự nhớ; hóa đơn vẫn in thẳng ra máy hóa đơn.
          </p>
        </CardContent>
      </Card>
```

- [ ] **Step 9: Typecheck + build**

Run: `npm run typecheck && npm test && npm run build`
Expected: không lỗi; số test tăng đúng các file mới.

---

### Task 7: Kiểm tra trên trình duyệt, tài liệu, phiên bản, commit

**Files:**
- Modify: `package.json` (`"version": "0.12.0"`), `README.md`, `CLAUDE.md`, `.claude/rules/database.md`

- [ ] **Step 1: Kiểm tra tự động toàn bộ**

Run: `npm run typecheck && npm test && npm run build`
Expected: không lỗi; ghi lại số test qua.

- [ ] **Step 2: Kiểm trên trình duyệt bằng skill `browser-verify`** (chặn mọi POST, stub GET khi cần dữ liệu). Server dev khởi động lại sẽ chạy migration `0005` trên DB dev (chỉ tạo bảng rỗng). Kiểm và báo lại thứ đã quan sát:
  1. Menu nhóm *Kho hàng*: *Sản phẩm · Nhập hàng · Trả NCC · In tem · Kiểm kê · Danh mục*.
  2. `/supplier-returns/new`: ô NCC ghi "Chọn nhà cung cấp", không có mục "Không ghi nhà cung cấp"; tìm một sản phẩm có thùng → thêm dòng; đổi đơn vị sang thùng → giá trả nhân hệ số; tăng số lượng quá tồn → dòng chữ màu cảnh báo "Tồn hiện có …"; chọn NCC có nợ → chân phiếu "Trừ nợ … · NCC trả tiền mặt …" đúng phép chia; *Lưu phiếu trả* → body POST `/api/supplier-returns` bị chặn có đúng `supplierId`, `items[].unitId`, `qty`, `unitPrice`, `note`. F5 trang → phiếu nháp còn nguyên.
  3. `/supplier-returns`: stub `GET /api/supplier-returns` một phiếu `done` và một `cancelled` → bảng, StatStrip 4 ô; bấm dòng → chi tiết; *In phiếu* gọi `window.print` (stub) và `#print-root` có "PHIẾU TRẢ HÀNG NHÀ CUNG CẤP" và "Bên nhận"; *Hủy phiếu* → hộp xác nhận → POST `/cancel` bị chặn.
  4. `/suppliers` → mở một NCC đang hoạt động → nút *Trả hàng* → URL `/supplier-returns/new?supplierId=…` và NCC được chọn sẵn.
  5. `/labels`: thêm hàng có mã và hàng chưa có mã ("Sẽ cấp mã mới"); *In N tem* → POST `/api/labels/print` bị chặn, body đúng. Mở `/products` → menu ⋯ → *In tem* → `/labels` có sẵn dòng, URL không còn `?add=`. Mở một phiếu nhập → *In tem* → số tem = số lượng × hệ số.
  6. Trang in: stub `GET /api/products/:id` (một sản phẩm có `barcode: '2000000000015'` và một đơn vị `barcode: '4006381333931'`), mở `/labels/print?i=<id>.0x2,<id>.<unitId>x1` và `/labels/print?sample=1` (stub `window.print`) → không có sidebar; xem trước có 3 tem, mã vạch SVG có vạch (`svg rect` > 20), có giá. Với mỗi khổ (`labelSize` stub qua `GET /api/settings`: `40x30`, `50x30`, `35x22x2`) xuất PDF bằng `page.pdf({ preferCSSPageSize: true })` → đọc kích thước trang trong PDF (MediaBox) ≈ 113×85 pt (40×30 mm), 142×85 pt (50×30), 204×62 pt (72×22); số trang = số tem (khổ 2 tem/hàng: `ceil(n/2)`). Mở `/orders`, in một hóa đơn rồi xuất PDF → trang vẫn rộng 80 mm (≈ 227 pt).
  7. `/settings`: thẻ *Tem mã vạch* có ô *Khổ tem* (3 lựa chọn), công tắc *In giá trên tem*, nút *In thử 1 tem* → POST `/api/labels/sample` bị chặn.
  8. Điện thoại 390×844: màn lập phiếu và trang In tem không cuộn ngang cả trang (`document.documentElement.scrollWidth ≤ 390`; bảng cuộn trong `ListPanel` là được); không có `CONSOLE ERROR` / `PAGE ERROR` ở mọi trang trên.

- [ ] **Step 3: Tài liệu và phiên bản**
  - `package.json` gốc: `"version": "0.11.0"` → `"version": "0.12.0"`.
  - `README.md`:
    - Dòng 8 (*Yêu cầu*) thêm sau câu máy in hóa đơn: ` Máy in tem decal (tùy chọn) để in tem mã vạch.`
    - Thêm sau dòng `- Khách trả hàng: …` (mục *Chạy thật*):

```markdown
- Trả hàng cho nhà cung cấp: *Trả NCC* (menu Kho hàng) → *Lập phiếu trả*, hoặc *Nhà cung cấp* → mở NCC → *Trả hàng*. Trừ nợ NCC trước, phần dư ghi là NCC trả tiền mặt; hủy phiếu thì tồn và nợ về như cũ.
- In tem mã vạch: *In tem* (menu Kho hàng), hoặc ⋯ → *In tem* ở Sản phẩm, *In tem* trong phiếu nhập. Hàng chưa có mã được cấp mã nội bộ bắt đầu bằng `20`. Chọn khổ tem trong *Cài đặt → Tem mã vạch*. Tem mở trong một cửa sổ riêng có hộp chọn máy in: lần đầu chọn máy in tem, các lần sau Chrome tự nhớ; hóa đơn vẫn in thẳng ra máy hóa đơn.
```

    - Thêm cuối file:

```markdown

## Kiểm thử thủ công – Trả NCC và in tem 0.12.0

1. *Nhà cung cấp* → NCC đang nợ → *Trả hàng* → thêm 1 thùng bia → giá trả = giá nhập thùng; lưu → toast "Đã lập TN-…", *In phiếu* ra "PHIẾU TRẢ HÀNG NHÀ CUNG CẤP" có chỗ ký; tồn bia giảm 24 lon; sổ nợ NCC có dòng "Trả NCC TN-…", nợ giảm đúng.
2. Trả nhiều hơn số nợ → phần dư hiện "NCC trả tiền mặt"; nợ NCC về 0, không âm. Lịch sử tồn của bia có dòng *Trả NCC* kèm mã `TN-…`.
3. *Trả NCC* → mở phiếu → *Hủy phiếu* → tồn và nợ về như trước, sổ nợ có "Hủy phiếu trả NCC …". Lọc theo NCC / trạng thái / tìm tên hàng; *Xuất Excel* ra 2 sheet *Phiếu trả NCC*, *Chi tiết*.
4. *Cài đặt → Tem mã vạch*: chọn khổ đúng cuộn decal, *Lưu*, *In thử 1 tem* → cửa sổ in tem mở, hộp in hiện: chọn máy in tem, in. Đóng rồi *In thử* lần nữa → hộp in đã chọn sẵn máy tem. Bán một đơn và in hóa đơn → vẫn ra máy hóa đơn, không hỏi.
5. *In tem* → thêm một hàng chưa có mã (bánh tự gói) 3 tem → in → tem có tên, giá, mã `20…`; quét tem ở *Bán hàng* ra đúng món. Thêm một thùng chưa có mã → tem thùng có giá thùng, quét ra đúng đơn vị thùng.
6. Phiếu nhập → *In tem* → trang In tem điền sẵn số tem theo số lon đã nhập; hàng cân chỉ 1 tem.
```

  - `CLAUDE.md`:
    - Cuối đoạn *Đã xong*: `trang \`/returns\`).` → `trang \`/returns\`), Trả NCC & in tem 0.12.0 (phiếu \`TN\` không gắn phiếu nhập trong \`services/supplier-returns.ts\`, trừ nợ NCC trước rồi NCC trả tiền mặt; in tem qua \`services/labels.ts\` cấp EAN-13 nội bộ \`20…\`, cửa sổ in tem riêng \`label-window.ts\` hồ sơ \`data/label-browser\` không \`--kiosk-printing\`, trang \`/supplier-returns\`, \`/labels\`, \`/labels/print\`).`
    - Bất biến *Mã chứng từ*: `` `TH-YYYYMMDD-NNNN` (phiếu trả). `` → `` `TH-YYYYMMDD-NNNN` (phiếu trả), `TN-YYYYMMDD-NNNN` (phiếu trả NCC). ``
    - *Mọi thay đổi tồn kho* giữ nguyên. Thêm bất biến ngay sau dòng *Trả hàng*:
      `- **Trả NCC** chỉ qua \`services/supplier-returns.ts\`: không gắn phiếu nhập, không đổi giá vốn, không vào \`daySummary\`/lãi lỗ; trừ nợ NCC hiện tại trước, phần dư là NCC trả tiền mặt; NCC đã xóa thì không hủy được phiếu đã trừ nợ.`
      `- **Mã vạch nội bộ** \`20…\` (EAN-13) chỉ cấp qua \`assignBarcodes\` (\`services/labels.ts\`), nối tiếp mã \`20…\` hợp lệ lớn nhất, không ghi đè mã đã có.`
    - *Migration*: `DB dev đã chạy tới \`0004\`` → `DB dev đã chạy tới \`0005\``.
  - `.claude/rules/database.md`: `(\`0000\`–\`0004\`)` → `(\`0000\`–\`0005\`)`; `tiếp theo là \`0005\`` → `tiếp theo là \`0006\``.

- [ ] **Step 4: Soát diff (skill `check`)**

Run: `git status --short && git diff --stat`
Expected: file có sẵn chỉ đổi đúng các dòng trong kế hoạch: `ImportLineRow.tsx` bớt khoảng 25 dòng (khối `Select` chuyển sang `UnitSelect`), `SupplierPicker.tsx`, `router.tsx`, `SettingsPage.tsx`, `exports.ts`, `schema.ts` vài chục dòng là hợp lý; `package-lock.json` đổi do `jsbarcode`. Hunk nào chỉ là format thì hoàn tác.

- [ ] **Step 5: Commit một lần**

```bash
git add -A
git commit -m "feat: trả hàng NCC và in tem mã vạch 0.12.0 – phiếu TN, trừ nợ NCC, cấp mã EAN-13 nội bộ, cửa sổ in tem riêng

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Trước `git add -A`, xem lại `git status` để chắc không có file tạm (ảnh chụp, PDF, script playwright nằm ở scratchpad, không trong repo) và **không** có thư mục `data/label-browser` (đã nằm trong `data/` bị bỏ qua).
