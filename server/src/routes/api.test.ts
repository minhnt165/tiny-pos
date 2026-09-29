import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { createTestDb } from '../db/test-db.js';
import { createApp } from '../app.js';

let server: Server;
let base: string;
beforeAll(async () => {
  server = createApp(createTestDb()).listen(0);
  await new Promise((r) => server.once('listening', r));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});
afterAll(() => server.close());

const call = async (method: string, path: string, body?: unknown, contentType = 'application/json') => {
  const res = await fetch(base + path, {
    method,
    headers: body !== undefined ? { 'content-type': contentType } : {},
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await res.text();
  const isJson = res.headers.get('content-type')?.includes('application/json');
  return { status: res.status, json: isJson && text ? JSON.parse(text) : null, text, headers: res.headers };
};

describe('API', () => {
  it('CRUD danh mục và sản phẩm, by-barcode, đơn vị, soft delete', async () => {
    const cat = await call('POST', '/api/categories', { name: 'Đồ uống' });
    expect(cat.status).toBe(201);
    const p = await call('POST', '/api/products', {
      name: 'Coca',
      barcode: '1',
      sellPrice: 10000,
      stock: 5,
      categoryId: cat.json.id,
    });
    expect(p.status).toBe(201);
    expect(p.json).toMatchObject({ name: 'Coca', stock: 5, categoryName: 'Đồ uống', units: [] });
    const u = await call('POST', `/api/products/${p.json.id}/units`, {
      name: 'Thùng',
      barcode: '1T',
      factor: 24,
      sellPrice: 230000,
    });
    expect(u.status).toBe(201);
    expect((await call('GET', '/api/products/by-barcode/1T')).json).toMatchObject({
      product: { id: p.json.id },
      unit: { factor: 24 },
    });
    expect((await call('GET', '/api/products/by-barcode/zzz')).status).toBe(404);
    expect((await call('GET', '/api/products?q=coc')).json).toHaveLength(1);
    expect((await call('DELETE', `/api/products/${p.json.id}`)).status).toBe(204);
    expect((await call('GET', '/api/products')).json).toHaveLength(0);
    expect((await call('POST', `/api/products/${p.json.id}/restore`)).json.isActive).toBe(true);
    expect((await call('GET', '/api/categories')).json).toMatchObject([{ productCount: 1 }]);
  });

  it('lỗi validate 400 có nhãn tiếng Việt, 409 trùng mã, 404 route lạ, 400 id sai', async () => {
    const bad = await call('POST', '/api/products', { name: 'X', sellPrice: '15000' });
    expect(bad.status).toBe(400);
    expect(bad.json.error).toContain('Giá bán');
    await call('POST', '/api/products', { name: 'A', barcode: 'dup' });
    expect(await call('POST', '/api/products', { name: 'B', barcode: 'dup' })).toMatchObject({
      status: 409,
      json: { error: 'Mã vạch đã tồn tại' },
    });
    expect((await call('GET', '/api/nope')).status).toBe(404);
    expect((await call('GET', '/api/products/abc')).status).toBe(400);
    expect((await call('POST', '/api/products', '{bad json', 'application/json')).status).toBe(400);
  });

  it('xuất và nhập CSV', async () => {
    const exp = await call('GET', '/api/products/csv');
    expect(exp.headers.get('content-type')).toContain('text/csv');
    expect(exp.headers.get('content-disposition')).toContain('san-pham-');
    // fetch().text() tự bỏ BOM; BOM đã được kiểm ở product-csv.test.ts
    expect(exp.text.startsWith('Mã vạch,Tên,')).toBe(true);
    const imp = await call('POST', '/api/products/csv', 'Tên,Giá bán\nKẹo,5000\n', 'text/csv');
    expect(imp.json).toEqual({ created: 1, updated: 0, errors: [] });
  });
});
