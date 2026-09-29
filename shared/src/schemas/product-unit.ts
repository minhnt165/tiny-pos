import { z } from 'zod';
import { nullableText } from './common.js';

export const productUnitInputSchema = z.object({
  name: z.string().trim().min(1).max(20),
  barcode: nullableText(50),
  factor: z.number().positive(),
  sellPrice: z.number().int().min(0),
});
export type ProductUnitInput = z.infer<typeof productUnitInputSchema>;
