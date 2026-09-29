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

/** Ô số: rỗng → 0, chữ → lỗi. */
const num = (label: string) =>
  z
    .string()
    .trim()
    .transform((s, ctx) => {
      if (s === '') return 0;
      const n = parseVnNumber(s);
      if (Number.isNaN(n)) ctx.addIssue({ code: 'custom', message: `${label} không phải là số` });
      return n;
    });
const money = (label: string) =>
  num(label).pipe(
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
  stock: qty('Tồn'),
  isWeighed: z.string().transform((s) => ['1', 'x', 'có', 'co', 'true', 'yes'].includes(s.trim().toLowerCase())),
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

export const CSV_MISSING_NAME_MESSAGE =
  'Không tìm thấy cột "Tên". Hãy lưu bằng Excel ở dạng "CSV UTF-8" và giữ nguyên dòng tiêu đề.';

/** Đọc CSV sản phẩm theo tên cột (không phụ thuộc thứ tự). Bắt buộc có cột "Tên". */
export function parseProductCsv(text: string): { rows: { line: number; data: ProductCsvRow }[]; errors: CsvRowError[] } {
  const table = parseCsv(text, detectDelimiter(text));
  const header = (table[0] ?? []).map((h) => h.trim().toLowerCase());
  const indexOf = (h: Header) => header.indexOf(h.toLowerCase());
  if (indexOf('Tên') < 0) return { rows: [], errors: [{ line: 1, message: CSV_MISSING_NAME_MESSAGE }] };
  const rows: { line: number; data: ProductCsvRow }[] = [];
  const errors: CsvRowError[] = [];
  table.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const raw: Record<string, string> = {};
    for (const h of PRODUCT_CSV_HEADERS) {
      const idx = indexOf(h);
      raw[FIELD_BY_HEADER[h]] = idx >= 0 ? (cells[idx] ?? '') : '';
    }
    const r = rowSchema.safeParse(raw);
    if (r.success) rows.push({ line, data: r.data });
    else errors.push({ line, message: r.error.issues.map((x) => x.message).join('; ') });
  });
  return { rows, errors };
}

export function productToCsvRow(
  p: Pick<ProductCsvRow, 'barcode' | 'name' | 'unit' | 'costPrice' | 'sellPrice' | 'stock' | 'isWeighed' | 'minStock'>,
  categoryName: string | null,
): (string | number | boolean | null)[] {
  return [p.barcode, p.name, p.unit, p.costPrice, p.sellPrice, p.stock, p.isWeighed, categoryName, p.minStock];
}
