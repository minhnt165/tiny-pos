import { beforeEach, describe, expect, it } from 'vitest';
import { importInputSchema, lotListQuerySchema, productInputSchema, settingsInputSchema } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { createTestDb } from '../db/test-db.js';
import { createImport } from './imports.js';
import { disposeLot, expiringOverview, listLots, productLots } from './lots.js';
import { createProduct, getProduct } from './products.js';
import { saveSettings } from './settings.js';

const VN = 420;
const at = (iso: string) => ({ now: new Date(iso), tzOffsetMin: VN });
const TODAY = at('2026-10-08T03:00:00.000Z'); // 10:00 ngày 8/10 giờ VN

let db: Db;
beforeEach(() => {
  db = createTestDb();
});
const product = (o: Record<string, unknown>) => createProduct(db, productInputSchema.parse(o));
// Không ghi NCC thì phải trả đủ: paid = Σ qty × unitCost
const imp = (items: { productId: number; qty: number; unitCost: number; expiresOn?: string | null }[]) =>
  createImport(db, importInputSchema.parse({ paid: items.reduce((s, i) => s + i.qty * i.unitCost, 0), items }), TODAY);
const list = (q: Record<string, unknown> = {}) => listLots(db, lotListQuerySchema.parse(q), TODAY);

/** Sữa: Tồn đầu 2 (không hạn), lô quá hạn 1/10, lô 20/10 (sắp), lô 1/1/2027 (ổn); Mì: tồn 0 không lô. */
function seed() {
  const sua = product({ name: 'Sữa tươi', unit: 'hộp', costPrice: 8000, sellPrice: 10000, stock: 2 });
  const mi = product({ name: 'Mì', costPrice: 3000, sellPrice: 4000 });
  imp([
    { productId: sua.id, qty: 3, unitCost: 9000, expiresOn: '2026-10-01' },
    { productId: sua.id, qty: 4, unitCost: 9500, expiresOn: '2026-10-20' },
    { productId: sua.id, qty: 5, unitCost: 9900, expiresOn: '2027-01-01' },
  ]);
  return { sua, mi };
}

describe('listLots', () => {
  it('mặc định chỉ lô còn hàng, quá hạn trước rồi hạn gần, không hạn cuối; summary không theo lọc trạng thái', () => {
    seed();
    const r = list();
    expect(r.lots.map((l) => [l.expiresOn, l.remaining, l.state, l.daysLeft])).toEqual([
      ['2026-10-01', 3, 'expired', -7],
      ['2026-10-20', 4, 'expiring', 12],
      ['2027-01-01', 5, 'ok', 85],
      [null, 2, 'ok', null],
    ]);
    expect(r.lots[0]).toMatchObject({ productName: 'Sữa tươi', unit: 'hộp', importCode: expect.stringMatching(/^PN-20261008-0001$/), qtyIn: 3, costPrice: 9000 });
    expect(r.lots[3]).toMatchObject({ importId: null, importCode: null });
    expect(r.summary).toEqual({ expiringCount: 1, expiredCount: 1, stockValue: 3 * 9000 + 4 * 9500 + 5 * 9900 + 2 * 8000 });
    expect(r.total).toBe(4);
  });
  it('lọc state, q (không dấu), productId; lô hết hàng chỉ hiện khi chọn empty', () => {
    const { sua } = seed();
    expect(list({ state: 'expired,expiring' }).lots.map((l) => l.expiresOn)).toEqual(['2026-10-01', '2026-10-20']);
    expect(list({ q: 'sua tuoi' }).total).toBe(4);
    expect(list({ q: 'mi' }).total).toBe(0);
    expect(list({ productId: sua.id + 1 }).total).toBe(0);
    disposeLot(db, list({ state: 'expired' }).lots[0]!.id, { note: null }, TODAY);
    expect(list().total).toBe(3);
    expect(list({ state: 'empty' }).lots).toMatchObject([{ expiresOn: '2026-10-01', remaining: 0, state: 'empty' }]);
  });
  it('ngưỡng expiryWarnDays từ cài đặt', () => {
    seed();
    saveSettings(db, settingsInputSchema.parse({ expiryWarnDays: 90 }));
    expect(list().summary.expiringCount).toBe(2);
  });
});

describe('productLots / expiringOverview / disposeLot', () => {
  it('productLots: chỉ lô dương theo FEFO', () => {
    const { sua, mi } = seed();
    expect(productLots(db, sua.id, TODAY).map((l) => l.expiresOn)).toEqual(['2026-10-01', '2026-10-20', '2027-01-01', null]);
    expect(productLots(db, mi.id, TODAY)).toEqual([]);
  });
  it('expiringOverview: đếm và cắt theo giới hạn, quá hạn trước', () => {
    seed();
    const e = expiringOverview(db, 1, TODAY);
    expect(e).toMatchObject({ count: 1, expiredCount: 1 });
    expect(e.items.map((l) => l.state)).toEqual(['expired']);
  });
  it('disposeLot: movement adjust trừ hết số còn, ghi chú có mã phiếu; lô hết → 409', () => {
    const { sua } = seed();
    const lot = list({ state: 'expired' }).lots[0]!;
    const r = disposeLot(db, lot.id, { note: 'mốc' }, TODAY);
    expect(r).toMatchObject({ remaining: 0, state: 'empty' });
    expect(getProduct(db, sua.id).stock).toBe(11);
    expect(() => disposeLot(db, lot.id, { note: null }, TODAY)).toThrow('Lô đã hết hàng');
    expect(() => disposeLot(db, 9999, { note: null }, TODAY)).toThrow('Không tìm thấy lô');
  });
});
