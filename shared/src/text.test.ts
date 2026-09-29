import { describe, expect, it } from 'vitest';
import { stripDiacritics, toBankName } from './text.js';

describe('text', () => {
  it('bỏ dấu tiếng Việt, kể cả đ/Đ', () => {
    expect(stripDiacritics('Đường Nguyễn Huệ')).toBe('Duong Nguyen Hue');
  });
  it('tên chủ tài khoản: in hoa, không dấu, gộp khoảng trắng', () => {
    expect(toBankName('  nguyễn văn   an ')).toBe('NGUYEN VAN AN');
    expect(toBankName('Trần Thị B.')).toBe('TRAN THI B');
  });
});
