import { describe, expect, it } from 'vitest';
import { formatDateVn, localDate, localDayRange, shiftDate } from './local-date.js';

const VN = 420;

describe('localDate', () => {
  it('17:00 UTC là 0 giờ hôm sau ở VN', () => {
    expect(localDate(new Date('2026-09-28T17:00:00.000Z'), VN)).toBe('2026-09-29');
    expect(localDate(new Date('2026-09-28T16:59:59.999Z'), VN)).toBe('2026-09-28');
  });
});

describe('localDayRange', () => {
  it('khoảng UTC [start, end) của một ngày VN', () => {
    expect(localDayRange('2026-09-29', VN)).toEqual({
      start: '2026-09-28T17:00:00.000Z',
      end: '2026-09-29T17:00:00.000Z',
    });
  });
});

describe('shiftDate', () => {
  it('lùi/tiến qua tháng', () => {
    expect(shiftDate('2026-09-30', 1)).toBe('2026-10-01');
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('formatDateVn', () => {
  it('YYYY-MM-DD thành dd/mm/yyyy', () => {
    expect(formatDateVn('2026-09-30')).toBe('30/09/2026');
    expect(formatDateVn('2026-01-05')).toBe('05/01/2026');
  });
  it('chuỗi khác dạng thì trả nguyên', () => {
    expect(formatDateVn('')).toBe('');
    expect(formatDateVn('30/09/2026')).toBe('30/09/2026');
  });
});
