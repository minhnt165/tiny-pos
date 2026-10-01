import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { migrationsFolder, partialMigrations } from './test-migrations.js';

describe('migration 0004', () => {
  it('chạy được trên DB 0.10.0 có hóa đơn và sổ nợ; dữ liệu cũ còn nguyên, bảng phiếu trả rỗng', () => {
    const sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    const db = drizzle(sqlite);
    migrate(db, { migrationsFolder: partialMigrations(4) });
    sqlite.exec(`
      INSERT INTO products (id, name, stock, cost_price) VALUES (1, 'Bia', 5, 9000);
      INSERT INTO customers (id, name, debt) VALUES (1, 'Chị Lan', 12000);
      INSERT INTO orders (id, code, total, paid, payment_method, customer_id) VALUES (1, 'HD-20260929-0001', 12000, 0, 'debt', 1);
      INSERT INTO order_items (order_id, product_id, product_name, unit, qty, price, cost_price, factor, amount)
        VALUES (1, 1, 'Bia', 'lon', 1, 12000, 9000, 1, 12000);
      INSERT INTO debt_transactions (customer_id, order_id, amount, kind) VALUES (1, 1, 12000, 'order');
    `);
    migrate(db, { migrationsFolder });
    expect(sqlite.prepare('SELECT code, total, status FROM orders').all()).toEqual([{ code: 'HD-20260929-0001', total: 12000, status: 'done' }]);
    expect(sqlite.prepare('SELECT count(*) AS n FROM order_items').get()).toEqual({ n: 1 });
    expect(sqlite.prepare('SELECT amount, kind FROM debt_transactions').all()).toEqual([{ amount: 12000, kind: 'order' }]);
    expect(sqlite.prepare('SELECT count(*) AS n FROM returns').get()).toEqual({ n: 0 });
    expect(sqlite.prepare('SELECT count(*) AS n FROM return_items').get()).toEqual({ n: 0 });
    expect(sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });
});
