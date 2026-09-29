import { describe, expect, it } from 'vitest';
import { productInputSchema, productListQuerySchema } from './product.js';

describe('productInputSchema', () => {
  it('điền mặc định và đổi barcode rỗng thành null', () => {
    const r = productInputSchema.parse({ name: '  Sữa  ', barcode: '  ' });
    expect(r).toMatchObject({ name: 'Sữa', barcode: null, unit: 'cái', costPrice: 0, sellPrice: 0, stock: 0, isWeighed: false, categoryId: null, minStock: 0 });
  });
  it('từ chối tên trống và giá âm', () => {
    expect(productInputSchema.safeParse({ name: '' }).success).toBe(false);
    expect(productInputSchema.safeParse({ name: 'x', sellPrice: -1 }).success).toBe(false);
  });
  it('từ chối số dạng chuỗi', () => {
    expect(productInputSchema.safeParse({ name: 'x', sellPrice: '15000' }).success).toBe(false);
  });
});

describe('productListQuerySchema', () => {
  it('ép kiểu query string', () => {
    expect(productListQuerySchema.parse({ q: ' a ', categoryId: '3', includeInactive: '1' })).toEqual({ q: 'a', categoryId: 3, includeInactive: true });
    expect(productListQuerySchema.parse({})).toEqual({ q: undefined, categoryId: undefined, includeInactive: false });
  });
});
