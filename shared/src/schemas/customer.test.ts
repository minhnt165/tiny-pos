import { describe, expect, it } from 'vitest';
import { customerAdjustmentSchema, customerCreateSchema, customerInputSchema, customerPaymentSchema } from './customer.js';

describe('customer schemas', () => {
  it('khách: trim tên, SĐT/ghi chú rỗng → null; nợ đầu kỳ mặc định 0', () => {
    expect(customerInputSchema.parse({ name: '  Chị Lan ', phone: '', note: ' ' })).toEqual({ name: 'Chị Lan', phone: null, note: null });
    expect(customerCreateSchema.parse({ name: 'Anh Tư' })).toEqual({ name: 'Anh Tư', phone: null, note: null, openingDebt: 0 });
    expect(customerInputSchema.safeParse({ name: '  ' }).success).toBe(false);
  });

  it('nợ đầu kỳ: số nguyên 0 – 1 tỷ', () => {
    expect(customerCreateSchema.safeParse({ name: 'A', openingDebt: 1_000_000_000 }).success).toBe(true);
    expect(customerCreateSchema.safeParse({ name: 'A', openingDebt: 1_000_000_001 }).success).toBe(false);
    expect(customerCreateSchema.safeParse({ name: 'A', openingDebt: -1 }).success).toBe(false);
    expect(customerCreateSchema.safeParse({ name: 'A', openingDebt: 1.5 }).success).toBe(false);
  });

  it('thu nợ: số tiền nguyên > 0, hình thức cash/transfer, ghi chú tùy chọn', () => {
    expect(customerPaymentSchema.parse({ amount: 50000, method: 'transfer' })).toEqual({ amount: 50000, method: 'transfer', note: null });
    expect(customerPaymentSchema.safeParse({ amount: 0, method: 'cash' }).success).toBe(false);
    expect(customerPaymentSchema.safeParse({ amount: 1000, method: 'card' }).success).toBe(false);
  });

  it('ghi nợ tay: bắt buộc ghi chú (không tính khoảng trắng)', () => {
    expect(customerAdjustmentSchema.parse({ amount: 5000, note: ' Quên ghi ' })).toEqual({ amount: 5000, note: 'Quên ghi' });
    expect(customerAdjustmentSchema.safeParse({ amount: 5000, note: '   ' }).success).toBe(false);
    expect(customerAdjustmentSchema.safeParse({ amount: 5000 }).success).toBe(false);
  });
});
