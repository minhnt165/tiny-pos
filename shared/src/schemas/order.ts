import { z } from 'zod';

export const optionalId = z
  .number()
  .int()
  .positive()
  .nullish()
  .transform((v) => v ?? null);

/** Trần cho giá/giảm giá/tiền khách đưa: chặn số vô lý do gõ nhầm hoặc máy quét bắn vào ô tiền. */
export const MAX_MONEY = 1_000_000_000;

/** Một dòng giỏ: có productId là hàng trong kho, không có là món ngoài (chỉ tên + giá). */
export const orderItemInputSchema = z.object({
  productId: optionalId,
  unitId: optionalId,
  name: z.string().trim().max(100).default(''),
  qty: z.number().positive().max(100_000),
  price: z.number().int().min(0).max(MAX_MONEY),
});

export const orderInputSchema = z.object({
  items: z.array(orderItemInputSchema).min(1, 'chưa có món nào'),
  discount: z.number().int().min(0).max(MAX_MONEY).default(0),
  paymentMethod: z.enum(['cash', 'transfer']),
  paid: z.number().int().min(0).max(MAX_MONEY).default(0),
});
export type OrderInput = z.output<typeof orderInputSchema>;
/** Kiểu body client gửi lên (trước khi zod điền mặc định). */
export type OrderInputBody = z.input<typeof orderInputSchema>;

export const orderListQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'phải có dạng YYYY-MM-DD')
    // Ngày phải có thật (2026-13-45 hay 2026-02-30 trả 400 thay vì làm hỏng localDayRange)
    .refine((d) => {
      const t = Date.parse(`${d}T00:00:00Z`);
      return !Number.isNaN(t) && new Date(t).toISOString().startsWith(d);
    }, 'không phải ngày hợp lệ')
    .optional(),
});
export type OrderListQuery = z.infer<typeof orderListQuerySchema>;
