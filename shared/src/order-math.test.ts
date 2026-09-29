import { describe, expect, it } from 'vitest';
import { cartTotals, formatQty, lineAmount, suggestCash } from './order-math.js';

describe('lineAmount', () => {
  it('hàng thường: qty × giá, làm tròn về đồng', () => {
    expect(lineAmount({ qty: 2, price: 12000, isWeighed: false })).toBe(24000);
    expect(lineAmount({ qty: 0.333, price: 10000, isWeighed: false })).toBe(3330);
  });
  it('hàng cân: làm tròn 500đ', () => {
    expect(lineAmount({ qty: 0.35, price: 57000, isWeighed: true })).toBe(20000);
    expect(lineAmount({ qty: 1.2, price: 35000, isWeighed: true })).toBe(42000);
  });
});

describe('cartTotals', () => {
  it('tổng, giảm giá, phải trả', () => {
    const lines = [
      { qty: 2, price: 12000, isWeighed: false },
      { qty: 0.35, price: 57000, isWeighed: true },
    ];
    expect(cartTotals(lines, 4000)).toEqual({ total: 44000, discount: 4000, payable: 40000 });
    expect(cartTotals([], 0)).toEqual({ total: 0, discount: 0, payable: 0 });
  });
});

describe('suggestCash', () => {
  it('đủ tiền + các mệnh giá tròn phía trên, tối đa 4, tăng dần', () => {
    expect(suggestCash(87000)).toEqual([87000, 90000, 100000, 200000]);
    expect(suggestCash(100000)).toEqual([100000, 200000, 500000]);
    expect(suggestCash(620000)).toEqual([620000, 650000, 700000]);
    expect(suggestCash(0)).toEqual([0]);
  });
});

describe('formatQty', () => {
  it('dấu phẩy thập phân, tối đa 3 số lẻ, bỏ số 0 cuối', () => {
    expect(formatQty(0.35)).toBe('0,35');
    expect(formatQty(2)).toBe('2');
    expect(formatQty(0.3333)).toBe('0,333');
    expect(formatQty(1234.5)).toBe('1.234,5');
  });
});
