/** Mã nội bộ: 10 chữ số thứ tự sau tiền tố 20 (dải EAN dành cho cửa hàng tự dùng). */
export const INTERNAL_MAX_SEQ = 9_999_999_999;
const INTERNAL_RE = /^20\d{11}$/;

/** Số kiểm tra EAN: tính từ phải sang, chữ số sát số kiểm tra nhân 3, xen kẽ nhân 1. */
function checkDigit(body: string): number {
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const d = Number(body[body.length - 1 - i]);
    sum += i % 2 === 0 ? d * 3 : d;
  }
  return (10 - (sum % 10)) % 10;
}

export function eanCheckDigit(body12: string): number {
  if (!/^\d{12}$/.test(body12)) throw new RangeError('Cần đúng 12 chữ số');
  return checkDigit(body12);
}

export const isValidEan13 = (code: string): boolean => /^\d{13}$/.test(code) && checkDigit(code.slice(0, 12)) === Number(code[12]);
export const isValidEan8 = (code: string): boolean => /^\d{8}$/.test(code) && checkDigit(code.slice(0, 7)) === Number(code[7]);

/** Mã EAN-13 nội bộ thứ `seq` (1 … INTERNAL_MAX_SEQ). */
export function internalEan13(seq: number): string {
  if (!Number.isInteger(seq) || seq < 1 || seq > INTERNAL_MAX_SEQ) throw new RangeError('Số thứ tự mã nội bộ không hợp lệ');
  const body = `20${String(seq).padStart(10, '0')}`;
  return body + checkDigit(body);
}

/** Số thứ tự của một mã nội bộ hợp lệ; mã khác trả null. */
export function internalSeq(code: string): number | null {
  return INTERNAL_RE.test(code) && isValidEan13(code) ? Number(code.slice(2, 12)) : null;
}

export type BarcodeFormat = 'EAN13' | 'EAN8' | 'CODE128';

/**
 * Kiểu vạch để vẽ tem: mã EAN hợp lệ vẽ đúng chuẩn EAN, còn lại Code128 (chỉ nhận ký tự ASCII in được).
 * Mã rỗng hoặc có chữ có dấu (gõ tay, nhập từ file) không vẽ được vạch: trả null để tem chỉ in dãy chữ.
 */
export function barcodeFormat(code: string): BarcodeFormat | null {
  if (isValidEan13(code)) return 'EAN13';
  if (isValidEan8(code)) return 'EAN8';
  return /^[\x20-\x7E]+$/.test(code) ? 'CODE128' : null;
}
