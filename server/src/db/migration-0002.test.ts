import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { migrationsFolder, partialMigrations } from './test-migrations.js';

describe('migration 0002', () => {
  it('chạy được trên DB giai đoạn 2 đã có phiếu nhập và đơn hàng; dữ liệu cũ còn nguyên', () => {
    const sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    const db = drizzle(sqlite);
    migrate(db, { migrationsFolder: partialMigrations(2) });
    sqlite.exec(`
      INSERT INTO products (id, name, stock, cost_price) VALUES (1, 'Bia', 5, 9000);
      INSERT INTO imports (id, supplier_name, total, note) VALUES (1, 'Đại lý cũ', 90000, 'phiếu cũ');
      INSERT INTO import_items (import_id, product_id, qty, cost_price) VALUES (1, 1, 10, 9000);
      INSERT INTO orders (id, code, total, paid, payment_method) VALUES (1, 'HD-20260929-0001', 12000, 12000, 'cash');
      INSERT INTO order_items (order_id, product_id, product_name, unit, qty, price, cost_price, factor, amount)
        VALUES (1, 1, 'Bia', 'lon', 1, 12000, 9000, 1, 12000);
    `);
    migrate(db, { migrationsFolder });
    expect(sqlite.prepare('SELECT id, code, supplier_id, supplier_name, total, paid, status, note FROM imports').all()).toEqual([
      { id: 1, code: 'PN-OLD-1', supplier_id: null, supplier_name: 'Đại lý cũ', total: 90000, paid: 0, status: 'done', note: 'phiếu cũ' },
    ]);
    expect(sqlite.prepare('SELECT import_id, product_id, qty, cost_price, factor, amount FROM import_items').all()).toEqual([
      { import_id: 1, product_id: 1, qty: 10, cost_price: 9000, factor: 1, amount: 0 },
    ]);
    expect(sqlite.prepare('SELECT count(*) AS n FROM order_items').get()).toEqual({ n: 1 });
    expect(sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });
});
