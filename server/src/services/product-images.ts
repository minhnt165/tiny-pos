import { eq, sql } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';
import type { ProductWithUnits } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { products } from '../db/schema.js';
import { BadRequestError, HttpError, NotFoundError } from '../errors.js';
import { getProduct } from './products.js';

/** Thư mục chứa ảnh (data/images). Server truyền vào, test dùng thư mục tạm. */
export interface ImageDeps {
  dir: string;
}

/** Không có thư mục ảnh (test API không cần ảnh): mọi thao tác ảnh trả 503. */
export const NO_IMAGES: ImageDeps = { dir: '' };

/** Trình duyệt đã thu nhỏ về ≤ 512px nên ảnh thật chỉ vài chục KB; 1 MB chặn gửi nhầm file gốc. */
export const MAX_IMAGE_BYTES = 1_048_576;

const isoNow = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

function requireDir(deps: ImageDeps): string {
  if (!deps.dir) throw new HttpError(503, 'Chưa cấu hình thư mục ảnh');
  fs.mkdirSync(deps.dir, { recursive: true });
  return deps.dir;
}

function currentImage(db: Db, id: number): string | null {
  const row = db.select({ image: products.image }).from(products).where(eq(products.id, id)).get();
  if (!row) throw new NotFoundError('Không tìm thấy sản phẩm');
  return row.image;
}

/** Xóa file ảnh cũ; lỗi (file đang bị khóa) chỉ ghi log, DB đã đúng rồi. */
function removeFile(dir: string, name: string | null): void {
  if (!name) return;
  try {
    fs.rmSync(path.join(dir, name), { force: true });
  } catch (e) {
    console.warn(`Không xóa được ảnh ${name}:`, e);
  }
}

/**
 * Lưu ảnh JPEG cho sản phẩm: ghi file `p<id>-<now>.jpg` trước, cập nhật DB sau (DB không bao giờ trỏ tới file chưa có),
 * rồi mới xóa file cũ. Tên có mốc thời gian để đổi ảnh là đổi URL (trình duyệt cache immutable).
 */
export function saveProductImage(db: Db, deps: ImageDeps, id: number, body: Buffer, now = Date.now()): ProductWithUnits {
  const dir = requireDir(deps);
  const old = currentImage(db, id);
  if (body.length < 2 || body[0] !== 0xff || body[1] !== 0xd8) throw new BadRequestError('Ảnh phải là JPEG');
  if (body.length > MAX_IMAGE_BYTES) throw new BadRequestError('Ảnh quá lớn (tối đa 1 MB)');
  const name = `p${id}-${now}.jpg`;
  fs.writeFileSync(path.join(dir, name), body);
  db.update(products).set({ image: name, updatedAt: isoNow }).where(eq(products.id, id)).run();
  if (old !== name) removeFile(dir, old);
  return getProduct(db, id);
}

export function deleteProductImage(db: Db, deps: ImageDeps, id: number): void {
  const dir = requireDir(deps);
  const old = currentImage(db, id);
  if (!old) return;
  db.update(products).set({ image: null, updatedAt: isoNow }).where(eq(products.id, id)).run();
  removeFile(dir, old);
}

/** Chép những ảnh `.jpg` ở `from` chưa có ở `to` (dùng cho Thư mục chép thêm của sao lưu). Không xóa, không ghi đè. */
export function copyMissingImages(from: string, to: string): number {
  if (!fs.existsSync(from)) return 0;
  fs.mkdirSync(to, { recursive: true });
  let n = 0;
  for (const name of fs.readdirSync(from)) {
    if (!name.endsWith('.jpg')) continue;
    const dest = path.join(to, name);
    if (fs.existsSync(dest)) continue;
    fs.copyFileSync(path.join(from, name), dest);
    n++;
  }
  return n;
}
