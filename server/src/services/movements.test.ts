import { describe, expect, it } from 'vitest';
import { importInputSchema, orderInputSchema, productInputSchema } from '@tiny-pos/shared';
import { createTestDb } from '../db/test-db.js';
import { cancelImport, createImport } from './imports.js';
import { listMovements } from './movements.js';
import { cancelOrder, createOrder } from './orders.js';
import { createProduct } from './products.js';
import { countItem, finishStocktake, openStocktake } from './stocktakes.js';

describe('listMovements', () => {
  it('đủ loại, mới nhất trước, mã chứng từ đúng; sản phẩm lạ 404', () => {
    const db = createTestDb();
    const clock = { now: new Date('2026-09-29T03:00:00.000Z'), tzOffsetMin: 420 };
    const p = createProduct(db, productInputSchema.parse({ name: 'Bia', stock: 5 }));
    const im = createImport(db, importInputSchema.parse({ paid: 10000, items: [{ productId: p.id, qty: 1, unitCost: 10000 }] }), clock);
    const o = createOrder(db, orderInputSchema.parse({ items: [{ productId: p.id, qty: 2, price: 12000 }], paymentMethod: 'cash', paid: 24000 }), clock);
    cancelOrder(db, o.id);
    cancelImport(db, im.id);
    const s = openStocktake(db, { note: null }, clock);
    countItem(db, s.id, p.id, { counted: 3 });
    finishStocktake(db, s.id);
    expect(listMovements(db, p.id, 100).map((m) => [m.type, m.qty, m.refCode])).toEqual([
      // tồn 5 +1 −2 +2 −1 = 5, đếm 3 → −2
      ['adjust', -2, 'KK-20260929-01'],
      ['adjust', -1, 'PN-20260929-0001'],
      ['return', 2, 'HD-20260929-0001'],
      ['sale', -2, 'HD-20260929-0001'],
      ['import', 1, 'PN-20260929-0001'],
      ['adjust', 5, null],
    ]);
    expect(listMovements(db, p.id, 2)).toHaveLength(2);
    expect(() => listMovements(db, 999, 10)).toThrow('Không tìm thấy sản phẩm');
  });
});
