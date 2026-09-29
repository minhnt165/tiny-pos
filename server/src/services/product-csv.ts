import { eq, sql } from 'drizzle-orm';
import {
  PRODUCT_CSV_HEADERS,
  parseProductCsv,
  productToCsvRow,
  toCsv,
  type CsvImportResult,
  type ProductCsvRow,
} from '@tiny-pos/shared';
import type { Db, DbOrTx } from '../db/connection.js';
import { categories, products } from '../db/schema.js';
import { listProducts } from './products.js';
import { adjustStockTo } from './stock.js';

/** CSV có BOM để Excel mở đúng dấu tiếng Việt. Chỉ xuất hàng đang bán. */
export function exportProductsCsv(db: Db): string {
  const rows = listProducts(db, { includeInactive: false }).map((p) => productToCsvRow(p, p.categoryName));
  return '﻿' + toCsv([[...PRODUCT_CSV_HEADERS], ...rows]);
}

function findOrCreateCategory(tx: DbOrTx, cache: Map<string, number>, name: string): number {
  const key = name.toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;
  const found = tx
    .select({ id: categories.id })
    .from(categories)
    .where(sql`lower(${categories.name}) = ${key}`)
    .get();
  const id = found?.id ?? tx.insert(categories).values({ name }).returning({ id: categories.id }).get().id;
  cache.set(key, id);
  return id;
}

/** Trùng mã vạch → cập nhật (bỏ qua Tồn để giữ lịch sử kho); chưa có → tạo mới kèm movement tồn đầu. */
function upsertRow(tx: DbOrTx, cache: Map<string, number>, row: ProductCsvRow): 'created' | 'updated' {
  const categoryId = row.categoryName ? findOrCreateCategory(tx, cache, row.categoryName) : null;
  const fields = {
    name: row.name,
    unit: row.unit,
    costPrice: row.costPrice,
    sellPrice: row.sellPrice,
    isWeighed: row.isWeighed,
    categoryId,
    minStock: row.minStock,
  };
  const existing = row.barcode
    ? tx.select({ id: products.id }).from(products).where(eq(products.barcode, row.barcode)).get()
    : undefined;
  if (existing) {
    tx.update(products)
      .set({ ...fields, updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))` })
      .where(eq(products.id, existing.id))
      .run();
    return 'updated';
  }
  const created = tx
    .insert(products)
    .values({ ...fields, barcode: row.barcode })
    .returning({ id: products.id })
    .get();
  if (row.stock > 0) adjustStockTo(tx, created.id, row.stock, 'Nhập CSV');
  return 'created';
}

/** Nhập CSV trong 1 transaction. Lỗi từng dòng (parse) được trả về; lỗi hệ thống → rollback. */
export function importProductsCsv(db: Db, text: string): CsvImportResult {
  const { rows, errors } = parseProductCsv(text);
  return db.transaction((tx) => {
    const cache = new Map<string, number>();
    let created = 0;
    let updated = 0;
    for (const { data } of rows) {
      if (upsertRow(tx, cache, data) === 'created') created++;
      else updated++;
    }
    return { created, updated, errors };
  });
}
