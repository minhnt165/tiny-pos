import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { createTestDb } from '../db/test-db.js';
import { createApp } from '../app.js';

const opened: string[] = [];
let server: Server;
let base: string;
beforeAll(async () => {
  server = createApp(createTestDb(), { labels: { origin: 'http://localhost:3000', open: (url) => (opened.push(url), true) } }).listen(0);
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
  return { status: res.status, type: res.headers.get('content-type'), json: text && res.headers.get('content-type')?.includes('json') ? JSON.parse(text) : null };
};

describe('API trả NCC', () => {
  it('lập phiếu, danh sách hôm nay, chi tiết, hủy, hủy lần hai 409, xuất Excel', async () => {
    const p = await call('POST', '/api/products', { name: 'Nước suối', costPrice: 4000, sellPrice: 5000, stock: 10 });
    const s = await call('POST', '/api/suppliers', { name: 'Đại lý Hùng' });
    const created = await call('POST', '/api/supplier-returns', { supplierId: s.json.id, items: [{ productId: p.json.id, qty: 2, unitPrice: 4000 }] });
    expect(created.status).toBe(201);
    expect(created.json).toMatchObject({ total: 8000, debtReduced: 0, cashReceived: 8000, supplierName: 'Đại lý Hùng' });
    expect(created.json.code).toMatch(/^TN-\d{8}-0001$/);
    expect((await call('GET', `/api/products/${p.json.id}`)).json.stock).toBe(8);

    const list = await call('GET', '/api/supplier-returns');
    expect(list.json.returns.map((r: { id: number }) => r.id)).toEqual([created.json.id]);
    expect(list.json.summary).toEqual({ count: 1, total: 8000, debt: 0, cash: 8000 });
    expect((await call('GET', `/api/supplier-returns/${created.json.id}`)).json.items).toHaveLength(1);
    expect((await call('GET', '/api/supplier-returns/export.xlsx')).type).toContain('spreadsheetml');

    expect((await call('POST', `/api/supplier-returns/${created.json.id}/cancel`)).json.status).toBe('cancelled');
    expect((await call('POST', `/api/supplier-returns/${created.json.id}/cancel`)).status).toBe(409);
    expect((await call('GET', `/api/products/${p.json.id}`)).json.stock).toBe(10);
  });

  it('400 khi không có món / NCC lạ / lọc sai; 404 phiếu không có', async () => {
    const s = await call('POST', '/api/suppliers', { name: 'NCC B' });
    expect((await call('POST', '/api/supplier-returns', { supplierId: s.json.id, items: [] })).status).toBe(400);
    expect((await call('POST', '/api/supplier-returns', { supplierId: 999, items: [{ productId: 1, qty: 1, unitPrice: 1 }] })).status).toBe(400);
    expect((await call('GET', '/api/supplier-returns?from=2026-10-02&to=2026-10-01')).status).toBe(400);
    expect((await call('GET', '/api/supplier-returns/999')).status).toBe(404);
  });
});

describe('API in tem', () => {
  it('cấp mã, mở cửa sổ với URL đầy đủ; tem mẫu; 400 khi rỗng hoặc quá 500 tem', async () => {
    opened.length = 0;
    const p = await call('POST', '/api/products', { name: 'Bánh bò', sellPrice: 5000 });
    const r = await call('POST', '/api/labels/print', { items: [{ productId: p.json.id, copies: 2 }] });
    expect(r.json).toEqual({ opened: true, url: `/labels/print?i=${p.json.id}.0x2` });
    expect(opened).toEqual([`http://localhost:3000/labels/print?i=${p.json.id}.0x2`]);
    expect((await call('GET', `/api/products/${p.json.id}`)).json.barcode).toMatch(/^20\d{11}$/);
    expect((await call('POST', '/api/labels/sample')).json).toEqual({ opened: true, url: '/labels/print?sample=1' });
    expect((await call('POST', '/api/labels/print', { items: [] })).status).toBe(400);
    expect((await call('POST', '/api/labels/print', { items: [{ productId: p.json.id, copies: 300 }, { productId: p.json.id, copies: 300 }] })).status).toBe(400);
  });
});
