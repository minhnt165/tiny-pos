import ExcelJS from 'exceljs';
import { BadRequestError } from '../errors.js';

/** Ô ghi ra file; cột `datetime` nhận chuỗi ISO UTC. */
export type XlsxValue = string | number | boolean | null | undefined;
/** Ô đọc từ file: ngày thành chuỗi ISO, công thức lấy kết quả, ô lỗi giữ mã lỗi ('#N/A'…), ô trống thành null. */
export type XlsxCell = string | number | boolean | null;

export interface XlsxColumn {
  header: string;
  width: number;
  /** code = ô chữ (giữ số 0 đầu của mã vạch, SĐT); money = số nguyên có dấu chấm nghìn. */
  kind: 'text' | 'code' | 'money' | 'qty' | 'datetime';
}

export interface XlsxSheet {
  name: string;
  rows: XlsxCell[][];
}

const NUM_FMT: Record<XlsxColumn['kind'], string | undefined> = {
  text: undefined,
  code: '@',
  money: '#,##0',
  qty: '#,##0.###',
  datetime: 'dd/mm/yyyy hh:mm',
};
const MINUTE = 60_000;

export const newWorkbook = () => new ExcelJS.Workbook();

/**
 * Thêm sheet: tiêu đề in đậm, cố định dòng 1, bật lọc. Định dạng gắn cho cả cột để dòng người dùng gõ thêm cũng giữ
 * (mã vạch dạng chữ, tiền có dấu chấm). Ngày giờ cộng lệch múi giờ vì exceljs ghi `Date` theo UTC.
 */
export function addSheet(wb: ExcelJS.Workbook, name: string, columns: XlsxColumn[], rows: XlsxValue[][], tzOffsetMin: number): void {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = columns.map((c) => {
    const fmt = NUM_FMT[c.kind];
    return { header: c.header, width: c.width, style: fmt ? { numFmt: fmt } : {} };
  });
  ws.getRow(1).font = { bold: true };
  for (const values of rows) {
    ws.addRow(
      columns.map((c, i) => {
        const v = values[i];
        if (v === null || v === undefined || v === '') return null;
        if (c.kind === 'datetime') return new Date(Date.parse(String(v)) + tzOffsetMin * MINUTE);
        return c.kind === 'code' ? String(v) : v;
      }),
    );
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: rows.length + 1, column: columns.length } };
}

export async function toBuffer(wb: ExcelJS.Workbook): Promise<Buffer> {
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function toCell(v: ExcelJS.CellValue | undefined): XlsxCell {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return v;
  if (v instanceof Date) return v.toISOString();
  if ('richText' in v) return v.richText.map((t) => t.text).join('');
  if ('formula' in v || 'sharedFormula' in v) {
    const result = (v as { result?: ExcelJS.CellValue }).result;
    // Công thức chưa có kết quả lưu sẵn: không có giá trị, không phải ô trống (ô trống ở cột giá sẽ thành 0)
    return result === undefined || result === null ? '#N/A' : toCell(result);
  }
  if ('hyperlink' in v) return toCell(v.text as ExcelJS.CellValue);
  // Ô lỗi (#N/A, #DIV/0!…): giữ mã lỗi để phần đọc bảng báo lỗi theo dòng
  return 'error' in v ? String(v.error) : null;
}

/** Đọc mọi sheet; `rows[i]` là dòng Excel i + 1 (dòng trống thành mảng rỗng) để số dòng báo lỗi khớp Excel. */
export async function readWorkbook(buf: Buffer): Promise<XlsxSheet[]> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  } catch {
    throw new BadRequestError('File Excel bị hỏng hoặc không đọc được');
  }
  return wb.worksheets.map((ws) => {
    const rows: XlsxCell[][] = [];
    ws.eachRow((row, n) => {
      const cells: XlsxCell[] = [];
      for (let c = 1; c <= row.cellCount; c++) cells.push(toCell(row.getCell(c).value));
      while (cells.length && cells.at(-1) === null) cells.pop();
      rows[n - 1] = cells;
    });
    return { name: ws.name, rows: Array.from(rows, (r) => r ?? []) };
  });
}

export async function readFirstSheet(buf: Buffer): Promise<XlsxCell[][]> {
  return (await readWorkbook(buf))[0]?.rows ?? [];
}
