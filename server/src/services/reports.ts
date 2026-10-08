import { and, eq, gt, gte, lt, sql } from 'drizzle-orm';
import {
  daysBetween,
  localDate,
  localDayRange,
  monthsBetween,
  reportGroupBy,
  resolveReportRange,
  type DebtPartyRow,
  type DebtReport,
  type ProductReport,
  type ProductReportQuery,
  type ProductSalesRow,
  type ProfitReport,
  type ProfitRow,
  type ReportQuery,
  type SlowProductRow,
} from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { customers, debtTransactions, lots, orderItems, orders, products, returnItems, returns, suppliers } from '../db/schema.js';
import { resolveClock, type Clock } from './daily-code.js';
import { daySummary } from './orders.js';

/** Khoảng ngày địa phương của báo cáo, mốc UTC [start, end) để so với created_at, và kiểu gom. */
function reportRange(q: { from?: string; to?: string }, clock?: Clock) {
  const { now, tz } = resolveClock(clock);
  const { from, to } = resolveReportRange(q, localDate(now, tz));
  return { from, to, tz, start: localDayRange(from, tz).start, end: localDayRange(to, tz).end, groupBy: reportGroupBy(from, to) };
}

const emptyRow = (period: string): ProfitRow => ({
  period,
  orders: 0,
  revenue: 0,
  cost: 0,
  profit: 0,
  cash: 0,
  transfer: 0,
  debt: 0,
  debtCollected: { cash: 0, transfer: 0 },
  returns: 0,
});

/** Lãi lỗ theo kỳ: chỉ đơn `done`; giá vốn = Σ qty × cost_price của dòng (đã theo đơn vị bán, không nhân factor). */
export function profitReport(db: Db, q: ReportQuery, clock?: Clock): ProfitReport {
  const r = reportRange(q, clock);
  const periodOf = (iso: string) => {
    const day = localDate(new Date(iso), r.tz);
    return r.groupBy === 'day' ? day : day.slice(0, 7);
  };
  const periods = r.groupBy === 'day' ? daysBetween(r.from, r.to) : monthsBetween(r.from, r.to);
  const rows = new Map(periods.map((p) => [p, emptyRow(p)]));
  const inRange = and(eq(orders.status, 'done'), gte(orders.createdAt, r.start), lt(orders.createdAt, r.end));

  // Giá vốn gom theo đơn trong SQL; qty là số thực nên làm tròn từng đơn. Viết tên bảng cứng trong subquery.
  const cost = sql<number>`(select coalesce(sum(qty * cost_price), 0) from order_items where order_items.order_id = orders.id)`;
  const done = db
    .select({ paymentMethod: orders.paymentMethod, total: orders.total, discount: orders.discount, paid: orders.paid, createdAt: orders.createdAt, cost })
    .from(orders)
    .where(inRange)
    .all();
  for (const o of done) {
    const row = rows.get(periodOf(o.createdAt))!;
    const payable = o.total - o.discount;
    const c = Math.round(Number(o.cost));
    row.orders += 1;
    row.revenue += payable;
    row.cost += c;
    row.profit += payable - c;
    if (o.paymentMethod === 'cash') row.cash += payable;
    else if (o.paymentMethod === 'transfer') row.transfer += payable;
    else {
      row.cash += o.paid;
      row.debt += payable - o.paid;
    }
  }
  const collected = db
    .select({ method: debtTransactions.method, amount: debtTransactions.amount, createdAt: debtTransactions.createdAt })
    .from(debtTransactions)
    .where(and(eq(debtTransactions.kind, 'payment'), gte(debtTransactions.createdAt, r.start), lt(debtTransactions.createdAt, r.end)))
    .all();
  for (const c of collected) {
    const row = rows.get(periodOf(c.createdAt))!;
    if (c.method === 'transfer') row.debtCollected.transfer -= c.amount;
    else row.debtCollected.cash -= c.amount;
  }

  // Phiếu trả tính vào ngày lập phiếu: trừ doanh thu, tiền mặt, ghi nợ; giá vốn chỉ trừ phần đã nhập lại kho (hàng hỏng thành lỗ)
  const restockCost = sql<number>`(select coalesce(sum(cost), 0) from return_items where return_items.return_id = returns.id and return_items.restock = 1)`;
  const returned = db
    .select({ refund: returns.refund, cash: returns.cashRefund, debt: returns.debtReduced, createdAt: returns.createdAt, cost: restockCost })
    .from(returns)
    .where(and(eq(returns.status, 'done'), gte(returns.createdAt, r.start), lt(returns.createdAt, r.end)))
    .all();
  for (const x of returned) {
    const row = rows.get(periodOf(x.createdAt))!;
    const c = Number(x.cost);
    row.returns += x.refund;
    row.revenue -= x.refund;
    row.cost -= c;
    row.profit -= x.refund - c;
    row.cash -= x.cash;
    row.debt -= x.debt;
  }

  // Tổng lấy từ daySummary để chắc chắn khớp trang Hóa đơn; giá vốn/lãi cộng từ các kỳ
  const s = daySummary(db, r.start, r.end);
  const totalCost = [...rows.values()].reduce((sum, x) => sum + x.cost, 0);
  const total: ProfitRow = {
    period: '',
    orders: s.count,
    revenue: s.total - s.returns.refund,
    cost: totalCost,
    profit: s.total - s.returns.refund - totalCost,
    cash: s.cash - s.returns.cash,
    transfer: s.transfer,
    debt: s.debt - s.returns.debt,
    debtCollected: s.debtCollected,
    returns: s.returns.refund,
  };
  return { range: { from: r.from, to: r.to, groupBy: r.groupBy }, total, rows: [...rows.values()].reverse() };
}

const REPORT_TOP_ROWS = 50;
const CUSTOM_LABEL = 'Món ngoài';
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'vi');

/** Mặt hàng: bán chạy (gom theo product_id, số lượng về đơn vị gốc), hàng ế trong kỳ, giá trị tồn hiện tại. */
export function productReport(db: Db, q: ProductReportQuery, clock?: Clock, limit = REPORT_TOP_ROWS): ProductReport {
  const r = reportRange(q, clock);
  // Cột trong sql`` viết tên bảng cứng (drizzle bỏ tiền tố bảng khi render)
  const sold = db
    .select({
      productId: orderItems.productId,
      qty: sql<number>`sum(order_items.qty * order_items.factor)`,
      revenue: sql<number>`sum(order_items.amount)`,
      cost: sql<number>`sum(order_items.qty * order_items.cost_price)`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(and(eq(orders.status, 'done'), gte(orders.createdAt, r.start), lt(orders.createdAt, r.end)))
    .groupBy(orderItems.productId)
    .all();
  // Phần trả trong kỳ (ngày lập phiếu) trừ vào món đã bán trong kỳ; doanh thu cùng cơ sở trước giảm giá như order_items.amount
  const returned = new Map(
    db
      .select({
        productId: orderItems.productId,
        qty: sql<number>`sum(return_items.qty * order_items.factor)`,
        revenue: sql<number>`sum(order_items.amount * return_items.qty / order_items.qty)`,
        cost: sql<number>`sum(case when return_items.restock = 1 then return_items.cost else 0 end)`,
      })
      .from(returnItems)
      .innerJoin(returns, eq(returnItems.returnId, returns.id))
      .innerJoin(orderItems, eq(returnItems.orderItemId, orderItems.id))
      .where(and(eq(returns.status, 'done'), gte(returns.createdAt, r.start), lt(returns.createdAt, r.end)))
      .groupBy(orderItems.productId)
      .all()
      .map((x) => [x.productId, x] as const),
  );
  const active = db.select().from(products).where(eq(products.isActive, true)).all();
  const nameOf = new Map(db.select({ id: products.id, name: products.name, unit: products.unit }).from(products).all().map((p) => [p.id, p]));

  const topAll: ProductSalesRow[] = sold.map((s) => {
    const p = s.productId === null ? undefined : nameOf.get(s.productId);
    const back = returned.get(s.productId);
    const revenue = Number(s.revenue) - Math.round(Number(back?.revenue ?? 0));
    return {
      productId: s.productId,
      name: p?.name ?? CUSTOM_LABEL,
      unit: p?.unit ?? 'cái',
      qty: Number(s.qty) - Number(back?.qty ?? 0),
      revenue,
      profit: revenue - (Math.round(Number(s.cost)) - Number(back?.cost ?? 0)),
    };
  });
  topAll.sort((a, b) => b[q.sort] - a[q.sort] || byName(a, b));
  const topSellingTotal = topAll.reduce(
    (t, x) => ({ count: t.count + 1, qty: t.qty + x.qty, revenue: t.revenue + x.revenue, profit: t.profit + x.profit }),
    { count: 0, qty: 0, revenue: 0, profit: 0 },
  );

  // Giá trị vốn theo lô (chỉ lô dương): giá vốn thật của từng lần nhập, không phải giá nhập gần nhất × tồn
  const lotValue = new Map(
    db
      .select({ productId: lots.productId, value: sql<number>`sum(${lots.remaining} * ${lots.costPrice})` })
      .from(lots)
      .where(gt(lots.remaining, 0))
      .groupBy(lots.productId)
      .all()
      .map((r) => [r.productId, Math.round(Number(r.value))] as const),
  );
  const costOf = (p: { id: number }) => lotValue.get(p.id) ?? 0;

  const soldIds = new Set(sold.map((s) => s.productId));
  const slowAll: SlowProductRow[] = active
    .filter((p) => p.stock > 0 && !soldIds.has(p.id))
    .map((p) => ({ productId: p.id, name: p.name, unit: p.unit, stock: p.stock, value: costOf(p) }))
    .sort((a, b) => b.value - a.value || byName(a, b));

  const inStock = active.filter((p) => p.stock > 0);
  const stock = {
    costValue: inStock.reduce((s, p) => s + costOf(p), 0),
    sellValue: inStock.reduce((s, p) => s + Math.round(p.stock * p.sellPrice), 0),
    // Cùng định nghĩa với filterProducts (stock=low / stock=out) để bấm sang trang Sản phẩm thấy đúng số dòng
    lowCount: active.filter((p) => p.stock < p.minStock).length,
    outCount: active.filter((p) => p.stock <= 0).length,
  };
  return {
    range: { from: r.from, to: r.to, groupBy: r.groupBy },
    sort: q.sort,
    stock,
    topSelling: topAll.slice(0, limit),
    topSellingTotal,
    slow: slowAll.slice(0, limit),
    slowCount: slowAll.length,
  };
}

const REPORT_TOP_PARTIES = 10;

/** Σ nợ dương, số người đang nợ và top nợ nhiều nhất của một bên (khách hoặc NCC đang theo dõi). */
function partyDebt(rows: DebtPartyRow[], limit: number) {
  const owing = rows.filter((x) => x.debt > 0).sort((a, b) => b.debt - a.debt || byName(a, b));
  return { total: owing.reduce((s, x) => s + x.debt, 0), count: owing.length, top: owing.slice(0, limit) };
}

/** Công nợ: nợ khách / NCC tại thời điểm xem; ghi nợ và thu nợ trong khoảng (cùng daySummary với trang Hóa đơn). */
export function debtReport(db: Db, q: ReportQuery, clock?: Clock, limit = REPORT_TOP_PARTIES): DebtReport {
  const r = reportRange(q, clock);
  const s = daySummary(db, r.start, r.end);
  const cs = db.select({ id: customers.id, name: customers.name, phone: customers.phone, debt: customers.debt }).from(customers).where(eq(customers.isActive, true)).all();
  const ss = db.select({ id: suppliers.id, name: suppliers.name, phone: suppliers.phone, debt: suppliers.debt }).from(suppliers).where(eq(suppliers.isActive, true)).all();
  return {
    range: { from: r.from, to: r.to, groupBy: r.groupBy },
    customers: partyDebt(cs, limit),
    suppliers: partyDebt(ss, limit),
    period: { debt: s.debt, collected: s.debtCollected, returnDebt: s.returns.debt },
  };
}
