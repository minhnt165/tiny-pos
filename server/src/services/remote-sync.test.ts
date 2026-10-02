import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RemoteOverviewDoc } from '@tiny-pos/shared';
import { createTestDb } from '../db/test-db.js';
import type { Db } from '../db/connection.js';
import { HttpError } from '../errors.js';
import { createRemoteSync, type RemoteSync, type RemoteWriter } from './remote-sync.js';
import { saveSettings, getSettings } from './settings.js';

const NOW = new Date('2026-10-02T03:00:00Z'); // 10:00 giờ VN
const MIN = 60_000;
const TZ = 420;
const DAY = 86_400_000;

interface Fake extends RemoteWriter {
  overviews: RemoteOverviewDoc[];
  access: string[][];
  deletes: number;
  closes: number;
  fail: Error | null;
  hang: boolean;
  /** setOverview chờ promise này xong mới chạy (giả lập lệnh đang bay). */
  wait: Promise<void> | null;
}
function fakeWriter(): Fake {
  const f: Fake = {
    overviews: [],
    access: [],
    deletes: 0,
    closes: 0,
    fail: null,
    hang: false,
    wait: null,
    async setOverview(doc) {
      if (f.hang) return new Promise(() => undefined);
      if (f.wait) await f.wait;
      if (f.fail) throw f.fail;
      f.overviews.push(doc);
    },
    async deleteOverview() {
      if (f.fail) throw f.fail;
      f.deletes++;
    },
    async setAccess(emails) {
      if (f.fail) throw f.fail;
      f.access.push(emails);
    },
    async close() {
      f.closes++;
    },
  };
  return f;
}

let root: string;
let db: Db;
let keyFile: string;
let dbFile: string;
let writer: Fake;
let factoryCalls = 0;
const touch = (file: string, at: Date) => fs.utimesSync(file, at, at);
const writeKey = (projectId = 'tiem-abc') => fs.writeFileSync(keyFile, JSON.stringify({ type: 'service_account', project_id: projectId }));

function make(over: Partial<Parameters<typeof createRemoteSync>[0]> = {}): RemoteSync {
  return createRemoteSync({
    db,
    keyFile,
    dbFile,
    appVersion: '0.14.0',
    writer: async () => {
      factoryCalls++;
      return writer;
    },
    clock: { now: NOW, tzOffsetMin: TZ },
    timeoutMs: 50,
    log: () => undefined,
    ...over,
  });
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'tiny-pos-remote-'));
  keyFile = path.join(root, 'service-account.json');
  dbFile = path.join(root, 'grocery.db');
  fs.writeFileSync(dbFile, '');
  touch(dbFile, new Date(NOW.getTime() - 60_000));
  db = createTestDb();
  writer = fakeWriter();
  factoryCalls = 0;
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('status', () => {
  it('chưa có file khóa → configured false, tắt, không email', () => {
    expect(make().status()).toEqual({ configured: false, projectId: null, url: null, enabled: false, emails: [], lastPushAt: null, lastError: null });
  });

  it('có file khóa → projectId và url; file hỏng → configured false + lastError', () => {
    writeKey('tiem-xyz');
    expect(make().status()).toMatchObject({ configured: true, projectId: 'tiem-xyz', url: 'https://tiem-xyz.web.app' });
    fs.writeFileSync(keyFile, '{ hong');
    touch(keyFile, new Date(NOW.getTime() + 1000));
    expect(make().status()).toMatchObject({ configured: false, projectId: null, lastError: 'File khóa Firebase không đọc được' });
    fs.writeFileSync(keyFile, JSON.stringify({ type: 'service_account' }));
    touch(keyFile, new Date(NOW.getTime() + 2000));
    expect(make().status()).toMatchObject({ configured: false, lastError: 'File khóa Firebase không đúng định dạng (thiếu project_id)' });
  });

  it('kiểm file mỗi lần gọi: chép file vào sau khi khởi động là nhận', () => {
    const s = make();
    expect(s.status().configured).toBe(false);
    writeKey();
    expect(s.status().configured).toBe(true);
  });
});

describe('save', () => {
  it('bật khi chưa có file khóa → 400', async () => {
    await expect(make().save({ enabled: true, emails: [] })).rejects.toMatchObject({ status: 400, message: 'Chưa có file khóa Firebase' });
  });

  it('bật: lưu settings, ghi access rồi overview; status phản ánh', async () => {
    writeKey();
    const s = make();
    const st = await s.save({ enabled: true, emails: ['a@x.vn', 'b@x.vn'] });
    expect(writer.access).toEqual([['a@x.vn', 'b@x.vn']]);
    expect(writer.overviews).toHaveLength(1);
    expect(st).toMatchObject({ enabled: true, emails: ['a@x.vn', 'b@x.vn'], lastPushAt: NOW.toISOString(), lastError: null });
    // Lưu vào bảng settings, service khác tạo lại vẫn đọc được
    expect(make().status()).toMatchObject({ enabled: true, emails: ['a@x.vn', 'b@x.vn'] });
  });

  it('bật với email rỗng: vẫn đẩy, access = []', async () => {
    writeKey();
    await make().save({ enabled: true, emails: [] });
    expect(writer.access).toEqual([[]]);
    expect(writer.overviews).toHaveLength(1);
  });

  it('tắt: xóa overview, giữ email; tick sau đó không đẩy', async () => {
    writeKey();
    const s = make();
    await s.save({ enabled: true, emails: ['a@x.vn'] });
    const st = await s.save({ enabled: false, emails: ['a@x.vn'] });
    expect(writer.deletes).toBe(1);
    expect(st).toMatchObject({ enabled: false, emails: ['a@x.vn'] });
    await s.tick(new Date(NOW.getTime() + 60_000));
    expect(writer.overviews).toHaveLength(1);
  });

  it('bật nhưng Firebase lỗi: vẫn lưu cấu hình, trả 200 với lastError', async () => {
    writeKey();
    writer.fail = new Error('getaddrinfo ENOTFOUND firestore.googleapis.com');
    const st = await make().save({ enabled: true, emails: ['a@x.vn'] });
    expect(st).toMatchObject({ enabled: true, lastError: 'Không kết nối được Firebase', lastPushAt: null });
  });
});

describe('tick', () => {
  it('không bật → không gọi writer, không tạo writer', async () => {
    writeKey();
    await make().tick();
    expect(factoryCalls).toBe(0);
  });

  it('lần đầu đẩy kèm access; DB không đổi cùng ngày → không đẩy; WAL đổi → đẩy; sang ngày → đẩy', async () => {
    writeKey();
    const s = make();
    await s.save({ enabled: true, emails: ['a@x.vn'] });
    writer.overviews = [];
    writer.access = [];
    const s2 = make(); // phiên mới (server khởi động lại): chưa đẩy lần nào → đẩy ngay và ghi lại access
    await s2.tick(NOW);
    expect(writer.overviews).toHaveLength(1);
    expect(writer.access).toEqual([['a@x.vn']]);

    await s2.tick(new Date(NOW.getTime() + 60_000));
    expect(writer.overviews).toHaveLength(1);

    fs.writeFileSync(`${dbFile}-wal`, '');
    touch(`${dbFile}-wal`, new Date(NOW.getTime() + 30_000));
    await s2.tick(new Date(NOW.getTime() + 60_000));
    expect(writer.overviews).toHaveLength(2);
    expect(writer.access).toHaveLength(1); // email không đổi thì không ghi lại

    touch(`${dbFile}-wal`, new Date(NOW.getTime() - 60_000));
    touch(dbFile, new Date(NOW.getTime() - 60_000));
    await s2.tick(new Date(NOW.getTime() + DAY));
    expect(writer.overviews).toHaveLength(3);
    expect(writer.overviews[2]?.data.today).toBe('2026-10-03');
  });

  it('tài liệu: storeName từ settings, updatedAt theo clock, appVersion, data = overview + backup null', async () => {
    writeKey();
    saveSettings(db, { ...getSettings(db), storeName: 'Tạp hóa Cô Ba' });
    const s = make();
    await s.save({ enabled: true, emails: [] });
    const doc = writer.overviews[0]!;
    expect(doc.storeName).toBe('Tạp hóa Cô Ba');
    expect(doc.updatedAt).toBe(NOW.toISOString());
    expect(doc.appVersion).toBe('0.14.0');
    expect(doc.data.today).toBe('2026-10-02');
    expect(doc.data.week.rows).toHaveLength(7);
    expect(doc.data.backup).toBeNull();
    expect(JSON.stringify(doc)).not.toContain('undefined');
  });

  it('writer lỗi → lastError, không ném; lần sau ổn → hết lỗi', async () => {
    writeKey();
    const s = make();
    await s.save({ enabled: true, emails: [] });
    writer.fail = new Error('7 PERMISSION_DENIED: Missing or insufficient permissions');
    touch(dbFile, new Date(NOW.getTime() + 10_000));
    await s.tick(new Date(NOW.getTime() + 60_000));
    expect(s.status().lastError).toBe('Lỗi Firebase: 7 PERMISSION_DENIED: Missing or insufficient permissions');
    writer.fail = null;
    await s.tick(new Date(NOW.getTime() + 120_000));
    expect(s.status().lastError).toBeNull();
    expect(s.status().lastPushAt).toBe(new Date(NOW.getTime() + 120_000).toISOString());
  });

  it('lệnh treo quá timeout → lỗi "quá N giây"; tick chồng khi đang bận thì bỏ qua', async () => {
    writeKey();
    const s = make();
    await s.save({ enabled: true, emails: [] });
    writer.hang = true;
    touch(dbFile, new Date(NOW.getTime() + 10_000));
    const first = s.tick(new Date(NOW.getTime() + 60_000));
    await s.tick(new Date(NOW.getTime() + 61_000)); // đang bận → về ngay
    await first;
    expect(s.status().lastError).toBe('Không kết nối được Firebase (quá 0 giây)');
  });

  it('email đổi trong DB (khôi phục bản sao) → lần đẩy sau ghi lại access', async () => {
    writeKey();
    const s = make();
    await s.save({ enabled: true, emails: ['a@x.vn'] });
    // Giả lập khôi phục: ghi thẳng khóa settings bằng service khác
    await make().save({ enabled: true, emails: ['b@x.vn'] });
    writer.access = [];
    touch(dbFile, new Date(NOW.getTime() + 10_000));
    await s.tick(new Date(NOW.getTime() + 60_000));
    expect(writer.access).toEqual([['b@x.vn']]);
  });

  it('file khóa đổi (mtime) → đóng writer cũ, tạo writer mới, status đổi project', async () => {
    writeKey('tiem-1');
    const s = make();
    await s.save({ enabled: true, emails: [] });
    expect(factoryCalls).toBe(1);
    writeKey('tiem-2');
    touch(keyFile, new Date(NOW.getTime() + 5000));
    touch(dbFile, new Date(NOW.getTime() + 10_000));
    await s.tick(new Date(NOW.getTime() + 60_000));
    expect(factoryCalls).toBe(2);
    expect(writer.closes).toBe(1);
    expect(s.status().projectId).toBe('tiem-2');
  });
});

describe('push', () => {
  it('đang tắt → 400; chưa có file → 400; writer lỗi → 502 kèm lý do', async () => {
    const s = make();
    await expect(s.push()).rejects.toMatchObject({ status: 400, message: 'Xem từ xa đang tắt' });
    writeKey();
    await s.save({ enabled: true, emails: [] });
    fs.rmSync(keyFile);
    await expect(s.push()).rejects.toMatchObject({ status: 400, message: 'Chưa có file khóa Firebase' });
    writeKey();
    writer.fail = new Error('14 UNAVAILABLE: No connection established');
    const err = await s.push().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpError);
    expect(err).toMatchObject({ status: 502, message: 'Không gửi được: Không kết nối được Firebase' });
    expect(s.status().lastError).toBe('Không kết nối được Firebase');
  });

  it('thành công → status mới, bỏ qua điều kiện mtime', async () => {
    writeKey();
    const s = make();
    await s.save({ enabled: true, emails: [] });
    const st = await s.push();
    expect(writer.overviews).toHaveLength(2);
    expect(st.lastError).toBeNull();
  });
});

describe('tắt và nhịp tim (đợt sửa sau review)', () => {
  it('tắt khi đang có lệnh đẩy bay → đẩy xong thì xóa tài liệu, không để sống lại', async () => {
    writeKey();
    const s = make();
    await s.save({ enabled: true, emails: [] });
    let release!: () => void;
    writer.wait = new Promise<void>((r) => (release = r));
    touch(dbFile, new Date(NOW.getTime() + 10_000));
    const inflight = s.tick(new Date(NOW.getTime() + MIN));
    const st = await s.save({ enabled: false, emails: [] }); // đang bận → chỉ lưu cấu hình
    expect(st.enabled).toBe(false);
    expect(writer.deletes).toBe(0);
    release();
    await inflight;
    expect(writer.deletes).toBe(1);
  });

  it('xóa lỗi lúc tắt → tick sau thử xóa lại, không đẩy', async () => {
    writeKey();
    const s = make();
    await s.save({ enabled: true, emails: [] });
    writer.fail = new Error('14 UNAVAILABLE');
    await s.save({ enabled: false, emails: [] });
    expect(writer.deletes).toBe(0);
    expect(s.status().lastError).toBe('Không kết nối được Firebase');
    writer.fail = null;
    await s.tick(new Date(NOW.getTime() + MIN));
    expect(writer.deletes).toBe(1);
    expect(s.status().lastError).toBeNull();
    expect(writer.overviews).toHaveLength(1);
  });

  it('DB không đổi nhưng quá REMOTE_HEARTBEAT_MS → vẫn đẩy để trang xem biết máy quầy còn sống', async () => {
    writeKey();
    const s = make();
    await s.save({ enabled: true, emails: [] });
    await s.tick(new Date(NOW.getTime() + 4 * MIN));
    expect(writer.overviews).toHaveLength(1);
    await s.tick(new Date(NOW.getTime() + 5 * MIN));
    expect(writer.overviews).toHaveLength(2);
  });
});
