import { beforeEach, describe, expect, it } from 'vitest';
import { productInputSchema } from '@tiny-pos/shared';
import { createTestDb } from '../db/test-db.js';
import type { Db } from '../db/connection.js';
import { createProduct, findProductByBarcode, getProduct } from './products.js';
import { createUnit, deleteUnit, updateUnit } from './product-units.js';

let db: Db;
let pid: number;
beforeEach(() => {
  db = createTestDb();
  pid = createProduct(db, productInputSchema.parse({ name: 'Coca lon', barcode: '100', sellPrice: 10000 })).id;
});

describe('product units', () => {
  it('thêm/sửa/xóa đơn vị và by-barcode nhận ra mã thùng', () => {
    const u = createUnit(db, pid, { name: 'Thùng', barcode: '100T', factor: 24, sellPrice: 230000 });
    expect(getProduct(db, pid).units).toEqual([u]);
    expect(findProductByBarcode(db, '100T')).toMatchObject({ product: { id: pid }, unit: { id: u.id, factor: 24 } });
    expect(findProductByBarcode(db, '100')).toMatchObject({ product: { id: pid }, unit: null });
    expect(updateUnit(db, pid, u.id, { name: 'Thùng', barcode: '100T', factor: 12, sellPrice: 115000 })).toMatchObject({
      factor: 12,
    });
    deleteUnit(db, pid, u.id);
    expect(getProduct(db, pid).units).toEqual([]);
    expect(() => deleteUnit(db, pid, u.id)).toThrow('Không tìm thấy đơn vị');
  });

  it('mã đơn vị trùng mã sản phẩm khác hoặc ngược lại → 409', () => {
    expect(() => createUnit(db, pid, { name: 'Lốc', barcode: '100', factor: 6, sellPrice: 60000 })).toThrow(
      'Mã vạch đã tồn tại',
    );
    createUnit(db, pid, { name: 'Lốc', barcode: '100L', factor: 6, sellPrice: 60000 });
    expect(() => createProduct(db, productInputSchema.parse({ name: 'X', barcode: '100L' }))).toThrow('Mã vạch đã tồn tại');
  });

  it('sản phẩm không tồn tại → 404', () => {
    expect(() => createUnit(db, 999, { name: 'Lốc', barcode: null, factor: 6, sellPrice: 1 })).toThrow(
      'Không tìm thấy sản phẩm',
    );
  });
});
