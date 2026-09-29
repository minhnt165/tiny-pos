import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../db/test-db.js';
import type { Db } from '../db/connection.js';
import { products, stockMovements } from '../db/schema.js';
import { adjustStockTo, recordMovement } from './stock.js';

let db: Db;
let pid: number;
beforeEach(() => {
  db = createTestDb();
  pid = db.insert(products).values({ name: 'X', stock: 10 }).returning().get()!.id;
});

describe('stock', () => {
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
