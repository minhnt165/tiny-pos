import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { productInputSchema } from '@tiny-pos/shared';
import { createTestDb } from '../db/test-db.js';
import type { Db } from '../db/connection.js';
import { BadRequestError, HttpError, NotFoundError } from '../errors.js';
import { createProduct, getProduct } from './products.js';
import { copyMissingImages, deleteProductImage, MAX_IMAGE_BYTES, NO_IMAGES, saveProductImage } from './product-images.js';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]); // đầu file JPEG thật, phần sau không cần
let db: Db;
let root: string;
let deps: { dir: string };
const product = () => createProduct(db, productInputSchema.parse({ name: 'Sữa', sellPrice: 1000 }));
const files = () => fs.readdirSync(deps.dir).sort();

beforeEach(() => {
  db = createTestDb();
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'tiny-pos-images-'));
  deps = { dir: path.join(root, 'images') }; // chưa tồn tại: service phải tự tạo
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('saveProductImage', () => {
  it('ghi file p<id>-<now>.jpg, cập nhật image và updatedAt', () => {
    const p = product();
    const before = p.updatedAt;
    const saved = saveProductImage(db, deps, p.id, JPEG, 1700000000000);
    expect(saved.image).toBe(`p${p.id}-1700000000000.jpg`);
    expect(files()).toEqual([`p${p.id}-1700000000000.jpg`]);
    expect(fs.readFileSync(path.join(deps.dir, saved.image!))).toEqual(JPEG);
    expect(saved.updatedAt >= before).toBe(true);
    expect(getProduct(db, p.id).image).toBe(saved.image);
  });

  it('lưu lần hai → file cũ bị xóa, tên mới', () => {
    const p = product();
    saveProductImage(db, deps, p.id, JPEG, 1);
    const s = saveProductImage(db, deps, p.id, JPEG, 2);
    expect(s.image).toBe(`p${p.id}-2.jpg`);
    expect(files()).toEqual([`p${p.id}-2.jpg`]);
  });

  it('lưu hai lần cùng now → cùng tên, file vẫn còn (không tự xóa tên mới)', () => {
    const p = product();
    saveProductImage(db, deps, p.id, JPEG, 5);
    saveProductImage(db, deps, p.id, JPEG, 5);
    expect(files()).toEqual([`p${p.id}-5.jpg`]);
  });

  it('không phải JPEG → 400; quá 1 MB → 400; không ghi file', () => {
    const p = product();
    expect(() => saveProductImage(db, deps, p.id, Buffer.from('hello'))).toThrow(new BadRequestError('Ảnh phải là JPEG'));
    expect(() => saveProductImage(db, deps, p.id, Buffer.alloc(0))).toThrow(new BadRequestError('Ảnh phải là JPEG'));
    const big = Buffer.concat([JPEG, Buffer.alloc(MAX_IMAGE_BYTES)]);
    expect(() => saveProductImage(db, deps, p.id, big)).toThrow(new BadRequestError('Ảnh quá lớn (tối đa 1 MB)'));
    expect(fs.existsSync(deps.dir) ? files() : []).toEqual([]);
    expect(getProduct(db, p.id).image).toBeNull();
  });

  it('sản phẩm không có → 404; chưa cấu hình thư mục → 503', () => {
    expect(() => saveProductImage(db, deps, 999, JPEG)).toThrow(new NotFoundError('Không tìm thấy sản phẩm'));
    const p = product();
    expect(() => saveProductImage(db, NO_IMAGES, p.id, JPEG)).toThrow(new HttpError(503, 'Chưa cấu hình thư mục ảnh'));
  });
});

describe('deleteProductImage', () => {
  it('xóa → image null, file mất; xóa khi không có ảnh → không lỗi; 404 id lạ', () => {
    const p = product();
    saveProductImage(db, deps, p.id, JPEG, 1);
    deleteProductImage(db, deps, p.id);
    expect(getProduct(db, p.id).image).toBeNull();
    expect(files()).toEqual([]);
    expect(() => deleteProductImage(db, deps, p.id)).not.toThrow();
    expect(() => deleteProductImage(db, deps, 999)).toThrow(new NotFoundError('Không tìm thấy sản phẩm'));
  });
});

describe('copyMissingImages', () => {
  it('chép file thiếu, bỏ qua file đã có và file không phải .jpg; nguồn không có → 0', () => {
    const to = path.join(root, 'extra', 'images');
    expect(copyMissingImages(deps.dir, to)).toBe(0);
    fs.mkdirSync(deps.dir, { recursive: true });
    fs.writeFileSync(path.join(deps.dir, 'p1-1.jpg'), 'a');
    fs.writeFileSync(path.join(deps.dir, 'p2-1.jpg'), 'b');
    fs.writeFileSync(path.join(deps.dir, 'Thumbs.db'), 'x');
    expect(copyMissingImages(deps.dir, to)).toBe(2);
    expect(fs.readdirSync(to).sort()).toEqual(['p1-1.jpg', 'p2-1.jpg']);
    fs.writeFileSync(path.join(to, 'p1-1.jpg'), 'đã có, không ghi đè');
    fs.writeFileSync(path.join(deps.dir, 'p3-1.jpg'), 'c');
    expect(copyMissingImages(deps.dir, to)).toBe(1);
    expect(fs.readFileSync(path.join(to, 'p1-1.jpg'), 'utf8')).toBe('đã có, không ghi đè');
  });
});
