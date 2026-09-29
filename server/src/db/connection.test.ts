import { describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { createTestDb } from './test-db.js';

describe('migration', () => {
  it('tạo đủ 11 bảng nghiệp vụ và bật foreign_keys', () => {
    const db = createTestDb();
    const rows = db.all<{ name: string }>(sql`select name from sqlite_master where type='table' order by name`);
    const tables = rows.map((r) => r.name).filter((n) => !n.startsWith('__') && !n.startsWith('sqlite_'));
    expect(tables).toEqual([
      'categories',
      'customers',
      'debt_transactions',
      'import_items',
      'imports',
      'order_items',
      'orders',
      'product_units',
      'products',
      'settings',
      'stock_movements',
    ]);
    expect(db.get<{ foreign_keys: number }>(sql`pragma foreign_keys`)?.foreign_keys).toBe(1);
  });
});
