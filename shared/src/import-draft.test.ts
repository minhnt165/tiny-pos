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
        { productId: 1, unitId: 7, qty: 1, unitCost: 240000, sellPrice: 290000, expiresOn: null },
        { productId: 1, unitId: null, qty: 1, unitCost: 10000, sellPrice: null, expiresOn: null },
      ],
    });
  });
  it('update expiresOn: lưu trên dòng và gửi theo body; null = không hạn', () => {
    let d = importDraftReducer(EMPTY_IMPORT_DRAFT, { type: 'add', product: beer, unitId: null });
    const key = d.lines[0]!.key;
    d = importDraftReducer(d, { type: 'update', key, patch: { expiresOn: '2026-12-31' } });
    expect(d.lines[0]!.expiresOn).toBe('2026-12-31');
    expect(toImportInput(d).items[0]!.expiresOn).toBe('2026-12-31');
    d = importDraftReducer(d, { type: 'update', key, patch: { expiresOn: null } });
    expect(toImportInput(d).items[0]!.expiresOn).toBeNull();
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
  it('nháp cũ chưa có expiresOn vẫn đọc được, nhận null', () => {
    const d = add(EMPTY_IMPORT_DRAFT, 7);
    const old = { ...d, lines: d.lines.map(({ expiresOn: _omit, ...rest }) => rest) };
    const r = parseImportDraft(JSON.stringify(old));
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0]!.expiresOn).toBeNull();
  });
});
