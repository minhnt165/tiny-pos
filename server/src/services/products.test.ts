import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { productInputSchema } from '@tiny-pos/shared';
import { createTestDb } from '../db/test-db.js';
import type { Db } from '../db/connection.js';
import { products, stockMovements } from '../db/schema.js';
import { createCategory } from './categories.js';
import { createProduct, getProduct, listProducts, setProductActive, updateProduct } from './products.js';

const input = (o: Record<string, unknown>) => productInputSchema.parse(o);
let db: Db;
beforeEach(() => {
  db = createTestDb();
});

describe('products', () => {
  it('tạo với tồn đầu → 1 movement adjust "Tồn đầu"', () => {
    const p = createProduct(db, input({ name: 'Sữa', barcode: '893', sellPrice: 15000, stock: 20 }));
    expect(p).toMatchObject({ name: 'Sữa', barcode: '893', stock: 20, units: [], categoryName: null });
    expect(db.select().from(stockMovements).all()).toMatchObject([
      { productId: p.id, qty: 20, type: 'adjust', note: 'Tồn đầu' },
    ]);
  });

  it('tạo với tồn 0 → không có movement', () => {
    createProduct(db, input({ name: 'A' }));
    expect(db.select().from(stockMovements).all()).toEqual([]);
  });

  it('sửa tồn → movement chênh lệch "Sửa thủ công"; sửa mà tồn không đổi → không thêm', () => {
    const p = createProduct(db, input({ name: 'A', stock: 5 }));
    updateProduct(db, p.id, input({ name: 'A', stock: 3 }));
    updateProduct(db, p.id, input({ name: 'B', stock: 3 }));
    expect(getProduct(db, p.id)).toMatchObject({ name: 'B', stock: 3 });
    expect(
      db
        .select()
        .from(stockMovements)
        .all()
        .map((m) => [m.qty, m.note]),
    ).toEqual([
      [5, 'Tồn đầu'],
      [-2, 'Sửa thủ công'],
    ]);
  });

  it('trùng barcode → lỗi 409', () => {
    createProduct(db, input({ name: 'A', barcode: '1' }));
    expect(() => createProduct(db, input({ name: 'B', barcode: '1' }))).toThrow('Mã vạch đã tồn tại');
    const p2 = createProduct(db, input({ name: 'C', barcode: '2' }));
    expect(() => updateProduct(db, p2.id, input({ name: 'C', barcode: '1' }))).toThrow('Mã vạch đã tồn tại');
  });

  it('liệt kê: lọc q theo tên/mã, theo danh mục, ẩn ngừng bán, kèm tên danh mục', () => {
    const c = createCategory(db, { name: 'Đồ uống', sortOrder: 0 });
    createProduct(db, input({ name: 'Coca', barcode: '111', categoryId: c.id }));
    createProduct(db, input({ name: 'Pepsi', barcode: '222', categoryId: c.id }));
    const old = createProduct(db, input({ name: 'Bánh', barcode: '333' }));
    setProductActive(db, old.id, false);
    expect(listProducts(db, { includeInactive: false }).map((p) => p.name)).toEqual(['Coca', 'Pepsi']);
    expect(listProducts(db, { includeInactive: true }).map((p) => p.name)).toEqual(['Bánh', 'Coca', 'Pepsi']);
    expect(listProducts(db, { q: '22', includeInactive: false }).map((p) => p.name)).toEqual(['Pepsi']);
    expect(listProducts(db, { q: 'coc', includeInactive: false })[0]).toMatchObject({ name: 'Coca', categoryName: 'Đồ uống' });
    expect(listProducts(db, { categoryId: c.id, includeInactive: false })).toHaveLength(2);
  });

  it('getProduct 404', () => {
    expect(() => getProduct(db, 42)).toThrow('Không tìm thấy sản phẩm');
  });
});

describe('listProducts – tìm không phân biệt hoa thường tiếng Việt', () => {
  it('gõ thường vẫn thấy tên viết hoa có dấu', () => {
    createProduct(db, input({ name: 'Đường cát', barcode: '77' }));
    createProduct(db, input({ name: 'Ớt bột' }));
    expect(listProducts(db, { q: 'đường', includeInactive: false }).map((p) => p.name)).toEqual(['Đường cát']);
    expect(listProducts(db, { q: 'ớt', includeInactive: false }).map((p) => p.name)).toEqual(['Ớt bột']);
    expect(listProducts(db, { q: '%', includeInactive: false })).toEqual([]);
  });

  it('gõ không dấu vẫn thấy tên có dấu', () => {
    createProduct(db, input({ name: 'Nước suối', barcode: '88' }));
    createProduct(db, input({ name: 'Đường cát' }));
    expect(listProducts(db, { q: 'nuoc', includeInactive: false }).map((p) => p.name)).toEqual(['Nước suối']);
    expect(listProducts(db, { q: 'DUONG', includeInactive: false }).map((p) => p.name)).toEqual(['Đường cát']);
  });

  it('updateProduct không làm mất image (schema input không có trường này)', () => {
    const p = createProduct(db, input({ name: 'Có ảnh' }));
    db.update(products).set({ image: 'p1-1.jpg' }).where(eq(products.id, p.id)).run();
    expect(updateProduct(db, p.id, input({ name: 'Đổi tên' })).image).toBe('p1-1.jpg');
  });
});
