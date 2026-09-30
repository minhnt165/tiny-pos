import { z } from 'zod';
import { nullableText } from './common.js';
import { MAX_MONEY } from './order.js';

export const supplierInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  phone: nullableText(20),
  note: nullableText(200),
});
export type SupplierInput = z.output<typeof supplierInputSchema>;
export type SupplierInputBody = z.input<typeof supplierInputSchema>;

export const supplierPaymentSchema = z.object({
  amount: z.number().int().positive().max(MAX_MONEY),
  note: nullableText(200),
});
export type SupplierPayment = z.output<typeof supplierPaymentSchema>;
export type SupplierPaymentBody = z.input<typeof supplierPaymentSchema>;
