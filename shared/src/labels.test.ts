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
