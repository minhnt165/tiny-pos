import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import type { Request } from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from '../db/test-db.js';
import { createApp } from '../app.js';
import { isCounterRequest, readCookie } from '../middleware/device-gate.js';
import { createDevicesService } from '../services/devices.js';

let server: Server;
let base: string;
let root: string;
beforeAll(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'tiny-pos-dev-'));
  const imagesDir = path.join(root, 'images');
  fs.mkdirSync(imagesDir);
  fs.writeFileSync(path.join(imagesDir, 'p1-1.jpg'), 'x');
  const db = createTestDb();
  const devices = createDevicesService(db, { lanUrl: () => 'http://192.168.1.5:3000' });
  // Giả hai phía từ cùng một tiến trình: có header x-test-counter = máy quầy, không có = máy khác trong LAN
  server = createApp(db, { devices, imagesDir, isCounter: (req) => req.headers['x-test-counter'] === '1' }).listen(0);
  await new Promise((r) => server.once('listening', r));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});
afterAll(() => {
  server.close();
  fs.rmSync(root, { recursive: true, force: true });
});

const call = async (method: string, p: string, o: { body?: unknown; counter?: boolean; cookie?: string } = {}) => {
  const headers: Record<string, string> = {};
  if (o.body !== undefined) headers['content-type'] = 'application/json';
  if (o.counter) headers['x-test-counter'] = '1';
  if (o.cookie) headers['cookie'] = o.cookie;
  const res = await fetch(base + p, { method, headers, body: o.body === undefined ? undefined : JSON.stringify(o.body) });
  const text = await res.text();
  const json = text && res.headers.get('content-type')?.includes('application/json') ? JSON.parse(text) : null;
  return { status: res.status, json, setCookie: res.headers.get('set-cookie') };
};
/** "tp_device=abc; Max-Age=…; Path=/; HttpOnly" → "tp_device=abc". */
const cookieOf = (setCookie: string | null) => setCookie!.split(';')[0]!;
const pairNew = async () => {
  const { json } = await call('POST', '/api/devices/pairing', { counter: true });
  const r = await call('POST', '/api/device/pair', { body: { code: json.code } });
  return { ...r, cookie: cookieOf(r.setCookie) };
};

describe('API ghép thiết bị', () => {
  it('máy chưa ghép: API và ảnh 401, trạng thái unpaired', async () => {
    const p = await call('GET', '/api/products');
    expect(p.status).toBe(401);
    expect(p.json).toEqual({ error: 'Thiết bị chưa được ghép', code: 'DEVICE_NOT_PAIRED' });
    expect((await call('GET', '/images/p1-1.jpg')).status).toBe(401);
    expect((await call('GET', '/api/device')).json).toEqual({ kind: 'unpaired' });
  });

  it('máy quầy: dùng được mọi thứ, tạo mã ghép có url LAN', async () => {
    expect((await call('GET', '/api/device', { counter: true })).json).toEqual({ kind: 'counter' });
    expect((await call('GET', '/api/products', { counter: true })).status).toBe(200);
    expect((await call('GET', '/images/p1-1.jpg', { counter: true })).status).toBe(200);
    const { status, json } = await call('POST', '/api/devices/pairing', { counter: true });
    expect(status).toBe(200);
    expect(json.code).toMatch(/^\d{6}$/);
    expect(json.url).toBe(`http://192.168.1.5:3000/pair?code=${json.code}`);
  });

  it('ghép: sai mã 400; sai định dạng 400 có nhãn; mã có khoảng trắng vẫn được; cookie HttpOnly Lax 10 năm', async () => {
    const { json } = await call('POST', '/api/devices/pairing', { counter: true });
    const wrong = json.code === '000000' ? '111111' : '000000';
    const bad = await call('POST', '/api/device/pair', { body: { code: wrong } });
    expect(bad.status).toBe(400);
    expect(bad.json.error).toBe('Mã không đúng, còn 4 lần thử');
    expect((await call('POST', '/api/device/pair', { body: { code: '12ab' } })).json.error).toMatch(/^Mã ghép:/);
    const spaced = `${json.code.slice(0, 3)} ${json.code.slice(3)}`;
    const ok = await call('POST', '/api/device/pair', { body: { code: spaced } });
    expect(ok.status).toBe(201);
    expect(ok.json.device).toMatchObject({ name: 'Thiết bị', lastSeenOn: null }); // UA của fetch Node là "node"
    expect(ok.setCookie).toMatch(/^tp_device=[\w-]{43};/);
    expect(ok.setCookie).toMatch(/HttpOnly/);
    expect(ok.setCookie).toMatch(/SameSite=Lax/);
    expect(ok.setCookie).toMatch(/Max-Age=315360000/);
    expect(ok.setCookie).not.toMatch(/Secure/);
    const cookie = cookieOf(ok.setCookie);
    expect((await call('GET', '/api/products', { cookie })).status).toBe(200);
    expect((await call('GET', '/images/p1-1.jpg', { cookie })).status).toBe(200);
    expect((await call('GET', '/api/device', { cookie })).json).toEqual({ kind: 'paired', device: { id: ok.json.device.id, name: 'Thiết bị' } });
  });

  it('lần dùng đầu tiên trong ngày gia hạn cookie (trình duyệt cắt Max-Age còn 400 ngày); lần sau cùng ngày thì không', async () => {
    const { cookie } = await pairNew();
    const first = await call('GET', '/api/products', { cookie });
    expect(first.status).toBe(200);
    expect(cookieOf(first.setCookie)).toBe(cookie);
    expect(first.setCookie).toMatch(/Max-Age=315360000/);
    expect(first.setCookie).toMatch(/HttpOnly/);
    expect(first.setCookie).toMatch(/SameSite=Lax/);
    expect((await call('GET', '/api/products', { cookie })).setCookie).toBeNull();
  });

  it('thiết bị đã ghép không quản lý thiết bị được (403)', async () => {
    const { cookie } = await pairNew();
    for (const [m, p] of [
      ['GET', '/api/devices'],
      ['POST', '/api/devices/pairing'],
      ['PATCH', '/api/devices/1'],
      ['DELETE', '/api/devices/1'],
    ] as const) {
      const r = await call(m, p, { cookie, body: m === 'PATCH' ? { name: 'X' } : undefined });
      expect(r.status).toBe(403);
      expect(r.json.error).toBe('Chỉ thao tác được trên máy quầy');
    }
  });

  it('máy quầy đổi tên, gỡ; tên rỗng 400; cookie của máy đã gỡ → 401', async () => {
    const { cookie, json } = await pairNew();
    const id = json.device.id as number;
    expect((await call('PATCH', `/api/devices/${id}`, { counter: true, body: { name: '  Điện thoại chị Lan ' } })).json.name).toBe('Điện thoại chị Lan');
    const blank = await call('PATCH', `/api/devices/${id}`, { counter: true, body: { name: '   ' } });
    expect(blank.status).toBe(400);
    expect(blank.json.error).toMatch(/^Tên:/);
    const list = (await call('GET', '/api/devices', { counter: true })).json as { id: number; name: string }[];
    expect(list.find((d) => d.id === id)?.name).toBe('Điện thoại chị Lan');
    expect((await call('DELETE', `/api/devices/${id}`, { counter: true })).status).toBe(204);
    expect((await call('DELETE', `/api/devices/${id}`, { counter: true })).status).toBe(404);
    expect((await call('GET', '/api/products', { cookie })).status).toBe(401);
    expect((await call('GET', '/api/device', { cookie })).json).toEqual({ kind: 'unpaired' });
  });

  it('cookie rác / hỏng / tên gần giống → 401, không 500', async () => {
    for (const cookie of ['tp_device=abc', 'tp_device=%E0%A4%A', 'a=1; b=2', 'tp_device=', 'xtp_device=abc'])
      expect((await call('GET', '/api/products', { cookie })).status).toBe(401);
  });
});

describe('isCounterRequest', () => {
  const req = (remoteAddress: string | undefined, host: string | undefined) =>
    ({ socket: { remoteAddress }, headers: { host } }) as unknown as Request;
  it.each([
    ['127.0.0.1', 'localhost:3000', true],
    ['::1', '[::1]:3000', true],
    ['::ffff:127.0.0.1', '127.0.0.1:3000', true],
    ['127.0.0.1', 'LOCALHOST:3000', true],
    ['127.0.0.1', 'localhost', true],
    ['127.0.0.1', 'evil.com', false],
    ['127.0.0.1', 'localhost.evil.com:3000', false],
    ['127.0.0.1', undefined, false],
    ['192.168.1.7', 'localhost:3000', false],
    [undefined, 'localhost:3000', false],
  ])('%s + Host %s → %s', (addr, host, expected) => expect(isCounterRequest(req(addr, host))).toBe(expected));
});

describe('readCookie', () => {
  it('đúng tên giữa nhiều cookie, decode; hỏng hoặc không có → undefined', () => {
    expect(readCookie('a=1; tp_device=x%2By; b=2', 'tp_device')).toBe('x+y');
    expect(readCookie('xtp_device=1', 'tp_device')).toBeUndefined();
    expect(readCookie('tp_device=%E0%A4%A', 'tp_device')).toBeUndefined();
    expect(readCookie(undefined, 'tp_device')).toBeUndefined();
  });
});
