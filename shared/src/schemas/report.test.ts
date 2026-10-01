import { describe, expect, it } from 'vitest';
import { daysBetween, formatMonthVn, monthsBetween } from '../local-date.js';
import { productReportQuerySchema, reportGroupBy, reportQuerySchema, reportViewFields, resolveReportRange } from './report.js';

describe('reportQuerySchema', () => {
  it('nhận from/to, bỏ khóa lạ (tab của trang), rỗng thì rỗng', () => {
    expect(reportQuerySchema.parse({ from: '2026-09-01', to: '2026-09-30', tab: 'profit' })).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(reportQuerySchema.parse({})).toEqual({});
  });
  it('báo lỗi khoảng đảo và quá 1 năm bằng tiếng Việt', () => {
    expect(() => reportQuerySchema.parse({ from: '2026-09-30', to: '2026-09-01' })).toThrow('Ngày bắt đầu phải trước ngày kết thúc');
    expect(() => reportQuerySchema.parse({ from: '2025-01-01', to: '2026-09-01' })).toThrow('Khoảng ngày tối đa 1 năm');
    expect(() => reportQuerySchema.parse({ from: '2026-02-30' })).toThrow('không phải ngày hợp lệ');
  });
  it('productReportQuerySchema: sort mặc định revenue, giá trị lạ → lỗi', () => {
    expect(productReportQuerySchema.parse({})).toEqual({ sort: 'revenue' });
    expect(productReportQuerySchema.parse({ sort: 'qty', from: '2026-09-01' })).toEqual({ sort: 'qty', from: '2026-09-01' });
    expect(() => productReportQuerySchema.parse({ sort: 'name' })).toThrow();
  });
  it('reportViewFields: tab mặc định profit, sort mặc định revenue', () => {
    expect(reportViewFields.tab.parse(undefined)).toBe('profit');
    expect(reportViewFields.sort.parse(undefined)).toBe('revenue');
    expect(reportViewFields.tab.safeParse('xyz').success).toBe(false);
  });
});

describe('resolveReportRange', () => {
  const today = '2026-09-29';
  it('không có from/to → tháng này, kết thúc hôm nay (không phải cuối tháng)', () => {
    expect(resolveReportRange({}, today)).toEqual({ from: '2026-09-01', to: '2026-09-29' });
  });
  it('có một đầu → hai đầu bằng nhau; có cả hai → giữ nguyên', () => {
    expect(resolveReportRange({ from: '2026-09-10' }, today)).toEqual({ from: '2026-09-10', to: '2026-09-10' });
    expect(resolveReportRange({ from: '2026-08-01', to: '2026-08-31' }, today)).toEqual({ from: '2026-08-01', to: '2026-08-31' });
  });
});

describe('reportGroupBy', () => {
  it('31 ngày gom theo ngày, 32 ngày gom theo tháng', () => {
    expect(reportGroupBy('2026-09-01', '2026-10-01')).toBe('day');
    expect(reportGroupBy('2026-08-31', '2026-10-01')).toBe('month');
    expect(reportGroupBy('2026-09-29', '2026-09-29')).toBe('day');
  });
});

describe('daysBetween / monthsBetween / formatMonthVn', () => {
  it('liệt kê đủ hai đầu, qua tháng và qua năm', () => {
    expect(daysBetween('2026-09-29', '2026-10-02')).toEqual(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);
    expect(daysBetween('2026-09-29', '2026-09-29')).toEqual(['2026-09-29']);
    expect(monthsBetween('2025-11-15', '2026-02-03')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(monthsBetween('2026-09-01', '2026-09-30')).toEqual(['2026-09']);
    expect(formatMonthVn('2026-09')).toBe('Tháng 09/2026');
  });
});
