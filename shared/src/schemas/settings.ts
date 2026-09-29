import { z } from 'zod';
import { toBankName } from '../text.js';

const text = (max: number, fallback = '') => z.string().trim().max(max).default(fallback);

/** Cài đặt cửa hàng; PUT gửi đủ object, trường thiếu nhận mặc định. */
export const settingsInputSchema = z.object({
  storeName: z.string().trim().min(1).max(100).default('Tạp hóa'),
  storeAddress: text(200),
  storePhone: text(20),
  receiptFooter: text(200, 'Cảm ơn quý khách!'),
  bankBin: z
    .string()
    .trim()
    .regex(/^(\d{6})?$/, 'gồm 6 chữ số')
    .default(''),
  bankAccount: z
    .string()
    .trim()
    .regex(/^\d{0,19}$/, 'chỉ gồm chữ số')
    .default(''),
  bankAccountName: z.string().max(50).transform(toBankName).default(''),
  autoPrint: z.boolean().default(true),
});
export type Settings = z.output<typeof settingsInputSchema>;

export const SETTINGS_DEFAULTS: Settings = settingsInputSchema.parse({});
