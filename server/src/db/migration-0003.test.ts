import { describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { migrationsFolder, partialMigrations } from './test-migrations.js';

describe('migration 0003', () => {
  it('chạy được trên DB giai đoạn 3 đã có khách, đơn ghi nợ, sổ nợ; dữ liệu cũ còn nguyên', () => {
    const sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    const db = drizzle(sqlite);
    migrate(db, { migrationsFolder: partialMigrations(3) });
    sqlite.exec(`
      INSERT INTO customers (id, name, phone, debt) VALUES (1, 'Chị Lan', '0909', 50000);
      INSERT INTO orders (id, code, total, paid, payment_method, customer_id) VALUES (1, 'HD-20260929-0001', 50000, 0, 'debt', 1);
      INSERT INTO debt_transactions (customer_id, order_id, amount, note) VALUES (1, 1, 50000, 'cũ');
    `);
    migrate(db, { migrationsFolder });
    expect(sqlite.prepare('SELECT id, name, phone, debt, note, is_active FROM customers').all()).toEqual([
      { id: 1, name: 'Chị Lan', phone: '0909', debt: 50000, note: null, is_active: 1 },
    ]);
    expect(sqlite.prepare('SELECT customer_id, order_id, amount, note, kind, method FROM debt_transactions').all()).toEqual([
      { customer_id: 1, order_id: 1, amount: 50000, note: 'cũ', kind: 'manual', method: null },
    ]);
    expect(sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });
});
