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

const get = async (path: string) => {
  const res = await fetch(base + path);
  const isJson = res.headers.get('content-type')?.includes('application/json');
  return { status: res.status, json: isJson ? await res.json() : null, headers: res.headers };
};

describe('API báo cáo', () => {
  it('ba route JSON trả đúng hình; thiếu from/to → tháng này; khóa tab bị bỏ qua', async () => {
    const profit = await get('/api/reports/profit?tab=profit');
    expect(profit.status).toBe(200);
    expect(profit.json.range.from).toMatch(/^\d{4}-\d{2}-01$/);
    expect(profit.json.range.to >= profit.json.range.from).toBe(true);
    expect(profit.json.total).toMatchObject({ period: '', orders: 0, revenue: 0, profit: 0 });
    expect(profit.json.rows.length).toBeGreaterThan(0);

    const products = await get('/api/reports/products?sort=qty');
    expect(products.json).toMatchObject({ sort: 'qty', stock: { costValue: 0, sellValue: 0, lowCount: 0, outCount: 0 }, topSelling: [], slow: [], slowCount: 0 });
    expect((await get('/api/reports/products')).json.sort).toBe('revenue');

    const debt = await get('/api/reports/debt?from=2026-09-01&to=2026-09-30');
    expect(debt.json).toMatchObject({
      range: { from: '2026-09-01', to: '2026-09-30', groupBy: 'day' },
      customers: { total: 0, count: 0, top: [] },
      suppliers: { total: 0, count: 0, top: [] },
      period: { debt: 0, collected: { cash: 0, transfer: 0 } },
    });
  });

  it('query sai → 400 tiếng Việt', async () => {
    expect(await get('/api/reports/profit?from=2026-09-30&to=2026-09-01')).toMatchObject({ status: 400, json: { error: 'Ngày bắt đầu phải trước ngày kết thúc' } });
    expect((await get('/api/reports/products?sort=name')).status).toBe(400);
    expect((await get('/api/reports/debt?from=2025-01-01&to=2026-09-01')).json.error).toBe('Khoảng ngày tối đa 1 năm');
  });

  it('ba route export trả file .xlsx có tên theo khoảng ngày', async () => {
    const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    for (const kind of ['profit', 'products', 'debt']) {
      const res = await get(`/api/reports/${kind}/export.xlsx?from=2026-09-01&to=2026-09-29&tab=${kind}`);
      expect(res.status, kind).toBe(200);
      expect(res.headers.get('content-type'), kind).toBe(XLSX);
      expect(res.headers.get('content-disposition'), kind).toMatch(/^attachment; filename="bao-cao-[a-z-]+-20260901-20260929\.xlsx"$/);
    }
    expect((await get('/api/reports/profit/export.xlsx?from=2026-09-30&to=2026-09-01')).status).toBe(400);
  });
});
