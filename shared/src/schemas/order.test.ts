import { describe, expect, it } from 'vitest';
import { orderInputSchema } from './order.js';
import { SETTINGS_DEFAULTS, settingsInputSchema } from './settings.js';

describe('orderInputSchema', () => {
  it('chuẩn hóa dòng: productId/unitId thiếu → null, name thiếu → rỗng', () => {
    const r = orderInputSchema.parse({ items: [{ qty: 1, price: 5000 }], paymentMethod: 'cash', paid: 5000 });
    expect(r).toEqual({
      items: [{ productId: null, unitId: null, name: '', qty: 1, price: 5000 }],
      discount: 0,
      paymentMethod: 'cash',
      paid: 5000,
      customerId: null,
    });
  });
  it('từ chối giỏ rỗng, qty ≤ 0, giá lẻ, phương thức lạ', () => {
    expect(orderInputSchema.safeParse({ items: [], paymentMethod: 'cash' }).success).toBe(false);
    expect(orderInputSchema.safeParse({ items: [{ qty: 0, price: 1 }], paymentMethod: 'cash' }).success).toBe(false);
    expect(orderInputSchema.safeParse({ items: [{ qty: 1, price: 1.5 }], paymentMethod: 'cash' }).success).toBe(false);
    expect(orderInputSchema.safeParse({ items: [{ qty: 1, price: 1 }], paymentMethod: 'card' }).success).toBe(false);
  });
  it('ghi nợ: nhận paymentMethod debt kèm customerId', () => {
    const r = orderInputSchema.parse({ items: [{ qty: 1, price: 5000 }], paymentMethod: 'debt', customerId: 3, paid: 1000 });
    expect(r).toMatchObject({ paymentMethod: 'debt', customerId: 3, paid: 1000 });
  });
  it('giá, giảm giá, tiền khách đưa tối đa 1 tỷ', () => {
    const ok = { items: [{ qty: 1, price: 1_000_000_000 }], paymentMethod: 'cash', discount: 1_000_000_000, paid: 1_000_000_000 };
    expect(orderInputSchema.safeParse(ok).success).toBe(true);
    expect(orderInputSchema.safeParse({ ...ok, items: [{ qty: 1, price: 1_000_000_001 }] }).success).toBe(false);
    expect(orderInputSchema.safeParse({ ...ok, discount: 1_000_000_001 }).success).toBe(false);
    expect(orderInputSchema.safeParse({ ...ok, paid: 1_000_000_001 }).success).toBe(false);
  });
});

describe('settingsInputSchema', () => {
  it('mặc định', () => {
    expect(SETTINGS_DEFAULTS).toEqual({
      storeName: 'Tạp hóa',
      storeAddress: '',
      storePhone: '',
      receiptFooter: 'Cảm ơn quý khách!',
      bankBin: '',
      bankAccount: '',
      bankAccountName: '',
      autoPrint: true,
    });
  });
  it('chuẩn hóa tên chủ tài khoản, kiểm tra BIN/số tài khoản', () => {
    expect(settingsInputSchema.parse({ bankAccountName: 'nguyễn văn an' }).bankAccountName).toBe('NGUYEN VAN AN');
    expect(settingsInputSchema.safeParse({ bankBin: '9704' }).success).toBe(false);
    expect(settingsInputSchema.safeParse({ bankAccount: '12a' }).success).toBe(false);
    expect(settingsInputSchema.safeParse({ storeName: '' }).success).toBe(false);
  });
});
