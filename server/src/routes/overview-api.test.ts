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

describe('API tổng quan', () => {
  it('GET /api/overview trả đủ khóa; không có service sao lưu → backup null', async () => {
    const res = await fetch(`${base}/api/overview`);
    expect(res.status).toBe(200);
    const o = await res.json();
    expect(o.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(o.week.rows).toHaveLength(7);
    expect(o.week.rows[0].period).toBe(o.today);
    expect(o).toMatchObject({
      recentOrders: [],
      lowStock: { count: 0, outCount: 0, items: [] },
      expiring: { count: 0, expiredCount: 0, items: [] },
      customers: { total: 0, count: 0, overdueCount: 0, overdueTotal: 0, top: [] },
      suppliers: { total: 0, count: 0, top: [] },
      stocktake: null,
      backup: null,
    });
  });
});
