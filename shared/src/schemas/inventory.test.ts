import { describe, expect, it } from 'vitest';
import { importInputSchema } from './import.js';
import { movementListQuerySchema, stocktakeCountSchema, stocktakeInputSchema, stocktakeListQuerySchema } from './stocktake.js';
import { supplierInputSchema, supplierPaymentSchema } from './supplier.js';

describe('importInputSchema', () => {
  it('điền mặc định: supplierId/unitId/sellPrice null, note null', () => {
    expect(importInputSchema.parse({ paid: 0, items: [{ productId: 1, qty: 2, unitCost: 1000 }] })).toEqual({
      supplierId: null,
      note: null,
      paid: 0,
      items: [{ productId: 1, unitId: null, qty: 2, unitCost: 1000, sellPrice: null, expiresOn: null }],
    });
  });
  it('hạn dùng: nhận YYYY-MM-DD kể cả quá khứ, từ chối ngày không có thật', () => {
    expect(importInputSchema.parse({ paid: 0, items: [{ productId: 1, qty: 1, unitCost: 1, expiresOn: '2025-01-31' }] }).items[0]!.expiresOn).toBe('2025-01-31');
    expect(importInputSchema.safeParse({ paid: 0, items: [{ productId: 1, qty: 1, unitCost: 1, expiresOn: '2026-02-30' }] }).success).toBe(false);
  });
  it('từ chối phiếu rỗng, qty 0, giá lẻ, giá quá 1 tỷ, thiếu productId', () => {
    const bad = (o: Record<string, unknown>) => importInputSchema.safeParse({ paid: 0, ...o }).success;
    expect(bad({ items: [] })).toBe(false);
    expect(bad({ items: [{ productId: 1, qty: 0, unitCost: 1 }] })).toBe(false);
    expect(bad({ items: [{ productId: 1, qty: 1, unitCost: 1.5 }] })).toBe(false);
    expect(bad({ items: [{ productId: 1, qty: 1, unitCost: 1_000_000_001 }] })).toBe(false);
    expect(bad({ items: [{ qty: 1, unitCost: 1 }] })).toBe(false);
  });
});

describe('supplierInputSchema / supplierPaymentSchema', () => {
  it('trim tên, chuỗi rỗng → null', () => {
    expect(supplierInputSchema.parse({ name: ' Đại lý Hùng ', phone: '' })).toEqual({ name: 'Đại lý Hùng', phone: null, note: null });
    expect(supplierInputSchema.safeParse({ name: '  ' }).success).toBe(false);
  });
  it('trả nợ: số nguyên dương', () => {
    expect(supplierPaymentSchema.parse({ amount: 5000 })).toEqual({ amount: 5000, note: null });
    expect(supplierPaymentSchema.safeParse({ amount: 0 }).success).toBe(false);
    expect(supplierPaymentSchema.safeParse({ amount: 10.5 }).success).toBe(false);
  });
});

describe('stocktake schemas', () => {
  it('số đếm ≥ 0, cho số lẻ; ghi chú rỗng → null; limit mặc định', () => {
    expect(stocktakeCountSchema.parse({ counted: 0.35 })).toEqual({ counted: 0.35 });
    expect(stocktakeCountSchema.safeParse({ counted: -1 }).success).toBe(false);
    expect(stocktakeInputSchema.parse({})).toEqual({ note: null });
    expect(stocktakeListQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(stocktakeListQuerySchema.parse({ limit: '5' })).toEqual({ limit: 5 });
    expect(movementListQuerySchema.parse({})).toEqual({ limit: 100 });
    expect(movementListQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
  });
});
