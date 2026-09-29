import { z } from 'zod';

const optionalId = z
  .number()
  .int()
  .positive()
  .nullish()
  .transform((v) => v ?? null);

/** Một dòng giỏ: có productId là hàng trong kho, không có là món ngoài (chỉ tên + giá). */
export const orderItemInputSchema = z.object({
  productId: optionalId,
  unitId: optionalId,
  name: z.string().trim().max(100).default(''),
  qty: z.number().positive().max(100_000),
  price: z.number().int().min(0),
});

export const orderInputSchema = z.object({
  items: z.array(orderItemInputSchema).min(1, 'chưa có món nào'),
  discount: z.number().int().min(0).default(0),
  paymentMethod: z.enum(['cash', 'transfer']),
  paid: z.number().int().min(0).default(0),
});
export type OrderInput = z.output<typeof orderInputSchema>;
/** Kiểu body client gửi lên (trước khi zod điền mặc định). */
export type OrderInputBody = z.input<typeof orderInputSchema>;

export const orderListQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'phải có dạng YYYY-MM-DD')
    .optional(),
});
export type OrderListQuery = z.infer<typeof orderListQuerySchema>;
