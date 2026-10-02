import { describe, expect, it } from 'vitest';
import { REMOTE_MAX_EMAILS, remoteConfigInputSchema } from './remote.js';

describe('remoteConfigInputSchema', () => {
  it('trim, chữ thường, bỏ trùng', () => {
    const r = remoteConfigInputSchema.parse({ enabled: true, emails: [' ChuTiem@Gmail.com ', 'chutiem@gmail.com', 'Vo@Example.vn'] });
    expect(r).toEqual({ enabled: true, emails: ['chutiem@gmail.com', 'vo@example.vn'] });
  });

  it('danh sách rỗng hợp lệ (bật mà chưa ai được xem)', () => {
    expect(remoteConfigInputSchema.parse({ enabled: true, emails: [] })).toEqual({ enabled: true, emails: [] });
  });

  it('email sai định dạng → lỗi tại emails', () => {
    const r = remoteConfigInputSchema.safeParse({ enabled: false, emails: ['khong-phai-email'] });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.path).toEqual(['emails']);
      expect(r.error.issues[0]?.message).toBe('có địa chỉ không hợp lệ');
    }
  });

  it(`quá ${REMOTE_MAX_EMAILS} email → lỗi`, () => {
    const emails = Array.from({ length: REMOTE_MAX_EMAILS + 1 }, (_, i) => `a${i}@x.vn`);
    expect(remoteConfigInputSchema.safeParse({ enabled: true, emails }).success).toBe(false);
  });

  it('thiếu enabled → lỗi', () => {
    expect(remoteConfigInputSchema.safeParse({ emails: [] }).success).toBe(false);
  });
});
