import { and, eq } from 'drizzle-orm';
import type { ProductUnit, ProductUnitInput } from '@tiny-pos/shared';
import type { Db, DbOrTx } from '../db/connection.js';
import { productUnits, products } from '../db/schema.js';
import { NotFoundError } from '../errors.js';
import { assertBarcodeFree } from './products.js';

function assertProduct(tx: DbOrTx, productId: number): void {
  const row = tx.select({ id: products.id }).from(products).where(eq(products.id, productId)).get();
  if (!row) throw new NotFoundError('Không tìm thấy sản phẩm');
}

export function createUnit(db: Db, productId: number, input: ProductUnitInput): ProductUnit {
  return db.transaction((tx) => {
    assertProduct(tx, productId);
    assertBarcodeFree(tx, input.barcode);
    return tx
      .insert(productUnits)
      .values({ ...input, productId })
      .returning()
      .get();
  });
}

export function updateUnit(db: Db, productId: number, unitId: number, input: ProductUnitInput): ProductUnit {
  return db.transaction((tx) => {
    assertBarcodeFree(tx, input.barcode, { unitId });
    const row = tx
      .update(productUnits)
      .set(input)
      .where(and(eq(productUnits.id, unitId), eq(productUnits.productId, productId)))
      .returning()
      .get();
    if (!row) throw new NotFoundError('Không tìm thấy đơn vị');
    return row;
  });
}

/** Xóa cứng: đơn vị quy đổi không có lịch sử riêng (order_items lưu snapshot). */
export function deleteUnit(db: Db, productId: number, unitId: number): void {
  const row = db
    .delete(productUnits)
    .where(and(eq(productUnits.id, unitId), eq(productUnits.productId, productId)))
    .returning()
    .get();
  if (!row) throw new NotFoundError('Không tìm thấy đơn vị');
}
