import { z } from 'zod';

/** Số email tối đa được xem từ xa (một tiệm: chủ và vài người nhà). */
export const REMOTE_MAX_EMAILS = 5;
/** Quá khoảng này chưa có bản đẩy mới thì trang xem cảnh báo máy quầy có thể đang tắt / mất mạng. */
export const REMOTE_STALE_MS = 10 * 60_000;
/** Server đẩy lại dù DB không đổi sau khoảng này (nhịp tim), để vắng khách không bị báo nhầm là máy tắt. Phải < REMOTE_STALE_MS. */
export const REMOTE_HEARTBEAT_MS = 5 * 60_000;

const email = z.email();

/**
 * PUT /api/remote. Email trim + chữ thường (token Google trả chữ thường), trùng sau chuẩn hóa thì bỏ bớt.
 * Kiểm định dạng ở mức mảng để lỗi nằm ở path `emails` (có nhãn), không phải `emails.0`.
 */
export const remoteConfigInputSchema = z.object({
  enabled: z.boolean(),
  emails: z
    .array(z.string().trim().toLowerCase())
    .max(REMOTE_MAX_EMAILS, `tối đa ${REMOTE_MAX_EMAILS} email`)
    .refine((a) => a.every((e) => email.safeParse(e).success), 'có địa chỉ không hợp lệ')
    .transform((a) => [...new Set(a)]),
});
export type RemoteConfigInput = z.output<typeof remoteConfigInputSchema>;
