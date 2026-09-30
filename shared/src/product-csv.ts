import { z } from 'zod';
import { parseCsv } from './csv.js';
import type { CsvRowError } from './types.js';

export const PRODUCT_CSV_HEADERS = [
  'Mã vạch',
  'Tên',
  'Đơn vị',
  'Giá nhập',
  'Giá bán',
  'Tồn',
  'Hàng cân',
  'Danh mục',
  'Tồn tối thiểu',
] as const;
type Header = (typeof PRODUCT_CSV_HEADERS)[number];

export interface ProductCsvRow {
  barcode: string | null;
  name: string;
  unit: string;
  costPrice: number;
  sellPrice: number;
  stock: number;
  isWeighed: boolean;
  categoryName: string | null;
  minStock: number;
}

const emptyToNull = (s: string) => (s.trim() === '' ? null : s.trim());

/** "15.000" (nhóm 3 số) → 15000; "1,5" hoặc "1.234,5" → phần thập phân; "2.5" → 2.5. */
export function parseVnNumber(s: string): number {
  const t = s.trim();
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) return Number(t.replace(/\./g, '').replace(',', '.'));
  return Number(t.replace(',', '.'));
}

/** Ô của bảng đọc từ file: CSV chỉ có chuỗi; Excel có thêm số, true/false, ô trống. */
export type TableCell = string | number | boolean | null | undefined;

/** Ô số: ô số của Excel dùng thẳng (cột tiền làm tròn tới đồng vì giá hay tính bằng công thức); ô chữ rỗng → 0, chữ → lỗi. */
const num = (label: string, round = false) =>
  z.union([z.number(), z.string()]).transform((v, ctx) => {
    if (typeof v === 'number') return round ? Math.round(v) : v;
    const s = v.trim();
    if (s === '') return 0;
    const n = parseVnNumber(s);
    if (Number.isNaN(n)) ctx.addIssue({ code: 'custom', message: `${label} không phải là số` });
    return n;
  });
const money = (label: string) =>
  num(label, true).pipe(
    z
      .number()
      .int({ message: `${label} phải là số nguyên` })
      .min(0, { message: `${label} không được âm` }),
  );
const qty = (label: string) => num(label).pipe(z.number().min(0, { message: `${label} không được âm` }));

const rowSchema = z.object({
  barcode: z.string().transform(emptyToNull),
  name: z.string().trim().min(1, { message: 'Tên không được trống' }),
  unit: z
    .string()
    .trim()
    .transform((s) => s || 'cái'),
  costPrice: money('Giá nhập'),
  sellPrice: money('Giá bán'),
  // Được âm: hàng đang bán âm xuất ra rồi nhập lại vẫn cập nhật được (cập nhật không đổi tồn); tạo mới với tồn âm bị chặn ở server
  stock: num('Tồn'),
  isWeighed: z
    .union([z.boolean(), z.string()])
    .transform((v) => (typeof v === 'boolean' ? v : ['1', 'x', 'có', 'co', 'true', 'yes'].includes(v.trim().toLowerCase()))),
  categoryName: z.string().transform(emptyToNull),
  minStock: qty('Tồn tối thiểu'),
});

const FIELD_BY_HEADER: Record<Header, keyof ProductCsvRow> = {
  'Mã vạch': 'barcode',
  'Tên': 'name',
  'Đơn vị': 'unit',
  'Giá nhập': 'costPrice',
  'Giá bán': 'sellPrice',
  'Tồn': 'stock',
  'Hàng cân': 'isWeighed',
  'Danh mục': 'categoryName',
  'Tồn tối thiểu': 'minStock',
};

/** Excel tiếng Việt lưu CSV bằng ";" — đoán theo dòng tiêu đề. */
function detectDelimiter(text: string): ',' | ';' {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const commas = (firstLine.match(/,/g) ?? []).length;
  const semis = (firstLine.match(/;/g) ?? []).length;
  return semis > commas ? ';' : ',';
}

export const CSV_MISSING_NAME_MESSAGE = 'Không tìm thấy cột "Tên". Hãy giữ nguyên dòng tiêu đề như file xuất ra.';

const NUMERIC_FIELDS = new Set<keyof ProductCsvRow>(['costPrice', 'sellPrice', 'stock', 'minStock']);
const cellText = (v: TableCell) => (v === null || v === undefined ? '' : String(v));
const isBlankRow = (cells: TableCell[]) => cells.every((c) => cellText(c).trim() === '');
/** Giá trị lỗi của Excel (#N/A của VLOOKUP…): phải báo lỗi, không được coi là ô trống (ô tiền trống thành 0). */
const EXCEL_ERROR = /^#(N\/A|VALUE!|REF!|DIV\/0!|NUM!|NAME\?|NULL!|SPILL!|CALC!)$/;

/** Chuẩn hóa ô cho schema: giữ số ở cột số, giữ true/false ở cột Hàng cân, còn lại thành chuỗi (mã vạch là ô số vẫn đủ chữ số). */
function cellFor(field: keyof ProductCsvRow, v: TableCell): string | number | boolean {
  if (typeof v === 'number' && NUMERIC_FIELDS.has(field)) return v;
  if (typeof v === 'boolean' && field === 'isWeighed') return v;
  return cellText(v);
}

/**
 * Đọc bảng sản phẩm theo tên cột (không phụ thuộc thứ tự). Bắt buộc có cột "Tên".
 * `table[0]` là tiêu đề, `table[i]` là dòng i + 1 của file; dòng trống bị bỏ qua.
 */
export function parseProductTable(table: TableCell[][]): { rows: { line: number; data: ProductCsvRow }[]; errors: CsvRowError[] } {
  const header = (table[0] ?? []).map((h) => cellText(h).trim().toLowerCase());
  const indexOf = (h: Header) => header.indexOf(h.toLowerCase());
  if (indexOf('Tên') < 0) return { rows: [], errors: [{ line: 1, message: CSV_MISSING_NAME_MESSAGE }] };
  const rows: { line: number; data: ProductCsvRow }[] = [];
  const errors: CsvRowError[] = [];
  table.slice(1).forEach((cells, i) => {
    if (isBlankRow(cells)) return;
    const line = i + 2;
    const raw: Record<string, string | number | boolean> = {};
    const bad: string[] = [];
    for (const h of PRODUCT_CSV_HEADERS) {
      const idx = indexOf(h);
      const field = FIELD_BY_HEADER[h];
      raw[field] = cellFor(field, idx >= 0 ? cells[idx] : null);
      const text = cellText(idx >= 0 ? cells[idx] : null).trim();
      if (EXCEL_ERROR.test(text)) bad.push(`Ô ${h} bị lỗi ${text} trong Excel`);
    }
    if (bad.length) return void errors.push({ line, message: bad.join('; ') });
    const r = rowSchema.safeParse(raw);
    if (r.success) rows.push({ line, data: r.data });
    else errors.push({ line, message: r.error.issues.map((x) => x.message).join('; ') });
  });
  return { rows, errors };
}

/** Đọc CSV sản phẩm (dấu phân cách đoán theo dòng tiêu đề). */
export function parseProductCsv(text: string): { rows: { line: number; data: ProductCsvRow }[]; errors: CsvRowError[] } {
  return parseProductTable(parseCsv(text, detectDelimiter(text)));
}

export function productToCsvRow(
  p: Pick<ProductCsvRow, 'barcode' | 'name' | 'unit' | 'costPrice' | 'sellPrice' | 'stock' | 'isWeighed' | 'minStock'>,
  categoryName: string | null,
): (string | number | boolean | null)[] {
  return [p.barcode, p.name, p.unit, p.costPrice, p.sellPrice, p.stock, p.isWeighed, categoryName, p.minStock];
}
