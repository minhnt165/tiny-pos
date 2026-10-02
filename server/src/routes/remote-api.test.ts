import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { RemoteOverviewDoc } from '@tiny-pos/shared';
import { createTestDb } from '../db/test-db.js';
import { createApp } from '../app.js';
import { createRemoteSync, type RemoteWriter } from '../services/remote-sync.js';

let server: Server;
let base: string;
let bare: Server;
let bareBase: string;
let root: string;
let keyFile: string;
let fail: Error | null = null;
const overviews: RemoteOverviewDoc[] = [];
const writer: RemoteWriter = {
  async setOverview(doc) {
    if (fail) throw fail;
    overviews.push(doc);
  },
  async deleteOverview() {},
  async setAccess() {},
};

const listen = async (s: Server) => {
  await new Promise((r) => s.once('listening', r));
  const addr = s.address();
  return `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
};

beforeAll(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'tiny-pos-rapi-'));
  keyFile = path.join(root, 'service-account.json');
  const dbFile = path.join(root, 'grocery.db');
  fs.writeFileSync(dbFile, '');
  const db = createTestDb();
  const remote = createRemoteSync({ db, keyFile, dbFile, appVersion: '0.14.0', writer: async () => writer, timeoutMs: 100, log: () => undefined });
  server = createApp(db, { remote }).listen(0);
  base = await listen(server);
  bare = createApp(createTestDb()).listen(0);
  bareBase = await listen(bare);
});
afterAll(() => {
  server.close();
  bare.close();
  fs.rmSync(root, { recursive: true, force: true });
});

const call = async (b: string, method: string, p: string, body?: unknown) => {
  const res = await fetch(b + p, { method, headers: body !== undefined ? { 'content-type': 'application/json' } : {}, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
};

describe('API xem từ xa', () => {
  it('không truyền remote (test createApp): GET trả chưa cấu hình, PUT/POST 503', async () => {
    expect((await call(bareBase, 'GET', '/api/remote')).json).toEqual({
      configured: false, projectId: null, url: null, enabled: false, emails: [], lastPushAt: null, lastError: null,
    });
    expect(await call(bareBase, 'PUT', '/api/remote', { enabled: false, emails: [] })).toMatchObject({ status: 503, json: { error: 'Chưa cấu hình xem từ xa' } });
    expect((await call(bareBase, 'POST', '/api/remote/push')).status).toBe(503);
  });

  it('GET chưa có khóa; PUT bật → 400; PUT email sai → 400 có nhãn; quá 5 → 400', async () => {
    expect((await call(base, 'GET', '/api/remote')).json).toMatchObject({ configured: false, enabled: false });
    expect(await call(base, 'PUT', '/api/remote', { enabled: true, emails: [] })).toMatchObject({ status: 400, json: { error: 'Chưa có file khóa Firebase' } });
    const bad = await call(base, 'PUT', '/api/remote', { enabled: false, emails: ['x'] });
    expect(bad.status).toBe(400);
    expect(bad.json.error).toBe('Email được xem: có địa chỉ không hợp lệ');
    const many = await call(base, 'PUT', '/api/remote', { enabled: false, emails: ['a@x.vn', 'b@x.vn', 'c@x.vn', 'd@x.vn', 'e@x.vn', 'f@x.vn'] });
    expect(many.status).toBe(400);
  });

  it('có khóa: PUT bật → 200 đã đẩy; POST push → 200; writer lỗi → 502; PUT tắt → push 400', async () => {
    fs.writeFileSync(keyFile, JSON.stringify({ project_id: 'tiem-api' }));
    const on = await call(base, 'PUT', '/api/remote', { enabled: true, emails: [' A@X.vn '] });
    expect(on.status).toBe(200);
    expect(on.json).toMatchObject({ configured: true, url: 'https://tiem-api.web.app', enabled: true, emails: ['a@x.vn'], lastError: null });
    expect(on.json.lastPushAt).toBeTruthy();
    expect(overviews).toHaveLength(1);

    expect((await call(base, 'POST', '/api/remote/push')).status).toBe(200);
    expect(overviews).toHaveLength(2);

    fail = new Error('14 UNAVAILABLE');
    expect(await call(base, 'POST', '/api/remote/push')).toMatchObject({ status: 502, json: { error: 'Không gửi được: Không kết nối được Firebase' } });
    fail = null;

    expect((await call(base, 'PUT', '/api/remote', { enabled: false, emails: ['a@x.vn'] })).json).toMatchObject({ enabled: false });
    expect(await call(base, 'POST', '/api/remote/push')).toMatchObject({ status: 400, json: { error: 'Xem từ xa đang tắt' } });
  });
});
