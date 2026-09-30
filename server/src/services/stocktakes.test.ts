import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { orderInputSchema, productInputSchema } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { stockMovements } from '../db/schema.js';
import { createTestDb } from '../db/test-db.js';
import { createOrder } from './orders.js';
import { createProduct, getProduct } from './products.js';
import {
  cancelStocktake,
  countItem,
  finishStocktake,
  getCurrentStocktake,
  listStocktakes,
  openStocktake,
  removeItem,
} from './stocktakes.js';

const VN = 420;
const at = (iso: string) => ({ now: new Date(iso), tzOffsetMin: VN });
const MORNING = at('2026-09-29T03:00:00.000Z');

let db: Db;
beforeEach(() => {
  db = createTestDb();
});
const product = (o: Record<string, unknown>) => createProduct(db, productInputSchema.parse(o));
const sell = (productId: number, qty: number) =>
  createOrder(db, orderInputSchema.parse({ items: [{ productId, qty, price: 1000 }], paymentMethod: 'cash', paid: 1_000_000 }), MORNING);
const adjusts = () =>
  db
    .select()
    .from(stockMovements)
    .where(eq(stockMovements.type, 'adjust'))
    .all()
    .filter((m) => m.note?.startsWith('Kiểm kê')) // bỏ các dòng 'Tồn đầu' do createProduct ghi
    .map((m) => [m.productId, m.qty, m.note]);

describe('stocktakes', () => {
  it('chỉ một phiên mở; mã KK theo ngày; chốt xong mở phiên mới được', () => {
    const s = openStocktake(db, { note: 'quầy nước' }, MORNING);
    expect(s).toMatchObject({ code: 'KK-20260929-01', status: 'open', note: 'quầy nước', itemCount: 0 });
    expect(() => openStocktake(db, { note: null })).toThrow('Đang có phiên kiểm kê chưa chốt');
    expect(getCurrentStocktake(db)?.id).toBe(s.id);
    finishStocktake(db, s.id);
    expect(getCurrentStocktake(db)).toBeNull();
    expect(openStocktake(db, { note: null }, MORNING).code).toBe('KK-20260929-02');
  });

  it('đếm → bán thêm → chốt: tồn cuối = số đếm − số bán sau lúc đếm; món không đếm giữ nguyên', () => {
    const a = product({ name: 'Nước', stock: 10, costPrice: 5000 });
    const b = product({ name: 'Mì', stock: 7 });
    const s = openStocktake(db, { note: null }, MORNING);
    const counted = countItem(db, s.id, a.id, { counted: 8 }, MORNING);
    expect(counted.items).toMatchObject([{ productId: a.id, productName: 'Nước', counted: 8, expected: 10, diff: -2 }]);
    expect(counted).toMatchObject({ itemCount: 1, diffCount: 1, diffValue: -10000 });
    sell(a.id, 2);
    const done = finishStocktake(db, s.id, at('2026-09-29T05:00:00.000Z'));
    expect(done).toMatchObject({ status: 'done', finishedAt: '2026-09-29T05:00:00.000Z' });
    expect(getProduct(db, a.id).stock).toBe(6);
    expect(getProduct(db, b.id).stock).toBe(7);
    expect(adjusts()).toEqual([[a.id, -2, 'Kiểm kê KK-20260929-01']]);
  });

  it('đếm lại cùng món (máy khác) → 1 dòng, ghi đè cả counted lẫn expected', () => {
    const a = product({ name: 'Nước', stock: 10 });
    const s = openStocktake(db, { note: null });
    countItem(db, s.id, a.id, { counted: 8 });
    sell(a.id, 1);
    const again = countItem(db, s.id, a.id, { counted: 9 });
    expect(again.items).toMatchObject([{ counted: 9, expected: 9, diff: 0 }]);
    expect(again.diffCount).toBe(0);
    finishStocktake(db, s.id);
    expect(adjusts()).toEqual([]);
    expect(getProduct(db, a.id).stock).toBe(9);
  });

  it('hàng cân số lẻ; bỏ món đã đếm', () => {
    const a = product({ name: 'Thịt', unit: 'kg', isWeighed: true, stock: 1.5 });
    const b = product({ name: 'Gạo', unit: 'kg', stock: 3 });
    const s = openStocktake(db, { note: null });
    countItem(db, s.id, a.id, { counted: 1.25 });
    countItem(db, s.id, b.id, { counted: 2 });
    expect(removeItem(db, s.id, b.id).items.map((i) => [i.productId, i.diff])).toEqual([[a.id, -0.25]]);
    finishStocktake(db, s.id);
    expect(getProduct(db, a.id).stock).toBeCloseTo(1.25);
    expect(getProduct(db, b.id).stock).toBe(3);
  });

  it('hủy phiên: kho không đổi; đếm/bỏ/chốt/hủy phiên đã đóng → 409', () => {
    const a = product({ name: 'Nước', stock: 10 });
    const s = openStocktake(db, { note: null });
    countItem(db, s.id, a.id, { counted: 3 });
    expect(cancelStocktake(db, s.id).status).toBe('cancelled');
    expect(getProduct(db, a.id).stock).toBe(10);
    expect(() => countItem(db, s.id, a.id, { counted: 1 })).toThrow('Phiên kiểm kê đã đóng');
    expect(() => removeItem(db, s.id, a.id)).toThrow('Phiên kiểm kê đã đóng');
    expect(() => finishStocktake(db, s.id)).toThrow('Phiên kiểm kê đã đóng');
    expect(() => cancelStocktake(db, s.id)).toThrow('Phiên kiểm kê đã đóng');
    expect(() => countItem(db, 999, a.id, { counted: 1 })).toThrow('Không tìm thấy phiên kiểm kê');
  });

  it('lịch sử: chỉ phiên đã chốt/hủy, mới nhất trước, có tóm tắt', () => {
    const a = product({ name: 'Nước', stock: 10, costPrice: 1000 });
    const s1 = openStocktake(db, { note: null });
    countItem(db, s1.id, a.id, { counted: 12 });
    finishStocktake(db, s1.id);
    const s2 = openStocktake(db, { note: null });
    cancelStocktake(db, s2.id);
    openStocktake(db, { note: null });
    expect(listStocktakes(db, 20).map((s) => [s.id, s.status, s.itemCount, s.diffValue])).toEqual([
      [s2.id, 'cancelled', 0, 0],
      [s1.id, 'done', 1, 2000],
    ]);
  });
});
