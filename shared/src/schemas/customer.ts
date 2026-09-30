import { z } from 'zod';
import { nullableText } from './common.js';
import { MAX_MONEY } from './order.js';

export const customerInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  phone: nullableText(20),
  note: nullableText(200),
});
export type CustomerInput = z.output<typeof customerInputSchema>;
export type CustomerInputBody = z.input<typeof customerInputSchema>;

/** Tạo khách kèm nợ đầu kỳ (chuyển từ sổ giấy). */
export const customerCreateSchema = customerInputSchema.extend({
  openingDebt: z.number().int().min(0).max(MAX_MONEY).default(0),
});
export type CustomerCreate = z.output<typeof customerCreateSchema>;
export type CustomerCreateBody = z.input<typeof customerCreateSchema>;

export const customerPaymentSchema = z.object({
  amount: z.number().int().positive().max(MAX_MONEY),
  method: z.enum(['cash', 'transfer']),
  note: nullableText(200),
});
export type CustomerPayment = z.output<typeof customerPaymentSchema>;
export type CustomerPaymentBody = z.input<typeof customerPaymentSchema>;

/** Ghi nợ tay: dùng khi quên ghi hoặc sửa thu nhầm, nên bắt buộc ghi chú. */
export const customerAdjustmentSchema = z.object({
  amount: z.number().int().positive().max(MAX_MONEY),
  note: z.string().trim().min(1).max(200),
});
export type CustomerAdjustment = z.output<typeof customerAdjustmentSchema>;
export type CustomerAdjustmentBody = z.input<typeof customerAdjustmentSchema>;
