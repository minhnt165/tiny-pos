import { z } from 'zod';
import { MAX_LABELS } from '../labels.js';
import { optionalId } from './order.js';

export const labelPrintInputSchema = z
  .object({
    items: z
      .array(z.object({ productId: z.number().int().positive(), unitId: optionalId, copies: z.number().int().min(1).max(MAX_LABELS) }))
      .min(1, 'chưa chọn tem nào'),
  })
  .refine((v) => v.items.reduce((s, i) => s + i.copies, 0) <= MAX_LABELS, { message: `tối đa ${MAX_LABELS} tem mỗi lần` });
export type LabelPrintInput = z.output<typeof labelPrintInputSchema>;
export type LabelPrintInputBody = z.input<typeof labelPrintInputSchema>;
