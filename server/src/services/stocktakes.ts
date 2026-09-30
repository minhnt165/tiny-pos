import { and, asc, desc, eq, ne } from 'drizzle-orm';
import {
  localDate,
  type StocktakeCount,
  type StocktakeDetail,
  type StocktakeInput,
  type StocktakeItem,
  type StocktakeSummary,
} from '@tiny-pos/shared';
import type { Db, DbOrTx } from '../db/connection.js';
import { products, stocktakeItems, stocktakes } from '../db/schema.js';
import { ConflictError, NotFoundError } from '../errors.js';
import { nextDailyCode, resolveClock, type Clock } from './daily-code.js';
import { recordMovement } from './stock.js';

const EPS = 1e-9;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

type StocktakeRow = typeof stocktakes.$inferSelect;

function findRow(tx: DbOrTx, id: number): StocktakeRow {
  const s = tx.select().from(stocktakes).where(eq(stocktakes.id, id)).get();
  if (!s) throw new NotFoundError('Không tìm thấy phiên kiểm kê');
  return s;
}

function assertOpen(tx: DbOrTx, id: number): StocktakeRow {
  const s = findRow(tx, id);
  if (s.status !== 'open') throw new ConflictError('Phiên kiểm kê đã đóng');
  return s;
}

function itemsOf(tx: DbOrTx, id: number): StocktakeItem[] {
  return tx
    .select({
      productId: stocktakeItems.productId,
      productName: products.name,
      unit: products.unit,
      costPrice: products.costPrice,
      counted: stocktakeItems.counted,
      expected: stocktakeItems.expected,
      countedAt: stocktakeItems.countedAt,
    })
    .from(stocktakeItems)
    .innerJoin(products, eq(stocktakeItems.productId, products.id))
    .where(eq(stocktakeItems.stocktakeId, id))
    .orderBy(asc(stocktakeItems.id))
    .all()
    .map((r) => ({ ...r, diff: round3(r.counted - r.expected) }));
}

export function getStocktake(db: DbOrTx, id: number): StocktakeDetail {
  const s = findRow(db, id);
  const items = itemsOf(db, id);
  const diffs = items.filter((i) => Math.abs(i.diff) > EPS);
  return {
    id: s.id,
    code: s.code,
    status: s.status,
    note: s.note,
    createdAt: s.createdAt,
    finishedAt: s.finishedAt,
    itemCount: items.length,
    diffCount: diffs.length,
    diffValue: Math.round(diffs.reduce((sum, i) => sum + i.diff * i.costPrice, 0)),
    items,
  };
}

export function getCurrentStocktake(db: Db): StocktakeDetail | null {
  const s = db.select({ id: stocktakes.id }).from(stocktakes).where(eq(stocktakes.status, 'open')).get();
  return s ? getStocktake(db, s.id) : null;
}

export function listStocktakes(db: Db, limit: number): StocktakeSummary[] {
  return db
    .select({ id: stocktakes.id })
    .from(stocktakes)
    .where(ne(stocktakes.status, 'open'))
    .orderBy(desc(stocktakes.id))
    .limit(limit)
    .all()
    .map(({ id }) => {
      const { items: _items, ...summary } = getStocktake(db, id);
      return summary;
    });
}

export function openStocktake(db: Db, input: StocktakeInput, clock?: Clock): StocktakeDetail {
  const { now, tz } = resolveClock(clock);
  return db.transaction((tx) => {
    const open = tx.select({ id: stocktakes.id }).from(stocktakes).where(eq(stocktakes.status, 'open')).get();
    if (open) throw new ConflictError('Đang có phiên kiểm kê chưa chốt');
    const code = nextDailyCode(tx, 'stocktakes', 'KK', localDate(now, tz), 2);
    const { id } = tx
      .insert(stocktakes)
      .values({ code, note: input.note, createdAt: now.toISOString() })
      .returning({ id: stocktakes.id })
      .get();
    return getStocktake(tx, id);
  });
}

/** Ghi (hoặc ghi đè) số đếm; `expected` = tồn máy ngay lúc đếm để bán sau đó không bị mất. */
export function countItem(db: Db, id: number, productId: number, input: StocktakeCount, clock?: Clock): StocktakeDetail {
  const { now } = resolveClock(clock);
  return db.transaction((tx) => {
    assertOpen(tx, id);
    const p = tx.select({ stock: products.stock }).from(products).where(eq(products.id, productId)).get();
    if (!p) throw new NotFoundError('Không tìm thấy sản phẩm');
    const values = { counted: input.counted, expected: p.stock, countedAt: now.toISOString() };
    tx.insert(stocktakeItems)
      .values({ stocktakeId: id, productId, ...values })
      .onConflictDoUpdate({ target: [stocktakeItems.stocktakeId, stocktakeItems.productId], set: values })
      .run();
    return getStocktake(tx, id);
  });
}

export function removeItem(db: Db, id: number, productId: number): StocktakeDetail {
  return db.transaction((tx) => {
    assertOpen(tx, id);
    tx.delete(stocktakeItems)
      .where(and(eq(stocktakeItems.stocktakeId, id), eq(stocktakeItems.productId, productId)))
      .run();
    return getStocktake(tx, id);
  });
}

/** Chốt: mỗi món lệch ghi 1 movement adjust = counted − expected. */
export function finishStocktake(db: Db, id: number, clock?: Clock): StocktakeDetail {
  const { now } = resolveClock(clock);
  return db.transaction((tx) => {
    const s = assertOpen(tx, id);
    for (const it of itemsOf(tx, id)) {
      if (Math.abs(it.diff) <= EPS) continue;
      recordMovement(tx, { productId: it.productId, qty: it.diff, type: 'adjust', refId: id, note: `Kiểm kê ${s.code}` });
    }
    tx.update(stocktakes).set({ status: 'done', finishedAt: now.toISOString() }).where(eq(stocktakes.id, id)).run();
    return getStocktake(tx, id);
  });
}

export function cancelStocktake(db: Db, id: number, clock?: Clock): StocktakeDetail {
  const { now } = resolveClock(clock);
  return db.transaction((tx) => {
    assertOpen(tx, id);
    tx.update(stocktakes).set({ status: 'cancelled', finishedAt: now.toISOString() }).where(eq(stocktakes.id, id)).run();
    return getStocktake(tx, id);
  });
}
