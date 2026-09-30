import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  importListQuerySchema,
  orderListQuerySchema,
  partyListQuerySchema,
  partyViewFields,
  productViewFields,
  resolveRange,
  validRange,
} from './list-filters.js';

describe('orderListQuerySchema', () => {
  it('mặc định trang 1, không lọc', () => {
    expect(orderListQuerySchema.parse({})).toEqual({ page: 1 });
  });
  it('đọc danh sách pay/status, bỏ trùng, trim ô tìm', () => {
    expect(orderListQuerySchema.parse({ pay: 'cash,debt,cash', status: 'cancelled', q: '  sữa ', customerId: '3', page: '2' })).toEqual({
      pay: ['cash', 'debt'],
      status: ['cancelled'],
      q: 'sữa',
      customerId: 3,
      page: 2,
    });
  });
  it('ô tìm rỗng coi như không tìm', () => {
    expect(orderListQuerySchema.parse({ q: '   ' }).q).toBeUndefined();
  });
  it('giữ tham số date cũ', () => {
    expect(orderListQuerySchema.parse({ date: '2026-09-29' })).toEqual({ date: '2026-09-29', page: 1 });
    expect(orderListQuerySchema.safeParse({ date: '2028-02-29' }).success).toBe(true);
  });
  it.each([
    [{ date: '29/09/2026' }],
    [{ from: '2026-02-30' }],
    [{ date: '2026-13-45' }],
    [{ pay: 'cash,foo' }],
    [{ status: 'open' }],
    [{ page: '0' }],
    [{ customerId: '-1' }],
    [{ q: 'x'.repeat(101) }],
  ])('400 với %j', (q) => {
    expect(orderListQuerySchema.safeParse(q).success).toBe(false);
  });
  it('from sau to → lỗi tiếng Việt', () => {
    const r = orderListQuerySchema.safeParse({ from: '2026-09-30', to: '2026-09-01' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe('Ngày bắt đầu phải trước ngày kết thúc');
  });
  it('quá 366 ngày → lỗi tiếng Việt; đúng 366 ngày thì được', () => {
    const r = orderListQuerySchema.safeParse({ from: '2025-09-29', to: '2026-09-30' });
    expect(r.error?.issues[0]?.message).toBe('Khoảng ngày tối đa 1 năm');
    expect(orderListQuerySchema.safeParse({ from: '2025-09-30', to: '2026-09-30' }).success).toBe(true);
  });
});

describe('importListQuerySchema', () => {
  it('supplierId số hoặc none, unpaid là cờ', () => {
    expect(importListQuerySchema.parse({ supplierId: 'none', unpaid: '1' })).toEqual({ supplierId: 'none', unpaid: true, page: 1 });
    expect(importListQuerySchema.parse({ supplierId: '4' })).toEqual({ supplierId: 4, unpaid: false, page: 1 });
    expect(importListQuerySchema.safeParse({ supplierId: 'abc' }).success).toBe(false);
  });
});

describe('partyListQuerySchema', () => {
  it('includeInactive là cờ', () => {
    expect(partyListQuerySchema.parse({ includeInactive: '1', q: ' lan ' })).toEqual({ includeInactive: true, q: 'lan' });
    expect(partyListQuerySchema.parse({})).toEqual({ includeInactive: false });
  });
});

describe('trường lọc phía trình duyệt', () => {
  const product = z.object(productViewFields);
  const party = z.object(partyViewFields);
  it('mặc định', () => {
    expect(product.parse({})).toEqual({ includeInactive: false, weighed: false, noBarcode: false, sort: 'name', page: 1 });
    expect(party.parse({})).toEqual({ debtOnly: false, includeInactive: false, sort: 'name' });
  });
  it('đọc chuỗi URL', () => {
    expect(product.parse({ stock: 'low', priceMin: '10000', sort: 'value-desc', categoryId: '2' })).toMatchObject({
      stock: 'low',
      priceMin: 10000,
      sort: 'value-desc',
      categoryId: 2,
    });
    expect(product.safeParse({ stock: 'abc' }).success).toBe(false);
  });
});

describe('khoảng ngày', () => {
  it('validRange', () => {
    expect(validRange('2026-09-01', '2026-09-30')).toBe(true);
    expect(validRange('2026-09-30', '2026-09-01')).toBe(false);
    expect(validRange('2025-09-29', '2026-09-30')).toBe(false);
  });
  it('resolveRange: date cũ, một đầu, mặc định hôm nay', () => {
    expect(resolveRange({}, '2026-09-30')).toEqual({ from: '2026-09-30', to: '2026-09-30' });
    expect(resolveRange({ date: '2026-09-29' }, '2026-09-30')).toEqual({ from: '2026-09-29', to: '2026-09-29' });
    expect(resolveRange({ from: '2026-09-01' }, '2026-09-30')).toEqual({ from: '2026-09-01', to: '2026-09-01' });
    expect(resolveRange({ from: '2026-09-01', to: '2026-09-15', date: '2026-01-01' }, '2026-09-30')).toEqual({ from: '2026-09-01', to: '2026-09-15' });
  });
});
