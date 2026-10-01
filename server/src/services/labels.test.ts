import { beforeEach, describe, expect, it } from 'vitest';
import { labelPrintInputSchema, productInputSchema, productUnitInputSchema } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { createTestDb } from '../db/test-db.js';
import { assignBarcodes, printLabels, printSampleLabel } from './labels.js';
import { createUnit, deleteUnit } from './product-units.js';
import { createProduct, findProductByBarcode, getProduct } from './products.js';

let db: Db;
beforeEach(() => {
  db = createTestDb();
});
const product = (o: Record<string, unknown>) => createProduct(db, productInputSchema.parse(o));
const opened: string[] = [];
const deps = (ok: boolean) => ({ origin: 'http://localhost:3000', open: (url: string) => (opened.push(url), ok) });

describe('assignBarcodes', () => {
  it('cấp mã liên tiếp cho sản phẩm và đơn vị chưa có mã; bỏ qua mã đã có; quét ra đúng hàng', () => {
    const banh = product({ name: 'Bánh bò', sellPrice: 5000 });
    const sua = product({ name: 'Sữa', barcode: '8934567890128', sellPrice: 9000 });
    const loc = createUnit(db, sua.id, productUnitInputSchema.parse({ name: 'Lốc', factor: 4, sellPrice: 34000 }));
    db.transaction((tx) =>
      assignBarcodes(tx, [
        { productId: banh.id, unitId: null },
        { productId: sua.id, unitId: null },
        { productId: sua.id, unitId: loc.id },
      ]),
    );
    expect(getProduct(db, banh.id).barcode).toBe('2000000000015');
    expect(getProduct(db, sua.id).barcode).toBe('8934567890128');
    expect(getProduct(db, sua.id).units[0]!.barcode).toBe('2000000000022');
    expect(findProductByBarcode(db, '2000000000022')).toMatchObject({ product: { id: sua.id }, unit: { id: loc.id } });
  });

  it('nối tiếp sau mã 20… hợp lệ lớn nhất đang có, kể cả mã gõ tay; bỏ qua mã 20… sai số kiểm tra / sai độ dài', () => {
    product({ name: 'Gõ tay', barcode: '2000000000046' });
    product({ name: 'Sai kiểm tra', barcode: '2000000009999' });
    product({ name: 'Ngắn', barcode: '2000000000' });
    const moi = product({ name: 'Mới' });
    db.transaction((tx) => assignBarcodes(tx, [{ productId: moi.id, unitId: null }]));
    expect(getProduct(db, moi.id).barcode).toBe('2000000000053');
  });

  it('sản phẩm lạ hoặc đơn vị không thuộc sản phẩm → 400, không ghi gì', () => {
    const a = product({ name: 'A' });
    const b = product({ name: 'B' });
    const ub = createUnit(db, b.id, productUnitInputSchema.parse({ name: 'Lốc', factor: 6, sellPrice: 1 }));
    expect(() => db.transaction((tx) => assignBarcodes(tx, [{ productId: a.id, unitId: null }, { productId: 999, unitId: null }]))).toThrow(
      'Sản phẩm không hợp lệ',
    );
    expect(() => db.transaction((tx) => assignBarcodes(tx, [{ productId: a.id, unitId: ub.id }]))).toThrow('Sản phẩm không hợp lệ');
    expect(getProduct(db, a.id).barcode).toBeNull();
  });
});

describe('printLabels', () => {
  it('cấp mã rồi gọi opener với URL đầy đủ; trả opened theo opener và url tương đối; gọi lại không đổi mã', () => {
    opened.length = 0;
    const banh = product({ name: 'Bánh bò', sellPrice: 5000 });
    const input = labelPrintInputSchema.parse({ items: [{ productId: banh.id, copies: 3 }] });
    expect(printLabels(db, input, deps(true))).toEqual({ opened: true, url: `/labels/print?i=${banh.id}.0x3` });
    expect(opened).toEqual([`http://localhost:3000/labels/print?i=${banh.id}.0x3`]);
    expect(printLabels(db, input, deps(false))).toEqual({ opened: false, url: `/labels/print?i=${banh.id}.0x3` });
    expect(getProduct(db, banh.id).barcode).toBe('2000000000015');
  });

  it('tem mẫu không đụng DB', () => {
    opened.length = 0;
    expect(printSampleLabel(deps(true))).toEqual({ opened: true, url: '/labels/print?sample=1' });
    expect(opened).toEqual(['http://localhost:3000/labels/print?sample=1']);
  });
});

describe('mã nội bộ không bị cấp lại', () => {
  it('xóa đơn vị đang giữ mã lớn nhất rồi in tiếp: mã mới nối tiếp, không dùng lại mã của tem cũ', () => {
    const sua = product({ name: 'Sữa' });
    const loc = createUnit(db, sua.id, productUnitInputSchema.parse({ name: 'Lốc', factor: 4, sellPrice: 34000 }));
    db.transaction((tx) => assignBarcodes(tx, [{ productId: sua.id, unitId: null }, { productId: sua.id, unitId: loc.id }]));
    expect(getProduct(db, sua.id).units[0]!.barcode).toBe('2000000000022');
    deleteUnit(db, sua.id, loc.id);
    const moi = product({ name: 'Mới' });
    db.transaction((tx) => assignBarcodes(tx, [{ productId: moi.id, unitId: null }]));
    expect(getProduct(db, moi.id).barcode).toBe('2000000000039');
  });
});
