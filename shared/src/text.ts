/** Bỏ dấu tiếng Việt: "Đường" → "Duong". */
export function stripDiacritics(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/** Tên chủ tài khoản theo kiểu ngân hàng: in hoa, không dấu, chỉ chữ/số/khoảng trắng. */
export function toBankName(s: string): string {
  return stripDiacritics(s)
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
