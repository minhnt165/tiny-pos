import { and, eq, like } from 'drizzle-orm';
import { formatLabelItems, INTERNAL_MAX_SEQ, internalEan13, internalSeq, type LabelPrintInput, type LabelPrintResult } from '@tiny-pos/shared';
import type { Db, DbOrTx } from '../db/connection.js';
import { productUnits, products, settings } from '../db/schema.js';
import { BadRequestError, ConflictError } from '../errors.js';
import { assertBarcodeFree } from './products.js';

/** Mở cửa sổ in tem trên máy quầy; false = không mở được (dev, không có trình duyệt), client tự mở tab. */
export type LabelOpener = (url: string) => boolean;
export interface LabelDeps {
  open: LabelOpener;
  /** Gốc URL cửa sổ in tem mở tới, ví dụ http://localhost:3000. */
  origin: string;
}
export const NO_LABEL_WINDOW: LabelDeps = { open: () => false, origin: '' };

/** Số thứ tự lớn nhất của mã nội bộ 20… hợp lệ đang có trên sản phẩm và đơn vị (kể cả mã gõ tay). */
function maxInternalSeq(tx: DbOrTx): number {
  const codes = [
    ...tx.select({ c: products.barcode }).from(products).where(like(products.barcode, '20%')).all(),
    ...tx.select({ c: productUnits.barcode }).from(productUnits).where(like(productUnits.barcode, '20%')).all(),
  ];
  let max = 0;
  for (const { c } of codes) {
    const seq = c ? internalSeq(c) : null;
    if (seq !== null && seq > max) max = seq;
  }
  return max;
}

/** Mốc số thứ tự đã cấp cao nhất (bảng settings): mã của đơn vị/sản phẩm đã xóa không được cấp lại vì tem cũ còn dán ngoài kệ. */
const SEQ_KEY = 'internalBarcodeSeq';

/** Cấp mã EAN-13 nội bộ cho sản phẩm/đơn vị chưa có mã, gọi trong transaction; không bao giờ ghi đè mã đã có. */
export function assignBarcodes(tx: DbOrTx, items: { productId: number; unitId: number | null }[]): void {
  const issued = Number(tx.select({ v: settings.value }).from(settings).where(eq(settings.key, SEQ_KEY)).get()?.v ?? 0) || 0;
  const start = Math.max(maxInternalSeq(tx), issued);
  let seq = start;
  const next = () => {
    if (seq >= INTERNAL_MAX_SEQ) throw new ConflictError('Đã hết mã nội bộ để cấp');
    const code = internalEan13(++seq);
    assertBarcodeFree(tx, code);
    return code;
  };
  for (const it of items) {
    if (it.unitId === null) {
      const p = tx.select({ barcode: products.barcode }).from(products).where(eq(products.id, it.productId)).get();
      if (!p) throw new BadRequestError('Sản phẩm không hợp lệ');
      if (p.barcode) continue;
      tx.update(products).set({ barcode: next(), updatedAt: new Date().toISOString() }).where(eq(products.id, it.productId)).run();
    } else {
      const u = tx
        .select({ barcode: productUnits.barcode })
        .from(productUnits)
        .where(and(eq(productUnits.id, it.unitId), eq(productUnits.productId, it.productId)))
        .get();
      if (!u) throw new BadRequestError('Sản phẩm không hợp lệ');
      if (u.barcode) continue;
      tx.update(productUnits).set({ barcode: next() }).where(eq(productUnits.id, it.unitId)).run();
    }
  }
  if (seq > start)
    tx.insert(settings).values({ key: SEQ_KEY, value: String(seq) }).onConflictDoUpdate({ target: settings.key, set: { value: String(seq) } }).run();
}

/** Cấp mã còn thiếu rồi mở trang in; mở cửa sổ nằm ngoài transaction. */
export function printLabels(db: Db, input: LabelPrintInput, deps: LabelDeps): LabelPrintResult {
  db.transaction((tx) => assignBarcodes(tx, input.items));
  const url = `/labels/print?i=${formatLabelItems(input.items)}`;
  return { opened: deps.open(deps.origin + url), url };
}

/** Tem mẫu cho nút In thử ở Cài đặt; không cần sản phẩm, không ghi DB. */
export function printSampleLabel(deps: LabelDeps): LabelPrintResult {
  const url = '/labels/print?sample=1';
  return { opened: deps.open(deps.origin + url), url };
}
