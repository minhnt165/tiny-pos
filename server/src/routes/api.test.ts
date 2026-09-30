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

  it('xuất Excel theo bộ lọc, nhập sản phẩm từ CSV và .xlsx', async () => {
    const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const paths = [
      '/api/products/export.xlsx?stock=low&page=3',
      '/api/orders/export.xlsx?pay=cash',
      '/api/imports/export.xlsx?unpaid=1',
      '/api/customers/export.xlsx?debtOnly=1',
      '/api/suppliers/export.xlsx',
    ];
    for (const path of paths) {
      const res = await fetch(base + path);
      expect(res.status, path).toBe(200);
      expect(res.headers.get('content-type'), path).toBe(XLSX);
      expect(res.headers.get('content-disposition'), path).toMatch(/^attachment; filename="[a-z-]+-\d{8}(-\d{8})?\.xlsx"$/);
    }
    const csv = await call('POST', '/api/products/import', 'Tên,Giá bán\nKẹo,5000\n', 'text/csv');
    expect(csv.json).toEqual({ created: 1, updated: 0, errors: [] });
    const file = Buffer.from(await (await fetch(base + '/api/products/export.xlsx')).arrayBuffer());
    const again = await fetch(base + '/api/products/import', { method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: file });
    expect(await again.json()).toMatchObject({ created: 0, errors: [] });
    expect((await call('GET', '/api/products/csv')).status).toBe(400);
  });

  it('xuất Excel: bộ lọc sai → 400 tiếng Việt; nhập file .xls cũ → 400; file quá 10 MB → 413', async () => {
    const bad = await call('GET', '/api/orders/export.xlsx?from=2026-09-30&to=2026-09-01');
    expect(bad).toMatchObject({ status: 400, json: { error: 'Ngày bắt đầu phải trước ngày kết thúc' } });
    const xls = await fetch(base + '/api/products/import', { method: 'POST', body: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1]) });
    expect(xls.status).toBe(400);
    const big = await fetch(base + '/api/products/import', {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: Buffer.alloc(11 * 1024 * 1024),
    });
    expect(big.status).toBe(413);
    expect(await big.json()).toEqual({ error: 'Dữ liệu gửi lên quá lớn (tối đa 10 MB)' });
  });
});
