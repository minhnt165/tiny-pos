import { and, asc, eq, sql } from 'drizzle-orm';
import type { Category, CategoryInput } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { categories, products } from '../db/schema.js';
import { NotFoundError } from '../errors.js';

export function listCategories(db: Db): Category[] {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      sortOrder: categories.sortOrder,
      productCount: sql<number>`count(${products.id})`,
    })
    .from(categories)
    .leftJoin(products, and(eq(products.categoryId, categories.id), eq(products.isActive, true)))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.name))
    .all();
}

export function createCategory(db: Db, input: CategoryInput): Category {
  const row = db.insert(categories).values(input).returning().get();
  return { ...row, productCount: 0 };
}

export function updateCategory(db: Db, id: number, input: CategoryInput): Category {
  const row = db.update(categories).set(input).where(eq(categories.id, id)).returning().get();
  if (!row) throw new NotFoundError('Không tìm thấy danh mục');
  return listCategories(db).find((c) => c.id === id) ?? { ...row, productCount: 0 };
}

/** Xóa danh mục; sản phẩm thuộc danh mục về null nhờ FK on delete set null. */
export function deleteCategory(db: Db, id: number): void {
  const row = db.delete(categories).where(eq(categories.id, id)).returning().get();
  if (!row) throw new NotFoundError('Không tìm thấy danh mục');
}
