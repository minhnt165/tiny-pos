import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from '../db/test-db.js';
import { createApp } from '../app.js';
import { createBackupService } from '../services/backups.js';

let server: Server;
let base: string;
let root: string;
beforeAll(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'tiny-pos-bapi-'));
  const db = createTestDb();
  const backups = createBackupService(db, { dir: path.join(root, 'backups'), tmpDir: path.join(root, 'tmp') });
  server = createApp(db, { backups }).listen(0);
  await new Promise((r) => server.once('listening', r));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});
afterAll(() => {
  server.close();
  fs.rmSync(root, { recursive: true, force: true });
});

const call = async (method: string, path: string, body?: unknown, contentType = 'application/json') => {
  const res = await fetch(base + path, {
    method,
    headers: body !== undefined ? { 'content-type': contentType } : {},
    body: body === undefined ? undefined : typeof body === 'string' || body instanceof Uint8Array ? body : JSON.stringify(body),
  });
  const text = await res.text();
  const isJson = res.headers.get('content-type')?.includes('application/json');
  return { status: res.status, json: isJson && text ? JSON.parse(text) : null, text, headers: res.headers };
};

describe('API sao lưu', () => {
  it('GET trống → POST tạo → GET có 1 → download → restore → DELETE', async () => {
    expect((await call('GET', '/api/backups')).json).toMatchObject({ extraDir: '', extraError: null, lastAutoAt: null, lastError: null, items: [] });
    const created = await call('POST', '/api/backups');
    expect(created.status).toBe(201);
    expect(created.json.kind).toBe('manual');
    const name: string = created.json.name;
    expect((await call('GET', '/api/backups')).json.items).toHaveLength(1);

    const dl = await call('GET', `/api/backups/${name}/download`);
    expect(dl.status).toBe(200);
    expect(dl.headers.get('content-disposition')).toContain(name);

    const r = await call('POST', `/api/backups/${name}/restore`);
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ restoredFrom: name, beforeRestore: { kind: 'before-restore' } });

    expect((await call('DELETE', `/api/backups/${name}`)).status).toBe(204);
    expect((await call('GET', `/api/backups/${name}/download`)).status).toBe(404);
  });

  it('tên sai → 400; extra-dir không tồn tại → 400; upload rác → 400', async () => {
    expect((await call('DELETE', '/api/backups/x.db')).status).toBe(400);
    expect((await call('PUT', '/api/backups/extra-dir', { extraDir: path.join(root, 'khong-co') })).status).toBe(400);
    const ok = await call('PUT', '/api/backups/extra-dir', { extraDir: root });
    expect(ok.json.extraDir).toBe(root);
    const junk = await call('POST', '/api/backups/restore-upload', new TextEncoder().encode('rác'), 'application/octet-stream');
    expect(junk.status).toBe(400);
    expect(junk.json.error).toMatch(/không phải dữ liệu/);
  });

  it('không truyền backups → /api/backups 404', async () => {
    const s = createApp(createTestDb()).listen(0);
    await new Promise((r) => s.once('listening', r));
    const addr = s.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    expect((await fetch(`http://127.0.0.1:${port}/api/backups`)).status).toBe(404);
    s.close();
  });
});
