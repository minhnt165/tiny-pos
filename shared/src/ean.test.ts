import { describe, expect, it } from 'vitest';
import { barcodeFormat, eanCheckDigit, internalEan13, internalSeq, isValidEan13, isValidEan8 } from './ean.js';

describe('số kiểm tra EAN', () => {
  it('đúng với mã EAN-13 và EAN-8 thật', () => {
    expect(eanCheckDigit('400638133393')).toBe(1);
    expect(isValidEan13('4006381333931')).toBe(true);
    expect(isValidEan13('4006381333932')).toBe(false);
    expect(isValidEan8('96385074')).toBe(true);
    expect(isValidEan8('96385075')).toBe(false);
  });

  it('chỉ nhận đúng 12 chữ số', () => {
    expect(() => eanCheckDigit('12345')).toThrow();
    expect(() => eanCheckDigit('40063813339a')).toThrow();
  });
});

describe('mã nội bộ 20…', () => {
  it('đệm 10 chữ số, thêm số kiểm tra, hợp lệ EAN-13', () => {
    expect(internalEan13(1)).toBe('2000000000015');
    expect(internalEan13(4)).toBe('2000000000046');
    expect(isValidEan13(internalEan13(9_999_999_999))).toBe(true);
    expect(() => internalEan13(0)).toThrow();
    expect(() => internalEan13(10_000_000_000)).toThrow();
  });

  it('đọc lại số thứ tự; mã ngoài dải, sai số kiểm tra hoặc sai độ dài trả null', () => {
    expect(internalSeq('2000000000046')).toBe(4);
    expect(internalSeq('2000000000047')).toBeNull();
    expect(internalSeq('8934567890128')).toBeNull();
    expect(internalSeq('200000000004')).toBeNull();
  });
});

describe('barcodeFormat', () => {
  it('EAN-13 / EAN-8 hợp lệ, còn lại CODE128', () => {
    expect(barcodeFormat('4006381333931')).toBe('EAN13');
    expect(barcodeFormat('96385074')).toBe('EAN8');
    expect(barcodeFormat('4006381333932')).toBe('CODE128');
    expect(barcodeFormat('SP-001')).toBe('CODE128');
  });

  it('mã có chữ có dấu hoặc rỗng thì không vẽ được vạch (null)', () => {
    expect(barcodeFormat('Bánh01')).toBeNull();
    expect(barcodeFormat('')).toBeNull();
  });
});
