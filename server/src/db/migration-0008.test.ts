import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { migrationsFolder, partialMigrations } from './test-migrations.js';

describe('migration 0008', () => {
  it('tạo lô Tồn đầu cho sản phẩm có tồn khác 0; tồn 0 không có lô; dữ liệu cũ nguyên', () => {
    const sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    const db = drizzle(sqlite);
    migrate(db, { migrationsFolder: partialMigrations(8) });
    sqlite.exec(`
      INSERT INTO products (id, name, stock, cost_price, updated_at) VALUES (1, 'Bia', 5, 9000, '2026-10-01T00:00:00.000Z');
      INSERT INTO products (id, name, stock, cost_price) VALUES (2, 'Mì', 0, 3000);
      INSERT INTO products (id, name, stock, cost_price) VALUES (3, 'Đường', -2, 20000);
      INSERT INTO imports (id, code, supplier_name, total) VALUES (1, 'PN-20261001-0001', 'Đại lý', 45000);
      INSERT INTO import_items (import_id, product_id, qty, cost_price) VALUES (1, 1, 5, 9000);
    `);
    migrate(db, { migrationsFolder });
    expect(sqlite.prepare('SELECT product_id, import_item_id, qty_in, remaining, cost_price, expires_on, note, created_at FROM lots ORDER BY product_id').all()).toEqual([
      { product_id: 1, import_item_id: null, qty_in: 5, remaining: 5, cost_price: 9000, expires_on: null, note: 'Tồn đầu', created_at: '2026-10-01T00:00:00.000Z' },
      { product_id: 3, import_item_id: null, qty_in: -2, remaining: -2, cost_price: 20000, expires_on: null, note: 'Tồn đầu', created_at: expect.any(String) },
    ]);
    expect(sqlite.prepare('SELECT expires_on FROM import_items').all()).toEqual([{ expires_on: null }]);
    expect(sqlite.prepare('SELECT count(*) AS n FROM lot_movements').get()).toEqual({ n: 0 });
    expect(sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });
});
