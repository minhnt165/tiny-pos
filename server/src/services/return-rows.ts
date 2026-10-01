import { and, asc, desc, eq, gte, inArray, lt, sql, type SQL } from 'drizzle-orm';
import type { ReturnItem, ReturnSummary, ReturnSummaryRow } from '@tiny-pos/shared';
import type { DbOrTx } from '../db/connection.js';
import { customers, orderItems, orders, returnItems, returns } from '../db/schema.js';

// Truy vấn đọc phiếu trả dùng chung cho orders.ts và returns.ts; chỉ phụ thuộc schema để hai service không import vòng.
// Viết tên bảng cứng trong sql``: drizzle bỏ tiền tố bảng khi render cột.

/** Σ tiền hoàn các phiếu trả chưa hủy của đơn; làm cột trong select từ `orders`. */
export const refundedSql = sql<number>`(select coalesce(sum(refund), 0) from returns where returns.order_id = orders.id and returns.status = 'done')`;

/** Σ số lượng đã trả (phiếu chưa hủy) của dòng hóa đơn; làm cột trong select từ `order_items`. */
export const returnedQtySql = sql<number>`(select coalesce(sum(return_items.qty), 0) from return_items
  join returns on returns.id = return_items.return_id where return_items.order_item_id = order_items.id and returns.status = 'done')`;

const itemCountSql = sql<number>`(select count(*) from return_items where return_items.return_id = returns.id)`;

/** Phiếu trả khớp điều kiện (kèm mã hóa đơn, khách hiện tại, số dòng), mới nhất trước. */
export function returnRows(db: DbOrTx, where: SQL | undefined, page?: { limit: number; offset: number }): ReturnSummaryRow[] {
  const q = db
    .select({ r: returns, orderCode: orders.code, customerId: orders.customerId, customerName: customers.name, itemCount: itemCountSql })
    .from(returns)
    .innerJoin(orders, eq(returns.orderId, orders.id))
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(where)
    .orderBy(desc(returns.id));
  const rows = page ? q.limit(page.limit).offset(page.offset).all() : q.all();
  return rows.map(({ r, ...x }) => ({ ...r, ...x, itemCount: Number(x.itemCount) }));
}

/** Dòng của các phiếu `ids` (lấy theo lô vì SQLite giới hạn số tham số), theo thứ tự lập. */
export function returnItemsOf(db: DbOrTx, ids: number[]): Map<number, ReturnItem[]> {
  const out = new Map<number, ReturnItem[]>();
  for (let i = 0; i < ids.length; i += 500) {
    const batch = db
      .select({
        returnId: returnItems.returnId,
        id: returnItems.id,
        orderItemId: returnItems.orderItemId,
        productId: orderItems.productId,
        productName: orderItems.productName,
        unit: orderItems.unit,
        qty: returnItems.qty,
        price: orderItems.price,
        factor: orderItems.factor,
        restock: returnItems.restock,
        amount: returnItems.amount,
        cost: returnItems.cost,
      })
      .from(returnItems)
      .innerJoin(orderItems, eq(returnItems.orderItemId, orderItems.id))
      .where(inArray(returnItems.returnId, ids.slice(i, i + 500)))
      .orderBy(asc(returnItems.id))
      .all();
    for (const { returnId, ...it } of batch) {
      const list = out.get(returnId);
      if (list) list.push(it);
      else out.set(returnId, [it]);
    }
  }
  return out;
}

/** Phiếu trả chưa hủy trong [start, end) (ISO UTC). daySummary và trang Trả hàng dùng chung để số luôn khớp. */
export function returnSummary(db: DbOrTx, start: string, end: string): ReturnSummary {
  const r = db
    .select({
      count: sql<number>`count(*)`,
      refund: sql<number>`coalesce(sum(${returns.refund}), 0)`,
      cash: sql<number>`coalesce(sum(${returns.cashRefund}), 0)`,
      debt: sql<number>`coalesce(sum(${returns.debtReduced}), 0)`,
    })
    .from(returns)
    .where(and(eq(returns.status, 'done'), gte(returns.createdAt, start), lt(returns.createdAt, end)))
    .get();
  return { count: Number(r?.count ?? 0), refund: Number(r?.refund ?? 0), cash: Number(r?.cash ?? 0), debt: Number(r?.debt ?? 0) };
}
