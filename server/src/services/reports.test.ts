import { beforeEach, describe, expect, it } from 'vitest';
import {
  customerCreateSchema,
  customerPaymentSchema,
  filterProducts,
  importInputSchema,
  orderInputSchema,
  orderListQuerySchema,
  productInputSchema,
  productReportQuerySchema,
  productUnitInputSchema,
  productViewQuerySchema,
  reportQuerySchema,
  returnInputSchema,
  supplierInputSchema,
} from '@tiny-pos/shared';
import type { OrderDetail } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { createTestDb } from '../db/test-db.js';
import { collectDebt, createCustomer, deleteCustomer, listCustomers } from './customers.js';
import { createImport } from './imports.js';
import { cancelOrder, createOrder, getOrder, listOrders } from './orders.js';
import { createUnit } from './product-units.js';
import { createProduct, listProducts, setProductActive, updateProduct } from './products.js';
import { debtReport, productReport, profitReport } from './reports.js';
import { createReturn } from './returns.js';
import { createSupplier } from './suppliers.js';

const VN = 420;
const at = (iso: string) => ({ now: new Date(iso), tzOffsetMin: VN });
const D29 = at('2026-09-29T03:00:00.000Z'); // 10:00 ngày 29/9 giờ VN
const D28_LATE = at('2026-09-28T16:30:00.000Z'); // 23:30 ngày 28/9 giờ VN
const D29_EARLY = at('2026-09-28T17:30:00.000Z'); // 00:30 ngày 29/9 giờ VN
const VIEW = at('2026-09-29T10:00:00.000Z'); // 17:00 ngày 29/9 giờ VN: lúc xem báo cáo
const SEP29 = { from: '2026-09-29', to: '2026-09-29' };
const q = (o: Record<string, unknown> = {}) => reportQuerySchema.parse(o);

let db: Db;
beforeEach(() => {
  db = createTestDb();
});
const product = (o: Record<string, unknown>) => createProduct(db, productInputSchema.parse(o));
const order = (o: Record<string, unknown>, clock = D29) =>
  createOrder(db, orderInputSchema.parse({ paymentMethod: 'cash', paid: 10_000_000, ...o }), clock);

/**
 * Dữ liệu ngày 29/9: Bia vốn 10.000 bán 12.000, thùng 24 lon 280.000; khách Chị Lan.
 * Đơn hoàn tất: tiền mặt 2 lon giảm 1.000 (23.000 / vốn 20.000); CK 1 thùng (280.000 / 240.000);
 * ghi nợ 1 lon trả trước 5.000 (12.000 / 10.000, nợ 7.000); món ngoài 3 × 10.000 (30.000 / 0).
 * Đơn hủy 10 lon: không tính. Thu nợ Lan 4.000 CK.
 * → Doanh thu 345.000, vốn 270.000, lãi 75.000, 4 đơn; TM 58.000, CK 280.000, ghi nợ 7.000, thu nợ CK 4.000.
 */
function seedSales() {
  const bia = product({ name: 'Bia', unit: 'lon', sellPrice: 12000, costPrice: 10000, stock: 100 });
  const crate = createUnit(db, bia.id, productUnitInputSchema.parse({ name: 'Thùng', factor: 24, sellPrice: 280000 }));
  const lan = createCustomer(db, customerCreateSchema.parse({ name: 'Chị Lan' }));
  order({ items: [{ productId: bia.id, qty: 2, price: 12000 }], discount: 1000 });
  order({ paymentMethod: 'transfer', paid: 280000, items: [{ productId: bia.id, unitId: crate.id, qty: 1, price: 280000 }] });
  order({ paymentMethod: 'debt', paid: 5000, customerId: lan.id, items: [{ productId: bia.id, qty: 1, price: 12000 }] });
  order({ items: [{ name: 'Túi đá', qty: 3, price: 10000 }] });
  const cancelled = order({ items: [{ productId: bia.id, qty: 10, price: 12000 }] });
  cancelOrder(db, cancelled.id, D29);
  collectDebt(db, lan.id, customerPaymentSchema.parse({ amount: 4000, method: 'transfer' }), D29);
  return { bia, crate, lan };
}

const TOTAL_29 = {
  period: '',
  orders: 4,
  revenue: 345000,
  cost: 270000,
  profit: 75000,
  cash: 58000,
  transfer: 280000,
  debt: 7000,
  debtCollected: { cash: 0, transfer: 4000 },
  returns: 0,
};

describe('profitReport', () => {
  it('doanh thu trừ giảm giá, giá vốn snapshot (thùng không nhân factor), món ngoài vốn 0, đơn hủy bỏ; khớp summary trang Hóa đơn', () => {
    seedSales();
    const r = profitReport(db, q(SEP29), VIEW);
    expect(r.range).toEqual({ from: '2026-09-29', to: '2026-09-29', groupBy: 'day' });
    expect(r.total).toEqual(TOTAL_29);
    expect(r.rows).toEqual([{ ...TOTAL_29, period: '2026-09-29' }]);
    const s = listOrders(db, orderListQuerySchema.parse(SEP29), VIEW).summary;
    expect(s).toEqual({ count: 4, total: 345000, cash: 58000, transfer: 280000, debt: 7000, debtCollected: { cash: 0, transfer: 4000 }, returns: { count: 0, refund: 0, cash: 0, debt: 0 } });
  });

  it('ranh giới ngày địa phương: 23:30 ngày 28 vào ngày 28, 00:30 ngày 29 vào ngày 29; mới nhất trước', () => {
    const p = product({ name: 'Mì', sellPrice: 5000, costPrice: 4000, stock: 10 });
    order({ items: [{ productId: p.id, qty: 1, price: 5000 }] }, D28_LATE);
    order({ items: [{ productId: p.id, qty: 2, price: 5000 }] }, D29_EARLY);
    const r = profitReport(db, q({ from: '2026-09-28', to: '2026-09-29' }), VIEW);
    expect(r.rows.map((x) => [x.period, x.orders, x.revenue, x.cost])).toEqual([
      ['2026-09-29', 1, 10000, 8000],
      ['2026-09-28', 1, 5000, 4000],
    ]);
    expect(r.total).toMatchObject({ orders: 2, revenue: 15000, cost: 12000, profit: 3000 });
  });

  it('giá vốn hàng cân là số nguyên: làm tròn từng đơn', () => {
    const p = product({ name: 'Thịt', unit: 'kg', sellPrice: 57000, costPrice: 41000, isWeighed: true, stock: 5 });
    order({ items: [{ productId: p.id, qty: 0.35, price: 57000 }] }); // thành tiền 20.000 (làm tròn 500), vốn 14.350
    order({ items: [{ productId: p.id, qty: 0.333, price: 57000 }] }); // vốn 13.653
    const r = profitReport(db, q(SEP29), VIEW);
    expect(Number.isInteger(r.total.cost)).toBe(true);
    expect(r.total.cost).toBe(14350 + 13653);
  });

  it('≤ 31 ngày gom theo ngày đủ cả ngày trống; > 31 ngày gom theo tháng đủ cả tháng trống', () => {
    seedSales();
    const byDay = profitReport(db, q({ from: '2026-09-01', to: '2026-10-01' }), VIEW);
    expect(byDay.range.groupBy).toBe('day');
    expect(byDay.rows).toHaveLength(31);
    expect(byDay.rows[0]).toMatchObject({ period: '2026-10-01', orders: 0, revenue: 0 });
    expect(byDay.rows[2]).toEqual({ ...TOTAL_29, period: '2026-09-29' });
    expect(byDay.total).toEqual(TOTAL_29);

    const byMonth = profitReport(db, q({ from: '2026-08-31', to: '2026-10-01' }), VIEW);
    expect(byMonth.range.groupBy).toBe('month');
    expect(byMonth.rows.map((x) => [x.period, x.orders])).toEqual([
      ['2026-10', 0],
      ['2026-09', 4],
      ['2026-08', 0],
    ]);
    expect(byMonth.rows[1]).toEqual({ ...TOTAL_29, period: '2026-09' });
  });

  it('không có from/to → tháng này tới hôm nay theo Clock; khoảng không có đơn → toàn số 0, không lỗi', () => {
    const r = profitReport(db, q(), VIEW);
    expect(r.range).toEqual({ from: '2026-09-01', to: '2026-09-29', groupBy: 'day' });
    expect(r.rows).toHaveLength(29);
    expect(r.total).toEqual({ ...TOTAL_29, orders: 0, revenue: 0, cost: 0, profit: 0, cash: 0, transfer: 0, debt: 0, debtCollected: { cash: 0, transfer: 0 } });
  });
});

const pq = (o: Record<string, unknown> = {}) => productReportQuerySchema.parse(o);

describe('productReport', () => {
  it('bán chạy: gom theo sản phẩm quy về đơn vị gốc, món ngoài một dòng, sắp theo sort, tổng của mọi mặt hàng', () => {
    seedSales(); // Bia 2 + 24 + 1 = 27 lon, doanh thu dòng 316.000 (chưa trừ giảm giá 1.000), vốn 270.000 → lãi 46.000
    const keo = product({ name: 'Kẹo', sellPrice: 1000, costPrice: 900, stock: 100 });
    order({ items: [{ productId: keo.id, qty: 50, price: 1000 }] }); // 50.000 / vốn 45.000 → lãi 5.000
    const bia = listProducts(db, { includeInactive: false }).find((p) => p.name === 'Bia')!;

    const byRevenue = productReport(db, pq({ ...SEP29 }), VIEW);
    expect(byRevenue.sort).toBe('revenue');
    expect(byRevenue.topSelling).toEqual([
      { productId: bia.id, name: 'Bia', unit: 'lon', qty: 27, revenue: 316000, profit: 46000 },
      { productId: keo.id, name: 'Kẹo', unit: 'cái', qty: 50, revenue: 50000, profit: 5000 },
      { productId: null, name: 'Món ngoài', unit: 'cái', qty: 3, revenue: 30000, profit: 30000 },
    ]);
    expect(byRevenue.topSellingTotal).toEqual({ count: 3, qty: 80, revenue: 396000, profit: 81000 });

    expect(productReport(db, pq({ ...SEP29, sort: 'qty' }), VIEW).topSelling.map((x) => x.name)).toEqual(['Kẹo', 'Bia', 'Món ngoài']);
    expect(productReport(db, pq({ ...SEP29, sort: 'profit' }), VIEW).topSelling.map((x) => x.name)).toEqual(['Bia', 'Món ngoài', 'Kẹo']);

    const cut = productReport(db, pq({ ...SEP29 }), VIEW, 1);
    expect(cut.topSelling).toHaveLength(1);
    expect(cut.topSellingTotal.count).toBe(3);
  });

  it('đổi tên sản phẩm sau khi bán vẫn gom một dòng, hiện tên mới', () => {
    const { bia } = seedSales();
    updateProduct(db, bia.id, productInputSchema.parse({ name: 'Bia Sài Gòn', unit: 'lon', sellPrice: 12000, costPrice: 10000, stock: 73 }));
    const r = productReport(db, pq({ ...SEP29 }), VIEW);
    expect(r.topSelling.filter((x) => x.productId === bia.id)).toEqual([{ productId: bia.id, name: 'Bia Sài Gòn', unit: 'lon', qty: 27, revenue: 316000, profit: 46000 }]);
  });

  it('không bán được: hàng đang bán, tồn > 0, không có trong đơn của kỳ; sắp theo giá trị tồn giảm dần', () => {
    seedSales(); // Bia còn 73 lon × 10.000 = 730.000
    product({ name: 'Nước mắm', costPrice: 30000, stock: 10 }); // 300.000
    product({ name: 'Muối', costPrice: 5000, stock: 100 }); // 500.000
    product({ name: 'Hết', costPrice: 5000, stock: 0 });
    const off = product({ name: 'Ngừng', costPrice: 5000, stock: 3 });
    setProductActive(db, off.id, false);

    const r = productReport(db, pq({ ...SEP29 }), VIEW);
    expect(r.slow.map((s) => [s.name, s.stock, s.value])).toEqual([
      ['Muối', 100, 500000],
      ['Nước mắm', 10, 300000],
    ]);
    expect(r.slowCount).toBe(2);
    expect(productReport(db, pq({ ...SEP29 }), VIEW, 1).slow.map((s) => s.name)).toEqual(['Muối']);

    const earlier = productReport(db, pq({ from: '2026-09-01', to: '2026-09-28' }), VIEW);
    expect(earlier.slow.map((s) => s.name)).toEqual(['Bia', 'Muối', 'Nước mắm']);
    expect(earlier.topSelling).toEqual([]);
    expect(earlier.topSellingTotal).toEqual({ count: 0, qty: 0, revenue: 0, profit: 0 });
  });

  it('tồn kho hiện tại: giá trị vốn/bán của hàng đang bán tồn > 0; sắp hết/hết hàng khớp bộ lọc trang Sản phẩm', () => {
    product({ name: 'A', costPrice: 1000, sellPrice: 1500, stock: 10, minStock: 20 }); // sắp hết
    product({ name: 'B', unit: 'kg', costPrice: 2000, sellPrice: 3000, stock: 0.5, isWeighed: true }); // 1.000 / 1.500
    product({ name: 'C', costPrice: 5000, sellPrice: 7000, stock: 0, minStock: 2 }); // hết (và sắp hết theo bộ lọc)
    const off = product({ name: 'D', costPrice: 9000, sellPrice: 9900, stock: 5 });
    setProductActive(db, off.id, false);

    const r = productReport(db, pq(), VIEW);
    expect(r.stock).toEqual({ costValue: 11000, sellValue: 16500, lowCount: 2, outCount: 1 });
    const shown = listProducts(db, { includeInactive: false });
    expect(r.stock.lowCount).toBe(filterProducts(shown, productViewQuerySchema.parse({ stock: 'low' })).length);
    expect(r.stock.outCount).toBe(filterProducts(shown, productViewQuerySchema.parse({ stock: 'out' })).length);
  });
});

describe('debtReport', () => {
  it('nợ hiện tại và top: chỉ người đang theo dõi có nợ > 0, sắp giảm dần, cắt theo limit; ghi nợ/thu nợ trong kỳ bằng Lãi lỗ', () => {
    const { bia, lan } = seedSales(); // Lan nợ 7.000 − 4.000 = 3.000
    const ba = createCustomer(db, customerCreateSchema.parse({ name: 'Cô Ba', openingDebt: 350000 }));
    const tu = createCustomer(db, customerCreateSchema.parse({ name: 'Anh Tư', openingDebt: 20000 }));
    collectDebt(db, tu.id, customerPaymentSchema.parse({ amount: 20000, method: 'cash' }), D29);
    deleteCustomer(db, tu.id); // hết nợ, đã xóa: không tính
    const hung = createSupplier(db, supplierInputSchema.parse({ name: 'Đại lý Hùng' }));
    createSupplier(db, supplierInputSchema.parse({ name: 'Kho Minh' })); // không nợ
    createImport(db, importInputSchema.parse({ supplierId: hung.id, paid: 100000, items: [{ productId: bia.id, qty: 10, unitCost: 15000 }] }), D29); // nợ 50.000

    const r = debtReport(db, q(SEP29), VIEW);
    expect(r.range).toEqual({ from: '2026-09-29', to: '2026-09-29', groupBy: 'day' });
    expect(r.customers).toEqual({
      total: 353000,
      count: 2,
      top: [
        { id: ba.id, name: 'Cô Ba', phone: null, debt: 350000 },
        { id: lan.id, name: 'Chị Lan', phone: null, debt: 3000 },
      ],
    });
    expect(r.customers.total).toBe(listCustomers(db).totalDebt);
    expect(r.suppliers).toEqual({ total: 50000, count: 1, top: [{ id: hung.id, name: 'Đại lý Hùng', phone: null, debt: 50000 }] });
    expect(r.period).toEqual({ debt: 7000, collected: { cash: 20000, transfer: 4000 }, returnDebt: 0 });
    expect(debtReport(db, q(SEP29), VIEW, 1).customers.top.map((c) => c.name)).toEqual(['Cô Ba']);
  });

  it('không ai nợ, không đơn → số 0 và mảng rỗng', () => {
    expect(debtReport(db, q(), VIEW)).toEqual({
      range: { from: '2026-09-01', to: '2026-09-29', groupBy: 'day' },
      customers: { total: 0, count: 0, top: [] },
      suppliers: { total: 0, count: 0, top: [] },
      period: { debt: 0, collected: { cash: 0, transfer: 0 }, returnDebt: 0 },
    });
  });
});

describe('trả hàng trong báo cáo', () => {
  const D30 = at('2026-09-30T03:00:00.000Z'); // 10:00 ngày 30/9 giờ VN
  const VIEW30 = at('2026-09-30T10:00:00.000Z');

  /**
   * Ngày 30 trả: 1 lon của đơn tiền mặt (nhập kho; giá trị dòng 23.000 sau giảm giá → hoàn 11.500), cả thùng của đơn CK
   * (hỏng, không nhập kho → hoàn 280.000, giá vốn không trừ), 1 lon của đơn ghi nợ (Lan còn nợ 3.000 → trừ nợ 3.000, tiền mặt 9.000).
   * → hoàn 303.500, tiền mặt 300.500, trừ nợ 3.000, giá vốn trừ 20.000.
   */
  function seedReturns() {
    seedSales();
    const done = listOrders(db, orderListQuerySchema.parse({ date: '2026-09-29', status: 'done' }), VIEW).orders.map((o) => getOrder(db, o.id));
    const back = (o: OrderDetail, restock = true) =>
      createReturn(db, returnInputSchema.parse({ orderId: o.id, items: [{ orderItemId: o.items[0]!.id, qty: 1, restock }] }), D30);
    back(done.find((o) => o.discount === 1000)!);
    back(done.find((o) => o.paymentMethod === 'transfer')!, false);
    back(done.find((o) => o.paymentMethod === 'debt')!);
  }

  it('lãi lỗ: ngày bán không đổi; ngày trả trừ doanh thu, tiền mặt, ghi nợ; giá vốn chỉ trừ hàng nhập lại kho; vẫn revenue = cash + transfer + debt', () => {
    seedReturns();
    const r = profitReport(db, q({ from: '2026-09-29', to: '2026-09-30' }), VIEW30);
    const [d30, d29] = r.rows;
    expect(d29).toEqual({ ...TOTAL_29, period: '2026-09-29' });
    expect(d30).toEqual({
      period: '2026-09-30',
      orders: 0,
      revenue: -303500,
      cost: -20000,
      profit: -283500,
      cash: -300500,
      transfer: 0,
      debt: -3000,
      debtCollected: { cash: 0, transfer: 0 },
      returns: 303500,
    });
    expect(r.total).toMatchObject({ orders: 4, returns: 303500, revenue: 41500, cost: 250000, profit: -208500, cash: -242500, transfer: 280000, debt: 4000 });
    expect(r.total.revenue).toBe(r.total.cash + r.total.transfer + r.total.debt);
  });

  it('daySummary ngày trả có returns; các số bán ra giữ nguyên nghĩa', () => {
    seedReturns();
    expect(listOrders(db, orderListQuerySchema.parse({ date: '2026-09-30' }), VIEW30).summary).toEqual({
      count: 0,
      total: 0,
      cash: 0,
      transfer: 0,
      debt: 0,
      debtCollected: { cash: 0, transfer: 0 },
      returns: { count: 3, refund: 303500, cash: 300500, debt: 3000 },
    });
  });

  it('mặt hàng: bán chạy trừ phần trả trong kỳ (doanh thu trước giảm giá, giá vốn chỉ phần nhập kho); kỳ chỉ có trả thì không có dòng', () => {
    seedReturns();
    const both = productReport(db, productReportQuerySchema.parse({ from: '2026-09-29', to: '2026-09-30' }), VIEW30);
    expect(both.topSelling.find((x) => x.name === 'Bia')).toMatchObject({ qty: 1, revenue: 12000, profit: -238000 });
    const only30 = productReport(db, productReportQuerySchema.parse({ from: '2026-09-30', to: '2026-09-30' }), VIEW30);
    expect(only30.topSelling).toEqual([]);
  });

  it('công nợ: returnDebt là phần trừ nợ do trả hàng trong kỳ', () => {
    seedReturns();
    expect(debtReport(db, q({ from: '2026-09-30', to: '2026-09-30' }), VIEW30).period).toEqual({
      debt: 0,
      collected: { cash: 0, transfer: 0 },
      returnDebt: 3000,
    });
  });
});
