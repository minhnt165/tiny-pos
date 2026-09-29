import { describe, expect, it } from 'vitest';
import {
  EMPTY_CART,
  cartReducer,
  customLine,
  lineFromProduct,
  newLineKey,
  parseHeldCarts,
  parseStoredCart,
  stockShortages,
  toOrderItems,
  type Cart,
} from './cart.js';
import type { Product, ProductUnit } from './types.js';

const product = (o: Partial<Product> = {}): Product => ({
  id: 1,
  barcode: '893',
  name: 'Bia Tiger',
  unit: 'lon',
  costPrice: 10000,
  sellPrice: 12000,
  stock: 30,
  isWeighed: false,
  categoryId: null,
  minStock: 0,
  isActive: true,
  createdAt: '',
  updatedAt: '',
  categoryName: null,
  ...o,
});
const crate: ProductUnit = { id: 7, productId: 1, name: 'Thùng', barcode: '894', factor: 24, sellPrice: 280000 };
const add = (cart: Cart, line = lineFromProduct(product(), null)) => cartReducer(cart, { type: 'add', line });

describe('cartReducer', () => {
  it('thêm cùng sản phẩm + cùng đơn vị → cộng số lượng; khác đơn vị → dòng mới', () => {
    let c = add(EMPTY_CART);
    c = add(c);
    c = add(c, lineFromProduct(product(), crate));
    expect(c.lines.map((l) => [l.unitName, l.qty, l.price, l.factor])).toEqual([
      ['lon', 2, 12000, 1],
      ['Thùng', 1, 280000, 24],
    ]);
  });
  it('hàng cân và món ngoài luôn là dòng mới', () => {
    const rice = lineFromProduct(product({ id: 2, name: 'Gạo', unit: 'kg', isWeighed: true }), null, 1.5);
    let c = add(add(EMPTY_CART, rice), rice);
    c = add(add(c, customLine('', 5000, 1)), customLine('', 5000, 1));
    expect(c.lines).toHaveLength(4);
    expect(c.lines[2]).toMatchObject({ productId: null, name: 'Hàng khác', unitName: 'cái' });
  });
  it('update qty ≤ 0 xóa dòng; update giá; setDiscount làm tròn, không âm', () => {
    let c = add(EMPTY_CART);
    const key = c.lines[0]!.key;
    c = cartReducer(c, { type: 'update', key, patch: { price: 11000 } });
    expect(c.lines[0]!.price).toBe(11000);
    c = cartReducer(c, { type: 'setDiscount', discount: -5 });
    expect(c.discount).toBe(0);
    c = cartReducer(c, { type: 'update', key, patch: { qty: 0 } });
    expect(c.lines).toEqual([]);
  });
  it('clear và replace', () => {
    const c = add(EMPTY_CART);
    expect(cartReducer(c, { type: 'clear' })).toEqual(EMPTY_CART);
    expect(cartReducer(EMPTY_CART, { type: 'replace', cart: c })).toBe(c);
  });
});

describe('newLineKey', () => {
  it('duy nhất khi gọi liên tục (không dùng crypto.randomUUID)', () => {
    const keys = new Set(Array.from({ length: 1000 }, newLineKey));
    expect(keys.size).toBe(1000);
  });
});

describe('stockShortages', () => {
  it('cộng dồn lẻ + thùng theo đơn vị gốc rồi so với tồn', () => {
    let c = add(EMPTY_CART, lineFromProduct(product({ stock: 30 }), crate));
    expect(stockShortages(c.lines).size).toBe(0);
    c = add(c, lineFromProduct(product({ stock: 30 }), null, 7));
    expect([...stockShortages(c.lines)]).toEqual([[1, 30]]);
  });
});

describe('toOrderItems', () => {
  it('hàng trong kho gửi productId/unitId, món ngoài gửi tên', () => {
    let c = add(EMPTY_CART, lineFromProduct(product(), crate));
    c = add(c, customLine('Đá', 3000, 2));
    expect(toOrderItems(c.lines)).toEqual([
      { productId: 1, unitId: 7, qty: 1, price: 280000 },
      { productId: null, name: 'Đá', qty: 2, price: 3000 },
    ]);
  });
});

describe('parseStoredCart / parseHeldCarts', () => {
  it('dữ liệu rác hoặc thiếu trường → giỏ trống / danh sách rỗng', () => {
    expect(parseStoredCart(null)).toEqual(EMPTY_CART);
    expect(parseStoredCart('{không phải json')).toEqual(EMPTY_CART);
    expect(parseStoredCart('{"lines":[{"name":"x"}],"discount":0}')).toEqual(EMPTY_CART);
    expect(parseHeldCarts('[1,2]')).toEqual([]);
  });
  it('đọc lại đúng giỏ đã lưu', () => {
    const c = add(EMPTY_CART);
    expect(parseStoredCart(JSON.stringify(c))).toEqual(c);
    const held = [{ id: 'a', at: '2026-09-29T03:00:00.000Z', cart: c }];
    expect(parseHeldCarts(JSON.stringify(held))).toEqual(held);
  });
});
