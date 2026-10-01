import { z } from 'zod';
import { datePresetRange } from '../local-date.js';
import type { ProductReportSort } from '../types.js';
import { isoDate, rangeError, resolveRange, spanDays } from './list-filters.js';

export const REPORT_TABS = ['profit', 'products', 'debt'] as const;
export type ReportTab = (typeof REPORT_TABS)[number];
export const PRODUCT_REPORT_SORTS = ['revenue', 'qty', 'profit'] as const satisfies readonly ProductReportSort[];
/** Khoảng dài hơn số ngày này thì gom theo tháng. */
export const REPORT_DAY_GROUP_MAX = 31;

export const reportRangeFields = { from: isoDate.optional(), to: isoDate.optional() };

/** z.object + kiểm tra khoảng from/to như các danh sách chứng từ (lỗi gắn ở gốc, không có nhãn trường). */
const withRangeCheck = <T extends z.ZodRawShape>(shape: T) =>
  z.object(shape).superRefine((q, ctx) => {
    const message = rangeError(q as { from?: string; to?: string });
    if (message) ctx.addIssue({ code: 'custom', message });
  });

export const reportQuerySchema = withRangeCheck(reportRangeFields);
export type ReportQuery = z.output<typeof reportQuerySchema>;

export const productReportQuerySchema = withRangeCheck({ ...reportRangeFields, sort: z.enum(PRODUCT_REPORT_SORTS).default('revenue') });
export type ProductReportQuery = z.output<typeof productReportQuerySchema>;

/** Khóa URL của trang Báo cáo (chỉ client đọc/ghi; server bỏ qua tab). */
export const reportViewFields = {
  ...reportRangeFields,
  tab: z.enum(REPORT_TABS).default('profit'),
  sort: z.enum(PRODUCT_REPORT_SORTS).default('revenue'),
};

/** Khoảng của báo cáo: có from/to thì như danh sách chứng từ, không có thì tháng này (tới hôm nay). */
export function resolveReportRange(q: { from?: string; to?: string }, today: string): { from: string; to: string } {
  return q.from || q.to ? resolveRange(q, today) : datePresetRange('thisMonth', today);
}

export function reportGroupBy(from: string, to: string): 'day' | 'month' {
  return spanDays(from, to) <= REPORT_DAY_GROUP_MAX ? 'day' : 'month';
}
