import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { migrationsFolder, partialMigrations } from './test-migrations.js';

describe('migration 0005', () => {
  it('chạy được trên DB 0.11.0 có phiếu nhập và sổ nợ NCC; dữ liệu cũ còn nguyên, bảng trả NCC rỗng', () => {
    const sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    const db = drizzle(sqlite);
    migrate(db, { migrationsFolder: partialMigrations(5) });
    sqlite.exec(`
      INSERT INTO products (id, name, stock, cost_price) VALUES (1, 'Bia', 24, 10000);
      INSERT INTO suppliers (id, name, debt) VALUES (1, 'Đại lý Hùng', 240000);
      INSERT INTO imports (id, code, supplier_id, supplier_name, total, paid) VALUES (1, 'PN-20260929-0001', 1, 'Đại lý Hùng', 240000, 0);
      INSERT INTO import_items (import_id, product_id, product_name, unit_name, factor, qty, unit_cost, cost_price, amount)
        VALUES (1, 1, 'Bia', 'lon', 1, 24, 10000, 10000, 240000);
      INSERT INTO supplier_transactions (supplier_id, import_id, amount, note) VALUES (1, 1, 240000, 'Nhập PN-20260929-0001');
      INSERT INTO stock_movements (product_id, qty, type, ref_id, note) VALUES (1, 24, 'import', 1, 'Nhập PN-20260929-0001');
    `);
    migrate(db, { migrationsFolder });
    expect(sqlite.prepare('SELECT code, total, status FROM imports').all()).toEqual([{ code: 'PN-20260929-0001', total: 240000, status: 'done' }]);
    expect(sqlite.prepare('SELECT debt FROM suppliers').get()).toEqual({ debt: 240000 });
    expect(sqlite.prepare('SELECT qty, type FROM stock_movements').all()).toEqual([{ qty: 24, type: 'import' }]);
    expect(sqlite.prepare('SELECT count(*) AS n FROM supplier_returns').get()).toEqual({ n: 0 });
    expect(sqlite.prepare('SELECT count(*) AS n FROM supplier_return_items').get()).toEqual({ n: 0 });
    expect(sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });
});
