import { describe, expect, it } from 'vitest';
import { datePresetRange, detectPreset, formatDateVn, formatRangeVn, localDate, localDayRange, shiftDate } from './local-date.js';

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

describe('datePresetRange', () => {
  it('các mốc tính từ hôm nay', () => {
    expect(datePresetRange('today', '2026-09-30')).toEqual({ from: '2026-09-30', to: '2026-09-30' });
    expect(datePresetRange('yesterday', '2026-10-01')).toEqual({ from: '2026-09-30', to: '2026-09-30' });
    expect(datePresetRange('last7', '2026-10-03')).toEqual({ from: '2026-09-27', to: '2026-10-03' });
    expect(datePresetRange('thisMonth', '2026-09-30')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(datePresetRange('lastMonth', '2026-03-15')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(datePresetRange('lastMonth', '2028-03-01')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(datePresetRange('lastMonth', '2027-01-10')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });
  it('detectPreset nhận ra mốc, không khớp thì null', () => {
    expect(detectPreset('2026-09-30', '2026-09-30', '2026-09-30')).toBe('today');
    expect(detectPreset('2026-09-01', '2026-09-30', '2026-09-30')).toBe('thisMonth');
    expect(detectPreset('2026-09-02', '2026-09-30', '2026-09-30')).toBeNull();
  });
  it('formatRangeVn: cùng năm hiện tại bỏ năm, khác năm thì ghi năm', () => {
    expect(formatRangeVn('2026-09-01', '2026-09-15', '2026-09-30')).toBe('01/09 – 15/09');
    expect(formatRangeVn('2026-09-15', '2026-09-15', '2026-09-30')).toBe('15/09');
    expect(formatRangeVn('2025-12-20', '2026-01-05', '2026-09-30')).toBe('20/12/2025 – 05/01/2026');
  });
});
