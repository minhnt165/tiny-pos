import { and, count, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import {
  localDate,
  localDayRange,
  MAX_EXPORT_ROWS,
  PAGE_SIZE,
  QTY_EPS,
  remainingQty,
  resolveRange,
  returnAmounts,
  roundQty,
  splitRefund,
  type ReturnDetail,
  type ReturnInput,
  type ReturnList,
  type ReturnListQuery,
} from '@tiny-pos/shared';
import type { Db, DbOrTx } from '../db/connection.js';
import { customers, orders, returnItems, returns } from '../db/schema.js';
import { BadRequestError, ConflictError, NotFoundError } from '../errors.js';
import { recordCustomerDebtTx } from './customer-ledger.js';
import { nextDailyCode, resolveClock, type Clock } from './daily-code.js';
import { getOrder, likeTerm } from './orders.js';
import { returnItemsOf, returnRows, returnSummary } from './return-rows.js';
import { recordMovement } from './stock.js';

const INVALID_LINE = 'Dòng trả hàng không hợp lệ';

export function getReturn(db: DbOrTx, id: number): ReturnDetail {
  const [row] = returnRows(db, eq(returns.id, id));
  if (!row) throw new NotFoundError('Không tìm thấy phiếu trả');
  return { ...row, items: returnItemsOf(db, [id]).get(id) ?? [] };
}

/**
 * Lập phiếu trả cho hóa đơn `done`, tính vào ngày lập phiếu: tiền hoàn theo giá trị sau giảm giá của dòng (return-math),
 * đơn ghi nợ trừ nợ hiện tại của khách trước rồi mới trả tiền mặt, dòng nhập lại kho ghi movement `return`.
 */
export function createReturn(db: Db, input: ReturnInput, clock?: Clock): ReturnDetail {
  const { now, tz } = resolveClock(clock);
  return db.transaction((tx) => {
    const o = getOrder(tx, input.orderId);
    if (o.status !== 'done') throw new ConflictError('Hóa đơn đã hủy, không trả hàng được');
    if (!input.items.length) throw new BadRequestError('Chưa chọn món nào để trả');
    if (new Set(input.items.map((l) => l.orderItemId)).size !== input.items.length) throw new BadRequestError(INVALID_LINE);
    const picks = new Map<number, number>();
    const lines = input.items.map((l) => {
      const it = o.items.find((i) => i.id === l.orderItemId);
      if (!it) throw new BadRequestError(INVALID_LINE);
      const qty = roundQty(l.qty);
      if (qty <= 0) throw new BadRequestError(INVALID_LINE);
      if (qty > remainingQty(it.qty, it.returnedQty) + QTY_EPS) throw new BadRequestError(`Số lượng trả vượt số còn lại của ${it.productName}`);
      picks.set(it.id, qty);
      return { it, qty, restock: l.restock && it.productId !== null };
    });
    const amounts = returnAmounts(o.items, o.discount, picks);
    const refund = lines.reduce((s, l) => s + amounts.get(l.it.id)!, 0);
    const { debtReduced, cashRefund } = splitRefund(refund, o.paymentMethod, o.customerDebt);
    const code = nextDailyCode(tx, 'returns', 'TH', localDate(now, tz), 4);
    const { id } = tx
      .insert(returns)
      .values({ code, orderId: o.id, refund, debtReduced, cashRefund, note: input.note, createdAt: now.toISOString() })
      .returning({ id: returns.id })
      .get();
    for (const l of lines) {
      tx.insert(returnItems)
        .values({ returnId: id, orderItemId: l.it.id, qty: l.qty, restock: l.restock, amount: amounts.get(l.it.id)!, cost: Math.round(l.qty * l.it.costPrice) })
        .run();
      if (l.restock) recordMovement(tx, { productId: l.it.productId!, qty: l.qty * l.it.factor, type: 'return', refId: id, note: `Trả hàng ${code}` });
    }
    if (debtReduced > 0)
      recordCustomerDebtTx(tx, {
        customerId: o.customerId!,
        amount: -debtReduced,
        kind: 'return',
        orderId: o.id,
        note: `Trả hàng ${code}`,
        createdAt: now.toISOString(),
      });
    return getReturn(tx, id);
  });
}

/** Hủy phiếu trả: trừ lại tồn đã nhập kho (movement adjust), cộng lại nợ đã trừ; phiếu giữ lại với trạng thái cancelled. */
export function cancelReturn(db: Db, id: number, clock?: Clock): ReturnDetail {
  const { now } = resolveClock(clock);
  return db.transaction((tx) => {
    const r = getReturn(tx, id);
    if (r.status === 'cancelled') throw new ConflictError('Phiếu trả đã hủy');
    // Khách đã xóa không hiện trong danh sách nợ và không thu nợ được: cộng lại nợ cho họ sẽ thành khoản treo
    const active = r.customerId === null || tx.select({ v: customers.isActive }).from(customers).where(eq(customers.id, r.customerId)).get()?.v;
    if (r.debtReduced > 0 && !active)
      throw new ConflictError('Khách đã ngừng theo dõi, không hủy được phiếu trả đã trừ nợ');
    for (const it of r.items) {
      if (!it.restock || it.productId === null) continue;
      recordMovement(tx, { productId: it.productId, qty: -it.qty * it.factor, type: 'adjust', refId: id, note: `Hủy phiếu trả ${r.code}` });
    }
    if (r.debtReduced > 0 && r.customerId !== null)
      recordCustomerDebtTx(tx, {
        customerId: r.customerId,
        amount: r.debtReduced,
        kind: 'return_cancel',
        orderId: r.orderId,
        note: `Hủy phiếu trả ${r.code}`,
        createdAt: now.toISOString(),
      });
    tx.update(returns).set({ status: 'cancelled', cancelledAt: now.toISOString() }).where(eq(returns.id, id)).run();
    return getReturn(tx, id);
  });
}

/** Điều kiện lọc phiếu trả dùng chung cho danh sách và file xuất; tìm theo mã phiếu, mã hóa đơn, tên món (không dấu). */
function returnFilter(query: ReturnListQuery, clock?: Clock) {
  const { now, tz } = resolveClock(clock);
  const { from, to } = resolveRange(query, localDate(now, tz));
  const start = localDayRange(from, tz).start;
  const end = localDayRange(to, tz).end;
  const term = likeTerm(query.q);
  const where = and(
    gte(returns.createdAt, start),
    lt(returns.createdAt, end),
    query.status?.length ? inArray(returns.status, query.status) : undefined,
    // Viết tên bảng cứng: drizzle bỏ tiền tố bảng trong sql``
    term
      ? sql`(vn_fold(returns.code) like ${term} escape '\\' or vn_fold(orders.code) like ${term} escape '\\' or exists (select 1 from return_items
          join order_items on order_items.id = return_items.order_item_id
          where return_items.return_id = returns.id and vn_fold(order_items.product_name) like ${term} escape '\\'))`
      : undefined,
  );
  return { from, to, start, end, where };
}

const countReturns = (db: Db, where: ReturnType<typeof returnFilter>['where']) =>
  db.select({ n: count() }).from(returns).innerJoin(orders, eq(returns.orderId, orders.id)).where(where).get()?.n ?? 0;

export function listReturns(db: Db, query: ReturnListQuery, clock?: Clock): ReturnList {
  const { start, end, where } = returnFilter(query, clock);
  const page = query.page ?? 1;
  return {
    returns: returnRows(db, where, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    summary: returnSummary(db, start, end),
    total: countReturns(db, where),
    page,
    pageSize: PAGE_SIZE,
  };
}

/** Mọi phiếu trả khớp bộ lọc (không phân trang), mới nhất trước, kèm dòng; quá `maxRows` thì báo lỗi. */
export function listReturnsForExport(
  db: Db,
  query: ReturnListQuery,
  clock?: Clock,
  maxRows = MAX_EXPORT_ROWS,
): { from: string; to: string; returns: ReturnDetail[] } {
  const { from, to, where } = returnFilter(query, clock);
  if (countReturns(db, where) > maxRows) throw new BadRequestError('Quá nhiều phiếu trả, hãy chọn khoảng ngày ngắn hơn');
  const rows = returnRows(db, where);
  const itemsOf = returnItemsOf(db, rows.map((r) => r.id));
  return { from, to, returns: rows.map((r) => ({ ...r, items: itemsOf.get(r.id) ?? [] })) };
}
