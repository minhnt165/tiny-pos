import { eq } from 'drizzle-orm';
import type { Db } from '../db/connection.js';
import { products } from '../db/schema.js';
import { createCategory, listCategories } from '../services/categories.js';
import { createUnit } from '../services/product-units.js';
import { createProduct } from '../services/products.js';
import { SEED_CATEGORIES, SEED_PRODUCTS, ean13 } from './seed-data.js';

export interface SeedResult {
  categoriesCreated: number;
  productsCreated: number;
  productsSkipped: number;
  unitsCreated: number;
}

/**
 * Nạp dữ liệu mẫu. An toàn khi chạy nhiều lần: danh mục khớp theo tên,
 * sản phẩm bỏ qua nếu đã có cùng mã vạch (hoặc cùng tên với hàng không mã).
 */
export function seed(db: Db): SeedResult {
  const result: SeedResult = { categoriesCreated: 0, productsCreated: 0, productsSkipped: 0, unitsCreated: 0 };

  const byName = new Map(listCategories(db).map((c) => [c.name.toLowerCase(), c.id]));
  SEED_CATEGORIES.forEach((name, i) => {
    if (byName.has(name.toLowerCase())) return;
    const c = createCategory(db, { name, sortOrder: i });
    byName.set(name.toLowerCase(), c.id);
    result.categoriesCreated++;
  });

  SEED_PRODUCTS.forEach((sp, i) => {
    const barcode = sp.noBarcode ? null : ean13(i + 1);
    const exists = barcode
      ? db.select({ id: products.id }).from(products).where(eq(products.barcode, barcode)).get()
      : db.select({ id: products.id }).from(products).where(eq(products.name, sp.name)).get();
    if (exists) {
      result.productsSkipped++;
      return;
    }
    const created = createProduct(db, {
      barcode,
      name: sp.name,
      unit: sp.unit,
      costPrice: sp.costPrice,
      sellPrice: sp.sellPrice,
      stock: sp.stock,
      isWeighed: sp.isWeighed ?? false,
      categoryId: byName.get(sp.category.toLowerCase()) ?? null,
      minStock: sp.minStock ?? 0,
    });
    result.productsCreated++;
    if (sp.inactive) db.update(products).set({ isActive: false }).where(eq(products.id, created.id)).run();
    for (const [j, u] of (sp.units ?? []).entries()) {
      createUnit(db, created.id, { name: u.name, barcode: barcode ? `${barcode}${j + 1}` : null, factor: u.factor, sellPrice: u.sellPrice });
      result.unitsCreated++;
    }
  });

  return result;
}
