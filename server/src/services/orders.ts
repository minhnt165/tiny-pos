import { and, asc, desc, eq, gte, like, lt, sql } from 'drizzle-orm';
import {
  cartTotals,
  currentTzOffset,
  lineAmount,
  localDate,
  localDayRange,
  type OrderDetail,
  type OrderInput,
  type OrderList,
  type OrderSummary,
} from '@tiny-pos/shared';
import type { Db, DbOrTx } from '../db/connection.js';
import { orderItems, orders, productUnits, products } from '../db/schema.js';
import { BadRequestError, ConflictError, NotFoundError } from '../errors.js';
import { recordMovement } from './stock.js';

/** Giờ hiện tại và múi giờ; test truyền vào để không phụ thuộc máy chạy. */
export interface Clock {
  now?: Date;
  tzOffsetMin?: number;
}

function resolveClock(c: Clock = {}) {
  const now = c.now ?? new Date();
  return { now, tz: c.tzOffsetMin ?? currentTzOffset(now) };
}

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

/** HD-YYYYMMDD-NNNN: số lớn nhất trong ngày + 1 (đọc trong cùng transaction). */
function nextCode(tx: DbOrTx, day: string): string {
  const prefix = `HD-${day.replaceAll('-', '')}-`;
  const last = tx
    .select({ code: orders.code })
    .from(orders)
    .where(like(orders.code, `${prefix}%`))
    .orderBy(desc(orders.code))
    .limit(1)
    .get();
  const seq = last ? Number(last.code.slice(prefix.length)) + 1 : 1;
  return prefix + String(seq).padStart(4, '0');
}

type OrderRow = typeof orders.$inferSelect;

function toSummary(o: OrderRow, itemCount: number): OrderSummary {
  return {
    id: o.id,
    code: o.code,
    total: o.total,
    discount: o.discount,
    payable: o.total - o.discount,
    paid: o.paid,
    paymentMethod: o.paymentMethod,
    status: o.status,
    itemCount,
    createdAt: o.createdAt,
    cancelledAt: o.cancelledAt,
  };
}

export function getOrder(db: DbOrTx, id: number): OrderDetail {
  const o = db.select().from(orders).where(eq(orders.id, id)).get();
  if (!o) throw new NotFoundError('Không tìm thấy hóa đơn');
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
  return { ...toSummary(o, items.length), items };
}

export function createOrder(db: Db, input: OrderInput, clock?: Clock): OrderDetail {
  const { now, tz } = resolveClock(clock);
  return db.transaction((tx) => {
    const lines = input.items.map((it) => resolveLine(tx, it));
    const { total, payable } = cartTotals(lines, input.discount);
    if (input.discount > total) throw new BadRequestError('Giảm giá lớn hơn tổng tiền');
    if (input.paymentMethod === 'cash' && input.paid < payable) throw new BadRequestError('Tiền khách đưa chưa đủ');
    const paid = input.paymentMethod === 'cash' ? input.paid : payable;
    const { id } = tx
      .insert(orders)
      .values({
        code: nextCode(tx, localDate(now, tz)),
        total,
        discount: input.discount,
        paid,
        paymentMethod: input.paymentMethod,
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
    return getOrder(tx, id);
  });
}

// Viết tên bảng cứng: drizzle bỏ tiền tố bảng khi render cột, `id` sẽ bị hiểu là order_items.id
const itemCount = sql<number>`(select count(*) from order_items where order_items.order_id = orders.id)`;

export function listOrders(db: Db, date: string, clock?: Clock): OrderList {
  const { tz } = resolveClock(clock);
  const { start, end } = localDayRange(date, tz);
  const list = db
    .select({ order: orders, itemCount })
    .from(orders)
    .where(and(gte(orders.createdAt, start), lt(orders.createdAt, end)))
    .orderBy(desc(orders.id))
    .all()
    .map((r) => toSummary(r.order, Number(r.itemCount)));
  const done = list.filter((o) => o.status === 'done');
  const sum = (rows: OrderSummary[]) => rows.reduce((s, o) => s + o.payable, 0);
  return {
    orders: list,
    summary: {
      count: done.length,
      total: sum(done),
      cash: sum(done.filter((o) => o.paymentMethod === 'cash')),
      transfer: sum(done.filter((o) => o.paymentMethod === 'transfer')),
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
    tx.update(orders).set({ status: 'cancelled', cancelledAt: now.toISOString() }).where(eq(orders.id, id)).run();
    return getOrder(tx, id);
  });
}
