import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  customerCreateSchema,
  customerPaymentSchema,
  filterProducts,
  importInputSchema,
  orderInputSchema,
  orderListQuerySchema,
  productInputSchema,
  productViewQuerySchema,
  returnInputSchema,
  supplierInputSchema,
} from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { debtTransactions } from '../db/schema.js';
import { createTestDb } from '../db/test-db.js';
import { addManualDebt, collectDebt, createCustomer, listCustomers, listCustomerTransactions } from './customers.js';
import { createImport } from './imports.js';
import { cancelOrder, createOrder, listOrders } from './orders.js';
import { overview } from './overview.js';
import { createProduct, listProducts, setProductActive } from './products.js';
import { cancelReturn, createReturn } from './returns.js';
import { createSupplier } from './suppliers.js';
import { countItem, openStocktake } from './stocktakes.js';

const VN = 420;
const at = (iso: string) => ({ now: new Date(iso), tzOffsetMin: VN });
const NOON = at('2026-09-29T05:00:00.000Z'); // 12:00 ngày 29/9 giờ VN: lúc xem
const LATE_28 = at('2026-09-28T16:30:00.000Z'); // 23:30 ngày 28/9 giờ VN
const EARLY_29 = at('2026-09-28T17:30:00.000Z'); // 00:30 ngày 29/9 giờ VN
const daysAgo = (n: number) => at(new Date(NOON.now.getTime() - n * 86_400_000).toISOString());

let db: Db;
beforeEach(() => {
  db = createTestDb();
});
const product = (o: Record<string, unknown>) => createProduct(db, productInputSchema.parse(o));
const order = (o: Record<string, unknown>, clock = NOON) =>
  createOrder(db, orderInputSchema.parse({ paymentMethod: 'cash', paid: 10_000_000, ...o }), clock);
/** createCustomer không nhận Clock (nợ đầu kỳ ghi giờ máy): lùi ngày mọi bút toán hiện có của khách để giả "nợ từ lâu". */
const backdate = (customerId: number, clock: { now: Date }) =>
  db.update(debtTransactions).set({ createdAt: clock.now.toISOString() }).where(eq(debtTransactions.customerId, customerId)).run();
/** Lùi ngày bút toán ghi nợ tay (addManualDebt không nhận Clock) mới nhất của khách. */
const backdateManual = (customerId: number, clock: { now: Date }) => {
  const tx = listCustomerTransactions(db, customerId).find((t) => t.kind === 'manual')!;
  db.update(debtTransactions).set({ createdAt: clock.now.toISOString() }).where(eq(debtTransactions.id, tx.id)).run();
};

describe('overview – hôm nay, 7 ngày, hóa đơn', () => {
  it('today theo giờ địa phương; week đủ 7 dòng mới nhất trước; rows[0] bằng summary trang Hóa đơn hôm nay; total = Σ rows', () => {
    const bia = product({ name: 'Bia', unit: 'lon', sellPrice: 12000, costPrice: 10000, stock: 100 });
    order({ items: [{ productId: bia.id, qty: 2, price: 12000 }] }, LATE_28); // hôm qua
    order({ items: [{ productId: bia.id, qty: 1, price: 12000 }] }, EARLY_29); // hôm nay 00:30
    order({ paymentMethod: 'transfer', paid: 24000, items: [{ productId: bia.id, qty: 2, price: 12000 }] }); // hôm nay trưa
    const o = overview(db, NOON);
    expect(o.today).toBe('2026-09-29');
    expect(o.week.range).toEqual({ from: '2026-09-23', to: '2026-09-29', groupBy: 'day' });
    expect(o.week.rows.map((r) => r.period)).toEqual(['2026-09-29', '2026-09-28', '2026-09-27', '2026-09-26', '2026-09-25', '2026-09-24', '2026-09-23']);
    expect(o.week.rows[0]).toMatchObject({ orders: 2, revenue: 36000, cost: 30000, profit: 6000, cash: 12000, transfer: 24000 });
    expect(o.week.rows[1]).toMatchObject({ orders: 1, revenue: 24000 });
    const s = listOrders(db, orderListQuerySchema.parse({ from: '2026-09-29', to: '2026-09-29' }), NOON).summary;
    expect(o.week.rows[0]).toMatchObject({ orders: s.count, revenue: s.total, cash: s.cash, transfer: s.transfer, debt: s.debt, debtCollected: s.debtCollected });
    expect(o.week.total.revenue).toBe(o.week.rows.reduce((sum, r) => sum + r.revenue, 0));
  });

  it('recentOrders: chỉ hôm nay, mới nhất trước, kể cả đơn hủy, cắt theo limits.orders', () => {
    const bia = product({ name: 'Bia', unit: 'lon', sellPrice: 12000, costPrice: 10000, stock: 100 });
    order({ items: [{ productId: bia.id, qty: 1, price: 12000 }] }, LATE_28); // hôm qua: không có
    const ids = Array.from({ length: 6 }, () => order({ items: [{ productId: bia.id, qty: 1, price: 12000 }] }).id);
    cancelOrder(db, ids[5], NOON);
    const o = overview(db, NOON, { orders: 5 });
    expect(o.recentOrders.map((r) => r.id)).toEqual([ids[5], ids[4], ids[3], ids[2], ids[1]]);
    expect(o.recentOrders[0]).toMatchObject({ status: 'cancelled', itemCount: 1, payable: 12000, paymentMethod: 'cash' });
    expect(overview(db, NOON).recentOrders).toHaveLength(5);
  });
});

describe('overview – hàng sắp hết', () => {
  it('stock < minStock của hàng đang bán; outCount đếm stock ≤ 0; sắp theo tỉ lệ tăng dần; count đếm cả ngoài limit; khớp filterProducts', () => {
    product({ name: 'Nước', unit: 'chai', sellPrice: 1, stock: 2, minStock: 10 }); // 0,2
    product({ name: 'Kẹo', unit: 'gói', sellPrice: 1, stock: 5, minStock: 10 }); // 0,5
    product({ name: 'Bánh', unit: 'gói', sellPrice: 1, stock: 0, minStock: 4 }); // 0 → hết hàng
    product({ name: 'Đủ', unit: 'cái', sellPrice: 1, stock: 10, minStock: 10 }); // không thấp
    product({ name: 'Không đặt mức', unit: 'cái', sellPrice: 1, stock: 0, minStock: 0 }); // hết nhưng không thấp
    const off = product({ name: 'Ngừng', unit: 'cái', sellPrice: 1, stock: 0, minStock: 5 });
    setProductActive(db, off.id, false);
    const o = overview(db, NOON, { lowStock: 2 });
    expect(o.lowStock.count).toBe(3);
    expect(o.lowStock.outCount).toBe(2);
    expect(o.lowStock.items.map((i) => i.name)).toEqual(['Bánh', 'Nước']);
    expect(o.lowStock.items[0]).toEqual({ productId: expect.any(Number), name: 'Bánh', image: null, unit: 'gói', stock: 0, minStock: 4 });
    expect(overview(db, NOON).lowStock.items).toHaveLength(3);
    const shown = listProducts(db, { includeInactive: false });
    expect(o.lowStock.count).toBe(filterProducts(shown, productViewQuerySchema.parse({ stock: 'low' })).length);
    expect(o.lowStock.outCount).toBe(filterProducts(shown, productViewQuerySchema.parse({ stock: 'out' })).length);
  });

  it('tồn âm với minStock = 0 vẫn là sắp hết và xếp đầu, không lỗi chia 0', () => {
    const am = product({ name: 'Âm', unit: 'cái', sellPrice: 1, stock: 3, minStock: 0 });
    order({ items: [{ productId: am.id, qty: 5, price: 1 }] }); // tồn −2
    product({ name: 'Thấp', unit: 'cái', sellPrice: 1, stock: 1, minStock: 10 });
    const o = overview(db, NOON);
    expect(o.lowStock.items.map((i) => i.name)).toEqual(['Âm', 'Thấp']);
    expect(o.lowStock.items[0].stock).toBe(-2);
  });
});

describe('overview – công nợ và kiểm kê', () => {
  it('khách: chỉ đang theo dõi có nợ > 0; nợ lâu khi khoản nợ chưa trả đã ≥ 30 ngày (mua chịu thêm không làm mới); top cắt theo limits.parties; total = listCustomers().totalDebt', () => {
    const ba = createCustomer(db, customerCreateSchema.parse({ name: 'Cô Ba', openingDebt: 350000 }));
    backdate(ba.id, daysAgo(31)); // 31 ngày: lâu
    const lan = createCustomer(db, customerCreateSchema.parse({ name: 'Chị Lan', openingDebt: 100000 }));
    backdate(lan.id, daysAgo(40));
    collectDebt(db, lan.id, customerPaymentSchema.parse({ amount: 10000, method: 'cash' }), daysAgo(29)); // trả 29 ngày trước: chưa lâu
    const tu = createCustomer(db, customerCreateSchema.parse({ name: 'Anh Tư', openingDebt: 50000 }));
    backdate(tu.id, daysAgo(30)); // đúng 30 ngày: lâu
    const nam = createCustomer(db, customerCreateSchema.parse({ name: 'Anh Năm', openingDebt: 20000 }));
    collectDebt(db, nam.id, customerPaymentSchema.parse({ amount: 20000, method: 'cash' }), daysAgo(60)); // hết nợ: không tính
    backdate(nam.id, daysAgo(60));
    createCustomer(db, customerCreateSchema.parse({ name: 'Chị Sáu', openingDebt: 1000 })); // nợ 1.000 hôm nay (giờ máy)
    const bay = createCustomer(db, customerCreateSchema.parse({ name: 'Chú Bảy', openingDebt: 30000 }));
    backdate(bay.id, daysAgo(60));
    addManualDebt(db, bay.id, { amount: 20000, note: 'Mua chịu thêm' });
    backdateManual(bay.id, daysAgo(5)); // cứ mua chịu thêm mà chưa trả lần nào từ 60 ngày: lâu
    const tam = createCustomer(db, customerCreateSchema.parse({ name: 'Anh Tám', openingDebt: 70000 }));
    backdate(tam.id, daysAgo(50));
    collectDebt(db, tam.id, customerPaymentSchema.parse({ amount: 70000, method: 'cash' }), daysAgo(40)); // trả hết 40 ngày trước
    addManualDebt(db, tam.id, { amount: 10000, note: 'Mua chịu mới' });
    backdateManual(tam.id, daysAgo(3)); // khoản nợ mới chỉ 3 ngày: chưa lâu

    const o = overview(db, NOON, { parties: 3 });
    expect(o.customers.total).toBe(listCustomers(db).totalDebt);
    expect(o.customers).toMatchObject({ total: 551000, count: 6, overdueCount: 3, overdueTotal: 450000 });
    expect(o.customers.top.map((c) => [c.name, c.debt, c.overdue])).toEqual([
      ['Cô Ba', 350000, true],
      ['Chị Lan', 90000, false],
      ['Anh Tư', 50000, true],
    ]);
    expect(o.customers.top[0]).toMatchObject({ id: ba.id, phone: null, owingSince: expect.stringMatching(/^2026-08-29T/), lastPaymentAt: null });
    expect(o.customers.top[1]).toMatchObject({ owingSince: null, lastPaymentAt: expect.stringMatching(/^2026-08-31T/) });
    expect(o.customers.top[2].id).toBe(tu.id);
    const all = overview(db, NOON, { parties: 10 }).customers.top;
    expect(all).toHaveLength(6);
    expect(all.find((c) => c.id === bay.id)).toMatchObject({ debt: 50000, overdue: true, owingSince: expect.stringMatching(/^2026-07-31T/), lastPaymentAt: null });
    expect(all.find((c) => c.id === tam.id)).toMatchObject({ debt: 10000, overdue: false, owingSince: expect.stringMatching(/^2026-09-26T/), lastPaymentAt: expect.stringMatching(/^2026-08-20T/) });
  });

  it('hủy phiếu trả không làm mới mốc nợ lâu: bút toán bù return_cancel không tính là ghi nợ mới', () => {
    const c = createCustomer(db, customerCreateSchema.parse({ name: 'Chị Lan' }));
    const o = order({ paymentMethod: 'debt', customerId: c.id, paid: 0, items: [{ name: 'Gạo', qty: 2, price: 25000 }] }, daysAgo(40));
    collectDebt(db, c.id, customerPaymentSchema.parse({ amount: 10000, method: 'cash' }), daysAgo(35));
    const r = createReturn(db, returnInputSchema.parse({ orderId: o.id, items: [{ orderItemId: o.items[0]!.id, qty: 1 }] }), NOON);
    cancelReturn(db, r.id, NOON);
    expect(overview(db, NOON).customers).toMatchObject({ overdueCount: 1, overdueTotal: 40000 });
  });

  it('NCC: nợ > 0 đang theo dõi, top giảm dần cắt theo limits.parties', () => {
    const bia = product({ name: 'Bia', unit: 'lon', sellPrice: 12000, costPrice: 10000, stock: 100 });
    const hung = createSupplier(db, supplierInputSchema.parse({ name: 'Đại lý Hùng' }));
    const minh = createSupplier(db, supplierInputSchema.parse({ name: 'Kho Minh' }));
    createSupplier(db, supplierInputSchema.parse({ name: 'Không nợ' }));
    createImport(db, importInputSchema.parse({ supplierId: hung.id, paid: 100000, items: [{ productId: bia.id, qty: 10, unitCost: 15000 }] }), NOON); // nợ 50.000
    createImport(db, importInputSchema.parse({ supplierId: minh.id, paid: 0, items: [{ productId: bia.id, qty: 10, unitCost: 15000 }] }), NOON); // nợ 150.000
    const o = overview(db, NOON, { parties: 1 });
    expect(o.suppliers).toEqual({ total: 200000, count: 2, top: [{ id: minh.id, name: 'Kho Minh', phone: null, debt: 150000 }] });
  });

  it('kiểm kê: không có phiếu mở → null; có → tóm tắt không kèm items', () => {
    expect(overview(db, NOON).stocktake).toBeNull();
    const a = product({ name: 'A', unit: 'cái', sellPrice: 1, costPrice: 1, stock: 10 });
    const b = product({ name: 'B', unit: 'cái', sellPrice: 1, costPrice: 1, stock: 10 });
    const s = openStocktake(db, { note: null }, NOON);
    countItem(db, s.id, a.id, { counted: 8 }, NOON);
    countItem(db, s.id, b.id, { counted: 10 }, NOON);
    const st = overview(db, NOON).stocktake!;
    expect(st).toMatchObject({ id: s.id, code: s.code, status: 'open', itemCount: 2, diffCount: 1, diffValue: -2 });
    expect('items' in st).toBe(false);
  });
});

describe('overview – tiệm mới', () => {
  it('DB trống: không ném lỗi, mọi số 0, week đủ 7 ngày', () => {
    const o = overview(db, NOON);
    expect(o).toMatchObject({
      today: '2026-09-29',
      recentOrders: [],
      lowStock: { count: 0, outCount: 0, items: [] },
      customers: { total: 0, count: 0, overdueCount: 0, overdueTotal: 0, top: [] },
      suppliers: { total: 0, count: 0, top: [] },
      stocktake: null,
    });
    expect(o.week.rows).toHaveLength(7);
    expect(o.week.total.orders).toBe(0);
    expect('backup' in o).toBe(false);
  });
});
