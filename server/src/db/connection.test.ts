import { describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { createTestDb } from './test-db.js';

describe('migration', () => {
  it('tạo đủ 20 bảng và bật foreign_keys', () => {
    const db = createTestDb();
    const rows = db.all<{ name: string }>(sql`select name from sqlite_master where type='table' order by name`);
    const tables = rows.map((r) => r.name).filter((n) => !n.startsWith('__') && !n.startsWith('sqlite_'));
    expect(tables).toEqual([
      'categories',
      'customers',
      'debt_transactions',
      'devices',
      'import_items',
      'imports',
      'order_items',
      'orders',
      'product_units',
      'products',
      'return_items',
      'returns',
      'settings',
      'stock_movements',
      'stocktake_items',
      'stocktakes',
      'supplier_return_items',
      'supplier_returns',
      'supplier_transactions',
      'suppliers',
    ]);
    expect(db.get<{ foreign_keys: number }>(sql`pragma foreign_keys`)?.foreign_keys).toBe(1);
  });

  it('order_items cho phép product_id null, có factor và amount; orders có cancelled_at', () => {
    const db = createTestDb();
    const cols = (t: string) => db.all<{ name: string; notnull: number }>(sql.raw(`PRAGMA table_info(${t})`));
    const items = cols('order_items');
    expect(items.find((c) => c.name === 'product_id')?.notnull).toBe(0);
    expect(items.map((c) => c.name)).toEqual(expect.arrayContaining(['factor', 'amount']));
    expect(cols('orders').map((c) => c.name)).toContain('cancelled_at');
  });
});
