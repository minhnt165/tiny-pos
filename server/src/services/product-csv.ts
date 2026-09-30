import { eq, isNull, sql } from 'drizzle-orm';
import { parseProductCsv, parseProductTable, type CsvImportResult, type ProductCsvRow } from '@tiny-pos/shared';
import type { Db, DbOrTx } from '../db/connection.js';
import { categories, products } from '../db/schema.js';
import { BadRequestError, HttpError } from '../errors.js';
import { readFirstSheet } from '../xlsx/workbook.js';
import { assertBarcodeFree } from './products.js';
import { adjustStockTo } from './stock.js';

// Byte đầu file: .xlsx là file zip ("PK"), .xls cũ là file OLE
const XLSX_MAGIC = [0x50, 0x4b, 0x03, 0x04];
const XLS_MAGIC = [0xd0, 0xcf, 0x11, 0xe0];
const startsWith = (buf: Buffer, magic: number[]) => magic.every((b, i) => buf[i] === b);

interface ImportCtx {
  categories: Map<string, number>;
  /** Sản phẩm không mã vạch theo tên đã chuẩn hóa (cả hàng ngừng bán); một tên có thể ứng với nhiều sản phẩm. */
  noBarcode: Map<string, number[]>;
  /** Ghi chú movement tồn đầu. */
  note: string;
}

/** Khóa so tên: bỏ khoảng trắng hai đầu, chữ thường cả chữ có dấu (lower() của SQLite chỉ đổi ASCII). */
const nameKey = (name: string) => name.trim().toLocaleLowerCase('vi');

function loadNoBarcode(tx: DbOrTx): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const p of tx.select({ id: products.id, name: products.name }).from(products).where(isNull(products.barcode)).all()) {
    const k = nameKey(p.name);
    map.set(k, [...(map.get(k) ?? []), p.id]);
  }
  return map;
}

function findOrCreateCategory(tx: DbOrTx, cache: Map<string, number>, name: string): number {
  const key = name.toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;
  const found = tx
    .select({ id: categories.id })
    .from(categories)
    .where(sql`lower(${categories.name}) = ${key}`)
    .get();
  const id = found?.id ?? tx.insert(categories).values({ name }).returning({ id: categories.id }).get().id;
  cache.set(key, id);
  return id;
}

/**
 * Khớp theo mã vạch trước; không thấy thì khớp theo tên trong số hàng không mã vạch. Dòng có mã vạch mới khớp theo tên
 * nghĩa là người dùng vừa điền mã cho hàng đó (`assignBarcode`), không phải hàng mới.
 */
function findExisting(tx: DbOrTx, ctx: ImportCtx, row: ProductCsvRow): { id: number; assignBarcode: boolean } | undefined {
  if (row.barcode) {
    const byCode = tx.select({ id: products.id }).from(products).where(eq(products.barcode, row.barcode)).get();
    if (byCode) return { id: byCode.id, assignBarcode: false };
  }
  const ids = ctx.noBarcode.get(nameKey(row.name)) ?? [];
  if (ids.length > 1)
    throw new BadRequestError(`Có nhiều sản phẩm tên "${row.name}" không có mã vạch, hãy thêm mã vạch cho từng sản phẩm ở trang Sản phẩm`);
  return ids[0] === undefined ? undefined : { id: ids[0], assignBarcode: !!row.barcode };
}

/** Đã có → cập nhật (bỏ qua Tồn để giữ lịch sử kho); chưa có → tạo mới kèm movement tồn đầu. */
function upsertRow(tx: DbOrTx, ctx: ImportCtx, row: ProductCsvRow): 'created' | 'updated' {
  const categoryId = row.categoryName ? findOrCreateCategory(tx, ctx.categories, row.categoryName) : null;
  const fields = {
    name: row.name,
    unit: row.unit,
    costPrice: row.costPrice,
    sellPrice: row.sellPrice,
    isWeighed: row.isWeighed,
    categoryId,
    minStock: row.minStock,
  };
  const existing = findExisting(tx, ctx, row);
  if (existing) {
    if (existing.assignBarcode) {
      // Mã có thể đang là mã thùng/lốc của sản phẩm khác
      assertBarcodeFree(tx, row.barcode, { productId: existing.id });
      ctx.noBarcode.delete(nameKey(row.name));
    }
    const barcode = existing.assignBarcode ? { barcode: row.barcode } : {};
    tx.update(products)
      .set({ ...fields, ...barcode, updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))` })
      .where(eq(products.id, existing.id))
      .run();
    return 'updated';
  }
  if (row.stock < 0) throw new BadRequestError('Tồn đầu không được âm');
  // Mã có thể đang là mã thùng/lốc của sản phẩm khác → từ chối như API thường
  assertBarcodeFree(tx, row.barcode);
  const created = tx
    .insert(products)
    .values({ ...fields, barcode: row.barcode })
    .returning({ id: products.id })
    .get();
  if (!row.barcode) ctx.noBarcode.set(nameKey(row.name), [created.id]);
  if (row.stock > 0) adjustStockTo(tx, created.id, row.stock, ctx.note);
  return 'created';
}

/**
 * Nhập sản phẩm từ file .xlsx (sheet đầu) hoặc .csv trong 1 transaction. Lỗi từng dòng (đọc, trùng mã, trùng tên,
 * tồn đầu âm) được trả về kèm số dòng; lỗi hệ thống → rollback.
 */
export async function importProductsFile(db: Db, buf: Buffer): Promise<CsvImportResult> {
  if (startsWith(buf, XLS_MAGIC)) throw new BadRequestError('File .xls cũ chưa hỗ trợ. Mở bằng Excel rồi lưu lại dạng .xlsx');
  const isXlsx = startsWith(buf, XLSX_MAGIC);
  const { rows, errors } = isXlsx ? parseProductTable(await readFirstSheet(buf)) : parseProductCsv(buf.toString('utf8'));
  return db.transaction((tx) => {
    const ctx: ImportCtx = { categories: new Map(), noBarcode: loadNoBarcode(tx), note: isXlsx ? 'Nhập Excel' : 'Nhập CSV' };
    let created = 0;
    let updated = 0;
    for (const { line, data } of rows) {
      try {
        if (upsertRow(tx, ctx, data) === 'created') created++;
        else updated++;
      } catch (e) {
        if (!(e instanceof HttpError) || e.status >= 500) throw e;
        errors.push({ line, message: e.message });
      }
    }
    errors.sort((a, b) => a.line - b.line);
    return { created, updated, errors };
  });
}
