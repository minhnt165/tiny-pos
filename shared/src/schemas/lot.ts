import { z } from 'zod';
import type { LotState } from '../types.js';
import { nullableText } from './common.js';

export const LOT_STATES = ['ok', 'expiring', 'expired', 'empty'] as const satisfies readonly LotState[];

/** Bỏ hàng hết hạn: trừ hết số còn của lô, ghi chú tùy chọn. */
export const lotDisposeSchema = z.object({ note: nullableText(200) });
export type LotDispose = z.output<typeof lotDisposeSchema>;
