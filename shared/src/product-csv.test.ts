import { describe, expect, it } from 'vitest';
import { CSV_MISSING_NAME_MESSAGE, parseProductCsv, parseProductTable, parseVnNumber, productToCsvRow, PRODUCT_CSV_HEADERS } from './product-csv.js';
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
  it('thiếu cột Tên thì hướng dẫn giữ dòng tiêu đề', () => {
    const message = parseProductCsv('Ten,Gia\n').errors[0]?.message;
    expect(message).toContain('dòng tiêu đề');
    expect(message).not.toContain('CSV UTF-8');
  });
});

describe('parseProductTable (ô đọc từ Excel)', () => {
  const H = [...PRODUCT_CSV_HEADERS];

  it('ô số dùng thẳng: 1.234 kg không bị hiểu là 1234', () => {
    const r = parseProductTable([H, [null, 'Thịt', 'kg', 100000, 150000, 1.234, true, null, 0.5]]);
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([
      {
        line: 2,
        data: { barcode: null, name: 'Thịt', unit: 'kg', costPrice: 100000, sellPrice: 150000, stock: 1.234, isWeighed: true, categoryName: null, minStock: 0.5 },
      },
    ]);
  });

  it('mã vạch là ô số vẫn thành chuỗi đủ chữ số; Hàng cân nhận 1 / TRUE / FALSE', () => {
    const r = parseProductTable([['Mã vạch', 'Tên', 'Hàng cân'], [8934563138165, 'Sữa', 1], [12, 'Kẹo', false], ['0123', 'Bánh', true]]);
    expect(r.rows.map((x) => [x.data.barcode, x.data.isWeighed])).toEqual([
      ['8934563138165', true],
      ['12', false],
      ['0123', true],
    ]);
  });

  it('giá ra từ công thức có phần lẻ được làm tròn tới đồng; ô chữ có phần lẻ vẫn báo lỗi', () => {
    const r = parseProductTable([['Tên', 'Giá nhập', 'Giá bán'], ['A', 10999.999999998, 16500.000000002], ['B', 0, '1,5']]);
    expect(r.rows.map((x) => [x.data.costPrice, x.data.sellPrice])).toEqual([[11000, 16500]]);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]?.line).toBe(3);
    expect(r.errors[0]?.message).toContain('Giá bán phải là số nguyên');
  });

  it('dòng trống bị bỏ qua, số dòng lỗi vẫn theo dòng thật của file', () => {
    const r = parseProductTable([['Tên', 'Giá bán'], [], [null, null], ['', '  '], ['Kẹo', 'abc']]);
    expect(r.rows).toEqual([]);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]?.line).toBe(5);
    expect(r.errors[0]?.message).toContain('Giá bán không phải là số');
  });

  it('Tồn được âm khi đọc (hàng đang bán âm); Tồn tối thiểu âm vẫn lỗi', () => {
    const r = parseProductTable([['Tên', 'Tồn', 'Tồn tối thiểu'], ['A', -3, 0], ['B', '-2,5', 0], ['C', 0, -1]]);
    expect(r.rows.map((x) => x.data.stock)).toEqual([-3, -2.5]);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]?.line).toBe(4);
    expect(r.errors[0]?.message).toContain('Tồn tối thiểu không được âm');
  });

  it('ô lỗi của Excel (#N/A của VLOOKUP) báo lỗi dòng, không bị coi là ô trống rồi thành giá 0', () => {
    const r = parseProductTable([['Tên', 'Giá bán', 'Giá nhập'], ['Sữa', '#N/A', 1000], ['#REF!', 5000, '#DIV/0!']]);
    expect(r.rows).toEqual([]);
    expect(r.errors).toEqual([
      { line: 2, message: 'Ô Giá bán bị lỗi #N/A trong Excel' },
      { line: 3, message: 'Ô Tên bị lỗi #REF! trong Excel; Ô Giá nhập bị lỗi #DIV/0! trong Excel' },
    ]);
  });

  it('thiếu cột Tên thì lỗi toàn file; tiêu đề là ô số/trống không làm hỏng', () => {
    expect(parseProductTable([[1, null, 'Giá bán'], ['Sữa', 1, 2]])).toEqual({ rows: [], errors: [{ line: 1, message: CSV_MISSING_NAME_MESSAGE }] });
    expect(parseProductTable([])).toEqual({ rows: [], errors: [{ line: 1, message: CSV_MISSING_NAME_MESSAGE }] });
  });
});
