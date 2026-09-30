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
  paymentMethod: z.enum(['cash', 'transfer', 'debt']),
  /** Chỉ dùng khi ghi nợ; đơn tiền mặt/chuyển khoản bỏ qua. */
  customerId: optionalId,
  paid: z.number().int().min(0).max(MAX_MONEY).default(0),
});
export type OrderInput = z.output<typeof orderInputSchema>;
/** Kiểu body client gửi lên (trước khi zod điền mặc định). */
export type OrderInputBody = z.input<typeof orderInputSchema>;
