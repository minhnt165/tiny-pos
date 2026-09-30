import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { addSheet, newWorkbook, readFirstSheet, readWorkbook, toBuffer, type XlsxColumn, type XlsxValue } from './workbook.js';

const VN = 420;
const COLS: XlsxColumn[] = [
  { header: 'Mã vạch', width: 16, kind: 'code' },
  { header: 'Tên', width: 30, kind: 'text' },
  { header: 'Giá', width: 12, kind: 'money' },
  { header: 'SL', width: 10, kind: 'qty' },
  { header: 'Lúc', width: 18, kind: 'datetime' },
];
const build = async (rows: XlsxValue[][]) => {
  const wb = newWorkbook();
  addSheet(wb, 'Thử', COLS, rows, VN);
  return toBuffer(wb);
};

describe('addSheet + readWorkbook', () => {
  it('ghi rồi đọc lại đúng giá trị; giờ địa phương; mã vạch giữ số 0; chữ "=…" không thành công thức', async () => {
    const buf = await build([
      ['0123', 'Sữa', 15000, 1.25, '2026-09-29T03:00:00.000Z'],
      [null, '=1+1', 0, 0, null],
    ]);
    expect(await readWorkbook(buf)).toEqual([
      {
        name: 'Thử',
        rows: [
          ['Mã vạch', 'Tên', 'Giá', 'SL', 'Lúc'],
          ['0123', 'Sữa', 15000, 1.25, '2026-09-29T10:00:00.000Z'],
          [null, '=1+1', 0, 0],
        ],
      },
    ]);
  });

  it('định dạng số, tiêu đề đậm, cố định dòng 1, bật lọc', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await build([['1', 'A', 1, 1, '2026-09-29T03:00:00.000Z']])) as unknown as ExcelJS.Buffer);
    const ws = wb.worksheets[0]!;
    expect(ws.getCell('A2').numFmt).toBe('@');
    expect(ws.getCell('C2').numFmt).toBe('#,##0');
    expect(ws.getCell('D2').numFmt).toBe('#,##0.###');
    expect(ws.getCell('E2').numFmt).toBe('dd/mm/yyyy hh:mm');
    expect(ws.getCell('A1').font?.bold).toBe(true);
    expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(ws.autoFilter).toBeTruthy();
  });

  it('định dạng gắn cho cả cột: dòng chủ tiệm gõ thêm dưới cùng vẫn giữ số 0 đầu của mã vạch, tiền vẫn có dấu chấm', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await build([['1', 'A', 1, 1, null]])) as unknown as ExcelJS.Buffer);
    const ws = wb.worksheets[0]!;
    expect(ws.getColumn(1).numFmt).toBe('@');
    expect(ws.getColumn(3).numFmt).toBe('#,##0');
    expect(ws.getColumn(5).numFmt).toBe('dd/mm/yyyy hh:mm');
    expect(ws.getCell('A10').numFmt).toBe('@');
  });

  it('đọc ô công thức (lấy kết quả), rich text, hyperlink; ô lỗi giữ mã lỗi; dòng bị bỏ giữ đúng vị trí', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('S');
    ws.getCell('A1').value = 'Tên';
    ws.getCell('B1').value = 'Giá bán';
    ws.getCell('A3').value = { richText: [{ text: 'Sữa ' }, { font: { bold: true }, text: 'tươi' }] };
    ws.getCell('B3').value = { formula: '1000*15', result: 15000 };
    ws.getCell('A4').value = { text: 'Kẹo', hyperlink: 'https://example.com' };
    ws.getCell('B4').value = { error: '#N/A' };
    ws.getCell('A5').value = 'Bánh';
    ws.getCell('B5').value = { formula: 'VLOOKUP(A5,Gia!A:B,2,0)' };
    const rows = await readFirstSheet(Buffer.from(await wb.xlsx.writeBuffer()));
    // Công thức chưa có kết quả lưu sẵn cũng là "không có giá trị", không phải ô trống
    expect(rows).toEqual([['Tên', 'Giá bán'], [], ['Sữa tươi', 15000], ['Kẹo', '#N/A'], ['Bánh', '#N/A']]);
  });

  it('file hỏng → 400', async () => {
    await expect(readFirstSheet(Buffer.from('không phải file excel'))).rejects.toMatchObject({
      status: 400,
      message: 'File Excel bị hỏng hoặc không đọc được',
    });
  });
});
