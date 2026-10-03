import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../db/test-db.js';
import type { Db } from '../db/connection.js';
import { NotFoundError } from '../errors.js';
import type { Clock } from './daily-code.js';
import { createDevicesService, deviceNameFromUa, type DevicesService } from './devices.js';

const T0 = new Date('2026-10-03T02:00:00.000Z'); // 09:00 giờ VN
const UA_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
let db: Db;
let clock: Clock;
let svc: DevicesService;
/** Dời đồng hồ đi `ms` kể từ T0 (service đọc clock.now mỗi lần gọi). */
const at = (ms: number) => {
  clock.now = new Date(T0.getTime() + ms);
};
const changes = () => (db.$client.prepare('select total_changes() as n').get() as { n: number }).n;
const pairOne = (ua: string | undefined = UA_IPHONE) => svc.pair(svc.startPairing().code, ua);

beforeEach(() => {
  db = createTestDb();
  clock = { now: T0, tzOffsetMin: 420 };
  svc = createDevicesService(db, { lanUrl: () => 'http://192.168.1.5:3000', clock });
});

describe('devices: mã ghép', () => {
  it('startPairing: 6 chữ số, hết hạn sau 5 phút, url LAN', () => {
    const p = svc.startPairing();
    expect(p.code).toMatch(/^\d{6}$/);
    expect(p.expiresAt).toBe('2026-10-03T02:05:00.000Z');
    expect(p.url).toBe(`http://192.168.1.5:3000/pair?code=${p.code}`);
  });

  it('đúng mã → thiết bị mới, token verify được; mã không dùng lại được', () => {
    const { code } = svc.startPairing();
    const { token, device } = svc.pair(code, UA_IPHONE);
    expect(device).toMatchObject({ name: 'iPhone · Safari', lastSeenOn: null });
    expect(token).toMatch(/^[\w-]{43}$/);
    expect(svc.verify(token)?.device.id).toBe(device.id);
    expect(() => svc.pair(code, UA_IPHONE)).toThrow('Chưa có mã ghép đang mở, hãy tạo mã trên máy quầy');
  });

  it('DB chỉ giữ SHA-256 của token', () => {
    const { token } = pairOne();
    const row = db.$client.prepare('select token_hash from devices').get() as { token_hash: string };
    expect(row.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.token_hash).not.toContain(token);
  });

  it('tạo mã mới → mã cũ thành mã sai', () => {
    const a = svc.startPairing().code;
    let b = svc.startPairing().code;
    while (b === a) b = svc.startPairing().code; // tránh trùng ngẫu nhiên 1/1.000.000
    expect(() => svc.pair(a, undefined)).toThrow(/^Mã không đúng/);
    expect(svc.pair(b, undefined).device.id).toBeGreaterThan(0);
  });

  it('4 phút 59 giây vẫn ghép được; đúng 5 phút thì hết hạn', () => {
    const { code } = svc.startPairing();
    at(5 * 60_000 - 1000);
    expect(svc.pair(code, undefined).device.id).toBeGreaterThan(0);
    const next = svc.startPairing(); // tạo lúc T0 + 4:59
    at(5 * 60_000 - 1000 + 5 * 60_000);
    expect(() => svc.pair(next.code, undefined)).toThrow('Chưa có mã ghép đang mở, hãy tạo mã trên máy quầy');
  });

  it('sai 5 lần → hủy mã; đúng mã sau đó cũng lỗi', () => {
    const { code } = svc.startPairing();
    const wrong = code === '000000' ? '111111' : '000000';
    for (const left of [4, 3, 2, 1]) expect(() => svc.pair(wrong, undefined)).toThrow(`Mã không đúng, còn ${left} lần thử`);
    expect(() => svc.pair(wrong, undefined)).toThrow('Mã đã hết hiệu lực, tạo mã mới trên máy quầy');
    expect(() => svc.pair(code, undefined)).toThrow('Chưa có mã ghép đang mở, hãy tạo mã trên máy quầy');
  });
});

describe('devices: verify, đổi tên, gỡ', () => {
  it('token sai/rỗng → null', () => {
    pairOne();
    expect(svc.verify('')).toBeNull();
    expect(svc.verify('x'.repeat(43))).toBeNull();
  });

  it('last_seen_on: ghi lần đầu, cùng ngày không ghi DB, sang ngày thì cập nhật; renew = lần đầu trong ngày', () => {
    const { token } = pairOne();
    expect(svc.verify(token)).toMatchObject({ device: { lastSeenOn: '2026-10-03' }, renew: true });
    const before = changes();
    at(10 * 3600_000); // 19:00 cùng ngày giờ VN
    expect(svc.verify(token)).toMatchObject({ device: { lastSeenOn: '2026-10-03' }, renew: false });
    expect(changes()).toBe(before);
    at(15 * 3600_000); // 00:00 ngày 04/10 giờ VN
    expect(svc.verify(token)).toMatchObject({ device: { lastSeenOn: '2026-10-04' }, renew: true });
    expect(svc.list()[0]!.lastSeenOn).toBe('2026-10-04');
  });

  it('list theo thứ tự ghép; rename, revoke; id lạ → 404', () => {
    const a = pairOne();
    const b = pairOne(undefined);
    expect(svc.list().map((d) => d.id)).toEqual([a.device.id, b.device.id]);
    expect(svc.rename(a.device.id, 'Máy chị Lan').name).toBe('Máy chị Lan');
    svc.revoke(a.device.id);
    expect(svc.verify(a.token)).toBeNull();
    expect(svc.list().map((d) => d.id)).toEqual([b.device.id]);
    expect(() => svc.rename(a.device.id, 'x')).toThrow(NotFoundError);
    expect(() => svc.revoke(a.device.id)).toThrow('Không tìm thấy thiết bị');
  });
});

describe('deviceNameFromUa', () => {
  it.each([
    [UA_IPHONE, 'iPhone · Safari'],
    ['Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36', 'Android · Chrome'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0', 'Windows · Edge'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1', 'iPhone · Chrome'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15', 'Mac · Safari'],
    ['Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0', 'Android · Firefox'],
    ['node', 'Thiết bị'],
    [undefined, 'Thiết bị'],
  ])('%s → %s', (ua, name) => expect(deviceNameFromUa(ua)).toBe(name));
});
