import { and, asc, eq, getTableColumns, sql } from 'drizzle-orm';
import { foldText, type BarcodeLookup, type Product, type ProductInput, type ProductListQuery, type ProductWithUnits } from '@tiny-pos/shared';
import type { Db, DbOrTx } from '../db/connection.js';
import { categories, productUnits, products } from '../db/schema.js';
import { ConflictError, NotFoundError } from '../errors.js';
import { adjustStockTo } from './stock.js';

const productColumns = { ...getTableColumns(products), categoryName: categories.name };
const isoNow = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

function selectProducts(tx: DbOrTx) {
  return tx.select(productColumns).from(products).leftJoin(categories, eq(products.categoryId, categories.id));
}

/**
 * Lọc `q` bằng JS, bỏ dấu và hoa/thường ("nuoc" khớp "Nước"), vì LIKE của SQLite chỉ bỏ hoa/thường với ASCII.
 * Danh mục tạp hóa nhỏ nên lọc trong bộ nhớ là đủ.
 */
export function listProducts(db: Db, query: ProductListQuery): Product[] {
  const rows = selectProducts(db)
    .where(
      and(
        query.includeInactive ? undefined : eq(products.isActive, true),
        query.categoryId ? eq(products.categoryId, query.categoryId) : undefined,
      ),
    )
    .orderBy(asc(products.name))
    .all();
  const q = query.q ? foldText(query.q.trim()) : '';
  if (!q) return rows;
  return rows.filter((p) => foldText(p.name).includes(q) || (p.barcode?.toLowerCase().includes(q) ?? false));
}

function getProductRow(tx: DbOrTx, id: number): Product {
  const row = selectProducts(tx).where(eq(products.id, id)).get();
  if (!row) throw new NotFoundError('Không tìm thấy sản phẩm');
  return row;
}

export function getProduct(db: DbOrTx, id: number): ProductWithUnits {
  const product = getProductRow(db, id);
  const units = db.select().from(productUnits).where(eq(productUnits.productId, id)).orderBy(asc(productUnits.factor)).all();
  return { ...product, units };
}

/** Mã vạch phải duy nhất trên cả products lẫn product_units (by-barcode mới không mơ hồ). */
export function assertBarcodeFree(
  tx: DbOrTx,
  barcode: string | null,
  opts: { productId?: number; unitId?: number } = {},
): void {
  if (!barcode) return;
  const p = tx.select({ id: products.id }).from(products).where(eq(products.barcode, barcode)).get();
  if (p && p.id !== opts.productId) throw new ConflictError('Mã vạch đã tồn tại');
  const u = tx.select({ id: productUnits.id }).from(productUnits).where(eq(productUnits.barcode, barcode)).get();
  if (u && u.id !== opts.unitId) throw new ConflictError('Mã vạch đã tồn tại');
}

export function createProduct(db: Db, input: ProductInput): ProductWithUnits {
  return db.transaction((tx) => {
    assertBarcodeFree(tx, input.barcode);
    const { stock, ...rest } = input;
    const row = tx.insert(products).values(rest).returning({ id: products.id }).get();
    if (stock > 0) adjustStockTo(tx, row.id, stock, 'Tồn đầu');
    return getProduct(tx, row.id);
  });
}

export function updateProduct(db: Db, id: number, input: ProductInput): ProductWithUnits {
  return db.transaction((tx) => {
    getProductRow(tx, id);
    assertBarcodeFree(tx, input.barcode, { productId: id });
    const { stock, ...rest } = input;
    tx.update(products)
      .set({ ...rest, updatedAt: isoNow })
      .where(eq(products.id, id))
      .run();
    adjustStockTo(tx, id, stock, 'Sửa thủ công');
    return getProduct(tx, id);
  });
}

export function setProductActive(db: Db, id: number, active: boolean): Product {
  const row = db
    .update(products)
    .set({ isActive: active, updatedAt: isoNow })
    .where(eq(products.id, id))
    .returning({ id: products.id })
    .get();
  if (!row) throw new NotFoundError('Không tìm thấy sản phẩm');
  return getProductRow(db, id);
}

/** Tìm theo mã sản phẩm trước, rồi tới mã đơn vị quy đổi (thùng/lốc). */
export function findProductByBarcode(db: Db, code: string): BarcodeLookup {
  const direct = selectProducts(db).where(eq(products.barcode, code)).get();
  if (direct) return { product: direct, unit: null };
  const unit = db.select().from(productUnits).where(eq(productUnits.barcode, code)).get();
  if (!unit) throw new NotFoundError('Không tìm thấy mã vạch');
  return { product: getProductRow(db, unit.productId), unit };
}
