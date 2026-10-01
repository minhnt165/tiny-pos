import { desc, eq, inArray } from 'drizzle-orm';
import type { StockMovement } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { orders, products, stockMovements } from '../db/schema.js';
import { NotFoundError } from '../errors.js';

/** Ghi chú của movement nhập/hủy phiếu/kiểm kê đã chứa mã chứng từ ("Nhập PN-…", "Kiểm kê KK-…"). */
const CODE_IN_NOTE = /\b(?:HD|PN|KK|TH|TN)-\d{8}-\d+\b/;

export function listMovements(db: Db, productId: number, limit: number): StockMovement[] {
  const p = db.select({ id: products.id }).from(products).where(eq(products.id, productId)).get();
  if (!p) throw new NotFoundError('Không tìm thấy sản phẩm');
  const rows = db
    .select({
      id: stockMovements.id,
      type: stockMovements.type,
      qty: stockMovements.qty,
      note: stockMovements.note,
      createdAt: stockMovements.createdAt,
      refId: stockMovements.refId,
    })
    .from(stockMovements)
    .where(eq(stockMovements.productId, productId))
    .orderBy(desc(stockMovements.id))
    .limit(limit)
    .all();
  const isOrder = (t: string) => t === 'sale' || t === 'return';
  const orderIds = [...new Set(rows.filter((r) => isOrder(r.type) && r.refId !== null).map((r) => r.refId!))];
  const orderCodes = new Map(
    orderIds.length
      ? db
          .select({ id: orders.id, code: orders.code })
          .from(orders)
          .where(inArray(orders.id, orderIds))
          .all()
          .map((o) => [o.id, o.code] as const)
      : [],
  );
  return rows.map(({ refId, ...r }) => ({
    ...r,
    refCode: r.note?.match(CODE_IN_NOTE)?.[0] ?? (isOrder(r.type) && refId !== null ? (orderCodes.get(refId) ?? null) : null),
  }));
}
