import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../db/test-db.js';
import type { Db } from '../db/connection.js';
import { products } from '../db/schema.js';
import { createCategory, deleteCategory, listCategories, updateCategory } from './categories.js';

let db: Db;
beforeEach(() => {
  db = createTestDb();
});

describe('categories', () => {
  it('tạo, liệt kê theo sortOrder rồi tên, đếm sản phẩm đang bán', () => {
    const b = createCategory(db, { name: 'Bánh kẹo', sortOrder: 2 });
    const a = createCategory(db, { name: 'Đồ uống', sortOrder: 1 });
    db.insert(products)
      .values([
        { name: 'Coca', categoryId: a.id },
        { name: 'Pepsi cũ', categoryId: a.id, isActive: false },
      ])
      .run();
    expect(listCategories(db)).toEqual([
      { id: a.id, name: 'Đồ uống', sortOrder: 1, productCount: 1 },
      { id: b.id, name: 'Bánh kẹo', sortOrder: 2, productCount: 0 },
    ]);
  });

  it('sửa và báo 404 khi không có', () => {
    const c = createCategory(db, { name: 'A', sortOrder: 0 });
    expect(updateCategory(db, c.id, { name: 'B', sortOrder: 5 })).toMatchObject({ name: 'B', sortOrder: 5 });
    expect(() => updateCategory(db, 999, { name: 'B', sortOrder: 0 })).toThrow('Không tìm thấy danh mục');
  });

  it('xóa danh mục thì sản phẩm về không danh mục', () => {
    const c = createCategory(db, { name: 'A', sortOrder: 0 });
    const [p] = db.insert(products).values({ name: 'X', categoryId: c.id }).returning().all();
    deleteCategory(db, c.id);
    expect(db.select().from(products).where(eq(products.id, p!.id)).get()?.categoryId).toBeNull();
    expect(() => deleteCategory(db, c.id)).toThrow('Không tìm thấy danh mục');
  });
});
