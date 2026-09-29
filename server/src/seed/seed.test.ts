import { describe, expect, it } from 'vitest';
import { createTestDb } from '../db/test-db.js';
import { listProducts } from '../services/products.js';
import { listCategories } from '../services/categories.js';
import { SEED_PRODUCTS, ean13 } from './seed-data.js';
import { seed } from './seed.js';

const validEan13 = (code: string) => {
  if (!/^\d{13}$/.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(code[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10 === Number(code[12]);
};

describe('seed', () => {
  it('mã EAN-13 sinh ra hợp lệ và không trùng', () => {
    const codes = SEED_PRODUCTS.map((_, i) => ean13(i + 1));
    expect(codes.every(validEan13)).toBe(true);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('nạp đủ dữ liệu, chạy lần hai không tạo trùng', () => {
    const db = createTestDb();
    const first = seed(db);
    expect(first.categoriesCreated).toBe(10);
    expect(first.productsCreated).toBe(SEED_PRODUCTS.length);
    expect(first.unitsCreated).toBeGreaterThan(10);
    expect(listCategories(db).reduce((s, c) => s + c.productCount, 0)).toBe(
      SEED_PRODUCTS.filter((p) => !p.inactive).length,
    );
    const inactive = listProducts(db, { includeInactive: true }).filter((p) => !p.isActive);
    expect(inactive).toHaveLength(2);

    const second = seed(db);
    expect(second).toEqual({ categoriesCreated: 0, productsCreated: 0, productsSkipped: SEED_PRODUCTS.length, unitsCreated: 0 });
  });
});
