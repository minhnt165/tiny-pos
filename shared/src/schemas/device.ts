import { z } from 'zod';

/** Mã ghép hết hạn sau khoảng này kể từ lúc máy quầy tạo. */
export const PAIRING_TTL_MS = 5 * 60_000;
/** Gõ sai đủ số lần này thì mã bị hủy, máy quầy phải tạo mã mới. */
export const PAIRING_MAX_FAILURES = 5;
/** Tên cookie giữ token của thiết bị đã ghép (HttpOnly, server đặt). */
export const DEVICE_COOKIE = 'tp_device';

/** POST /api/device/pair. Bỏ mọi khoảng trắng trước khi kiểm để "123 456" (dán, đọc qua điện thoại) vẫn hợp lệ. */
export const pairInputSchema = z.object({
  code: z
    .string()
    .transform((s) => s.replace(/\s/g, ''))
    .pipe(z.string().regex(/^\d{6}$/, 'gồm 6 chữ số')),
});
export type PairInput = z.output<typeof pairInputSchema>;

/** PATCH /api/devices/:id. */
export const deviceNameSchema = z.object({ name: z.string().trim().min(1).max(50) });
export type DeviceNameInput = z.output<typeof deviceNameSchema>;
