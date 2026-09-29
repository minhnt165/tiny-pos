import { z } from 'zod';
import { nullableText } from './common.js';

export const productInputSchema = z.object({
  barcode: nullableText(50),
  name: z.string().trim().min(1).max(200),
  unit: z.string().trim().min(1).max(20).default('cái'),
  costPrice: z.number().int().min(0).default(0),
  sellPrice: z.number().int().min(0).default(0),
  stock: z.number().min(0).default(0),
  isWeighed: z.boolean().default(false),
  categoryId: z
    .number()
    .int()
    .positive()
    .nullish()
    .transform((v) => v ?? null),
  minStock: z.number().min(0).default(0),
});
export type ProductInput = z.infer<typeof productInputSchema>;

const flag = z
  .enum(['1', '0', 'true', 'false'])
  .optional()
  .transform((v) => v === '1' || v === 'true');

export const productListQuerySchema = z.object({
  q: z.string().trim().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  includeInactive: flag,
});
export type ProductListQuery = z.infer<typeof productListQuerySchema>;
