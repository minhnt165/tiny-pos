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

describe('API trả hàng', () => {
  it('lập phiếu, danh sách hôm nay, chi tiết, hóa đơn biết phiếu trả, chặn hủy hóa đơn, hủy phiếu, hủy lần hai 409', async () => {
    const p = await call('POST', '/api/products', { name: 'Nước suối', sellPrice: 5000, stock: 10 });
    const o = await call('POST', '/api/orders', { items: [{ productId: p.json.id, qty: 2, price: 5000 }], paymentMethod: 'cash', paid: 10000 });
    const created = await call('POST', '/api/returns', { orderId: o.json.id, items: [{ orderItemId: o.json.items[0].id, qty: 1 }] });
    expect(created.status).toBe(201);
    expect(created.json).toMatchObject({ refund: 5000, cashRefund: 5000, orderCode: o.json.code });
    expect(created.json.code).toMatch(/^TH-\d{8}-0001$/);
    expect((await call('GET', `/api/products/${p.json.id}`)).json.stock).toBe(9);

    const list = await call('GET', '/api/returns');
    expect(list.json.returns.map((r: { id: number }) => r.id)).toEqual([created.json.id]);
    expect(list.json.summary).toEqual({ count: 1, refund: 5000, cash: 5000, debt: 0 });
    expect((await call('GET', '/api/orders')).json.summary.returns).toEqual({ count: 1, refund: 5000, cash: 5000, debt: 0 });
    expect((await call('GET', `/api/returns/${created.json.id}`)).json.items).toHaveLength(1);
    expect((await call('GET', `/api/orders/${o.json.id}`)).json).toMatchObject({ refunded: 5000, items: [{ returnedQty: 1 }] });

    expect((await call('POST', `/api/orders/${o.json.id}/cancel`)).status).toBe(409);
    expect((await call('POST', `/api/returns/${created.json.id}/cancel`)).json.status).toBe('cancelled');
    expect((await call('POST', `/api/returns/${created.json.id}/cancel`)).status).toBe(409);
  });

  it('400 khi không có món hoặc vượt số; 404 hóa đơn / phiếu không có; xuất Excel', async () => {
    const o = await call('POST', '/api/orders', { items: [{ name: 'Đá', qty: 1, price: 2000 }], paymentMethod: 'cash', paid: 2000 });
    expect((await call('POST', '/api/returns', { orderId: o.json.id, items: [] })).status).toBe(400);
    const over = await call('POST', '/api/returns', { orderId: o.json.id, items: [{ orderItemId: o.json.items[0].id, qty: 2 }] });
    expect(over).toMatchObject({ status: 400, json: { error: 'Số lượng trả vượt số còn lại của Đá' } });
    expect((await call('POST', '/api/returns', { orderId: 9999, items: [{ orderItemId: 1, qty: 1 }] })).status).toBe(404);
    expect((await call('GET', '/api/returns/9999')).status).toBe(404);
    const res = await fetch(`${base}/api/returns/export.xlsx`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('spreadsheetml');
  });
});
