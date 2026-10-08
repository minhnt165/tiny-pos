import { z } from 'zod';
import { nullableText } from './common.js';
import { MAX_MONEY, optionalId } from './order.js';

/** Một dòng trả NCC: số lượng và giá trả theo đơn vị đã chọn (gốc hoặc thùng/lốc). */
export const supplierReturnItemInputSchema = z.object({
  productId: z.number().int().positive(),
  unitId: optionalId,
  qty: z.number().positive().max(100_000),
  unitPrice: z.number().int().min(0).max(MAX_MONEY),
  /** Lô muốn trừ; null = tự động (hết hạn sớm trước). */
  lotId: optionalId,
});

export const supplierReturnInputSchema = z.object({
  supplierId: z.number().int().positive(),
  note: nullableText(200),
  items: z.array(supplierReturnItemInputSchema).min(1, 'chưa chọn món nào để trả'),
});
export type SupplierReturnInput = z.output<typeof supplierReturnInputSchema>;
export type SupplierReturnInputBody = z.input<typeof supplierReturnInputSchema>;
