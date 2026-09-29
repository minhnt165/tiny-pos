import { describe, expect, it } from 'vitest';
import { BANKS } from './banks.js';
import { buildVietQr, crc16, vietQrFromSettings } from './vietqr.js';

describe('crc16', () => {
  it('CRC-16/CCITT-FALSE của chuỗi chuẩn', () => {
    expect(crc16('123456789')).toBe('29B1');
  });
});

describe('buildVietQr', () => {
  it('ghép TLV đúng chuẩn EMVCo/NAPAS, CRC ở cuối', () => {
    const s = buildVietQr({ bin: '970436', account: '0011001234567', amount: 87000, message: 'Thanh toán' });
    expect(s.slice(0, -4)).toBe(
      '000201010212' +
        '38570010A00000072701270006970436011300110012345670208QRIBFTTA' +
        '5303704' +
        '540587000' +
        '5802VN' +
        '62140810Thanh toan' +
        '6304',
    );
    expect(s.slice(-4)).toBe(crc16(s.slice(0, -4)));
  });
  it('không có số tiền → QR tĩnh (11), không có tag 54', () => {
    const s = buildVietQr({ bin: '970436', account: '123', amount: 0 });
    expect(s.startsWith('000201010211')).toBe(true);
    expect(s.slice(0, -4).endsWith('5802VN6304')).toBe(true);
  });
});

describe('vietQrFromSettings', () => {
  it('thiếu ngân hàng hoặc số tài khoản → null', () => {
    expect(vietQrFromSettings({ bankBin: '', bankAccount: '123' }, 1000)).toBeNull();
    expect(vietQrFromSettings({ bankBin: '970436', bankAccount: '' }, 1000)).toBeNull();
    expect(vietQrFromSettings({ bankBin: '970436', bankAccount: '123' }, 1000)).toContain('Thanh toan');
  });
});

describe('BANKS', () => {
  it('BIN 6 chữ số, không trùng', () => {
    expect(BANKS.length).toBeGreaterThanOrEqual(20);
    for (const b of BANKS) expect(b.bin).toMatch(/^\d{6}$/);
    expect(new Set(BANKS.map((b) => b.bin)).size).toBe(BANKS.length);
  });
});
