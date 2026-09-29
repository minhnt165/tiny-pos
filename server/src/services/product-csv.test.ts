import { beforeEach, describe, expect, it } from 'vitest';
import { productInputSchema } from '@tiny-pos/shared';
import { createTestDb } from '../db/test-db.js';
import type { Db } from '../db/connection.js';
import { stockMovements } from '../db/schema.js';
import { listCategories } from './categories.js';
import { exportProductsCsv, importProductsCsv } from './product-csv.js';
import { createProduct, listProducts } from './products.js';

let db: Db;
beforeEach(() => {
  db = createTestDb();
});
const H = 'Mã vạch,Tên,Đơn vị,Giá nhập,Giá bán,Tồn,Hàng cân,Danh mục,Tồn tối thiểu\n';

describe('importProductsCsv', () => {
  it('tạo mới kèm tồn, tự tạo danh mục theo tên (không phân biệt hoa thường)', () => {
    const r = importProductsCsv(db, H + '1,Sữa,hộp,10000,15000,20,0,Đồ Uống,5\n2,Thịt,kg,0,120000,0,1,đồ uống,0\n');
    expect(r).toEqual({ created: 2, updated: 0, errors: [] });
    expect(listCategories(db)).toMatchObject([{ name: 'Đồ Uống', productCount: 2 }]);
    expect(listProducts(db, { includeInactive: false })).toMatchObject([
      { name: 'Sữa', unit: 'hộp', stock: 20, categoryName: 'Đồ Uống', minStock: 5 },
      { name: 'Thịt', isWeighed: true, stock: 0 },
    ]);
    expect(db.select().from(stockMovements).all()).toMatchObject([{ qty: 20, type: 'adjust', note: 'Nhập CSV' }]);
  });

  it('trùng barcode → cập nhật, bỏ qua cột Tồn', () => {
    createProduct(db, productInputSchema.parse({ name: 'Cũ', barcode: '1', stock: 7 }));
    const r = importProductsCsv(db, H + '1,Mới,cái,1,2,99,0,,0\n');
    expect(r).toMatchObject({ created: 0, updated: 1 });
    expect(listProducts(db, { includeInactive: false })[0]).toMatchObject({ name: 'Mới', sellPrice: 2, stock: 7 });
    expect(db.select().from(stockMovements).all()).toHaveLength(1);
  });

  it('hai dòng cùng mã mới trong file: dòng sau cập nhật dòng trước', () => {
    const r = importProductsCsv(db, H + '9,A,cái,0,1,5,0,,0\n9,B,cái,0,2,50,0,,0\n');
    expect(r).toMatchObject({ created: 1, updated: 1 });
    expect(listProducts(db, { includeInactive: false })).toMatchObject([{ name: 'B', sellPrice: 2, stock: 5 }]);
  });

  it('dòng lỗi được báo, dòng khác vẫn nhập', () => {
    const r = importProductsCsv(db, H + '2,,cái,0,1,0,0,,0\n3,OK,cái,0,1,0,0,,0\n');
    expect(r.created).toBe(1);
    expect(r.errors).toEqual([{ line: 2, message: 'Tên không được trống' }]);
  });
});

describe('exportProductsCsv', () => {
  it('có BOM, tiêu đề tiếng Việt, chỉ hàng đang bán, nhập lại được', () => {
    createProduct(db, productInputSchema.parse({ name: 'Kẹo, dẻo', barcode: '5', sellPrice: 5000, stock: 3 }));
    const text = exportProductsCsv(db);
    expect(text.startsWith('﻿Mã vạch,Tên,')).toBe(true);
    expect(text).toContain('5,"Kẹo, dẻo",cái,0,5000,3,0,,0');
    const db2 = createTestDb();
    expect(importProductsCsv(db2, text)).toEqual({ created: 1, updated: 0, errors: [] });
  });
});
