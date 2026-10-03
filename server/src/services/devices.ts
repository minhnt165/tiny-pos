import { createHash, randomBytes, randomInt } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { PAIRING_MAX_FAILURES, PAIRING_TTL_MS, localDate, type Device, type PairingInfo } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { devices } from '../db/schema.js';
import { BadRequestError, NotFoundError } from '../errors.js';
import { resolveClock, type Clock } from './daily-code.js';

export interface DevicesService {
  /** Mã 6 số mới, ghi đè mã cũ (mỗi lúc chỉ một mã). */
  startPairing(): PairingInfo;
  /** Đúng mã → tạo thiết bị, trả token gốc một lần để route đặt cookie. */
  pair(code: string, userAgent: string | undefined): { token: string; device: Device };
  /** Token trong cookie → thiết bị; ghi last_seen_on khi sang ngày mới. `renew` = lần dùng đầu tiên trong ngày → gate gia hạn cookie. */
  verify(token: string): { device: Device; renew: boolean } | null;
  list(): Device[];
  rename(id: number, name: string): Device;
  revoke(id: number): void;
}

const NO_PAIRING = 'Chưa có mã ghép đang mở, hãy tạo mã trên máy quầy';
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const toDevice = (r: typeof devices.$inferSelect): Device => ({ id: r.id, name: r.name, createdAt: r.createdAt, lastSeenOn: r.lastSeenOn });

/** "iPhone · Safari" từ User-Agent để chủ tiệm nhận ra máy; không nhận ra thì "Thiết bị". iPhone kiểm trước Mac vì UA iPhone có "like Mac OS X". */
export function deviceNameFromUa(ua: string | undefined): string {
  const s = ua ?? '';
  const os = /iPhone/.test(s)
    ? 'iPhone'
    : /iPad/.test(s)
      ? 'iPad'
      : /Android/.test(s)
        ? 'Android'
        : /Windows/.test(s)
          ? 'Windows'
          : /Macintosh|Mac OS X/.test(s)
            ? 'Mac'
            : null;
  const browser = /Edg(A|iOS)?\//.test(s)
    ? 'Edge'
    : /Firefox\/|FxiOS\//.test(s)
      ? 'Firefox'
      : /Chrome\/|CriOS\//.test(s)
        ? 'Chrome'
        : /Safari\//.test(s)
          ? 'Safari'
          : null;
  if (os && browser) return `${os} · ${browser}`;
  return os ?? browser ?? 'Thiết bị';
}

/**
 * Ghép thiết bị trong LAN. Mã ghép chỉ ở bộ nhớ (server khởi động lại là mất, máy quầy tạo lại);
 * token gốc chỉ nằm trong cookie của thiết bị, DB giữ SHA-256.
 */
export function createDevicesService(db: Db, opts: { lanUrl: () => string; clock?: Clock }): DevicesService {
  let pairing: { code: string; expiresAt: number; failures: number } | null = null;
  const clock = () => resolveClock(opts.clock);
  const row = (id: number) => {
    const r = db.select().from(devices).where(eq(devices.id, id)).get();
    if (!r) throw new NotFoundError('Không tìm thấy thiết bị');
    return r;
  };

  return {
    startPairing() {
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      pairing = { code, expiresAt: clock().now.getTime() + PAIRING_TTL_MS, failures: 0 };
      return { code, url: `${opts.lanUrl()}/pair?code=${code}`, expiresAt: new Date(pairing.expiresAt).toISOString() };
    },

    pair(code, userAgent) {
      const p = pairing;
      if (!p || clock().now.getTime() >= p.expiresAt) {
        pairing = null;
        throw new BadRequestError(NO_PAIRING);
      }
      if (code !== p.code) {
        p.failures++;
        const left = PAIRING_MAX_FAILURES - p.failures;
        if (left > 0) throw new BadRequestError(`Mã không đúng, còn ${left} lần thử`);
        pairing = null;
        throw new BadRequestError('Mã đã hết hiệu lực, tạo mã mới trên máy quầy');
      }
      pairing = null;
      const token = randomBytes(32).toString('base64url');
      const r = db.insert(devices).values({ name: deviceNameFromUa(userAgent), tokenHash: hash(token) }).returning().get();
      return { token, device: toDevice(r) };
    },

    verify(token) {
      if (!token) return null;
      const r = db.select().from(devices).where(eq(devices.tokenHash, hash(token))).get();
      if (!r) return null;
      const { now, tz } = clock();
      const day = localDate(now, tz);
      // Mỗi lần ghi DB làm Xem từ xa đẩy lại → chỉ ghi khi sang ngày mới
      const renew = r.lastSeenOn !== day;
      if (renew) {
        db.update(devices).set({ lastSeenOn: day }).where(eq(devices.id, r.id)).run();
        r.lastSeenOn = day;
      }
      return { device: toDevice(r), renew };
    },

    list: () => db.select().from(devices).orderBy(devices.id).all().map(toDevice),

    rename(id, name) {
      row(id);
      return toDevice(db.update(devices).set({ name }).where(eq(devices.id, id)).returning().get()!);
    },

    revoke(id) {
      row(id);
      db.delete(devices).where(eq(devices.id, id)).run();
    },
  };
}
