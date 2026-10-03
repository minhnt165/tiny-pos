import { describe, expect, it } from 'vitest';
import { deviceNameSchema, pairInputSchema } from './device.js';

describe('pairInputSchema', () => {
  it('bỏ khoảng trắng: "123 456", " 123456 "', () => {
    expect(pairInputSchema.parse({ code: '123 456' })).toEqual({ code: '123456' });
    expect(pairInputSchema.parse({ code: ' 123456 ' }).code).toBe('123456');
  });

  it('không đúng 6 chữ số → lỗi tại code', () => {
    for (const code of ['12345', '1234567', '12a456', ''])
      expect(pairInputSchema.safeParse({ code }).error?.issues[0]?.path).toEqual(['code']);
  });
});

describe('deviceNameSchema', () => {
  it('trim; rỗng hoặc dài hơn 50 ký tự → lỗi', () => {
    expect(deviceNameSchema.parse({ name: '  Máy chị Lan ' }).name).toBe('Máy chị Lan');
    expect(deviceNameSchema.safeParse({ name: '   ' }).success).toBe(false);
    expect(deviceNameSchema.safeParse({ name: 'x'.repeat(51) }).success).toBe(false);
    expect(deviceNameSchema.safeParse({ name: 'x'.repeat(50) }).success).toBe(true);
  });
});
