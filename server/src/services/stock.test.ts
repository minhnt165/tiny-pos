import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { productInputSchema } from '@tiny-pos/shared';
import { createTestDb } from '../db/test-db.js';
import type { Db } from '../db/connection.js';
import { lotMovements, lots, products, stockMovements } from '../db/schema.js';
import { createProduct, getProduct } from './products.js';
import { adjustStockTo, assertLotInvariant, recordMovement } from './stock.js';

let db: Db;
beforeEach(() => {
  db = createTestDb();
});

describe('stock', () => {
  let pid: number;
  beforeEach(() => {
    pid = db.insert(products).values({ name: 'X', stock: 10 }).returning().get()!.id;
  });

  it('recordMovement cộng vào tồn và ghi dòng movement', () => {
    recordMovement(db, { productId: pid, qty: -3, type: 'sale', refId: 7 });
    expect(db.select().from(products).get()?.stock).toBe(7);
    expect(db.select().from(stockMovements).all()).toMatchObject([{ productId: pid, qty: -3, type: 'sale', refId: 7 }]);
  });

  it('adjustStockTo ghi chênh lệch, không ghi gì khi bằng nhau', () => {
    adjustStockTo(db, pid, 12.5, 'Sửa thủ công');
    adjustStockTo(db, pid, 12.5, 'Sửa thủ công');
    expect(db.select().from(products).get()?.stock).toBe(12.5);
    expect(db.select().from(stockMovements).all()).toMatchObject([{ qty: 2.5, type: 'adjust', note: 'Sửa thủ công' }]);
  });

  it('adjustStockTo báo 404 với sản phẩm không tồn tại', () => {
    expect(() => adjustStockTo(db, 999, 1, 'x')).toThrow('Không tìm thấy sản phẩm');
  });
});

const product = (o: Record<string, unknown>) => createProduct(db, productInputSchema.parse(o));
const lotsOf = (productId: number) =>
  db.select({ id: lots.id, qtyIn: lots.qtyIn, remaining: lots.remaining, costPrice: lots.costPrice, expiresOn: lots.expiresOn, note: lots.note })
    .from(lots).where(eq(lots.productId, productId)).orderBy(lots.id).all();
const allocOf = (movementId: number) =>
  db.select({ lotId: lotMovements.lotId, qty: lotMovements.qty }).from(lotMovements).where(eq(lotMovements.movementId, movementId)).all();
const importLot = (productId: number, qty: number, costPrice: number, expiresOn: string | null = null) =>
  recordMovement(db, { productId, qty, type: 'import', newLot: { importItemId: null, costPrice, expiresOn } });

describe('recordMovement với lô', () => {
  it('createProduct có tồn → lô Tồn đầu bằng tồn và giá vốn; tồn 0 → chưa có lô', () => {
    const p = product({ name: 'Bia', costPrice: 9000, sellPrice: 12000, stock: 10 });
    expect(lotsOf(p.id)).toMatchObject([{ qtyIn: 0, remaining: 10, costPrice: 9000, expiresOn: null, note: 'Tồn đầu' }]);
    const q = product({ name: 'Mì', costPrice: 3000, sellPrice: 4000 });
    expect(lotsOf(q.id)).toEqual([]);
    assertLotInvariant(db, p.id);
  });

  it('nhập tạo lô mới với hạn; bán trừ FEFO gối hai lô, trả về alloc kèm giá vốn', () => {
    const p = product({ name: 'Sữa', costPrice: 8000, sellPrice: 10000, stock: 3 }); // lô 1: 3 @8000, không hạn
    importLot(p.id, 10, 9000, '2026-10-20'); // lô 2: hạn gần → trừ trước
    const r = recordMovement(db, { productId: p.id, qty: -12, type: 'sale', refId: 1 });
    expect(r.alloc).toEqual([
      { lotId: 2, qty: -10, costPrice: 9000 },
      { lotId: 1, qty: -2, costPrice: 8000 },
    ]);
    expect(lotsOf(p.id)).toMatchObject([{ remaining: 1 }, { remaining: 0 }]);
    expect(getProduct(db, p.id).stock).toBe(1);
    expect(allocOf(r.movementId)).toEqual([{ lotId: 2, qty: -10 }, { lotId: 1, qty: -2 }]);
    assertLotInvariant(db, p.id);
  });

  it('bán vượt: trừ âm vào lô cuối FEFO; sản phẩm chưa có lô → tạo Tồn đầu rồi trừ âm', () => {
    const p = product({ name: 'Đường', costPrice: 20000, sellPrice: 25000 });
    const r = recordMovement(db, { productId: p.id, qty: -2, type: 'sale' });
    expect(lotsOf(p.id)).toMatchObject([{ qtyIn: 0, remaining: -2, costPrice: 20000, note: 'Tồn đầu' }]);
    expect(r.alloc).toEqual([{ lotId: 1, qty: -2, costPrice: 20000 }]);
    assertLotInvariant(db, p.id);
  });

  it('nhập khi lô âm: bù về 0 rồi dư vào lô mới (remaining < qtyIn)', () => {
    const p = product({ name: 'Đường', costPrice: 20000, sellPrice: 25000 });
    recordMovement(db, { productId: p.id, qty: -3, type: 'sale' });
    importLot(p.id, 20, 21000);
    expect(lotsOf(p.id)).toMatchObject([{ remaining: 0 }, { qtyIn: 20, remaining: 17, costPrice: 21000 }]);
    expect(getProduct(db, p.id).stock).toBe(17);
    assertLotInvariant(db, p.id);
  });

  it('cộng không có đích (kiểm kê thừa): bù âm rồi vào lô mới nhất', () => {
    const p = product({ name: 'Kẹo', costPrice: 500, sellPrice: 1000, stock: 2 });
    importLot(p.id, 5, 600, '2026-12-01');
    recordMovement(db, { productId: p.id, qty: -9, type: 'sale' }); // lô 2 (hạn) trừ 5, lô 1 trừ 4 → -2
    recordMovement(db, { productId: p.id, qty: 3, type: 'adjust', note: 'Kiểm kê' });
    expect(lotsOf(p.id)).toMatchObject([{ remaining: 0 }, { remaining: 1 }]);
    assertLotInvariant(db, p.id);
  });

  it('lotId: trừ thẳng lô đó kể cả âm; lô của sản phẩm khác → 400', () => {
    const p = product({ name: 'A', costPrice: 1, sellPrice: 2, stock: 1 });
    const q = product({ name: 'B', costPrice: 1, sellPrice: 2, stock: 1 });
    const [lotQ] = lotsOf(q.id);
    recordMovement(db, { productId: q.id, qty: -3, type: 'supplier_return', lotId: lotQ!.id });
    expect(lotsOf(q.id)).toMatchObject([{ remaining: -2 }]);
    expect(() => recordMovement(db, { productId: p.id, qty: -1, type: 'supplier_return', lotId: lotQ!.id })).toThrow('Lô không thuộc sản phẩm này');
    assertLotInvariant(db, q.id);
  });

  it('reverseOf: cộng lại đúng lô đã trừ, kể cả khi lô đó đã bị trừ tiếp; một phần chia tỷ lệ', () => {
    const p = product({ name: 'Sữa', costPrice: 8000, sellPrice: 10000, stock: 4 });
    importLot(p.id, 6, 9000, '2026-10-20');
    const sale = recordMovement(db, { productId: p.id, qty: -8, type: 'sale', refId: 1 }); // lô2 -6, lô1 -2
    recordMovement(db, { productId: p.id, qty: -2, type: 'sale', refId: 2 }); // lô1 -2 → lô1 = 0
    const back = recordMovement(db, { productId: p.id, qty: 4, type: 'return', refId: 1, reverseOf: sale.movementId });
    expect(back.alloc).toEqual([{ lotId: 2, qty: 3, costPrice: 9000 }, { lotId: 1, qty: 1, costPrice: 8000 }]);
    expect(lotsOf(p.id)).toMatchObject([{ remaining: 1 }, { remaining: 3 }]);
    recordMovement(db, { productId: p.id, qty: 4, type: 'return', refId: 1, reverseOf: sale.movementId });
    expect(lotsOf(p.id)).toMatchObject([{ remaining: 2 }, { remaining: 6 }]);
    assertLotInvariant(db, p.id);
  });

  it('reverseOf movement không có phân bổ (chứng từ cũ) → luật tự động', () => {
    const p = product({ name: 'Cũ', costPrice: 1000, sellPrice: 2000, stock: 5 });
    const { id } = db.insert(stockMovements).values({ productId: p.id, qty: -2, type: 'sale', refId: 9 }).returning({ id: stockMovements.id }).get();
    const r = recordMovement(db, { productId: p.id, qty: 2, type: 'return', refId: 9, reverseOf: id });
    expect(r.alloc).toEqual([{ lotId: 1, qty: 2, costPrice: 1000 }]);
    expect(lotsOf(p.id)).toMatchObject([{ remaining: 7 }]);
  });

  it('hàng cân: 0,3 kg gối hai lô, không rác nhị phân, bất biến đúng', () => {
    const p = product({ name: 'Gạo', unit: 'kg', isWeighed: true, costPrice: 15000, sellPrice: 18000, stock: 0.1 });
    importLot(p.id, 5, 16000, null);
    const r = recordMovement(db, { productId: p.id, qty: -0.3, type: 'sale' });
    expect(r.alloc).toEqual([{ lotId: 1, qty: -0.1, costPrice: 15000 }, { lotId: 2, qty: -0.2, costPrice: 16000 }]);
    expect(lotsOf(p.id)).toMatchObject([{ remaining: 0 }, { remaining: 4.8 }]);
    assertLotInvariant(db, p.id);
  });

  it('qty quá 3 chữ số lẻ: làm tròn một lần cho movement, lô và tồn; nhỏ hơn 0,0005 → không đổi gì', () => {
    const p = product({ name: 'Gạo', unit: 'kg', isWeighed: true, costPrice: 15000, sellPrice: 18000, stock: 1 });
    const r = recordMovement(db, { productId: p.id, qty: -0.1234, type: 'sale' });
    expect(r.alloc).toEqual([{ lotId: 1, qty: -0.123, costPrice: 15000 }]);
    expect(db.select({ qty: stockMovements.qty }).from(stockMovements).where(eq(stockMovements.id, r.movementId)).get()).toEqual({ qty: -0.123 });
    expect(getProduct(db, p.id).stock).toBe(0.877);
    expect(lotsOf(p.id)).toMatchObject([{ remaining: 0.877 }]);
    assertLotInvariant(db, p.id);
    const tiny = recordMovement(db, { productId: p.id, qty: 0.0004, type: 'return', reverseOf: r.movementId });
    expect(tiny.alloc).toEqual([]);
    expect(getProduct(db, p.id).stock).toBe(0.877);
    assertLotInvariant(db, p.id);
  });

  it('reverseOf một phần với hàng đếm cái: chia theo phần dư lớn nhất, không sinh số lẻ', () => {
    const p = product({ name: 'Sữa', costPrice: 8000, sellPrice: 10000, stock: 1 }); // A: 1, không hạn
    importLot(p.id, 2, 9000, '2026-10-20'); // B: 2, hạn gần → trừ trước
    const [a, b] = lotsOf(p.id);
    const sale = recordMovement(db, { productId: p.id, qty: -3, type: 'sale' }); // B -2, A -1
    const one = recordMovement(db, { productId: p.id, qty: 1, type: 'return', reverseOf: sale.movementId });
    expect(one.alloc).toEqual([{ lotId: b!.id, qty: 1, costPrice: 9000 }]);
    const two = recordMovement(db, { productId: p.id, qty: 2, type: 'return', reverseOf: sale.movementId });
    expect(two.alloc).toEqual([{ lotId: b!.id, qty: 1, costPrice: 9000 }, { lotId: a!.id, qty: 1, costPrice: 8000 }]);
    assertLotInvariant(db, p.id);
  });

  it('alreadyReversed: đảo lẻ nhiều lần cộng dồn đúng phân bổ gốc, không lô nào vượt số gốc', () => {
    const p = product({ name: 'Sữa', costPrice: 8000, sellPrice: 10000, stock: 1 }); // A: 1, không hạn
    importLot(p.id, 2, 9000, '2026-10-20'); // B: 2, hạn gần → trừ trước
    const [a, b] = lotsOf(p.id);
    const sale = recordMovement(db, { productId: p.id, qty: -3, type: 'sale' });
    expect(allocOf(sale.movementId)).toEqual([{ lotId: b!.id, qty: -2 }, { lotId: a!.id, qty: -1 }]);
    const back = (already: number) =>
      recordMovement(db, { productId: p.id, qty: 1, type: 'return', reverseOf: sale.movementId, alreadyReversed: already }).alloc;
    // cộng dồn [B, A]: 1 → [1, 0], 2 → [1, 1], 3 → [2, 1]
    expect(back(0)).toEqual([{ lotId: b!.id, qty: 1, costPrice: 9000 }]);
    expect(back(1)).toEqual([{ lotId: a!.id, qty: 1, costPrice: 8000 }]);
    expect(back(2)).toEqual([{ lotId: b!.id, qty: 1, costPrice: 9000 }]);
    expect(lotsOf(p.id).map((l) => l.remaining)).toEqual([1, 2]);
    assertLotInvariant(db, p.id);
  });

  it('alreadyReversed với 3 lô: phần dư lớn nhất không đơn điệu (Alabama) vẫn cộng dồn đúng từng lô', () => {
    const p = product({ name: 'Sữa', costPrice: 8000, sellPrice: 10000, stock: 1 }); // Tồn đầu 1, cuối FEFO
    importLot(p.id, 3, 9000, '2026-10-20');
    importLot(p.id, 3, 9500, '2026-10-25');
    const sale = recordMovement(db, { productId: p.id, qty: -7, type: 'sale' }); // gốc [3, 3, 1]
    // Chia thẳng 3 rồi 4 theo phần dư lớn nhất: [1, 1, 1] → [2, 2, 0], lô Tồn đầu "lấy lại" 1
    for (let k = 0; k < 7; k++) {
      const r = recordMovement(db, { productId: p.id, qty: 1, type: 'return', reverseOf: sale.movementId, alreadyReversed: k });
      expect(r.alloc.reduce((s, x) => s + x.qty, 0)).toBe(1);
      expect(lotsOf(p.id).every((l) => l.remaining >= 0 && l.remaining <= (l.note === 'Tồn đầu' ? 1 : 3))).toBe(true);
      assertLotInvariant(db, p.id);
    }
    expect(lotsOf(p.id).map((l) => l.remaining)).toEqual([1, 3, 3]);
  });

  it('reverseOf một phần với hàng cân: chia tỷ lệ 3 chữ số, không part âm', () => {
    const p = product({ name: 'Gạo', unit: 'kg', isWeighed: true, costPrice: 15000, sellPrice: 18000, stock: 0.1 }); // A
    importLot(p.id, 0.2, 16000, '2026-10-20'); // B
    const [a, b] = lotsOf(p.id);
    const sale = recordMovement(db, { productId: p.id, qty: -0.3, type: 'sale' }); // B -0,2, A -0,1
    const back = recordMovement(db, { productId: p.id, qty: 0.15, type: 'return', reverseOf: sale.movementId });
    expect(back.alloc).toEqual([{ lotId: b!.id, qty: 0.1, costPrice: 16000 }, { lotId: a!.id, qty: 0.05, costPrice: 15000 }]);
    assertLotInvariant(db, p.id);

    const q = product({ name: 'Đậu', unit: 'kg', isWeighed: true, costPrice: 1000, sellPrice: 2000, stock: 0.001 }); // không hạn → cuối FEFO
    importLot(q.id, 1, 1000, '2026-10-10');
    importLot(q.id, 1, 1000, '2026-10-11');
    importLot(q.id, 1, 1000, '2026-10-12');
    const big = recordMovement(db, { productId: q.id, qty: -3.001, type: 'sale' }); // gốc [1, 1, 1, 0,001]
    const small = recordMovement(db, { productId: q.id, qty: 0.005, type: 'return', reverseOf: big.movementId });
    expect(small.alloc.every((x) => x.qty > 0)).toBe(true);
    expect(small.alloc.reduce((s, x) => s + x.qty, 0)).toBeCloseTo(0.005, 9);
    assertLotInvariant(db, q.id);
  });
});
