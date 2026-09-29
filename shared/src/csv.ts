export type CsvCell = string | number | boolean | null | undefined;

/** Đọc CSV (RFC 4180): hỗ trợ ngoặc kép, dấu phẩy trong ô, CRLF/LF, BOM. Bỏ dòng trống. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  for (; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

function escapeCell(v: CsvCell): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'boolean' ? (v ? '1' : '0') : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Ghi CSV, mỗi dòng kết thúc CRLF. Không thêm BOM (caller tự thêm khi tải file). */
export function toCsv(rows: CsvCell[][]): string {
  return rows.map((r) => r.map(escapeCell).join(',')).join('\r\n') + '\r\n';
}
