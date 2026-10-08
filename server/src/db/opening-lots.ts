// server/src/db/opening-lots.ts
import type Database from 'better-sqlite3';

/**
 * Cùng ý với migration 0008 (mỗi sản phẩm có tồn nhận một lô "Tồn đầu" bằng tồn và giá vốn hiện tại) nhưng thêm điều kiện
 * chưa có lô (`not exists`), vì câu này chạy lại được sau khi khôi phục bản sao.
 */
export const OPENING_LOTS_SQL = `insert into lots (product_id, import_item_id, qty_in, remaining, cost_price, expires_on, note, created_at)
  select id, null, stock, stock, cost_price, null, 'Tồn đầu', updated_at from products
  where stock <> 0 and not exists (select 1 from lots where lots.product_id = products.id)`;

/** Dùng sau khi khôi phục bản sao từ phiên bản chưa có lô (migration không chạy lại trên dữ liệu chép vào). */
export function seedOpeningLots(sqlite: Database.Database): number {
  return sqlite.prepare(OPENING_LOTS_SQL).run().changes;
}
