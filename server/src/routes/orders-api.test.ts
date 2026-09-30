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

describe('API đơn hàng và cài đặt', () => {
  it('bán, xem trong ngày, xem chi tiết, hủy, hủy lần hai 409', async () => {
    const p = await call('POST', '/api/products', { name: 'Nước suối', sellPrice: 5000, stock: 10 });
    const created = await call('POST', '/api/orders', {
      items: [{ productId: p.json.id, qty: 2, price: 5000 }, { name: 'Đá', qty: 1, price: 2000 }],
      paymentMethod: 'cash',
      paid: 20000,
    });
    expect(created.status).toBe(201);
    expect(created.json).toMatchObject({ total: 12000, paid: 20000, itemCount: 2 });
    expect(created.json.code).toMatch(/^HD-\d{8}-0001$/);

    const today = await call('GET', '/api/orders');
    expect(today.json.orders.map((o: { id: number }) => o.id)).toEqual([created.json.id]);
    expect(today.json.summary).toEqual({ count: 1, total: 12000, cash: 12000, transfer: 0, debt: 0, debtCollected: { cash: 0, transfer: 0 } });

    expect((await call('GET', `/api/orders/${created.json.id}`)).json.items).toHaveLength(2);
    expect((await call('GET', `/api/products/${p.json.id}`)).json.stock).toBe(8);

    const cancelled = await call('POST', `/api/orders/${created.json.id}/cancel`);
    expect(cancelled.json.status).toBe('cancelled');
    expect((await call('GET', `/api/products/${p.json.id}`)).json.stock).toBe(10);
    expect(await call('POST', `/api/orders/${created.json.id}/cancel`)).toEqual({ status: 409, json: { error: 'Hóa đơn đã hủy' } });
  });

  it('400 có nhãn tiếng Việt: giỏ rỗng, số lượng sai, ngày sai; 404 hóa đơn lạ', async () => {
    const empty = await call('POST', '/api/orders', { items: [], paymentMethod: 'cash' });
    expect(empty.status).toBe(400);
    expect(empty.json.error).toContain('Giỏ hàng');
    const badQty = await call('POST', '/api/orders', { items: [{ qty: -1, price: 1 }], paymentMethod: 'cash' });
    expect(badQty.json.error).toContain('Số lượng');
    expect((await call('GET', '/api/orders?date=29-09-2026')).status).toBe(400);
    expect((await call('GET', '/api/orders?date=2026-13-45')).status).toBe(400);
    expect((await call('GET', '/api/orders/9999')).status).toBe(404);
  });

  it('cài đặt: GET mặc định, PUT rồi GET', async () => {
    expect((await call('GET', '/api/settings')).json.storeName).toBe('Tạp hóa');
    const put = await call('PUT', '/api/settings', { storeName: 'Tạp hóa Út', bankAccountName: 'út em' });
    expect(put.json).toMatchObject({ storeName: 'Tạp hóa Út', bankAccountName: 'UT EM', autoPrint: true });
    expect((await call('GET', '/api/settings')).json.storeName).toBe('Tạp hóa Út');
    expect((await call('PUT', '/api/settings', { bankBin: '12' })).status).toBe(400);
  });
});
