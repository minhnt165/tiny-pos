import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { filterParties, filterProducts, sortParties, sortProducts, type PartyLike } from './list-filters.js';
import { partyViewFields, productViewFields } from './schemas/list-filters.js';
import type { Product } from './types.js';

const view = (o: Record<string, unknown>) => z.object(productViewFields).parse(o);
const pv = (o: Record<string, unknown>) => z.object(partyViewFields).parse(o);
let id = 0;
const p = (o: Partial<Product>): Product =>
  ({
    id: ++id,
    name: 'x',
    barcode: null,
    unit: 'cái',
    sellPrice: 0,
    costPrice: 0,
    stock: 10,
    minStock: 0,
    isWeighed: false,
    isActive: true,
    categoryId: null,
    categoryName: null,
    ...o,
  }) as Product;

describe('filterProducts', () => {
  const sua = p({ name: 'Sữa tươi', barcode: '893001', sellPrice: 8000, stock: 2, minStock: 5, categoryId: 1 });
  const thit = p({ name: 'Thịt heo', sellPrice: 120000, stock: 0, isWeighed: true });
  const am = p({ name: 'Nước mắm', barcode: '893002', sellPrice: 40000, stock: -1 });
  const cu = p({ name: 'Kẹo cũ', barcode: '893003', sellPrice: 1000, isActive: false });
  const all = [sua, thit, am, cu];
  const names = (l: Product[]) => l.map((x) => x.name);

  it('mặc định ẩn hàng ngừng bán', () => {
    expect(names(filterProducts(all, view({})))).toEqual(['Sữa tươi', 'Thịt heo', 'Nước mắm']);
    expect(filterProducts(all, view({ includeInactive: '1' }))).toHaveLength(4);
  });
  it('tìm không dấu theo tên hoặc mã vạch', () => {
    expect(names(filterProducts(all, view({ q: 'sua' })))).toEqual(['Sữa tươi']);
    expect(names(filterProducts(all, view({ q: '893002' })))).toEqual(['Nước mắm']);
  });
  it('tồn: sắp hết / hết / âm', () => {
    expect(names(filterProducts(all, view({ stock: 'low' })))).toEqual(['Sữa tươi', 'Nước mắm']);
    expect(names(filterProducts(all, view({ stock: 'out' })))).toEqual(['Thịt heo', 'Nước mắm']);
    expect(names(filterProducts(all, view({ stock: 'negative' })))).toEqual(['Nước mắm']);
  });
  it('hàng cân, không mã vạch, danh mục, khoảng giá', () => {
    expect(names(filterProducts(all, view({ weighed: '1' })))).toEqual(['Thịt heo']);
    expect(names(filterProducts(all, view({ noBarcode: '1' })))).toEqual(['Thịt heo']);
    expect(names(filterProducts(all, view({ categoryId: '1' })))).toEqual(['Sữa tươi']);
    expect(names(filterProducts(all, view({ priceMin: '10000', priceMax: '50000' })))).toEqual(['Nước mắm']);
  });
});

describe('sortProducts', () => {
  const a = p({ name: 'Bia', sellPrice: 20000, stock: 5, costPrice: 1000 });
  const b = p({ name: 'Ấm', sellPrice: 5000, stock: 50, costPrice: 1000 });
  const c = p({ name: 'Cà phê', sellPrice: 9000, stock: 1, costPrice: 100000 });
  const n = (s: Parameters<typeof sortProducts>[1]) => sortProducts([a, b, c], s).map((x) => x.name);
  it('theo tên tiếng Việt, giá, tồn, giá trị tồn', () => {
    expect(n('name')).toEqual(['Ấm', 'Bia', 'Cà phê']);
    expect(n('price-asc')).toEqual(['Ấm', 'Cà phê', 'Bia']);
    expect(n('price-desc')).toEqual(['Bia', 'Cà phê', 'Ấm']);
    expect(n('stock-asc')).toEqual(['Cà phê', 'Bia', 'Ấm']);
    expect(n('stock-desc')).toEqual(['Ấm', 'Bia', 'Cà phê']);
    expect(n('value-desc')).toEqual(['Cà phê', 'Ấm', 'Bia']);
  });
  it('không đổi mảng gốc', () => {
    const list = [a, b];
    sortProducts(list, 'name');
    expect(list).toEqual([a, b]);
  });
});

describe('filterParties / sortParties', () => {
  const x = (o: Partial<PartyLike>): PartyLike => ({ name: 'x', phone: null, debt: 0, isActive: true, lastActivityAt: null, ...o });
  const lan = x({ name: 'Chị Lan', phone: '0911', debt: 50000, lastActivityAt: '2026-09-01T00:00:00.000Z' });
  const duc = x({ name: 'Đức', debt: 0, lastActivityAt: '2026-09-20T00:00:00.000Z' });
  const ba = x({ name: 'Bà Ba', debt: 120000 });
  const cu = x({ name: 'Ông Cũ', debt: 10000, isActive: false });
  const all = [lan, duc, ba, cu];
  const names = (l: PartyLike[]) => l.map((i) => i.name);
  it('ẩn người đã xóa trừ khi bật; tìm không dấu hoặc SĐT; chỉ người đang nợ', () => {
    expect(names(filterParties(all, pv({})))).toEqual(['Chị Lan', 'Đức', 'Bà Ba']);
    expect(filterParties(all, pv({ includeInactive: '1' }))).toHaveLength(4);
    expect(names(filterParties(all, pv({ q: 'duc' })))).toEqual(['Đức']);
    expect(names(filterParties(all, pv({ q: '0911' })))).toEqual(['Chị Lan']);
    expect(names(filterParties(all, pv({ debtOnly: '1' })))).toEqual(['Chị Lan', 'Bà Ba']);
  });
  it('sắp theo tên, nợ giảm dần, giao dịch gần nhất (chưa có xuống cuối)', () => {
    expect(names(sortParties([lan, duc, ba], 'name'))).toEqual(['Bà Ba', 'Chị Lan', 'Đức']);
    expect(names(sortParties([lan, duc, ba], 'debt-desc'))).toEqual(['Bà Ba', 'Chị Lan', 'Đức']);
    expect(names(sortParties([lan, duc, ba], 'recent'))).toEqual(['Đức', 'Chị Lan', 'Bà Ba']);
  });
});
