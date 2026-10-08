import { describe, expect, it } from 'vitest';
import { splitSupplierRefund } from './supplier-return-math.js';
import {
  EMPTY_SUPPLIER_RETURN_DRAFT,
  overStock,
  parseSupplierReturnDraft,
  presetSupplier,
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
    expect(toSupplierReturnInput(d, 5)).toEqual({ supplierId: 5, note: 'Hết hạn', items: [{ productId: 1, unitId: null, qty: 3, unitPrice: 10000, lotId: null }] });
  });

  it('setLot: đổi lô của dòng, gửi lotId; thêm cùng sản phẩm khi dòng đã chọn lô → dòng mới', () => {
    let d = reduce(EMPTY_SUPPLIER_RETURN_DRAFT, { type: 'add', product: beer, unitId: null });
    const key = d.lines[0]!.key;
    d = reduce(d, { type: 'setLot', key, lotId: 7 });
    expect(toSupplierReturnInput(d, 5).items[0]).toMatchObject({ lotId: 7 });
    d = reduce(d, { type: 'add', product: beer, unitId: null });
    expect(d.lines).toHaveLength(2);
    expect(d.lines[1]!.lotId).toBeNull();
  });

  it('đọc nháp hỏng ra phiếu trống; clear về trống', () => {
    expect(parseSupplierReturnDraft('{"x":1')).toEqual(EMPTY_SUPPLIER_RETURN_DRAFT);
    expect(parseSupplierReturnDraft(null)).toEqual(EMPTY_SUPPLIER_RETURN_DRAFT);
    const d = add(EMPTY_SUPPLIER_RETURN_DRAFT);
    expect(parseSupplierReturnDraft(JSON.stringify(d))).toEqual(d);
    expect(reduce(d, { type: 'clear' })).toEqual(EMPTY_SUPPLIER_RETURN_DRAFT);
  });
});

describe('presetSupplier', () => {
  it('nháp trống hoặc cùng NCC: chọn NCC; nháp đang có dòng của NCC khác: giữ nguyên và báo xung đột', () => {
    expect(presetSupplier(EMPTY_SUPPLIER_RETURN_DRAFT, 2)).toEqual({ draft: { ...EMPTY_SUPPLIER_RETURN_DRAFT, supplierId: 2 }, conflict: false });
    const forA = reduce(add(EMPTY_SUPPLIER_RETURN_DRAFT), { type: 'setSupplier', supplierId: 1 });
    expect(presetSupplier(forA, 1)).toEqual({ draft: forA, conflict: false });
    expect(presetSupplier(forA, 2)).toEqual({ draft: forA, conflict: true });
    const noSupplier = add(EMPTY_SUPPLIER_RETURN_DRAFT);
    expect(presetSupplier(noSupplier, 2)).toEqual({ draft: { ...noSupplier, supplierId: 2 }, conflict: false });
  });
});
