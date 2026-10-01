import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from './schema.js';
import { stripDiacritics } from '@tiny-pos/shared';

const here = path.dirname(fileURLToPath(import.meta.url));
// src/db → ../../drizzle ; dist/db → ../../drizzle (cùng độ sâu)
const migrationsFolder = path.resolve(here, '../../drizzle');

export type Db = BetterSQLite3Database<typeof schema> & { $client: Database.Database };
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DbOrTx = Db | Tx;

/** Hàm SQL dùng chung: vn_fold(s) = bỏ dấu tiếng Việt + chữ thường (LIKE của SQLite chỉ bỏ hoa/thường với ASCII). */
export function registerFunctions(sqlite: Database.Database): void {
  sqlite.function('vn_fold', { deterministic: true }, (s: unknown) => (s == null ? null : stripDiacritics(String(s)).toLowerCase()));
}

/** Mở (hoặc tạo) file SQLite, bật WAL + foreign keys, chạy migration còn thiếu. */
export function createDb(file: string): Db {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  registerFunctions(sqlite);
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder });
  return db;
}
