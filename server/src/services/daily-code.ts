import { sql } from 'drizzle-orm';
import { currentTzOffset } from '@tiny-pos/shared';
import type { DbOrTx } from '../db/connection.js';

/** Giờ hiện tại và múi giờ; test truyền vào để không phụ thuộc máy chạy. */
export interface Clock {
  now?: Date;
  tzOffsetMin?: number;
}

export function resolveClock(c: Clock = {}) {
  const now = c.now ?? new Date();
  return { now, tz: c.tzOffsetMin ?? currentTzOffset(now) };
}

/**
 * Mã chứng từ theo ngày địa phương: `${prefix}-YYYYMMDD-NNNN`, số lớn nhất trong ngày + 1.
 * Gọi trong cùng transaction với lệnh insert.
 */
export function nextDailyCode(
  tx: DbOrTx,
  table: 'orders' | 'imports' | 'stocktakes',
  prefix: string,
  day: string,
  width: number,
): string {
  const p = `${prefix}-${day.replaceAll('-', '')}-`;
  const last = tx.get<{ code: string } | undefined>(
    sql`select code from ${sql.identifier(table)} where code like ${`${p}%`} order by code desc limit 1`,
  );
  const seq = last ? Number(last.code.slice(p.length)) + 1 : 1;
  return p + String(seq).padStart(width, '0');
}
