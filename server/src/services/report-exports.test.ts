import { beforeEach, describe, expect, it } from 'vitest';
import {
  customerCreateSchema,
  orderInputSchema,
  productInputSchema,
  productReportQuerySchema,
  reportQuerySchema,
} from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { createTestDb } from '../db/test-db.js';
import { readWorkbook } from '../xlsx/workbook.js';
import { createCustomer } from './customers.js';
import { createOrder } from './orders.js';
import { createProduct } from './products.js';
import { exportDebtReportXlsx, exportProductReportXlsx, exportProfitReportXlsx } from './report-exports.js';

const VN = 420;
const D29 = { now: new Date('2026-09-29T03:00:00.000Z'), tzOffsetMin: VN };
const VIEW = { now: new Date('2026-09-29T10:00:00.000Z'), tzOffsetMin: VN };

let db: Db;
beforeEach(() => {
  db = createTestDb();
  const sua = createProduct(db, productInputSchema.parse({ name: 'Sữa', sellPrice: 15000, costPrice: 10000, stock: 20 }));
  createProduct(db, productInputSchema.parse({ name: 'Muối', sellPrice: 5000, costPrice: 4000, stock: 30 }));
  const lan = createCustomer(db, customerCreateSchema.parse({ name: 'Chị Lan', openingDebt: 50000 }));
  createOrder(db, orderInputSchema.parse({ paymentMethod: 'cash', paid: 100000, items: [{ productId: sua.id, qty: 2, price: 15000 }] }), D29);
  createOrder(db, orderInputSchema.parse({ paymentMethod: 'debt', paid: 0, customerId: lan.id, items: [{ productId: sua.id, qty: 1, price: 15000 }] }), D29);
});

describe('exportProfitReportXlsx', () => {
  it('sheet Lãi lỗ theo kỳ (kỳ là chữ dd/mm/yyyy), dòng Tổng cuối', async () => {
    const f = await exportProfitReportXlsx(db, reportQuerySchema.parse({ from: '2026-09-28', to: '2026-09-29' }), VIEW);
    expect(f.filename).toBe('bao-cao-lai-lo-20260928-20260929.xlsx');
    const [s] = await readWorkbook(f.buffer);
    expect(s!.name).toBe('Lãi lỗ');
    expect(s!.rows).toEqual([
      ['Kỳ', 'Số đơn', 'Doanh thu', 'Trả hàng', 'Giá vốn', 'Lãi gộp', 'Tiền mặt', 'Chuyển khoản', 'Ghi nợ', 'Thu nợ TM', 'Thu nợ CK'],
      ['29/09/2026', 2, 45000, 0, 30000, 15000, 30000, 0, 15000, 0, 0],
      ['28/09/2026', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      ['Tổng', 2, 45000, 0, 30000, 15000, 30000, 0, 15000, 0, 0],
    ]);
  });
  it('gom theo tháng thì kỳ ghi mm/yyyy', async () => {
    const f = await exportProfitReportXlsx(db, reportQuerySchema.parse({ from: '2026-08-01', to: '2026-09-29' }), VIEW);
    const [s] = await readWorkbook(f.buffer);
    expect(s!.rows.slice(1).map((r) => r[0])).toEqual(['09/2026', '08/2026', 'Tổng']);
  });
});

describe('exportProductReportXlsx', () => {
  it('3 sheet: Bán chạy đủ dòng, Không bán được, Tồn kho', async () => {
    const f = await exportProductReportXlsx(db, productReportQuerySchema.parse({ from: '2026-09-29', to: '2026-09-29', sort: 'qty' }), VIEW);
    expect(f.filename).toBe('bao-cao-mat-hang-20260929.xlsx');
    const sheets = await readWorkbook(f.buffer);
    expect(sheets.map((s) => s.name)).toEqual(['Bán chạy', 'Không bán được', 'Tồn kho']);
    expect(sheets[0]!.rows).toEqual([
      ['Mặt hàng', 'Đơn vị', 'Số lượng', 'Doanh thu', 'Lãi'],
      ['Sữa', 'cái', 3, 45000, 15000],
    ]);
    expect(sheets[1]!.rows).toEqual([
      ['Mặt hàng', 'Đơn vị', 'Tồn', 'Giá trị tồn'],
      ['Muối', 'cái', 30, 120000],
    ]);
    expect(sheets[2]!.rows).toEqual([
      ['Chỉ tiêu', 'Giá trị'],
      ['Tồn kho theo giá vốn', 290000],
      ['Tồn kho theo giá bán', 405000],
      ['Số mặt hàng sắp hết', 0],
      ['Số mặt hàng hết hàng', 0],
    ]);
  });
  it('file xuất đủ mặt hàng, không cắt 50 như màn hình', async () => {
    const items = Array.from({ length: 55 }, (_, i) => {
      const p = createProduct(db, productInputSchema.parse({ name: `Hàng ${String(i).padStart(2, '0')}`, sellPrice: 1000, costPrice: 500, stock: 10 }));
      return { productId: p.id, qty: 1, price: 1000 };
    });
    createOrder(db, orderInputSchema.parse({ paymentMethod: 'cash', paid: 100000, items }), D29);
    const f = await exportProductReportXlsx(db, productReportQuerySchema.parse({ from: '2026-09-29', to: '2026-09-29' }), VIEW);
    const [top] = await readWorkbook(f.buffer);
    expect(top!.rows).toHaveLength(1 + 55 + 1); // tiêu đề + 55 hàng mới + Sữa
  });
});

describe('exportDebtReportXlsx', () => {
  it('2 sheet Khách nợ / Nợ NCC, dòng Tổng cuối', async () => {
    const f = await exportDebtReportXlsx(db, reportQuerySchema.parse({ from: '2026-09-29', to: '2026-09-29' }), VIEW);
    expect(f.filename).toBe('bao-cao-cong-no-20260929.xlsx');
    const sheets = await readWorkbook(f.buffer);
    expect(sheets.map((s) => s.name)).toEqual(['Khách nợ', 'Nợ NCC']);
    expect(sheets[0]!.rows).toEqual([
      ['Tên', 'SĐT', 'Đang nợ'],
      ['Chị Lan', null, 65000],
      ['Tổng', null, 65000],
    ]);
    expect(sheets[1]!.rows).toEqual([
      ['Tên', 'SĐT', 'Còn nợ'],
      ['Tổng', null, 0],
    ]);
  });
});
