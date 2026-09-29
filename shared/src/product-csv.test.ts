import { describe, expect, it } from 'vitest';
import { CSV_MISSING_NAME_MESSAGE, parseProductCsv, parseVnNumber, productToCsvRow, PRODUCT_CSV_HEADERS } from './product-csv.js';
import { toCsv } from './csv.js';

describe('parseProductCsv', () => {
  it('đọc theo tên cột, không phụ thuộc thứ tự, thiếu cột phụ vẫn được', () => {
    const text = 'Tên,Giá bán,Mã vạch,Hàng cân\nSữa,15000,893,0\nThịt heo,120000,,x\n';
    const r = parseProductCsv(text);
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([
      { line: 2, data: { barcode: '893', name: 'Sữa', unit: 'cái', costPrice: 0, sellPrice: 15000, stock: 0, isWeighed: false, categoryName: null, minStock: 0 } },
      { line: 3, data: { barcode: null, name: 'Thịt heo', unit: 'cái', costPrice: 0, sellPrice: 120000, stock: 0, isWeighed: true, categoryName: null, minStock: 0 } },
    ]);
  });
  it('báo lỗi theo dòng, các dòng khác vẫn đọc', () => {
    const r = parseProductCsv('Tên,Giá bán\n,10\nBánh,abc\nKẹo,5000\n');
    expect(r.rows.map((x) => x.data.name)).toEqual(['Kẹo']);
    expect(r.errors.map((e) => e.line)).toEqual([2, 3]);
    expect(r.errors[0]?.message).toContain('Tên');
    expect(r.errors[1]?.message).toContain('Giá bán');
  });
  it('thiếu cột Tên thì lỗi toàn file', () => {
    const r = parseProductCsv('Ten;Gia\nSữa;1\n');
    expect(r.rows).toEqual([]);
    expect(r.errors).toEqual([{ line: 1, message: CSV_MISSING_NAME_MESSAGE }]);
  });
  it('đi vòng với productToCsvRow', () => {
    const p = { barcode: '1', name: 'Kẹo, dẻo', unit: 'gói', costPrice: 3000, sellPrice: 5000, stock: 2.5, isWeighed: false, minStock: 1 };
    const text = toCsv([[...PRODUCT_CSV_HEADERS], productToCsvRow(p, 'Bánh kẹo')]);
    expect(parseProductCsv(text).rows[0]?.data).toEqual({ ...p, categoryName: 'Bánh kẹo' });
  });
});

describe('parseVnNumber', () => {
  it('hiểu cả kiểu Việt lẫn kiểu máy', () => {
    expect(parseVnNumber('15.000')).toBe(15000);
    expect(parseVnNumber('1.234,5')).toBe(1234.5);
    expect(parseVnNumber('1,5')).toBe(1.5);
    expect(parseVnNumber('2.5')).toBe(2.5);
    expect(parseVnNumber('abc')).toBeNaN();
  });
});

describe('parseProductCsv tự nhận dấu phân cách', () => {
  it('đọc được file Excel lưu bằng dấu chấm phẩy', () => {
    const r = parseProductCsv('Mã vạch;Tên;Giá bán\n1;Sữa;15000\n');
    expect(r.errors).toEqual([]);
    expect(r.rows[0]?.data).toMatchObject({ barcode: '1', name: 'Sữa', sellPrice: 15000 });
  });
  it('thiếu cột Tên thì hướng dẫn cách lưu file', () => {
    expect(parseProductCsv('Ten,Gia\n').errors[0]?.message).toContain('CSV UTF-8');
  });
});
