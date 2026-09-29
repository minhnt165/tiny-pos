import { describe, expect, it } from 'vitest';
import { parseCsv, toCsv } from './csv.js';

describe('parseCsv', () => {
  it('tách dòng và cột đơn giản, bỏ dòng trống', () => {
    expect(parseCsv('a,b\n1,2\n\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('xử lý CRLF và BOM', () => {
    expect(parseCsv('\uFEFFa,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('xử lý ngoặc kép, dấu phẩy và xuống dòng trong ô', () => {
    expect(parseCsv('"Sữa ""Cô gái"", 1L","x\ny"')).toEqual([['Sữa "Cô gái", 1L', 'x\ny']]);
  });
  it('giữ ô trống cuối dòng', () => {
    expect(parseCsv('a,\n')).toEqual([['a', '']]);
  });
});

describe('toCsv', () => {
  it('bao ngoặc khi cần, boolean thành 1/0, null thành rỗng', () => {
    expect(toCsv([['a,b', 'c"d', 5, true, false, null]])).toBe('"a,b","c""d",5,1,0,\r\n');
  });
  it('đi vòng qua parseCsv không đổi dữ liệu', () => {
    const rows = [['Tên', 'Ghi chú'], ['Bánh "ngon", 2', 'dòng 1\ndòng 2']];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});
