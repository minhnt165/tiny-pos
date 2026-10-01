import { and, eq, gt, sql } from 'drizzle-orm';
import {
  datePresetRange,
  DEBT_OVERDUE_DAYS,
  localDate,
  localDayRange,
  OVERVIEW_LOW_STOCK_ROWS,
  OVERVIEW_RECENT_ORDERS,
  OVERVIEW_TOP_PARTIES,
  shiftDate,
  type DebtPartyRow,
  type LowStockRow,
  type OverdueCustomerRow,
  type Overview,
} from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { customers, products, suppliers } from '../db/schema.js';
import { resolveClock, type Clock } from './daily-code.js';
import { recentOrders } from './orders.js';
import { profitReport } from './reports.js';
import { getCurrentStocktake } from './stocktakes.js';

export interface OverviewLimits {
  orders: number;
  lowStock: number;
  parties: number;
}
const DEFAULT_LIMITS: OverviewLimits = { orders: OVERVIEW_RECENT_ORDERS, lowStock: OVERVIEW_LOW_STOCK_ROWS, parties: OVERVIEW_TOP_PARTIES };

/** Phần server tính; route ghép thêm `backup` từ BackupService. */
export type OverviewData = Omit<Overview, 'backup'>;

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'vi');

/** Hàng đang bán dưới mức tối thiểu, thiếu nặng nhất trước. minStock = 0 mà vẫn thấp nghĩa là tồn âm → xếp đầu. */
function lowStock(db: Db, limit: number): Overview['lowStock'] {
  const active = db.select().from(products).where(eq(products.isActive, true)).all();
  const low = active.filter((p) => p.stock < p.minStock);
  const ratio = (p: { stock: number; minStock: number }) => (p.minStock > 0 ? p.stock / p.minStock : Number.NEGATIVE_INFINITY);
  const items: LowStockRow[] = low
    .sort((a, b) => ratio(a) - ratio(b) || byName(a, b))
    .slice(0, limit)
    .map((p) => ({ productId: p.id, name: p.name, unit: p.unit, stock: p.stock, minStock: p.minStock }));
  return { count: low.length, outCount: active.filter((p) => p.stock <= 0).length, items };
}

/** Σ nợ, số người nợ và top nợ nhiều nhất của danh sách đã lọc `debt > 0`. */
function debtSummary<T extends DebtPartyRow>(owing: T[], limit: number): { total: number; count: number; top: T[] } {
  const sorted = [...owing].sort((a, b) => b.debt - a.debt || byName(a, b));
  return { total: sorted.reduce((s, x) => s + x.debt, 0), count: sorted.length, top: sorted.slice(0, limit) };
}

/** Khách đang nợ; nợ lâu = giao dịch sổ nợ gần nhất (ghi nợ hay trả nợ) cách hôm nay ≥ DEBT_OVERDUE_DAYS. */
function customerDebt(db: Db, today: string, tz: number, limit: number): Overview['customers'] {
  // Viết tên bảng cứng trong subquery (drizzle bỏ tiền tố bảng khi render cột), như listCustomers
  const lastActivityAt = sql<string | null>`(select max(created_at) from debt_transactions where debt_transactions.customer_id = customers.id)`;
  const cutoff = shiftDate(today, -DEBT_OVERDUE_DAYS);
  const owing: OverdueCustomerRow[] = db
    .select({ id: customers.id, name: customers.name, phone: customers.phone, debt: customers.debt, lastActivityAt })
    .from(customers)
    .where(and(eq(customers.isActive, true), gt(customers.debt, 0)))
    .all()
    .map((c) => ({ ...c, overdue: c.lastActivityAt === null || localDate(new Date(c.lastActivityAt), tz) <= cutoff }));
  const overdue = owing.filter((c) => c.overdue);
  return { ...debtSummary(owing, limit), overdueCount: overdue.length, overdueTotal: overdue.reduce((s, c) => s + c.debt, 0) };
}

function supplierDebt(db: Db, limit: number): Overview['suppliers'] {
  const owing: DebtPartyRow[] = db
    .select({ id: suppliers.id, name: suppliers.name, phone: suppliers.phone, debt: suppliers.debt })
    .from(suppliers)
    .where(and(eq(suppliers.isActive, true), gt(suppliers.debt, 0)))
    .all();
  return debtSummary(owing, limit);
}

/** Phiếu kiểm kê đang mở, bỏ items (có thể hàng trăm dòng) như listStocktakes. */
function openStocktakeSummary(db: Db): Overview['stocktake'] {
  const cur = getCurrentStocktake(db);
  if (!cur) return null;
  const { items: _items, ...summary } = cur;
  return summary;
}

/** Tổng quan tại thời điểm xem: chỉ đọc, không transaction. Giới hạn dòng truyền vào để test. */
export function overview(db: Db, clock?: Clock, limits: Partial<OverviewLimits> = {}): OverviewData {
  const lim = { ...DEFAULT_LIMITS, ...limits };
  const { now, tz } = resolveClock(clock);
  const today = localDate(now, tz);
  const { start, end } = localDayRange(today, tz);
  return {
    today,
    week: profitReport(db, datePresetRange('last7', today), clock),
    recentOrders: recentOrders(db, start, end, lim.orders),
    lowStock: lowStock(db, lim.lowStock),
    customers: customerDebt(db, today, tz, lim.parties),
    suppliers: supplierDebt(db, lim.parties),
    stocktake: openStocktakeSummary(db),
  };
}
