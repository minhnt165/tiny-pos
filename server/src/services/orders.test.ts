import { beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { customerCreateSchema, orderInputSchema, productInputSchema, productUnitInputSchema } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { stockMovements } from '../db/schema.js';
import { createTestDb } from '../db/test-db.js';
import { cancelOrder, createOrder, getOrder, listOrders } from './orders.js';
import { createUnit, deleteUnit } from './product-units.js';
import { createProduct, getProduct, setProductActive, updateProduct } from './products.js';
import { collectDebt, createCustomer, deleteCustomer, getCustomer, listCustomerTransactions } from './customers.js';

const VN = 420;
const at = (iso: string) => ({ now: new Date(iso), tzOffsetMin: VN });
const MORNING = at('2026-09-29T03:00:00.000Z'); // 10:00 ngày 29/9 giờ VN
const order = (o: Record<string, unknown>) =>
  orderInputSchema.parse({ paymentMethod: 'cash', paid: 10_000_000, ...o });

let db: Db;
beforeEach(() => {
  db = createTestDb();
});
const product = (o: Record<string, unknown>) => createProduct(db, productInputSchema.parse(o));
const crateOf = (productId: number) =>
  createUnit(db, productId, productUnitInputSchema.parse({ name: 'Thùng', factor: 24, sellPrice: 280000 }));
const movements = (type: 'sale' | 'return') =>
  db
    .select()
    .from(stockMovements)
    .where(eq(stockMovements.type, type))
    .all()
    .map((m) => [m.productId, m.qty, m.refId]);

describe('createOrder', () => {
  it('bán lẻ và theo thùng: trừ qty×factor, snapshot giá vốn theo thùng', () => {
    const p = product({ name: 'Bia', unit: 'lon', sellPrice: 12000, costPrice: 10000, stock: 30 });
    const crate = crateOf(p.id);
    const o = createOrder(
      db,
      order({
        items: [
          { productId: p.id, qty: 2, price: 12000 },
          { productId: p.id, unitId: crate.id, qty: 1, price: 280000 },
        ],
      }),
      MORNING,
    );
    expect(o).toMatchObject({ code: 'HD-20260929-0001', total: 304000, payable: 304000, status: 'done', itemCount: 2 });
    expect(o.createdAt).toBe('2026-09-29T03:00:00.000Z');
    expect(o.items).toMatchObject([
      { productName: 'Bia', unit: 'lon', qty: 2, factor: 1, costPrice: 10000, amount: 24000 },
      { productName: 'Bia', unit: 'Thùng', qty: 1, factor: 24, costPrice: 240000, amount: 280000 },
    ]);
    expect(getProduct(db, p.id).stock).toBe(4);
    expect(movements('sale')).toEqual([
      [p.id, -2, o.id],
      [p.id, -24, o.id],
    ]);
  });

  it('cho bán khi tồn không đủ (tồn âm)', () => {
    const p = product({ name: 'Mì', stock: 1 });
    createOrder(db, order({ items: [{ productId: p.id, qty: 3, price: 4000 }] }), MORNING);
    expect(getProduct(db, p.id).stock).toBe(-2);
  });

  it('hàng cân: thành tiền làm tròn 500đ, trừ kho số lẻ', () => {
    const p = product({ name: 'Thịt', unit: 'kg', sellPrice: 57000, isWeighed: true, stock: 5 });
    const o = createOrder(db, order({ items: [{ productId: p.id, qty: 0.35, price: 57000 }] }), MORNING);
    expect(o.items[0]).toMatchObject({ qty: 0.35, amount: 20000 });
    expect(o.total).toBe(20000);
    expect(getProduct(db, p.id).stock).toBeCloseTo(4.65);
  });

  it('món ngoài: tên mặc định "Hàng khác", không sinh movement', () => {
    const o = createOrder(db, order({ items: [{ name: '', qty: 2, price: 5000 }] }), MORNING);
    expect(o.items).toMatchObject([{ productId: null, productName: 'Hàng khác', unit: 'cái', costPrice: 0, amount: 10000 }]);
    expect(db.select().from(stockMovements).all()).toEqual([]);
  });

  it('snapshot giữ nguyên sau khi sửa sản phẩm', () => {
    const p = product({ name: 'Sữa', sellPrice: 15000, costPrice: 12000 });
    const o = createOrder(db, order({ items: [{ productId: p.id, qty: 1, price: 15000 }] }), MORNING);
    updateProduct(db, p.id, productInputSchema.parse({ name: 'Sữa mới', sellPrice: 16000, costPrice: 13000 }));
    expect(getOrder(db, o.id).items[0]).toMatchObject({ productName: 'Sữa', price: 15000, costPrice: 12000 });
  });

  it('mã tăng dần trong ngày, sang ngày VN mới về 0001 (kể cả khi UTC vẫn là hôm trước)', () => {
    const item = { items: [{ qty: 1, price: 1000 }] };
    expect(createOrder(db, order(item), MORNING).code).toBe('HD-20260929-0001');
    expect(createOrder(db, order(item), at('2026-09-29T10:00:00.000Z')).code).toBe('HD-20260929-0002');
    expect(createOrder(db, order(item), at('2026-09-29T17:30:00.000Z')).code).toBe('HD-20260930-0001');
  });

  it('chuyển khoản: paid luôn bằng số phải trả', () => {
    const o = createOrder(
      db,
      order({ items: [{ qty: 1, price: 50000 }], discount: 5000, paymentMethod: 'transfer', paid: 0 }),
      MORNING,
    );
    expect(o).toMatchObject({ total: 50000, discount: 5000, payable: 45000, paid: 45000, paymentMethod: 'transfer' });
  });

  it('400: giảm giá vượt tổng, tiền mặt không đủ, sản phẩm ngừng bán, đơn vị không thuộc sản phẩm', () => {
    const a = product({ name: 'A', barcode: '1' });
    const b = product({ name: 'B', barcode: '2' });
    const crateB = crateOf(b.id);
    expect(() => createOrder(db, order({ items: [{ qty: 1, price: 1000 }], discount: 2000 }))).toThrow(
      'Giảm giá lớn hơn tổng tiền',
    );
    expect(() => createOrder(db, order({ items: [{ qty: 1, price: 1000 }], paid: 500 }))).toThrow(
      'Tiền khách đưa chưa đủ',
    );
    expect(() => createOrder(db, order({ items: [{ productId: a.id, unitId: crateB.id, qty: 1, price: 1 }] }))).toThrow(
      'Đơn vị của "A" không hợp lệ',
    );
    setProductActive(db, a.id, false);
    expect(() => createOrder(db, order({ items: [{ productId: a.id, qty: 1, price: 1 }] }))).toThrow(
      'Sản phẩm "A" không còn bán',
    );
    expect(() => createOrder(db, order({ items: [{ productId: 999, qty: 1, price: 1 }] }))).toThrow(
      'Sản phẩm #999 không còn bán',
    );
  });
});

describe('cancelOrder', () => {
  it('trả kho bằng movement return theo factor lúc bán, kể cả khi đơn vị đã bị xóa; hủy lần hai 409', () => {
    const p = product({ name: 'Bia', stock: 48 });
    const crate = crateOf(p.id);
    const o = createOrder(
      db,
      order({ items: [{ productId: p.id, unitId: crate.id, qty: 1, price: 280000 }, { qty: 1, price: 3000 }] }),
      MORNING,
    );
    deleteUnit(db, p.id, crate.id);
    const c = cancelOrder(db, o.id, at('2026-09-29T04:00:00.000Z'));
    expect(c).toMatchObject({ status: 'cancelled', cancelledAt: '2026-09-29T04:00:00.000Z' });
    expect(getProduct(db, p.id).stock).toBe(48);
    expect(movements('return')).toEqual([[p.id, 24, o.id]]);
    expect(() => cancelOrder(db, o.id)).toThrow('Hóa đơn đã hủy');
  });

  it('không có hóa đơn → 404', () => {
    expect(() => cancelOrder(db, 42)).toThrow('Không tìm thấy hóa đơn');
  });
});

describe('listOrders', () => {
  it('lọc theo ngày VN, mới nhất trước; tóm tắt bỏ đơn hủy, tách tiền mặt / chuyển khoản', () => {
    const item = { items: [{ qty: 1, price: 10000 }] };
    createOrder(db, order(item), at('2026-09-28T16:59:59.000Z')); // 23:59 ngày 28 VN
    const a = createOrder(db, order(item), at('2026-09-28T17:00:00.000Z')); // 00:00 ngày 29 VN
    const b = createOrder(db, order({ ...item, paymentMethod: 'transfer' }), MORNING);
    const c = createOrder(db, order(item), MORNING);
    cancelOrder(db, c.id);
    const r = listOrders(db, '2026-09-29', { tzOffsetMin: VN });
    expect(r.orders.map((o) => o.id)).toEqual([c.id, b.id, a.id]);
    expect(r.orders[0]).toMatchObject({ status: 'cancelled', itemCount: 1 });
    expect(r.summary).toEqual({ count: 2, total: 20000, cash: 10000, transfer: 10000, debt: 0, debtCollected: { cash: 0, transfer: 0 } });
  });
});

describe('đơn ghi nợ', () => {
  const customer = (openingDebt = 0) => createCustomer(db, customerCreateSchema.parse({ name: 'Chị Lan', openingDebt }));
  const debtOrder = (customerId: number | null, paid: number, clock = MORNING) =>
    createOrder(db, order({ items: [{ qty: 1, price: 50000 }], paymentMethod: 'debt', customerId, paid }), clock);

  it('trả 0 và trả một phần: nợ tăng đúng phần thiếu, dòng sổ order, chi tiết có khách và nợ', () => {
    const c = customer(100000);
    const a = debtOrder(c.id, 0);
    const b = debtOrder(c.id, 20000);
    expect(a.debt).toEqual({ amount: 50000, balanceAfter: 150000 });
    expect(b).toMatchObject({
      paymentMethod: 'debt',
      paid: 20000,
      customerId: c.id,
      customerName: 'Chị Lan',
      debt: { amount: 30000, balanceAfter: 180000 },
    });
    expect(getCustomer(db, c.id).debt).toBe(180000);
    expect(listCustomerTransactions(db, c.id)[0]).toMatchObject({
      kind: 'order',
      amount: 30000,
      orderId: b.id,
      orderCode: b.code,
      note: `Bán ${b.code}`,
      createdAt: '2026-09-29T03:00:00.000Z',
    });
  });

  it('thiếu khách, khách không có/đã xóa, trả đủ → 400 và không lưu đơn', () => {
    const c = customer(100000);
    expect(() => debtOrder(null, 0)).toThrow('Chưa chọn khách');
    expect(() => debtOrder(999, 0)).toThrow('Khách hàng không còn theo dõi');
    expect(() => debtOrder(c.id, 50000)).toThrow('Khách trả đủ thì chọn Tiền mặt');
    collectDebt(db, c.id, { amount: 100000, method: 'cash', note: null });
    deleteCustomer(db, c.id);
    expect(() => debtOrder(c.id, 0)).toThrow('Khách hàng không còn theo dõi');
    expect(listOrders(db, '2026-09-29', { tzOffsetMin: VN }).orders).toEqual([]);
  });

  it('đơn tiền mặt gửi kèm customerId → không gắn khách, không ghi nợ', () => {
    const c = customer();
    const o = createOrder(db, order({ items: [{ qty: 1, price: 10000 }], customerId: c.id }), MORNING);
    expect(o).toMatchObject({ customerId: null, customerName: null, debt: null });
    expect(getCustomer(db, c.id).debt).toBe(0);
  });

  it('hủy đơn ghi nợ: dòng order_cancel trừ đúng phần nợ; thu hết rồi hủy → nợ âm; in lại vẫn số lúc bán', () => {
    const c = customer();
    const o = debtOrder(c.id, 10000); // nợ 40.000
    collectDebt(db, c.id, { amount: 40000, method: 'cash', note: null });
    const x = cancelOrder(db, o.id, MORNING);
    expect(getCustomer(db, c.id).debt).toBe(-40000);
    expect(x.debt).toEqual({ amount: 40000, balanceAfter: 40000 });
    expect(listCustomerTransactions(db, c.id)[0]).toMatchObject({ kind: 'order_cancel', amount: -40000, orderId: o.id, note: `Hủy ${o.code}` });
    const ledger = db.get<{ s: number }>(sql`select coalesce(sum(amount), 0) as s from debt_transactions where customer_id = ${c.id}`)?.s;
    expect(getCustomer(db, c.id).debt).toBe(ledger);
  });

  it('hủy đơn ghi nợ của khách đã ngừng theo dõi vẫn được', () => {
    const c = customer();
    const o = debtOrder(c.id, 0);
    collectDebt(db, c.id, { amount: 50000, method: 'cash', note: null });
    deleteCustomer(db, c.id);
    expect(cancelOrder(db, o.id, MORNING).status).toBe('cancelled');
    expect(getCustomer(db, c.id).debt).toBe(-50000);
  });

  it('in lại sau nhiều giao dịch khác của khách vẫn ra nợ cũ / tổng nợ lúc bán', () => {
    const c = customer(100000);
    const a = debtOrder(c.id, 0); // 150.000
    collectDebt(db, c.id, { amount: 70000, method: 'cash', note: null }); // 80.000
    debtOrder(c.id, 0); // 130.000
    expect(getOrder(db, a.id).debt).toEqual({ amount: 50000, balanceAfter: 150000 });
  });

  it('tổng kết ngày VN: total = cash + transfer + debt; thu nợ tách TM/CK, không tính ngày khác', () => {
    const c = customer(200000);
    const item = { items: [{ qty: 1, price: 10000 }] };
    createOrder(db, order(item), MORNING);
    createOrder(db, order({ ...item, paymentMethod: 'transfer' }), MORNING);
    createOrder(db, order({ ...item, paymentMethod: 'debt', customerId: c.id, paid: 4000 }), MORNING);
    const cancelled = createOrder(db, order({ ...item, paymentMethod: 'debt', customerId: c.id, paid: 0 }), MORNING);
    cancelOrder(db, cancelled.id, MORNING);
    collectDebt(db, c.id, { amount: 50000, method: 'cash', note: null }, MORNING);
    collectDebt(db, c.id, { amount: 30000, method: 'transfer', note: null }, MORNING);
    collectDebt(db, c.id, { amount: 1000, method: 'cash', note: null }, at('2026-09-28T16:59:59.000Z')); // 23:59 ngày 28 VN
    expect(listOrders(db, '2026-09-29', { tzOffsetMin: VN }).summary).toEqual({
      count: 3,
      total: 30000,
      cash: 14000,
      transfer: 10000,
      debt: 6000,
      debtCollected: { cash: 50000, transfer: 30000 },
    });
  });
});
