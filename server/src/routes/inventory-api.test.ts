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

const call = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : {},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
};

describe('API nhập hàng, NCC, kiểm kê, lịch sử tồn', () => {
  it('NCC → phiếu nhập ghi nợ → trả nợ → hủy phiếu → lịch sử tồn', async () => {
    const p = await call('POST', '/api/products', { name: 'Bia', costPrice: 9000, sellPrice: 12000 });
    const s = await call('POST', '/api/suppliers', { name: 'Đại lý Hùng', phone: '0909' });
    expect(s.status).toBe(201);
    const im = await call('POST', '/api/imports', {
      supplierId: s.json.id,
      paid: 50000,
      items: [{ productId: p.json.id, qty: 10, unitCost: 10000 }],
    });
    expect(im.status).toBe(201);
    expect(im.json.code).toMatch(/^PN-\d{8}-0001$/);
    expect((await call('GET', '/api/suppliers?q=đại')).json).toMatchObject([{ name: 'Đại lý Hùng', debt: 50000 }]);
    expect((await call('GET', `/api/suppliers/${s.json.id}/transactions`)).json).toHaveLength(1);
    expect((await call('POST', `/api/suppliers/${s.json.id}/payments`, { amount: 60000 })).status).toBe(400);
    expect((await call('POST', `/api/suppliers/${s.json.id}/payments`, { amount: 20000 })).json.debt).toBe(30000);
    expect((await call('DELETE', `/api/suppliers/${s.json.id}`)).status).toBe(409);
    expect((await call('GET', '/api/imports')).json.summary).toEqual({ count: 1, total: 100000, paid: 50000 });
    expect((await call('GET', `/api/imports/${im.json.id}`)).json.items).toHaveLength(1);
    expect((await call('POST', `/api/imports/${im.json.id}/cancel`)).json.status).toBe('cancelled');
    expect((await call('POST', `/api/imports/${im.json.id}/cancel`)).status).toBe(409);
    const mv = await call('GET', `/api/products/${p.json.id}/movements`);
    expect(mv.json.map((m: { type: string }) => m.type)).toEqual(['adjust', 'import']);
    expect((await call('GET', `/api/products/${p.json.id}/movements?limit=0`)).status).toBe(400);
  });

  it('kiểm kê: mở, mở lần hai 409, đếm, chốt, lịch sử', async () => {
    const p = await call('POST', '/api/products', { name: 'Nước', stock: 10 });
    const s = await call('POST', '/api/stocktakes', {});
    expect(s.status).toBe(201);
    expect((await call('POST', '/api/stocktakes', {})).status).toBe(409);
    expect((await call('GET', '/api/stocktakes/current')).json.id).toBe(s.json.id);
    const c = await call('PUT', `/api/stocktakes/${s.json.id}/items/${p.json.id}`, { counted: 7 });
    expect(c.json.items).toMatchObject([{ counted: 7, expected: 10, diff: -3 }]);
    expect((await call('DELETE', `/api/stocktakes/${s.json.id}/items/${p.json.id}`)).json.items).toEqual([]);
    await call('PUT', `/api/stocktakes/${s.json.id}/items/${p.json.id}`, { counted: 7 });
    expect((await call('POST', `/api/stocktakes/${s.json.id}/finish`)).json.status).toBe('done');
    expect((await call('GET', '/api/stocktakes/current')).json).toBeNull();
    expect((await call('GET', `/api/products/${p.json.id}`)).json.stock).toBe(7);
    expect((await call('GET', '/api/stocktakes')).json.map((x: { id: number }) => x.id)).toEqual([s.json.id]);
    expect((await call('GET', `/api/stocktakes/${s.json.id}`)).json.items).toHaveLength(1);
    expect((await call('PUT', `/api/stocktakes/${s.json.id}/items/${p.json.id}`, { counted: 1 })).status).toBe(409);
  });

  it('400 có nhãn tiếng Việt', async () => {
    const bad = await call('POST', '/api/imports', { paid: 0, items: [{ productId: 1, qty: 1, unitCost: 1.5 }] });
    expect(bad.status).toBe(400);
    expect(bad.json.error).toContain('Giá nhập');
    expect((await call('POST', '/api/suppliers', { name: '' })).json.error).toContain('Tên');
    expect((await call('PUT', '/api/stocktakes/1/items/1', { counted: -1 })).json.error).toContain('Số đếm');
  });
});
