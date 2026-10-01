import { z } from 'zod';

/** Giới hạn chung của danh sách chứng từ. */
export const MAX_RANGE_DAYS = 366;
export const PAGE_SIZE = 50;
/** Số chứng từ tối đa trong một file xuất Excel. */
export const MAX_EXPORT_ROWS = 20_000;
export const PAY_METHODS = ['cash', 'transfer', 'debt'] as const;
export const DOC_STATUSES = ['done', 'cancelled'] as const;
export type PayMethod = (typeof PAY_METHODS)[number];
export type DocStatus = (typeof DOC_STATUSES)[number];

const DAY = 86_400_000;

/** Ngày "YYYY-MM-DD" có thật (2026-02-30 bị từ chối). */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'phải có dạng YYYY-MM-DD')
  .refine((d) => {
    const t = Date.parse(`${d}T00:00:00Z`);
    return !Number.isNaN(t) && new Date(t).toISOString().startsWith(d);
  }, 'không phải ngày hợp lệ');

/** Số ngày của khoảng [from, to], tính cả hai đầu. */
export const spanDays = (from: string, to: string) => (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY + 1;

export function validRange(from: string, to: string): boolean {
  return from <= to && spanDays(from, to) <= MAX_RANGE_DAYS;
}

/** Khoảng ngày thật: from/to thắng date cũ; chỉ có một đầu thì hai đầu bằng nhau; không có gì thì hôm nay. */
export function resolveRange(q: { from?: string; to?: string; date?: string }, today: string): { from: string; to: string } {
  const from = q.from ?? q.to ?? q.date ?? today;
  const to = q.to ?? q.from ?? q.date ?? today;
  return { from, to };
}

/** Chuỗi "a,b" → mảng giá trị hợp lệ, bỏ trùng; rỗng → không lọc. */
function csvEnum<T extends string>(values: readonly [T, ...T[]]) {
  return z.preprocess(
    (v) => {
      if (v === undefined || v === null || v === '') return undefined;
      const parts = (Array.isArray(v) ? v : String(v).split(',')).map((s) => String(s).trim()).filter(Boolean);
      return parts.length ? [...new Set(parts)] : undefined;
    },
    z.array(z.enum(values)).optional(),
  );
}

/** Cờ trên URL: '1'/'true' là bật. */
const flag = z
  .enum(['1', '0', 'true', 'false'])
  .optional()
  .transform((v) => v === '1' || v === 'true');

const search = z
  .string()
  .trim()
  .max(100)
  .optional()
  .transform((v) => (v ? v : undefined));
const page = z.coerce.number().int().min(1).default(1);
const positiveId = z.coerce.number().int().positive().optional();

const rangeFields = { from: isoDate.optional(), to: isoDate.optional(), date: isoDate.optional() };

/** Lỗi của khoảng from/to (nếu có); gắn vào gốc (path rỗng) để thông báo không bị thêm nhãn trường. */
export function rangeError(q: { from?: string; to?: string; date?: string }): string | undefined {
  if (!q.from && !q.to) return undefined;
  const { from, to } = resolveRange(q, q.from ?? q.to!);
  if (from > to) return 'Ngày bắt đầu phải trước ngày kết thúc';
  if (spanDays(from, to) > MAX_RANGE_DAYS) return 'Khoảng ngày tối đa 1 năm';
  return undefined;
}

export const orderListFields = {
  ...rangeFields,
  q: search,
  pay: csvEnum(PAY_METHODS),
  status: csvEnum(DOC_STATUSES),
  customerId: positiveId,
  page,
};
export const orderListQuerySchema = z.object(orderListFields).superRefine((q, ctx) => {
  const message = rangeError(q);
  if (message) ctx.addIssue({ code: 'custom', message });
});
export type OrderListQuery = z.output<typeof orderListQuerySchema>;

export const importListFields = {
  ...rangeFields,
  q: search,
  status: csvEnum(DOC_STATUSES),
  supplierId: z.union([z.literal('none'), z.coerce.number().int().positive()]).optional(),
  unpaid: flag,
  page,
};
export const importListQuerySchema = z.object(importListFields).superRefine((q, ctx) => {
  const message = rangeError(q);
  if (message) ctx.addIssue({ code: 'custom', message });
});
export type ImportListQuery = z.output<typeof importListQuerySchema>;

export const returnListFields = { ...rangeFields, q: search, status: csvEnum(DOC_STATUSES), page };
export const returnListQuerySchema = z.object(returnListFields).superRefine((q, ctx) => {
  const message = rangeError(q);
  if (message) ctx.addIssue({ code: 'custom', message });
});
export type ReturnListQuery = z.output<typeof returnListQuerySchema>;

export const partyListQuerySchema = z.object({ q: search, includeInactive: flag });
export type PartyListQuery = z.output<typeof partyListQuerySchema>;

// Lọc phía trình duyệt: chỉ dùng để đọc/ghi URL, không gửi lên server
export const STOCK_FILTERS = ['low', 'out', 'negative'] as const;
export const PRODUCT_SORTS = ['name', 'price-asc', 'price-desc', 'stock-asc', 'stock-desc', 'value-desc'] as const;
const money = z.coerce.number().int().min(0).optional();
export const productViewFields = {
  q: search,
  categoryId: positiveId,
  includeInactive: flag,
  stock: z.enum(STOCK_FILTERS).optional(),
  weighed: flag,
  noBarcode: flag,
  priceMin: money,
  priceMax: money,
  sort: z.enum(PRODUCT_SORTS).default('name'),
  page,
};
export type ProductView = z.output<z.ZodObject<typeof productViewFields>>;
/** Query của route xuất Excel sản phẩm: cùng khóa URL với trang (page bị bỏ qua). */
export const productViewQuerySchema = z.object(productViewFields);

export const PARTY_SORTS = ['name', 'debt-desc', 'recent'] as const;
export const partyViewFields = { q: search, debtOnly: flag, includeInactive: flag, sort: z.enum(PARTY_SORTS).default('name') };
export type PartyView = z.output<z.ZodObject<typeof partyViewFields>>;
export const partyViewQuerySchema = z.object(partyViewFields);
