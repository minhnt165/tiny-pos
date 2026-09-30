import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { importLineAmount } from '@tiny-pos/shared';
import { createTestDb } from '../db/test-db.js';
import { imports } from '../db/schema.js';
import { listProducts } from '../services/products.js';
import { listCategories } from '../services/categories.js';
import { listSuppliers } from '../services/suppliers.js';
import { SEED_IMPORTS, SEED_PRODUCTS, SEED_SUPPLIERS, SEED_SUPPLIER_PAYMENTS, ean13 } from './seed-data.js';
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
    expect(second).toEqual({
      categoriesCreated: 0,
      productsCreated: 0,
      productsSkipped: SEED_PRODUCTS.length,
      unitsCreated: 0,
      suppliersCreated: 0,
      importsCreated: 0,
      importsSkipped: SEED_IMPORTS.length,
      paymentsCreated: 0,
    });
  });

  it('phiếu nhập mẫu: nợ NCC, tồn kho, giá vốn khớp với dữ liệu', () => {
    const db = createTestDb();
    const r = seed(db, new Date('2026-09-30T05:00:00Z'));
    expect(r.suppliersCreated).toBe(SEED_SUPPLIERS.length);
    expect(r.importsCreated).toBe(SEED_IMPORTS.length);
    expect(r.paymentsCreated).toBe(SEED_SUPPLIER_PAYMENTS.length);

    const lineTotal = (im: (typeof SEED_IMPORTS)[number]) => im.items.reduce((s, it) => s + importLineAmount(it.qty, it.unitCost), 0);
    for (const s of listSuppliers(db)) {
      const owed = SEED_IMPORTS.filter((im) => im.supplier === s.name && !im.cancelled)
        .map((im) => lineTotal(im) - (im.paid === 'all' ? lineTotal(im) : im.paid))
        .reduce((a, b) => a + b, 0);
      const paid = SEED_SUPPLIER_PAYMENTS.filter((p) => p.supplier === s.name).reduce((a, p) => a + p.amount, 0);
      expect(s.debt, s.name).toBe(owed - paid);
      expect(s.debt, s.name).toBeGreaterThanOrEqual(0);
    }

    const byName = new Map(listProducts(db, { includeInactive: true }).map((p) => [p.name, p]));
    // Tiger: 48 lon + 2 thùng + 3 thùng; giá vốn theo lần nhập sau cùng (379.200/24)
    expect(byName.get('Bia Tiger lon 330ml')).toMatchObject({ stock: 48 + 5 * 24, costPrice: 15800 });
    // Phiếu Pepsi đã hủy: tồn trở về như cũ
    expect(byName.get('Pepsi lon 330ml')?.stock).toBe(36);

    const cancelled = db.select().from(imports).where(eq(imports.status, 'cancelled')).all();
    expect(cancelled.map((im) => im.note)).toEqual(SEED_IMPORTS.filter((im) => im.cancelled).map((im) => im.note));
  });
});
