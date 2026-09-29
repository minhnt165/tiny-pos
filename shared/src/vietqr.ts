import { stripDiacritics } from './text.js';

/** Một trường TLV: ID 2 số + độ dài 2 số + giá trị. */
const tlv = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`;

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), 4 ký tự hex in hoa. */
export function crc16(s: string): string {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export interface VietQrInput {
  bin: string;
  account: string;
  amount: number;
  message?: string;
}

/** Chuỗi VietQR (EMVCo) chuyển khoản tới tài khoản; dựng hoàn toàn offline. */
export function buildVietQr({ bin, account, amount, message = '' }: VietQrInput): string {
  const merchant = tlv('00', 'A000000727') + tlv('01', tlv('00', bin) + tlv('01', account)) + tlv('02', 'QRIBFTTA');
  const amt = Math.round(amount);
  const msg = stripDiacritics(message).replace(/[^A-Za-z0-9 ]/g, '').trim().slice(0, 25);
  const body =
    tlv('00', '01') +
    tlv('01', amt > 0 ? '12' : '11') +
    tlv('38', merchant) +
    tlv('53', '704') +
    (amt > 0 ? tlv('54', String(amt)) : '') +
    tlv('58', 'VN') +
    (msg ? tlv('62', tlv('08', msg)) : '') +
    '6304';
  return body + crc16(body);
}

/** QR theo cài đặt cửa hàng; chưa cài ngân hàng/số tài khoản thì null. */
export function vietQrFromSettings(s: { bankBin: string; bankAccount: string }, amount: number): string | null {
  if (!s.bankBin || !s.bankAccount) return null;
  return buildVietQr({ bin: s.bankBin, account: s.bankAccount, amount, message: 'Thanh toan' });
}
