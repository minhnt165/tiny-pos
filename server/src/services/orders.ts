import { and, asc, count, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import {
  cartTotals,
  lineAmount,
  localDate,
  localDayRange,
  MAX_EXPORT_ROWS,
  PAGE_SIZE,
  resolveRange,
  roundQty,
  stripDiacritics,
  type DaySummary,
  type OrderDebt,
  type OrderDetail,
  type OrderInput,
  type OrderItem,
  type OrderList,
  type OrderListQuery,
  type OrderSummary,
} from '@tiny-pos/shared';
import type { Db, DbOrTx } from '../db/connection.js';
import { customers, debtTransactions, orderItems, orders, productUnits, products, returns } from '../db/schema.js';
import { BadRequestError, ConflictError, NotFoundError } from '../errors.js';
import { recordMovement } from './stock.js';
import { debtBalanceAt, recordCustomerDebtTx } from './customer-ledger.js';
import { nextDailyCode, resolveClock, type Clock } from './daily-code.js';
import { refundedSql, returnedQtySql, returnRows, returnSummary } from './return-rows.js';

export type { Clock } from './daily-code.js';

const CUSTOM_NAME = 'Hàng khác';

interface ResolvedLine {
  productId: number | null;
  productName: string;
  unit: string;
  qty: number;
  price: number;
  costPrice: number;
  factor: number;
  isWeighed: boolean;
}

/** Đọc sản phẩm/đơn vị trong DB để lấy snapshot tên, đơn vị, giá vốn, hệ số. */
function resolveLine(tx: DbOrTx, it: OrderInput['items'][number]): ResolvedLine {
  if (it.productId === null) {
    const name = it.name || CUSTOM_NAME;
    return { productId: null, productName: name, unit: 'cái', qty: it.qty, price: it.price, costPrice: 0, factor: 1, isWeighed: false };
  }
  const p = tx.select().from(products).where(eq(products.id, it.productId)).get();
  if (!p || !p.isActive) throw new BadRequestError(`Sản phẩm ${p ? `"${p.name}"` : `#${it.productId}`} không còn bán`);
  let factor = 1;
  let unit = p.unit;
  if (it.unitId !== null) {
    const u = tx
      .select()
      .from(productUnits)
      .where(and(eq(productUnits.id, it.unitId), eq(productUnits.productId, p.id)))
      .get();
    if (!u) throw new BadRequestError(`Đơn vị của "${p.name}" không hợp lệ`);
    factor = u.factor;
    unit = u.name;
  }
  return {
    productId: p.id,
    productName: p.name,
    unit,
    qty: it.qty,
    price: it.price,
    costPrice: Math.round(p.costPrice * factor),
    factor,
    isWeighed: p.isWeighed && it.unitId === null,
  };
}

type OrderRow = typeof orders.$inferSelect;

function toSummary(o: OrderRow, itemCount: number, customerName: string | null, refunded: number): OrderSummary {
  return {
    id: o.id,
    code: o.code,
    total: o.total,
    discount: o.discount,
    payable: o.total - o.discount,
    paid: o.paid,
    paymentMethod: o.paymentMethod,
    customerId: o.customerId,
    customerName,
    status: o.status,
    itemCount,
    refunded,
    createdAt: o.createdAt,
    cancelledAt: o.cancelledAt,
  };
}

/** Cột của một món hàng, dùng chung cho getOrder và file xuất. */
const orderItemColumns = {
  id: orderItems.id,
  productId: orderItems.productId,
  productName: orderItems.productName,
  unit: orderItems.unit,
  qty: orderItems.qty,
  price: orderItems.price,
  costPrice: orderItems.costPrice,
  factor: orderItems.factor,
  amount: orderItems.amount,
  returnedQty: returnedQtySql,
};

/** Nợ của đơn ghi nợ tại lúc bán: lấy dòng sổ `order` của đơn và số dư của khách ngay sau dòng đó. */
function orderDebt(db: DbOrTx, o: OrderRow): OrderDebt | null {
  if (o.paymentMethod !== 'debt') return null;
  const t = db
    .select()
    .from(debtTransactions)
    .where(and(eq(debtTransactions.orderId, o.id), eq(debtTransactions.kind, 'order')))
    .get();
  return t ? { amount: t.amount, balanceAfter: debtBalanceAt(db, t.customerId, t.id) } : null;
}

export function getOrder(db: DbOrTx, id: number): OrderDetail {
  const r = db
    .select({ order: orders, customerName: customers.name, customerDebt: customers.debt, refunded: refundedSql })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(orders.id, id))
    .get();
  if (!r) throw new NotFoundError('Không tìm thấy hóa đơn');
  const o = r.order;
  const items = db
    .select(orderItemColumns)
    .from(orderItems)
    .where(eq(orderItems.orderId, id))
    .orderBy(asc(orderItems.id))
    .all()
    .map((it) => ({ ...it, returnedQty: roundQty(Number(it.returnedQty)) }));
  return {
    ...toSummary(o, items.length, r.customerName, Number(r.refunded)),
    items,
    debt: orderDebt(db, o),
    returns: returnRows(db, eq(returns.orderId, id)),
    customerDebt: r.customerDebt,
  };
}

export function createOrder(db: Db, input: OrderInput, clock?: Clock): OrderDetail {
  const { now, tz } = resolveClock(clock);
  return db.transaction((tx) => {
    const lines = input.items.map((it) => resolveLine(tx, it));
    const { total, payable } = cartTotals(lines, input.discount);
    if (input.discount > total) throw new BadRequestError('Giảm giá lớn hơn tổng tiền');
    if (input.paymentMethod === 'cash' && input.paid < payable) throw new BadRequestError('Tiền khách đưa chưa đủ');
    let customerId: number | null = null;
    if (input.paymentMethod === 'debt') {
      if (input.customerId === null) throw new BadRequestError('Chưa chọn khách');
      const c = tx.select().from(customers).where(eq(customers.id, input.customerId)).get();
      if (!c || !c.isActive) throw new BadRequestError('Khách hàng không còn theo dõi');
      if (input.paid >= payable) throw new BadRequestError('Khách trả đủ thì chọn Tiền mặt');
      customerId = c.id;
    }
    // Ghi nợ: paid là tiền mặt khách trả trước; chuyển khoản luôn đủ
    const paid = input.paymentMethod === 'transfer' ? payable : input.paid;
    const code = nextDailyCode(tx, 'orders', 'HD', localDate(now, tz), 4);
    const { id } = tx
      .insert(orders)
      .values({
        code,
        total,
        discount: input.discount,
        paid,
        paymentMethod: input.paymentMethod,
        customerId,
        createdAt: now.toISOString(),
      })
      .returning({ id: orders.id })
      .get();
    for (const l of lines) {
      const { isWeighed: _w, ...snapshot } = l;
      tx.insert(orderItems)
        .values({ ...snapshot, orderId: id, amount: lineAmount(l) })
        .run();
      // Không kiểm tra tồn: cho bán âm, số kho sửa khi kiểm kê
      if (l.productId !== null) recordMovement(tx, { productId: l.productId, qty: -l.qty * l.factor, type: 'sale', refId: id });
    }
    if (customerId !== null)
      recordCustomerDebtTx(tx, { customerId, amount: payable - paid, kind: 'order', orderId: id, note: `Bán ${code}`, createdAt: now.toISOString() });
    return getOrder(tx, id);
  });
}

// Viết tên bảng cứng: drizzle bỏ tiền tố bảng khi render cột, `id` sẽ bị hiểu là order_items.id
const itemCount = sql<number>`(select count(*) from order_items where order_items.order_id = orders.id)`;

/** Chuỗi tìm cho LIKE: bỏ dấu, chữ thường, escape % _ \ ; rỗng → không tìm. */
export function likeTerm(q: string | undefined): string | undefined {
  if (!q) return undefined;
  return `%${stripDiacritics(q).toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Điều kiện lọc hóa đơn dùng chung cho danh sách (phân trang) và file xuất. */
function orderFilter(query: OrderListQuery, clock?: Clock) {
  const { now, tz } = resolveClock(clock);
  const { from, to } = resolveRange(query, localDate(now, tz));
  const start = localDayRange(from, tz).start;
  const end = localDayRange(to, tz).end;
  const inRange = and(gte(orders.createdAt, start), lt(orders.createdAt, end));
  const term = likeTerm(query.q);
  const where = and(
    inRange,
    query.pay?.length ? inArray(orders.paymentMethod, query.pay) : undefined,
    query.status?.length ? inArray(orders.status, query.status) : undefined,
    query.customerId ? eq(orders.customerId, query.customerId) : undefined,
    // Viết tên bảng cứng như itemCount: drizzle bỏ tiền tố bảng trong sql``
    term
      ? sql`(vn_fold(orders.code) like ${term} escape '\\' or exists (select 1 from order_items where order_items.order_id = orders.id and vn_fold(order_items.product_name) like ${term} escape '\\'))`
      : undefined,
  );
  return { from, to, start, end, inRange, where };
}

/**
 * Số liệu két trong [start, end) (ISO UTC): đơn hoàn tất theo hình thức + thu nợ. Theo khoảng ngày,
 * không theo lọc khác để đối soát két vẫn đúng khi đang lọc. Trang Hóa đơn và Báo cáo dùng chung.
 */
export function daySummary(db: DbOrTx, start: string, end: string): DaySummary {
  const done = db
    .select({ paymentMethod: orders.paymentMethod, total: orders.total, discount: orders.discount, paid: orders.paid })
    .from(orders)
    .where(and(eq(orders.status, 'done'), gte(orders.createdAt, start), lt(orders.createdAt, end)))
    .all()
    .map((o) => ({ paymentMethod: o.paymentMethod, payable: o.total - o.discount, paid: o.paid }));
  const sum = (rows: { payable: number }[]) => rows.reduce((s, o) => s + o.payable, 0);
  const debtOrders = done.filter((o) => o.paymentMethod === 'debt');
  const collected = db
    .select({ method: debtTransactions.method, amount: debtTransactions.amount })
    .from(debtTransactions)
    .where(and(eq(debtTransactions.kind, 'payment'), gte(debtTransactions.createdAt, start), lt(debtTransactions.createdAt, end)))
    .all();
  const collectedBy = (m: 'cash' | 'transfer') => collected.filter((r) => r.method === m).reduce((s, r) => s - r.amount, 0);
  return {
    count: done.length,
    total: sum(done),
    cash: sum(done.filter((o) => o.paymentMethod === 'cash')) + debtOrders.reduce((s, o) => s + o.paid, 0),
    transfer: sum(done.filter((o) => o.paymentMethod === 'transfer')),
    debt: debtOrders.reduce((s, o) => s + o.payable - o.paid, 0),
    debtCollected: { cash: collectedBy('cash'), transfer: collectedBy('transfer') },
    returns: returnSummary(db, start, end),
  };
}

export function listOrders(db: Db, query: OrderListQuery, clock?: Clock): OrderList {
  const { start, end, where } = orderFilter(query, clock);
  const page = query.page ?? 1;
  const total = db.select({ n: count() }).from(orders).where(where).get()?.n ?? 0;
  const list = db
    .select({ order: orders, itemCount, customerName: customers.name, refunded: refundedSql })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(where)
    .orderBy(desc(orders.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
    .all()
    .map((r) => toSummary(r.order, Number(r.itemCount), r.customerName, Number(r.refunded)));
  return { orders: list, summary: daySummary(db, start, end), total, page, pageSize: PAGE_SIZE };
}

/** Hóa đơn mới nhất trong [start, end) (ISO UTC), mọi trạng thái, không phân trang; trang Tổng quan. */
export function recentOrders(db: Db, start: string, end: string, limit: number): OrderSummary[] {
  return db
    .select({ order: orders, itemCount, customerName: customers.name, refunded: refundedSql })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(and(gte(orders.createdAt, start), lt(orders.createdAt, end)))
    .orderBy(desc(orders.id))
    .limit(limit)
    .all()
    .map((r) => toSummary(r.order, Number(r.itemCount), r.customerName, Number(r.refunded)));
}

/** Mọi hóa đơn khớp bộ lọc (không phân trang), mới nhất trước, kèm món; quá `maxRows` thì báo lỗi thay vì dựng file khổng lồ. */
export function listOrdersForExport(
  db: Db,
  query: OrderListQuery,
  clock?: Clock,
  maxRows = MAX_EXPORT_ROWS,
): { from: string; to: string; orders: OrderDetail[] } {
  const { from, to, where } = orderFilter(query, clock);
  const n = db.select({ n: count() }).from(orders).where(where).get()?.n ?? 0;
  if (n > maxRows) throw new BadRequestError('Quá nhiều hóa đơn, hãy chọn khoảng ngày ngắn hơn');
  const rows = db
    .select({ order: orders, customerName: customers.name, refunded: refundedSql })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(where)
    .orderBy(desc(orders.id))
    .all();
  const itemsOf = new Map<number, OrderItem[]>();
  const ids = rows.map((r) => r.order.id);
  // Lấy món theo lô: SQLite giới hạn số tham số trong một câu lệnh
  for (let i = 0; i < ids.length; i += 500) {
    const batch = db
      .select({ orderId: orderItems.orderId, ...orderItemColumns })
      .from(orderItems)
      .where(inArray(orderItems.orderId, ids.slice(i, i + 500)))
      .orderBy(asc(orderItems.id))
      .all();
    for (const { orderId, ...it } of batch) {
      const list = itemsOf.get(orderId);
      if (list) list.push(it);
      else itemsOf.set(orderId, [it]);
    }
  }
  return {
    from,
    to,
    orders: rows.map((r) => {
      const items = itemsOf.get(r.order.id) ?? [];
      return { ...toSummary(r.order, items.length, r.customerName, Number(r.refunded)), items, debt: null, returns: [], customerDebt: null };
    }),
  };
}

/** Hủy đơn: cộng trả kho đúng qty×factor lúc bán rồi đánh dấu cancelled. */
export function cancelOrder(db: Db, id: number, clock?: Clock): OrderDetail {
  const { now } = resolveClock(clock);
  return db.transaction((tx) => {
    const o = getOrder(tx, id);
    if (o.status === 'cancelled') throw new ConflictError('Hóa đơn đã hủy');
    if (o.returns.some((r) => r.status === 'done')) throw new ConflictError('Hóa đơn đã có phiếu trả, hãy hủy phiếu trả trước');
    for (const it of o.items) {
      if (it.productId === null) continue;
      recordMovement(tx, { productId: it.productId, qty: it.qty * it.factor, type: 'return', refId: id, note: 'Hủy hóa đơn' });
    }
    if (o.paymentMethod === 'debt' && o.customerId !== null && o.payable > o.paid)
      recordCustomerDebtTx(tx, {
        customerId: o.customerId,
        amount: -(o.payable - o.paid),
        kind: 'order_cancel',
        orderId: id,
        note: `Hủy ${o.code}`,
        createdAt: now.toISOString(),
      });
    tx.update(orders).set({ status: 'cancelled', cancelledAt: now.toISOString() }).where(eq(orders.id, id)).run();
    return getOrder(tx, id);
  });
}
