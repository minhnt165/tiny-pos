import { z } from 'zod';

/** Một dòng trả: dòng hóa đơn gốc, số lượng theo đơn vị lúc bán. */
export const returnItemInputSchema = z.object({
  orderItemId: z.number().int().positive(),
  qty: z.number().positive().max(100_000),
  /** Cộng lại tồn; món ngoài luôn bỏ qua. */
  restock: z.boolean().default(true),
});

export const returnInputSchema = z.object({
  orderId: z.number().int().positive(),
  items: z.array(returnItemInputSchema).min(1, 'chưa chọn món nào để trả'),
  note: z
    .string()
    .trim()
    .max(200)
    .nullish()
    .transform((v) => v || null),
});
export type ReturnInput = z.output<typeof returnInputSchema>;
/** Kiểu body client gửi lên (trước khi zod điền mặc định). */
export type ReturnInputBody = z.input<typeof returnInputSchema>;
