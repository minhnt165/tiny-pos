import { z } from 'zod';
import { nullableText } from './common.js';

export const stocktakeInputSchema = z.object({ note: nullableText(200) });
export type StocktakeInput = z.output<typeof stocktakeInputSchema>;

/** Số đếm theo đơn vị gốc; hàng cân được số lẻ. */
export const stocktakeCountSchema = z.object({ counted: z.number().min(0).max(1_000_000) });
export type StocktakeCount = z.output<typeof stocktakeCountSchema>;

export const stocktakeListQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) });
export type StocktakeListQuery = z.output<typeof stocktakeListQuerySchema>;

export const movementListQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(500).default(100) });
export type MovementListQuery = z.output<typeof movementListQuerySchema>;
