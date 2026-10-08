import { z } from 'zod';
import { nullableText } from './common.js';
import { isoDate } from './list-filters.js';
import { MAX_MONEY, optionalId } from './order.js';

const money = z.number().int().min(0).max(MAX_MONEY);

/** Một dòng phiếu nhập: số lượng và giá nhập theo đơn vị đã chọn (gốc hoặc thùng/lốc). */
export const importItemInputSchema = z.object({
  productId: z.number().int().positive(),
  unitId: optionalId,
  qty: z.number().positive().max(100_000),
  unitCost: money,
  /** Giá bán mới của đúng đơn vị này; null = không đổi. */
  sellPrice: money.nullish().transform((v) => v ?? null),
  /** Hạn dùng của lô, "YYYY-MM-DD"; null = không hạn. Không chặn ngày quá khứ. */
  expiresOn: isoDate.nullish().transform((v) => v ?? null),
});

export const importInputSchema = z.object({
  supplierId: optionalId,
  note: nullableText(200),
  paid: money,
  items: z.array(importItemInputSchema).min(1, 'chưa có món nào'),
});
export type ImportInput = z.output<typeof importInputSchema>;
export type ImportInputBody = z.input<typeof importInputSchema>;
