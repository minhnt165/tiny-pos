import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { categoryInputSchema, productInputSchema } from '@tiny-pos/shared';
import { eq } from 'drizzle-orm';
import { createTestDb } from '../db/test-db.js';
import type { Db } from '../db/connection.js';
import { BadRequestError, NotFoundError } from '../errors.js';
import { categories, productUnits, settings } from '../db/schema.js';
import { createCategory } from './categories.js';
import { createProduct, listProducts } from './products.js';
import { createBackupService, type BackupService } from './backups.js';
import { createDevicesService } from './devices.js';

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

describe('backups: thư mục chép thêm', () => {
  it('đặt thư mục hợp lệ → bản sao có ở cả hai nơi, dọn auto ở cả hai', async () => {
    const extra = path.join(root, 'usb');
    fs.mkdirSync(extra);
    const s = createBackupService(db, { dir: dir(), tmpDir: tmp(), keepAuto: 2 });
    s.setExtraDir(extra);
    expect(s.getExtraDir()).toBe(extra);
    expect(s.status().extraDir).toBe(extra);
    for (let i = 0; i < 3; i++) await s.create('auto');
    const m = await s.create('manual');
    expect(fs.existsSync(path.join(extra, m.name))).toBe(true);
    expect(fs.readdirSync(extra).filter((n) => n.includes('-auto'))).toHaveLength(2);
    expect(fs.readdirSync(dir()).filter((n) => n.includes('-auto'))).toHaveLength(2);
    expect(s.status().extraError).toBeNull();
  });

  it('thư mục không tồn tại / là file / không ghi được → 400, không lưu', () => {
    expect(() => svc.setExtraDir(path.join(root, 'khong-co'))).toThrow(new BadRequestError('Thư mục không tồn tại'));
    const f = path.join(root, 'file.txt');
    fs.writeFileSync(f, '');
    expect(() => svc.setExtraDir(f)).toThrow(new BadRequestError('Thư mục không tồn tại'));
    expect(svc.getExtraDir()).toBe('');
  });

  it('rút USB (xóa thư mục) → sao lưu vẫn thành công, extraError có nội dung; đặt lại → hết lỗi', async () => {
    const extra = path.join(root, 'usb');
    fs.mkdirSync(extra);
    svc.setExtraDir(extra);
    fs.rmSync(extra, { recursive: true });
    const item = await svc.create('manual');
    expect(fs.existsSync(path.join(dir(), item.name))).toBe(true);
    expect(svc.status().extraError).toMatch(/Không chép được sang .*usb/);
    fs.mkdirSync(extra);
    svc.setExtraDir(extra);
    expect(svc.status().extraError).toBeNull();
  });

  it('đặt rỗng → xóa khóa; remove cũng xóa bản ở thư mục thêm', async () => {
    const extra = path.join(root, 'usb');
    fs.mkdirSync(extra);
    svc.setExtraDir(extra);
    const item = await svc.create('manual');
    svc.remove(item.name);
    expect(fs.existsSync(path.join(extra, item.name))).toBe(false);
    svc.setExtraDir('   ');
    expect(svc.getExtraDir()).toBe('');
  });
});

describe('backups: khôi phục', () => {
  const names = () => db.select().from(categories).all().map((c) => c.name).sort();

  it('restore: về đúng dữ liệu bản sao, giữ sqlite_sequence, có bản before-restore', async () => {
    const cat = createCategory(db, categoryInputSchema.parse({ name: 'Đồ uống' }));
    product('Coca', '1');
    product('Pepsi', '2');
    db.insert(settings).values({ key: 'storeName', value: 'Tiệm A' }).run();
    const snap = await svc.create('manual');

    product('Sting', '3');
    createCategory(db, categoryInputSchema.parse({ name: 'Bánh' }));
    db.update(settings).set({ value: 'Tiệm B' }).where(eq(settings.key, 'storeName')).run();

    const r = await svc.restore(snap.name);
    expect(r.restoredFrom).toBe(snap.name);
    expect(r.beforeRestore.kind).toBe('before-restore');
    expect(countProducts(path.join(dir(), r.beforeRestore.name))).toBe(3);

    expect(listProducts(db, { includeInactive: true }).map((p) => p.name).sort()).toEqual(['Coca', 'Pepsi']);
    expect(names()).toEqual(['Đồ uống']);
    expect(db.select().from(settings).where(eq(settings.key, 'storeName')).get()?.value).toBe('Tiệm A');
    // id tiếp theo nối tiếp bản sao (Sting từng là id 3, bị bỏ → sản phẩm mới nhận id 3)
    expect(product('Mới').id).toBe(3);
    expect(cat.id).toBe(1);
  });

  it('bản sao schema cũ (thiếu cột, thiếu bảng) → cột thiếu nhận mặc định, bảng thiếu bị trống', async () => {
    product('Coca', '1');
    const snap = await svc.create('manual');
    const file = path.join(dir(), snap.name);
    const d = new Database(file);
    d.exec('alter table products drop column min_stock');
    d.exec('drop table customers');
    d.close();
    createCategory(db, categoryInputSchema.parse({ name: 'Bánh' }));
    await svc.restore(snap.name);
    expect(listProducts(db, { includeInactive: true }).map((p) => ({ name: p.name, minStock: p.minStock }))).toEqual([{ name: 'Coca', minStock: 0 }]);
    expect(names()).toEqual([]);
  });

  it('file rác / thiếu bảng / phiên bản mới hơn → 400, DB không đổi, không tạo before-restore', async () => {
    product('Coca', '1');
    const junk = path.join(dir(), 'grocery-20261001-000000-manual.db');
    fs.writeFileSync(junk, 'không phải sqlite');
    await expect(svc.restore('grocery-20261001-000000-manual.db')).rejects.toThrow('File không phải dữ liệu Tiny POS hoặc đã hỏng');

    const empty = path.join(dir(), 'grocery-20261001-000001-manual.db');
    const e = new Database(empty);
    e.exec('create table t(x)');
    e.close();
    await expect(svc.restore('grocery-20261001-000001-manual.db')).rejects.toThrow('File không phải dữ liệu Tiny POS');

    const future = await svc.create('manual');
    const d = new Database(path.join(dir(), future.name));
    d.exec("insert into __drizzle_migrations (hash, created_at) values ('x', 0)");
    d.close();
    await expect(svc.restore(future.name)).rejects.toThrow(/phiên bản mới hơn/);

    expect(countProducts(path.join(dir(), future.name))).toBe(1);
    expect(listProducts(db, { includeInactive: true })).toHaveLength(1);
    expect(svc.status().items.filter((i) => i.kind === 'before-restore')).toEqual([]);
  });

  it('bản sao vi phạm khóa ngoại → rollback, DB không đổi, before-restore đã tạo', async () => {
    product('Coca', '1');
    const snap = await svc.create('manual');
    const d = new Database(path.join(dir(), snap.name));
    d.pragma('foreign_keys = OFF');
    d.exec("insert into product_units (product_id, name, barcode, factor, sell_price) values (999, 'Thùng', 'T1', 24, 1000)");
    d.close();
    product('Pepsi', '2');
    await expect(svc.restore(snap.name)).rejects.toThrow('Bản sao có dữ liệu không nhất quán, không khôi phục');
    expect(listProducts(db, { includeInactive: true })).toHaveLength(2);
    expect(db.select().from(productUnits).all()).toEqual([]);
    expect(svc.status().items.filter((i) => i.kind === 'before-restore')).toHaveLength(1);
  });

  it('restoreUpload: như restore, xóa file tạm kể cả khi lỗi', async () => {
    product('Coca', '1');
    const snap = await svc.create('manual');
    const buf = fs.readFileSync(path.join(dir(), snap.name));
    product('Pepsi', '2');
    const r = await svc.restoreUpload(buf);
    expect(r.restoredFrom).toBe('upload');
    expect(listProducts(db, { includeInactive: true })).toHaveLength(1);
    expect(fs.readdirSync(tmp())).toEqual([]);

    await expect(svc.restoreUpload(Buffer.from('rác'))).rejects.toThrow(/không phải dữ liệu/);
    expect(fs.readdirSync(tmp())).toEqual([]);
    await expect(svc.restoreUpload(Buffer.alloc(0))).rejects.toThrow('Chưa có file');
  });

  it('khôi phục không đụng danh sách thiết bị: máy đã gỡ không sống lại, id mới không trùng', async () => {
    const devs = createDevicesService(db, { lanUrl: () => 'http://192.168.1.5:3000' });
    const pairOne = (ua: string) => devs.pair(devs.startPairing().code, ua).device;
    const a = pairOne('iPhone Safari/604.1');
    product('Coca', '1');
    const snap = await svc.create('manual');

    devs.revoke(a.id);
    const b = pairOne('Android Chrome/129.0');
    await svc.restore(snap.name);

    expect(devs.list().map((d) => d.id)).toEqual([b.id]);
    expect(listProducts(db, { includeInactive: true }).map((p) => p.name)).toEqual(['Coca']);
    // sqlite_sequence của devices giữ nguyên → thiết bị mới không nhận lại id của máy đã gỡ
    expect(pairOne('Windows Edg/129.0').id).toBeGreaterThan(b.id);
  });
});

describe('backups: bản sao biến mất giữa chừng', () => {
  it('file bị dọn/xóa sau khi kiểm → 404, DB không đổi (không ATTACH tạo DB rỗng)', async () => {
    const s = createBackupService(db, { dir: dir(), tmpDir: tmp(), keepAuto: 2 });
    product('Coca', '1');
    const a1 = await s.create('auto');
    const a2 = await s.create('auto');
    // Người dùng chép tay một bản auto cũ vào thư mục: thừa so với keepAuto, sẽ bị dọn ở lần sao lưu kế tiếp
    const old = path.join(dir(), 'grocery-20260901-000000-auto.db');
    fs.copyFileSync(path.join(dir(), a1.name), old);
    fs.utimesSync(old, new Date('2026-09-01'), new Date('2026-09-01'));
    expect(fs.existsSync(path.join(dir(), a2.name))).toBe(true);
    await expect(s.restore('grocery-20260901-000000-auto.db')).rejects.toThrow(NotFoundError);
    expect(listProducts(db, { includeInactive: true })).toHaveLength(1);
    expect(fs.existsSync(old)).toBe(false);
  });
});

describe('backups: ảnh sản phẩm sang thư mục chép thêm', () => {
  it('có imagesDir + extraDir → sau create, <extra>/images có đủ ảnh; chạy lại không lỗi', async () => {
    const images = path.join(root, 'images');
    fs.mkdirSync(images);
    fs.writeFileSync(path.join(images, 'p1-1.jpg'), 'a');
    const extra = path.join(root, 'usb');
    fs.mkdirSync(extra);
    const s = createBackupService(db, { dir: dir(), tmpDir: tmp(), imagesDir: images });
    s.setExtraDir(extra);
    await s.create('manual');
    expect(fs.readdirSync(path.join(extra, 'images'))).toEqual(['p1-1.jpg']);
    fs.writeFileSync(path.join(images, 'p2-1.jpg'), 'b');
    await s.create('manual');
    expect(fs.readdirSync(path.join(extra, 'images')).sort()).toEqual(['p1-1.jpg', 'p2-1.jpg']);
    expect(s.status().extraError).toBeNull();
  });

  it('imagesDir chưa tồn tại → sao lưu bình thường, không tạo <extra>/images', async () => {
    const extra = path.join(root, 'usb');
    fs.mkdirSync(extra);
    const s = createBackupService(db, { dir: dir(), tmpDir: tmp(), imagesDir: path.join(root, 'khong-co') });
    s.setExtraDir(extra);
    const m = await s.create('manual');
    expect(fs.existsSync(path.join(extra, m.name))).toBe(true);
    expect(fs.existsSync(path.join(extra, 'images'))).toBe(false);
    expect(s.status().extraError).toBeNull();
  });

  it('thư mục chép thêm biến mất sau khi đặt (USB rút) → extraError, bản sao chính vẫn tạo', async () => {
    const images = path.join(root, 'images');
    fs.mkdirSync(images);
    fs.writeFileSync(path.join(images, 'p1-1.jpg'), 'a');
    const extra = path.join(root, 'usb');
    fs.mkdirSync(extra);
    const s = createBackupService(db, { dir: dir(), tmpDir: tmp(), imagesDir: images });
    s.setExtraDir(extra);
    fs.rmSync(extra, { recursive: true, force: true });
    const m = await s.create('manual');
    expect(fs.existsSync(path.join(dir(), m.name))).toBe(true);
    expect(s.status().extraError).toMatch(/Không chép được sang/);
  });
});
