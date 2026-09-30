import { and, asc, desc, eq, gte, lt, sql } from 'drizzle-orm';
import {
  cartTotals,
  lineAmount,
  localDate,
  localDayRange,
  type OrderDebt,
  type OrderDetail,
  type OrderInput,
  type OrderList,
  type OrderSummary,
} from '@tiny-pos/shared';
import type { Db, DbOrTx } from '../db/connection.js';
import { customers, debtTransactions, orderItems, orders, productUnits, products } from '../db/schema.js';
import { BadRequestError, ConflictError, NotFoundError } from '../errors.js';
import { recordMovement } from './stock.js';
import { debtBalanceAt, recordCustomerDebtTx } from './customer-ledger.js';
import { nextDailyCode, resolveClock, type Clock } from './daily-code.js';

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

function toSummary(o: OrderRow, itemCount: number, customerName: string | null): OrderSummary {
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
    createdAt: o.createdAt,
    cancelledAt: o.cancelledAt,
  };
}

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
    .select({ order: orders, customerName: customers.name })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(eq(orders.id, id))
    .get();
  if (!r) throw new NotFoundError('Không tìm thấy hóa đơn');
  const o = r.order;
  const items = db
    .select({
      id: orderItems.id,
      productId: orderItems.productId,
      productName: orderItems.productName,
      unit: orderItems.unit,
      qty: orderItems.qty,
      price: orderItems.price,
      costPrice: orderItems.costPrice,
      factor: orderItems.factor,
      amount: orderItems.amount,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, id))
    .orderBy(asc(orderItems.id))
    .all();
  return { ...toSummary(o, items.length, r.customerName), items, debt: orderDebt(db, o) };
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

export function listOrders(db: Db, date: string, clock?: Clock): OrderList {
  const { tz } = resolveClock(clock);
  const { start, end } = localDayRange(date, tz);
  const list = db
    .select({ order: orders, itemCount, customerName: customers.name })
    .from(orders)
    .leftJoin(customers, eq(orders.customerId, customers.id))
    .where(and(gte(orders.createdAt, start), lt(orders.createdAt, end)))
    .orderBy(desc(orders.id))
    .all()
    .map((r) => toSummary(r.order, Number(r.itemCount), r.customerName));
  const done = list.filter((o) => o.status === 'done');
  const sum = (rows: OrderSummary[]) => rows.reduce((s, o) => s + o.payable, 0);
  const debtOrders = done.filter((o) => o.paymentMethod === 'debt');
  const collected = db
    .select({ method: debtTransactions.method, amount: debtTransactions.amount })
    .from(debtTransactions)
    .where(and(eq(debtTransactions.kind, 'payment'), gte(debtTransactions.createdAt, start), lt(debtTransactions.createdAt, end)))
    .all();
  const collectedBy = (m: 'cash' | 'transfer') => collected.filter((r) => r.method === m).reduce((s, r) => s - r.amount, 0);
  return {
    orders: list,
    summary: {
      count: done.length,
      total: sum(done),
      cash: sum(done.filter((o) => o.paymentMethod === 'cash')) + debtOrders.reduce((s, o) => s + o.paid, 0),
      transfer: sum(done.filter((o) => o.paymentMethod === 'transfer')),
      debt: debtOrders.reduce((s, o) => s + o.payable - o.paid, 0),
      debtCollected: { cash: collectedBy('cash'), transfer: collectedBy('transfer') },
    },
  };
}

/** Hủy đơn: cộng trả kho đúng qty×factor lúc bán rồi đánh dấu cancelled. */
export function cancelOrder(db: Db, id: number, clock?: Clock): OrderDetail {
  const { now } = resolveClock(clock);
  return db.transaction((tx) => {
    const o = getOrder(tx, id);
    if (o.status === 'cancelled') throw new ConflictError('Hóa đơn đã hủy');
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
