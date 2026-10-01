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
