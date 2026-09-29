import { eq, sql } from 'drizzle-orm';
import type { DbOrTx } from '../db/connection.js';
import { products, stockMovements } from '../db/schema.js';
import { NotFoundError } from '../errors.js';

export type MovementType = 'sale' | 'import' | 'return' | 'adjust';

export interface MovementInput {
  productId: number;
  qty: number;
  type: MovementType;
  refId?: number | null;
  note?: string | null;
}

/** Cách DUY NHẤT để đổi tồn kho: ghi movement rồi cộng dồn vào products.stock. */
export function recordMovement(tx: DbOrTx, m: MovementInput): void {
  tx.insert(stockMovements)
    .values({ productId: m.productId, qty: m.qty, type: m.type, refId: m.refId ?? null, note: m.note ?? null })
    .run();
  tx.update(products)
    .set({ stock: sql`${products.stock} + ${m.qty}` })
    .where(eq(products.id, m.productId))
    .run();
}

/** Đưa tồn về đúng `target` bằng 1 movement adjust (kiểm kê, sửa tay). */
export function adjustStockTo(tx: DbOrTx, productId: number, target: number, note: string): void {
  const row = tx.select({ stock: products.stock }).from(products).where(eq(products.id, productId)).get();
  if (!row) throw new NotFoundError('Không tìm thấy sản phẩm');
  const diff = target - row.stock;
  if (Math.abs(diff) < 1e-9) return;
  recordMovement(tx, { productId, qty: diff, type: 'adjust', note });
}
