import { describe, expect, it } from 'vitest';
import { formatMoney, round500 } from './money.js';

describe('formatMoney', () => {
  it('nhóm hàng nghìn bằng dấu chấm và thêm đ', () => {
    expect(formatMoney(0)).toBe('0đ');
    expect(formatMoney(500)).toBe('500đ');
    expect(formatMoney(15000)).toBe('15.000đ');
    expect(formatMoney(1234567)).toBe('1.234.567đ');
  });
  it('giữ dấu âm', () => {
    expect(formatMoney(-15000)).toBe('-15.000đ');
  });
  it('làm tròn số lẻ', () => {
    expect(formatMoney(999.6)).toBe('1.000đ');
  });
});

describe('round500', () => {
  it('làm tròn về bội 500 gần nhất', () => {
    expect(round500(1249)).toBe(1000);
    expect(round500(1250)).toBe(1500);
    expect(round500(12345)).toBe(12500);
    expect(round500(0)).toBe(0);
  });
});
