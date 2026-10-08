import { and, asc, count, desc, eq, gt, inArray, sql } from 'drizzle-orm';
import {
  daysLeft,
  localDate,
  lotState,
  PAGE_SIZE,
  QTY_EPS,
  shiftDate,
  type LotDispose,
  type LotList,
  type LotListQuery,
  type LotRow,
  type LotState,
  type Overview,
  type ProductLot,
} from '@tiny-pos/shared';
import type { Db, DbOrTx } from '../db/connection.js';
import { importItems, imports, lots, products } from '../db/schema.js';
import { ConflictError, NotFoundError } from '../errors.js';
import { resolveClock, type Clock } from './daily-code.js';
import { likeTerm } from './orders.js';
import { getSettings } from './settings.js';
import { recordMovement } from './stock.js';

const columns = {
  id: lots.id,
  productId: lots.productId,
  productName: products.name,
  unit: products.unit,
  image: products.image,
  importId: imports.id,
  importCode: imports.code,
  qtyIn: lots.qtyIn,
  remaining: lots.remaining,
  costPrice: lots.costPrice,
  expiresOn: lots.expiresOn,
  createdAt: lots.createdAt,
};

/** Trạng thái tính trong SQL để lọc và phân trang ở server; cùng luật với lotState (shared). */
function stateSql(today: string, warnUntil: string) {
  return sql<LotState>`case when lots.remaining <= ${QTY_EPS} then 'empty'
    when lots.expires_on is null then 'ok'
    when lots.expires_on < ${today} then 'expired'
    when lots.expires_on <= ${warnUntil} then 'expiring'
    else 'ok' end`;
}

function base(db: DbOrTx) {
  return db
    .select(columns)
    .from(lots)
    .innerJoin(products, eq(lots.productId, products.id))
    .leftJoin(importItems, eq(lots.importItemId, importItems.id))
    .leftJoin(imports, eq(importItems.importId, imports.id));
}

type Raw = Omit<LotRow, 'daysLeft' | 'state'> & { importId: number | null };

function toRow(r: Raw, today: string, warnDays: number): LotRow {
  return { ...r, daysLeft: daysLeft(r.expiresOn, today), state: lotState(r, today, warnDays) };
}

function context(db: DbOrTx, clock?: Clock) {
  const { now, tz } = resolveClock(clock);
  const today = localDate(now, tz);
  const warnDays = getSettings(db).expiryWarnDays;
  return { today, warnDays, warnUntil: shiftDate(today, warnDays) };
}

// Quá hạn trước (hạn nhỏ nhất), rồi hạn gần, không hạn cuối, mới nhất trước
const fefoOrder = [sql`${lots.expiresOn} is null`, asc(lots.expiresOn), desc(lots.id)];

export function getLot(db: DbOrTx, id: number, clock?: Clock): LotRow {
  const r = base(db).where(eq(lots.id, id)).get();
  if (!r) throw new NotFoundError('Không tìm thấy lô');
  const c = context(db, clock);
  return toRow(r, c.today, c.warnDays);
}

export function listLots(db: Db, query: LotListQuery, clock?: Clock): LotList {
  const c = context(db, clock);
  const state = stateSql(c.today, c.warnUntil);
  const term = likeTerm(query.q);
  // Viết tên bảng cứng trong sql``: drizzle bỏ tiền tố bảng khi render cột
  const scope = and(
    query.productId ? eq(lots.productId, query.productId) : undefined,
    term ? sql`vn_fold(products.name) like ${term} escape '\\'` : undefined,
  );
  const states = query.state ?? ['ok', 'expiring', 'expired'];
  const where = and(scope, inArray(state, states));
  const page = query.page ?? 1;
  const total = db.select({ n: count() }).from(lots).innerJoin(products, eq(lots.productId, products.id)).where(where).get()?.n ?? 0;
  const rows = base(db).where(where).orderBy(...fefoOrder).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE).all();
  const sum = db
    .select({
      expiring: sql<number>`sum(case when ${state} = 'expiring' then 1 else 0 end)`,
      expired: sql<number>`sum(case when ${state} = 'expired' then 1 else 0 end)`,
      value: sql<number>`coalesce(sum(case when lots.remaining > 0 then lots.remaining * lots.cost_price else 0 end), 0)`,
    })
    .from(lots)
    .innerJoin(products, eq(lots.productId, products.id))
    .where(scope)
    .get();
  return {
    lots: rows.map((r) => toRow(r, c.today, c.warnDays)),
    total,
    page,
    pageSize: PAGE_SIZE,
    summary: { expiringCount: Number(sum?.expiring ?? 0), expiredCount: Number(sum?.expired ?? 0), stockValue: Math.round(Number(sum?.value ?? 0)) },
  };
}

/** Lô còn hàng của một sản phẩm theo FEFO (hạn gần trước, không hạn cuối, cùng hạn thì cũ trước). */
export function productLots(db: DbOrTx, productId: number, clock?: Clock): ProductLot[] {
  const p = db.select({ id: products.id }).from(products).where(eq(products.id, productId)).get();
  if (!p) throw new NotFoundError('Không tìm thấy sản phẩm');
  const { today } = context(db, clock);
  return db
    .select({ id: lots.id, importCode: imports.code, remaining: lots.remaining, costPrice: lots.costPrice, expiresOn: lots.expiresOn })
    .from(lots)
    .leftJoin(importItems, eq(lots.importItemId, importItems.id))
    .leftJoin(imports, eq(importItems.importId, imports.id))
    .where(and(eq(lots.productId, productId), gt(lots.remaining, QTY_EPS)))
    .orderBy(sql`${lots.expiresOn} is null`, asc(lots.expiresOn), asc(lots.id))
    .all()
    .map((l) => ({ ...l, daysLeft: daysLeft(l.expiresOn, today) }));
}

/** Thẻ Sắp hết hạn trên Tổng quan: lô còn hàng quá hạn hoặc trong ngưỡng; items quá hạn trước, cắt theo limit. */
export function expiringOverview(db: Db, limit: number, clock?: Clock): Overview['expiring'] {
  const c = context(db, clock);
  const state = stateSql(c.today, c.warnUntil);
  const where = inArray(state, ['expired', 'expiring']);
  const items = base(db).where(where).orderBy(...fefoOrder).limit(limit).all().map((r) => toRow(r, c.today, c.warnDays));
  const n = db
    .select({ expiring: sql<number>`sum(case when ${state} = 'expiring' then 1 else 0 end)`, expired: sql<number>`sum(case when ${state} = 'expired' then 1 else 0 end)` })
    .from(lots)
    .get();
  return { count: Number(n?.expiring ?? 0), expiredCount: Number(n?.expired ?? 0), items };
}

/** Bỏ hàng (hết hạn, hỏng): một movement adjust trừ hết số còn của đúng lô đó. */
export function disposeLot(db: Db, id: number, input: LotDispose, clock?: Clock): LotRow {
  return db.transaction((tx) => {
    const lot = getLot(tx, id, clock);
    if (lot.remaining <= QTY_EPS) throw new ConflictError('Lô đã hết hàng');
    const note = `Bỏ hàng ${lot.importCode ?? 'tồn đầu'}${input.note ? `: ${input.note}` : ''}`;
    recordMovement(tx, { productId: lot.productId, qty: -lot.remaining, type: 'adjust', lotId: lot.id, note });
    return getLot(tx, id, clock);
  });
}
