import { describe, expect, it } from 'vitest';
import { orderInputSchema, orderListQuerySchema } from './order.js';
import { SETTINGS_DEFAULTS, settingsInputSchema } from './settings.js';

describe('orderInputSchema', () => {
  it('chuẩn hóa dòng: productId/unitId thiếu → null, name thiếu → rỗng', () => {
    const r = orderInputSchema.parse({ items: [{ qty: 1, price: 5000 }], paymentMethod: 'cash', paid: 5000 });
    expect(r).toEqual({
      items: [{ productId: null, unitId: null, name: '', qty: 1, price: 5000 }],
      discount: 0,
      paymentMethod: 'cash',
      paid: 5000,
    });
  });
  it('từ chối giỏ rỗng, qty ≤ 0, giá lẻ, phương thức debt', () => {
    expect(orderInputSchema.safeParse({ items: [], paymentMethod: 'cash' }).success).toBe(false);
    expect(orderInputSchema.safeParse({ items: [{ qty: 0, price: 1 }], paymentMethod: 'cash' }).success).toBe(false);
    expect(orderInputSchema.safeParse({ items: [{ qty: 1, price: 1.5 }], paymentMethod: 'cash' }).success).toBe(false);
    expect(orderInputSchema.safeParse({ items: [{ qty: 1, price: 1 }], paymentMethod: 'debt' }).success).toBe(false);
  });
});

describe('orderListQuerySchema', () => {
  it('date dạng YYYY-MM-DD hoặc bỏ trống', () => {
    expect(orderListQuerySchema.parse({})).toEqual({});
    expect(orderListQuerySchema.parse({ date: '2026-09-29' })).toEqual({ date: '2026-09-29' });
    expect(orderListQuerySchema.safeParse({ date: '29/09/2026' }).success).toBe(false);
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
