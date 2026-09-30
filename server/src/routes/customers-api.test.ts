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

describe('API khách hàng và ghi nợ', () => {
  it('nợ đầu kỳ → bán ghi nợ → thu nợ CK → ghi tay → sổ nợ, tổng kết → hủy đơn → xóa còn nợ 409', async () => {
    const c = await call('POST', '/api/customers', { name: 'Chị Lan', phone: '0909', openingDebt: 100000 });
    expect(c.status).toBe(201);
    expect(c.json).toMatchObject({ name: 'Chị Lan', debt: 100000, isActive: true });
    const id = c.json.id;

    const o = await call('POST', '/api/orders', {
      items: [{ name: 'Gạo', qty: 1, price: 50000 }],
      paymentMethod: 'debt',
      customerId: id,
      paid: 20000,
    });
    expect(o.status).toBe(201);
    expect(o.json).toMatchObject({ paymentMethod: 'debt', customerName: 'Chị Lan', paid: 20000, debt: { amount: 30000, balanceAfter: 130000 } });

    const pay = await call('POST', `/api/customers/${id}/payments`, { amount: 50000, method: 'transfer' });
    expect(pay.status).toBe(200);
    expect(pay.json).toMatchObject({
      customer: { debt: 80000 },
      transaction: { kind: 'payment', amount: -50000, method: 'transfer', note: 'Thu nợ', balanceAfter: 80000 },
    });
    expect((await call('POST', `/api/customers/${id}/adjustments`, { amount: 5000, note: 'Quên ghi gói thuốc' })).json.debt).toBe(85000);

    expect((await call('GET', '/api/customers?q=lan')).json).toMatchObject({ totalDebt: 85000, customers: [{ id, debt: 85000 }] });
    const tx = await call('GET', `/api/customers/${id}/transactions`);
    expect(tx.json.map((t: { kind: string }) => t.kind)).toEqual(['manual', 'payment', 'order', 'opening']);
    expect(tx.json[2].orderCode).toBe(o.json.code);

    const day = await call('GET', '/api/orders');
    expect(day.json.summary).toMatchObject({ total: 50000, cash: 20000, transfer: 0, debt: 30000, debtCollected: { cash: 0, transfer: 50000 } });
    expect(day.json.orders[0]).toMatchObject({ customerId: id, customerName: 'Chị Lan' });

    expect((await call('POST', `/api/orders/${o.json.id}/cancel`)).json.status).toBe('cancelled');
    expect((await call('GET', `/api/customers/${id}/transactions`)).json[0]).toMatchObject({ kind: 'order_cancel', amount: -30000 });
    expect(await call('DELETE', `/api/customers/${id}`)).toEqual({ status: 409, json: { error: 'Còn nợ, không xóa được' } });
  });

  it('sửa khách; hết nợ thì xóa được (204) và không còn trong danh sách', async () => {
    const c = await call('POST', '/api/customers', { name: 'Anh Tư' });
    expect((await call('PUT', `/api/customers/${c.json.id}`, { name: 'Anh Tư xe ôm', phone: '0911' })).json).toMatchObject({
      name: 'Anh Tư xe ôm',
      phone: '0911',
      debt: 0,
    });
    expect((await call('DELETE', `/api/customers/${c.json.id}`)).status).toBe(204);
    const list = await call('GET', '/api/customers');
    expect(list.json.customers.map((x: { id: number }) => x.id)).not.toContain(c.json.id);
  });

  it('400 có nhãn tiếng Việt, không ghi sổ; 404 khách lạ', async () => {
    const big = await call('POST', '/api/customers', { name: 'A', openingDebt: 1_000_000_001 });
    expect(big.status).toBe(400);
    expect(big.json.error).toContain('Nợ đầu kỳ');
    const c = await call('POST', '/api/customers', { name: 'Bà Ba', openingDebt: 10000 });
    const noNote = await call('POST', `/api/customers/${c.json.id}/adjustments`, { amount: 1000, note: '   ' });
    expect(noNote.status).toBe(400);
    expect(noNote.json.error).toContain('Ghi chú');
    const frac = await call('POST', `/api/customers/${c.json.id}/payments`, { amount: 1.5, method: 'cash' });
    expect(frac.status).toBe(400);
    expect(frac.json.error).toContain('Số tiền');
    const badMethod = await call('POST', `/api/customers/${c.json.id}/payments`, { amount: 1000, method: 'card' });
    expect(badMethod.json.error).toContain('Hình thức');
    expect((await call('POST', `/api/customers/${c.json.id}/payments`, { amount: 10001, method: 'cash' })).json).toEqual({
      error: 'Thu nhiều hơn số đang nợ',
    });
    expect((await call('GET', `/api/customers/${c.json.id}/transactions`)).json).toHaveLength(1);
    expect((await call('POST', '/api/orders', { items: [{ qty: 1, price: 1000 }], paymentMethod: 'debt' })).json).toEqual({
      error: 'Chưa chọn khách',
    });
    expect((await call('GET', '/api/customers/9999/transactions')).status).toBe(404);
  });
});
