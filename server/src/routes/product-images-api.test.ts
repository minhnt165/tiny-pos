import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from '../db/test-db.js';
import { createApp } from '../app.js';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
let server: Server;
let base: string;
let root: string;
let imagesDir: string;

beforeAll(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'tiny-pos-images-api-'));
  imagesDir = path.join(root, 'images');
  // clientDist giả để SPA fallback bật: kiểm /images/<lạ> không được trả index.html
  const dist = path.join(root, 'dist');
  fs.mkdirSync(dist);
  fs.writeFileSync(path.join(dist, 'index.html'), '<html>spa</html>');
  server = createApp(createTestDb(), { clientDist: dist, imagesDir }).listen(0);
  await new Promise((r) => server.once('listening', r));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});
afterAll(() => {
  server.close();
  fs.rmSync(root, { recursive: true, force: true });
});

const raw = (method: string, p: string, body?: Buffer | string) =>
  fetch(base + p, { method, headers: body !== undefined ? { 'content-type': 'application/octet-stream' } : {}, body });
const createProduct = async (b: string, name: string): Promise<number> => {
  const res = await fetch(`${b}/api/products`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, sellPrice: 1000 }),
  });
  return ((await res.json()) as { id: number }).id;
};

describe('API ảnh sản phẩm', () => {
  it('PUT ảnh → 200 có image, GET /images/<tên> → jpeg immutable; DELETE → 204 và 404 khi tải', async () => {
    const id = await createProduct(base, 'Sữa');
    const put = await raw('PUT', `/api/products/${id}/image`, JPEG);
    expect(put.status).toBe(200);
    const { image } = (await put.json()) as { image: string };
    expect(image).toMatch(new RegExp(`^p${id}-\\d+\\.jpg$`));
    const get = await fetch(`${base}/images/${image}`);
    expect(get.status).toBe(200);
    expect(get.headers.get('content-type')).toBe('image/jpeg');
    expect(get.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(Buffer.from(await get.arrayBuffer())).toEqual(JPEG);
    expect((await raw('DELETE', `/api/products/${id}/image`)).status).toBe(204);
    expect((await fetch(`${base}/images/${image}`)).status).toBe(404);
  });

  it('không phải JPEG → 400; quá 1 MB → 413; id lạ → 404; tên ảnh lạ → 404 rỗng, không phải index.html', async () => {
    const id = await createProduct(base, 'Bánh');
    const bad = await raw('PUT', `/api/products/${id}/image`, 'không phải ảnh');
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ error: 'Ảnh phải là JPEG' });
    const big = await raw('PUT', `/api/products/${id}/image`, Buffer.concat([JPEG, Buffer.alloc(1_100_000)]));
    expect(big.status).toBe(413);
    expect((await raw('PUT', '/api/products/999/image', JPEG)).status).toBe(404);
    const missing = await fetch(`${base}/images/p999-1.jpg`);
    expect(missing.status).toBe(404);
    expect(await missing.text()).toBe('');
    // SPA fallback vẫn hoạt động cho đường dẫn khác
    expect(await (await fetch(`${base}/products`)).text()).toBe('<html>spa</html>');
  });

  it('không cấu hình imagesDir → PUT trả 503', async () => {
    const s = createApp(createTestDb()).listen(0);
    await new Promise((r) => s.once('listening', r));
    const addr = s.address();
    const b = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
    try {
      const id = await createProduct(b, 'X');
      const res = await fetch(`${b}/api/products/${id}/image`, {
        method: 'PUT',
        headers: { 'content-type': 'application/octet-stream' },
        body: JPEG,
      });
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: 'Chưa cấu hình thư mục ảnh' });
    } finally {
      s.close();
    }
  });
});
