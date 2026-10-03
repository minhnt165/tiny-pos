import type { Request, RequestHandler, Response } from 'express';
import { DEVICE_COOKIE, type DeviceStatus } from '@tiny-pos/shared';
import { HttpError } from '../errors.js';
import type { DevicesService } from '../services/devices.js';

export type IsCounter = (req: Request) => boolean;

const TEN_YEARS_MS = 10 * 365 * 24 * 3600 * 1000;
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
/** Máy chưa ghép vẫn gọi được: hỏi trạng thái và gửi mã ghép. */
const PUBLIC = new Set(['/api/device', '/api/device/pair']);

/** Host bỏ cổng, chữ thường: "LOCALHOST:3000" → "localhost", "[::1]:3000" → "[::1]". */
function hostName(host: string | undefined): string {
  const h = (host ?? '').toLowerCase();
  return h.startsWith('[') ? h.slice(0, h.indexOf(']') + 1) : h.split(':')[0]!;
}

/** Request từ chính máy quầy: địa chỉ loopback (không giả được qua TCP) và Host là localhost (chặn DNS rebinding). */
export const isCounterRequest: IsCounter = (req) =>
  LOOPBACK.has(req.socket.remoteAddress ?? '') && LOCAL_HOSTS.has(hostName(req.headers.host));

/** Giá trị cookie `name` trong header Cookie; mã hóa hỏng thì coi như không có. */
export function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0 || part.slice(0, i).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Đặt cookie thiết bị. Không Secure: app chạy HTTP trong LAN; Lax chặn trang khác gửi request ghi kèm cookie.
 * Chrome/Edge cắt hạn còn 400 ngày nên gate đặt lại mỗi ngày đầu tiên thiết bị được dùng (gia hạn trượt).
 */
export function setDeviceCookie(res: Response, token: string): void {
  res.cookie(DEVICE_COOKIE, token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: TEN_YEARS_MS });
}

/** Đặt trước /api và /images: máy quầy và thiết bị đã ghép đi tiếp, còn lại 401 (trừ PUBLIC). Ghi `res.locals.device`. */
export function deviceGate(devices: DevicesService, isCounter: IsCounter): RequestHandler {
  return (req, res, next) => {
    let status: DeviceStatus;
    if (isCounter(req)) status = { kind: 'counter' };
    else {
      const token = readCookie(req.headers.cookie, DEVICE_COOKIE) ?? '';
      const v = devices.verify(token);
      if (v?.renew) setDeviceCookie(res, token);
      status = v ? { kind: 'paired', device: { id: v.device.id, name: v.device.name } } : { kind: 'unpaired' };
    }
    res.locals['device'] = status;
    if (status.kind !== 'unpaired' || PUBLIC.has(req.originalUrl.split('?')[0]!)) return next();
    res.status(401).json({ error: 'Thiết bị chưa được ghép', code: 'DEVICE_NOT_PAIRED' });
  };
}

/** Chỉ máy quầy: tạo mã ghép, xem, đổi tên, gỡ thiết bị. */
export const counterOnly: RequestHandler = (_req, res, next) =>
  next((res.locals['device'] as DeviceStatus | undefined)?.kind === 'counter' ? undefined : new HttpError(403, 'Chỉ thao tác được trên máy quầy'));
