import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { productInputSchema } from '@tiny-pos/shared';
import { createTestDb } from '../db/test-db.js';
import type { Db } from '../db/connection.js';
import { BadRequestError, NotFoundError } from '../errors.js';
import { createProduct } from './products.js';
import { createBackupService, type BackupService } from './backups.js';

const CLOCK = { now: new Date('2026-10-01T02:31:05.000Z'), tzOffsetMin: 420 }; // 09:31:05 giờ VN
let db: Db;
let root: string;
let svc: BackupService;
const dir = () => path.join(root, 'backups');
const tmp = () => path.join(root, 'tmp');
const product = (name: string, barcode?: string) => createProduct(db, productInputSchema.parse({ name, barcode, sellPrice: 1000 }));
const countProducts = (file: string) => {
  const d = new Database(file, { readonly: true });
  try {
    return (d.prepare('select count(*) as n from products').get() as { n: number }).n;
  } finally {
    d.close();
  }
};

beforeEach(() => {
  db = createTestDb();
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'tiny-pos-backup-'));
  svc = createBackupService(db, { dir: dir(), tmpDir: tmp(), clock: CLOCK });
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('backups: tạo và liệt kê', () => {
  it('create manual → tên theo giờ địa phương, file lành, không sót .part', async () => {
    product('Sữa', '1');
    const item = await svc.create('manual');
    expect(item).toMatchObject({ name: 'grocery-20261001-093105-manual.db', kind: 'manual' });
    expect(item.size).toBeGreaterThan(0);
    expect(fs.readdirSync(dir())).toEqual(['grocery-20261001-093105-manual.db']);
    expect(countProducts(path.join(dir(), item.name))).toBe(1);
    expect(svc.status().items).toEqual([item]);
  });

  it('trùng giây → hậu tố -2, -3', async () => {
    const a = await svc.create('manual');
    const b = await svc.create('manual');
    const c = await svc.create('manual');
    expect([a.name, b.name, c.name]).toEqual([
      'grocery-20261001-093105-manual.db',
      'grocery-20261001-093105-manual-2.db',
      'grocery-20261001-093105-manual-3.db',
    ]);
  });

  it('giữ tối đa 30 bản auto; manual và before-restore không bị dọn', async () => {
    const s = createBackupService(db, { dir: dir(), tmpDir: tmp(), keepAuto: 3 });
    await s.create('manual');
    await s.create('before-restore');
    for (let i = 0; i < 5; i++) await s.create('auto');
    const items = s.status().items;
    expect(items.filter((i) => i.kind === 'auto')).toHaveLength(3);
    expect(items.filter((i) => i.kind === 'manual')).toHaveLength(1);
    expect(items.filter((i) => i.kind === 'before-restore')).toHaveLength(1);
    expect(fs.readdirSync(dir()).filter((n) => n.endsWith('.part'))).toEqual([]);
  });

  it('status: mới nhất trước, bỏ qua file lạ, lastAutoAt từ file auto mới nhất', async () => {
    fs.writeFileSync(path.join(dir(), 'ghi-chu.txt'), 'x');
    const s = createBackupService(db, { dir: dir(), tmpDir: tmp() });
    const a1 = await s.create('auto');
    await new Promise((r) => setTimeout(r, 1100));
    const a2 = await s.create('auto');
    const fresh = createBackupService(db, { dir: dir(), tmpDir: tmp() });
    expect(fresh.status().items.map((i) => i.name)).toEqual([a2.name, a1.name]);
    expect(fresh.lastAutoAt()).toBe(a2.createdAt);
    expect(fresh.status()).toMatchObject({ dir: dir(), extraDir: '', extraError: null, lastError: null });
  });

  it('lastAutoAt null khi chưa có; noteAutoError hiện trong status', () => {
    expect(svc.lastAutoAt()).toBeNull();
    svc.noteAutoError('đĩa đầy');
    expect(svc.status().lastError).toBe('đĩa đầy');
    svc.noteAutoError(null);
    expect(svc.status().lastError).toBeNull();
  });

  it('remove xóa file; tên sai → 400; không có → 404', async () => {
    const item = await svc.create('manual');
    svc.remove(item.name);
    expect(fs.existsSync(path.join(dir(), item.name))).toBe(false);
    expect(() => svc.remove(item.name)).toThrow(NotFoundError);
    expect(() => svc.filePath('../grocery-20261001-093105-manual.db')).toThrow(BadRequestError);
    expect(() => svc.filePath('grocery-20261001-093105-manual.db.part')).toThrow(BadRequestError);
    expect(() => svc.filePath('grocery-20261001-093105-auto.db')).toThrow(NotFoundError);
  });

  it('tạo thư mục dir và tmpDir nếu chưa có', () => {
    expect(fs.statSync(dir()).isDirectory()).toBe(true);
    expect(fs.statSync(tmp()).isDirectory()).toBe(true);
  });
});
