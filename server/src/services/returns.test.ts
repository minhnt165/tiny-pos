import { beforeEach, describe, expect, it } from 'vitest';
import {
  customerCreateSchema,
  customerPaymentSchema,
  orderInputSchema,
  productInputSchema,
  productUnitInputSchema,
  returnInputSchema,
  returnListQuerySchema,
} from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { stockMovements } from '../db/schema.js';
import { createTestDb } from '../db/test-db.js';
import { collectDebt, createCustomer, deleteCustomer, getCustomer, listCustomerTransactions } from './customers.js';
import { cancelOrder, createOrder, getOrder } from './orders.js';
import { createUnit } from './product-units.js';
import { createProduct, getProduct } from './products.js';
import { cancelReturn, createReturn, listReturns } from './returns.js';

const VN = 420;
const at = (iso: string) => ({ now: new Date(iso), tzOffsetMin: VN });
const D29 = at('2026-09-29T03:00:00.000Z'); // 10:00 ngày 29/9 giờ VN: ngày bán
const D30 = at('2026-09-30T03:00:00.000Z'); // 10:00 ngày 30/9 giờ VN: ngày trả

let db: Db;
beforeEach(() => {
  db = createTestDb();
});
const product = (o: Record<string, unknown>) => createProduct(db, productInputSchema.parse(o));
const order = (o: Record<string, unknown>, clock = D29) =>
  createOrder(db, orderInputSchema.parse({ paymentMethod: 'cash', paid: 10_000_000, ...o }), clock);
const ret = (o: Record<string, unknown>, clock = D30) => createReturn(db, returnInputSchema.parse(o), clock);
const movements = () =>
  db
    .select()
    .from(stockMovements)
    .all()
    .filter((m) => m.type !== 'sale' && m.note !== 'Tồn đầu') // bỏ movement bán và tồn đầu lúc tạo sản phẩm
    .map((m) => [m.type, m.productId, m.qty, m.note]);

/** Bia 12.000 (vốn 10.000), thùng 24 lon 280.000; đơn tiền mặt 2 lon + 1 thùng + 1 túi đá 5.000, giảm 9.000 → phải trả 300.000. */
function seedCashOrder() {
  const bia = product({ name: 'Bia', unit: 'lon', sellPrice: 12000, costPrice: 10000, stock: 100 });
  const crate = createUnit(db, bia.id, productUnitInputSchema.parse({ name: 'Thùng', factor: 24, sellPrice: 280000 }));
  const o = order({
    discount: 9000,
    items: [
      { productId: bia.id, qty: 2, price: 12000 },
      { productId: bia.id, unitId: crate.id, qty: 1, price: 280000 },
      { name: 'Túi đá', qty: 1, price: 5000 },
    ],
  });
  const [lon, thung, da] = o.items.map((i) => i.id) as [number, number, number];
  return { bia, o, lon, thung, da };
}

describe('createReturn', () => {
  it('trả một phần đơn tiền mặt: mã TH theo ngày trả, tiền hoàn sau giảm giá, hoàn tiền mặt, nhập lại kho theo factor', () => {
    const { bia, o, lon } = seedCashOrder();
    const r = ret({ orderId: o.id, items: [{ orderItemId: lon, qty: 1 }], note: 'Lon móp' });
    expect(r).toMatchObject({
      code: 'TH-20260930-0001',
      orderId: o.id,
      orderCode: o.code,
      refund: 11651,
      debtReduced: 0,
      cashRefund: 11651,
      status: 'done',
      itemCount: 1,
      note: 'Lon móp',
      createdAt: '2026-09-30T03:00:00.000Z',
    });
    expect(r.items).toMatchObject([{ orderItemId: lon, productName: 'Bia', unit: 'lon', qty: 1, restock: true, amount: 11651, cost: 10000 }]);
    expect(getProduct(db, bia.id).stock).toBe(75);
    expect(movements()).toEqual([['return', bia.id, 1, 'Trả hàng TH-20260930-0001']]);
    const after = getOrder(db, o.id);
    expect(after.items.map((i) => i.returnedQty)).toEqual([1, 0, 0]);
    expect(after).toMatchObject({ refunded: 11651, customerDebt: null });
    expect(after.returns.map((x) => x.code)).toEqual(['TH-20260930-0001']);
  });

  it('trả nhiều lần đến hết: tổng hoàn đúng bằng số phải trả; thùng không nhập kho thì không cộng tồn; món ngoài không nhập kho', () => {
    const { bia, o, lon, thung, da } = seedCashOrder();
    const a = ret({ orderId: o.id, items: [{ orderItemId: lon, qty: 1 }] });
    const b = ret({ orderId: o.id, items: [{ orderItemId: lon, qty: 1 }, { orderItemId: da, qty: 1 }] });
    const c = ret({ orderId: o.id, items: [{ orderItemId: thung, qty: 1, restock: false }] });
    expect([a.refund, b.refund, c.refund]).toEqual([11651, 16504, 271845]);
    expect(a.refund + b.refund + c.refund).toBe(o.payable);
    expect(b.code).toBe('TH-20260930-0002');
    expect(b.items.find((i) => i.orderItemId === da)).toMatchObject({ productId: null, restock: false, amount: 4854 });
    expect(c.items[0]).toMatchObject({ restock: false, cost: 240000 });
    expect(getProduct(db, bia.id).stock).toBe(76);
    expect(getOrder(db, o.id).refunded).toBe(300000);
  });

  it('400: vượt số còn lại, dòng không thuộc hóa đơn, trùng dòng; 404 hóa đơn không có; 409 hóa đơn đã hủy', () => {
    const { o, lon } = seedCashOrder();
    ret({ orderId: o.id, items: [{ orderItemId: lon, qty: 1 }] });
    expect(() => ret({ orderId: o.id, items: [{ orderItemId: lon, qty: 2 }] })).toThrow('Số lượng trả vượt số còn lại của Bia');
    expect(() => ret({ orderId: o.id, items: [{ orderItemId: 9999, qty: 1 }] })).toThrow('Dòng trả hàng không hợp lệ');
    expect(() =>
      ret({ orderId: o.id, items: [{ orderItemId: lon, qty: 0.5 }, { orderItemId: lon, qty: 0.5 }] }),
    ).toThrow('Dòng trả hàng không hợp lệ');
    expect(() => ret({ orderId: 9999, items: [{ orderItemId: lon, qty: 1 }] })).toThrow('Không tìm thấy hóa đơn');
    const other = order({ items: [{ name: 'Kẹo', qty: 1, price: 1000 }] });
    cancelOrder(db, other.id, D29);
    expect(() => ret({ orderId: other.id, items: [{ orderItemId: other.items[0]!.id, qty: 1 }] })).toThrow(
      'Hóa đơn đã hủy, không trả hàng được',
    );
    expect(getOrder(db, o.id).returns).toHaveLength(1); // các lần lỗi không lưu gì
  });

  it('hàng cân trả số lẻ hai lần: cộng lại đúng thành tiền, lần ba báo vượt', () => {
    const thit = product({ name: 'Thịt', unit: 'kg', sellPrice: 100000, costPrice: 80000, isWeighed: true, stock: 5 });
    const o = order({ items: [{ productId: thit.id, qty: 0.35, price: 100000 }] });
    const line = o.items[0]!.id;
    const a = ret({ orderId: o.id, items: [{ orderItemId: line, qty: 0.2 }] });
    const b = ret({ orderId: o.id, items: [{ orderItemId: line, qty: 0.15 }] });
    expect(a.refund + b.refund).toBe(35000);
    expect(getProduct(db, thit.id).stock).toBeCloseTo(5);
    expect(getOrder(db, o.id).items[0]!.returnedQty).toBe(0.35);
    expect(() => ret({ orderId: o.id, items: [{ orderItemId: line, qty: 0.001 }] })).toThrow('Số lượng trả vượt số còn lại của Thịt');
  });
});

describe('trả hàng đơn ghi nợ', () => {
  const lan = () => createCustomer(db, customerCreateSchema.parse({ name: 'Chị Lan' }));

  it('trừ nợ hiện tại trước, phần dư trả tiền mặt; sổ nợ dòng return âm', () => {
    const bia = product({ name: 'Bia', unit: 'lon', sellPrice: 12000, costPrice: 10000, stock: 100 });
    const c = lan();
    const o = order({ paymentMethod: 'debt', customerId: c.id, paid: 4000, items: [{ productId: bia.id, qty: 2, price: 12000 }] }); // nợ 20.000
    const r = ret({ orderId: o.id, items: [{ orderItemId: o.items[0]!.id, qty: 2 }] });
    expect(r).toMatchObject({ refund: 24000, debtReduced: 20000, cashRefund: 4000, customerId: c.id, customerName: 'Chị Lan' });
    expect(getCustomer(db, c.id).debt).toBe(0);
    expect(listCustomerTransactions(db, c.id)[0]).toMatchObject({
      kind: 'return',
      amount: -20000,
      orderId: o.id,
      note: `Trả hàng ${r.code}`,
      createdAt: '2026-09-30T03:00:00.000Z',
    });
  });

  it('nợ của khách lớn hơn tiền hoàn: trừ nợ hết, không chi tiền mặt; khách đã hết nợ thì trả tiền mặt', () => {
    const c = lan();
    const big = order({ paymentMethod: 'debt', customerId: c.id, paid: 0, items: [{ name: 'Gạo', qty: 1, price: 50000 }] });
    const small = order({ paymentMethod: 'debt', customerId: c.id, paid: 0, items: [{ name: 'Muối', qty: 1, price: 10000 }] });
    expect(ret({ orderId: small.id, items: [{ orderItemId: small.items[0]!.id, qty: 1 }] })).toMatchObject({ debtReduced: 10000, cashRefund: 0 });
    collectDebt(db, c.id, customerPaymentSchema.parse({ amount: 50000, method: 'cash' }), D30);
    expect(ret({ orderId: big.id, items: [{ orderItemId: big.items[0]!.id, qty: 1 }] })).toMatchObject({ debtReduced: 0, cashRefund: 50000 });
    expect(getCustomer(db, c.id).debt).toBe(0);
  });
});

describe('cancelReturn', () => {
  it('trừ lại tồn đã nhập kho bằng adjust, cộng lại nợ đã trừ (return_cancel); phiếu còn với trạng thái Đã hủy; hủy lần hai 409', () => {
    const bia = product({ name: 'Bia', unit: 'lon', sellPrice: 12000, costPrice: 10000, stock: 100 });
    const c = createCustomer(db, customerCreateSchema.parse({ name: 'Chị Lan' }));
    const o = order({ paymentMethod: 'debt', customerId: c.id, paid: 0, items: [{ productId: bia.id, qty: 2, price: 12000 }] });
    const r = ret({ orderId: o.id, items: [{ orderItemId: o.items[0]!.id, qty: 1 }] });
    expect(getProduct(db, bia.id).stock).toBe(99);
    expect(getCustomer(db, c.id).debt).toBe(12000);
    expect(cancelReturn(db, r.id, D30)).toMatchObject({ status: 'cancelled', cancelledAt: '2026-09-30T03:00:00.000Z' });
    expect(getProduct(db, bia.id).stock).toBe(98);
    expect(getCustomer(db, c.id).debt).toBe(24000);
    expect(listCustomerTransactions(db, c.id)[0]).toMatchObject({ kind: 'return_cancel', amount: 12000, note: `Hủy phiếu trả ${r.code}` });
    expect(movements()).toEqual([
      ['return', bia.id, 1, `Trả hàng ${r.code}`],
      ['adjust', bia.id, -1, `Hủy phiếu trả ${r.code}`],
    ]);
    const after = getOrder(db, o.id);
    expect(after.refunded).toBe(0);
    expect(after.items[0]!.returnedQty).toBe(0);
    expect(after.returns.map((x) => x.status)).toEqual(['cancelled']);
    expect(() => cancelReturn(db, r.id, D30)).toThrow('Phiếu trả đã hủy');
    expect(() => cancelReturn(db, 9999, D30)).toThrow('Không tìm thấy phiếu trả');
  });

  it('khách đã xóa (ngừng theo dõi): không hủy được phiếu đã trừ nợ, vì nợ cộng lại sẽ treo không thu được', () => {
    const c = createCustomer(db, customerCreateSchema.parse({ name: 'Chị Lan' }));
    const o = order({ paymentMethod: 'debt', customerId: c.id, paid: 0, items: [{ name: 'Gạo', qty: 1, price: 20000 }] });
    const r = ret({ orderId: o.id, items: [{ orderItemId: o.items[0]!.id, qty: 1 }] });
    expect(getCustomer(db, c.id).debt).toBe(0);
    deleteCustomer(db, c.id);
    expect(() => cancelReturn(db, r.id, D30)).toThrow('Khách đã ngừng theo dõi, không hủy được phiếu trả đã trừ nợ');
    expect(getCustomer(db, c.id).debt).toBe(0);
    expect(getOrder(db, o.id).returns.map((x) => x.status)).toEqual(['done']);
  });

  it('hóa đơn còn phiếu trả thì không hủy được; hủy phiếu trả xong thì hủy được, tồn về như trước khi bán', () => {
    const { bia, o, lon } = seedCashOrder();
    const r = ret({ orderId: o.id, items: [{ orderItemId: lon, qty: 1 }] });
    expect(() => cancelOrder(db, o.id, D30)).toThrow('Hóa đơn đã có phiếu trả, hãy hủy phiếu trả trước');
    expect(getProduct(db, bia.id).stock).toBe(75);
    cancelReturn(db, r.id, D30);
    cancelOrder(db, o.id, D30);
    expect(getProduct(db, bia.id).stock).toBe(100);
  });
});

describe('listReturns', () => {
  it('lọc theo ngày VN của phiếu, trạng thái, tìm mã phiếu / mã hóa đơn / tên món không dấu; summary chỉ theo ngày, bỏ phiếu hủy', () => {
    const { o, lon, da } = seedCashOrder();
    const a = ret({ orderId: o.id, items: [{ orderItemId: lon, qty: 1 }] });
    const b = ret({ orderId: o.id, items: [{ orderItemId: da, qty: 1 }] });
    cancelReturn(db, b.id, D30);
    ret({ orderId: o.id, items: [{ orderItemId: lon, qty: 1 }] }, at('2026-10-01T03:00:00.000Z'));
    const list = (q: Record<string, unknown>) => listReturns(db, returnListQuerySchema.parse(q), D30);
    const day = list({});
    expect(day.returns.map((r) => r.code)).toEqual([b.code, a.code]);
    expect(day.summary).toEqual({ count: 1, refund: 11651, cash: 11651, debt: 0 });
    expect(day).toMatchObject({ total: 2, page: 1, pageSize: 50 });
    expect(list({ status: 'cancelled' }).returns.map((r) => r.id)).toEqual([b.id]);
    expect(list({ q: 'tui da' }).returns.map((r) => r.id)).toEqual([b.id]);
    expect(list({ q: o.code }).total).toBe(2);
    expect(list({ q: a.code.toLowerCase() }).returns.map((r) => r.id)).toEqual([a.id]);
    expect(list({ q: '%' }).total).toBe(0);
    expect(list({ from: '2026-09-30', to: '2026-10-01' }).total).toBe(3);
  });
});
