import { and, asc, eq, sql } from 'drizzle-orm';
import { allocateIn, allocateOut, QTY_EPS, roundQty, type LotBalance, type MovementType } from '@tiny-pos/shared';
import type { DbOrTx } from '../db/connection.js';
import { lotMovements, lots, products, stockMovements } from '../db/schema.js';
import { BadRequestError, NotFoundError } from '../errors.js';

export type { MovementType };

export interface NewLot {
  importItemId: number | null;
  costPrice: number;
  expiresOn: string | null;
}

export interface MovementInput {
  productId: number;
  qty: number;
  type: MovementType;
  refId?: number | null;
  note?: string | null;
  /** Nhập: tạo lô mới rồi cộng vào (sau khi bù lô âm). */
  newLot?: NewLot;
  /** Trừ/cộng thẳng một lô (trả NCC chọn lô, bỏ hàng). */
  lotId?: number;
  /** Đảo một movement trước đó theo đúng lô nó đã dùng; movement gốc không có phân bổ → luật tự động. */
  reverseOf?: number;
  /** Đi kèm `reverseOf`: phần (đơn vị gốc) của movement gốc đã được các lần trước đảo (trả lẻ nhiều lần); mặc định 0. */
  alreadyReversed?: number;
}

export interface LotAlloc {
  lotId: number;
  qty: number;
  costPrice: number;
}

export interface MovementResult {
  movementId: number;
  alloc: LotAlloc[];
}

export function lotBalances(tx: DbOrTx, productId: number): LotBalance[] {
  return tx
    .select({ id: lots.id, remaining: lots.remaining, costPrice: lots.costPrice, expiresOn: lots.expiresOn })
    .from(lots)
    .where(eq(lots.productId, productId))
    .orderBy(asc(lots.id))
    .all();
}

/** Lô "Tồn đầu": sản phẩm chưa có lô nào mà đã có thay đổi tồn (tạo sản phẩm có tồn, bán khi chưa nhập). */
function openingLot(tx: DbOrTx, productId: number): LotBalance {
  const p = tx.select({ costPrice: products.costPrice }).from(products).where(eq(products.id, productId)).get();
  if (!p) throw new NotFoundError('Không tìm thấy sản phẩm');
  const { id } = tx
    .insert(lots)
    .values({ productId, importItemId: null, qtyIn: 0, remaining: 0, costPrice: p.costPrice, expiresOn: null, note: 'Tồn đầu' })
    .returning({ id: lots.id })
    .get();
  return { id, remaining: 0, costPrice: p.costPrice, expiresOn: null };
}

/**
 * Chia `want` (≥ 0) theo tỷ lệ các dòng gốc `caps`, mỗi phần trong [0, cap]:
 * mọi dòng gốc nguyên (hàng đếm cái) → chia theo phần dư lớn nhất, không sinh số lẻ (bằng nhau thì dòng trước);
 * có dòng lẻ (hàng cân) → làm tròn 3 chữ số, sai số dồn từ dòng cuối còn chỗ.
 */
function splitReverse(caps: number[], want: number): number[] {
  const total = caps.reduce((s, c) => s + c, 0);
  const whole = caps.every((c) => Number.isInteger(c));
  const exact = caps.map((c) => (c * want) / total);
  const parts = exact.map((e, i) => Math.min(whole ? Math.floor(e + QTY_EPS) : Math.max(roundQty(e), 0), caps[i]!));
  const idx = caps.map((_, i) => i);
  const order = whole
    ? idx.sort((x, y) => {
        const d = exact[y]! - parts[y]! - (exact[x]! - parts[x]!);
        return Math.abs(d) > QTY_EPS ? d : x - y;
      })
    : idx.reverse();
  let diff = roundQty(want - parts.reduce((s, p) => s + p, 0));
  for (const i of order) {
    if (Math.abs(diff) <= QTY_EPS) break;
    const room = roundQty(caps[i]! - parts[i]!);
    const step = diff > 0 ? Math.min(diff, room, whole ? 1 : room) : -Math.min(-diff, parts[i]!);
    parts[i] = roundQty(parts[i]! + step);
    diff = roundQty(diff - step);
  }
  // Đảo nhiều hơn số gốc (caller truyền sai): phần dư vào dòng cuối để bất biến lô vẫn đúng.
  if (diff > QTY_EPS) parts[parts.length - 1] = roundQty(parts[parts.length - 1]! + diff);
  return parts;
}

/**
 * Phần đã đảo cộng dồn khi tổng đã đảo là `want`, đơn điệu theo `want` (đảo 1 rồi 1 = đảo 2) để trả lẻ nhiều lần cộng đúng từng lô.
 * Hàng đếm cái: đi từng đơn vị, mỗi đơn vị vào dòng mà `splitReverse` của tổng mới vượt phần đã chia nhiều nhất (bằng nhau thì
 * dòng còn thiếu so với tỷ lệ nhiều hơn, rồi dòng trước). Trùng `splitReverse` khi nó đơn điệu (luôn đúng với ≤ 2 lô); khi phần dư
 * lớn nhất "lấy lại" của một dòng (nghịch lý Alabama, ≥ 3 lô) thì giữ phần đã chia. Hàng cân: `splitReverse` (lệch ≤ 0,002).
 */
function splitCumulative(caps: number[], want: number): number[] {
  if (!caps.every((c) => Number.isInteger(c))) return splitReverse(caps, want);
  const total = caps.reduce((s, c) => s + c, 0);
  // Đảo toàn phần (thường gặp: hủy cả chứng từ) luôn ra đúng caps: trả thẳng, khỏi đi từng đơn vị O(total).
  if (want >= total - QTY_EPS && roundQty(want - total) <= QTY_EPS) return [...caps];
  const done = caps.map(() => 0);
  const next = (k: number): number => {
    const h = splitReverse(caps, k);
    let best = -1;
    for (let i = 0; i < caps.length; i++) {
      if (done[i]! >= caps[i]!) continue;
      if (best < 0) best = i;
      else {
        const d = h[i]! - done[i]! - (h[best]! - done[best]!);
        const lag = (caps[i]! * k) / total - done[i]! - ((caps[best]! * k) / total - done[best]!);
        if (d > 0 || (d === 0 && lag > QTY_EPS)) best = i;
      }
    }
    return best;
  };
  const n = Math.min(Math.floor(want + QTY_EPS), total);
  for (let k = 1; k <= n; k++) done[next(k)]! += 1;
  // Phần lẻ (đơn vị không nguyên) vào dòng sẽ nhận đơn vị kế tiếp; đảo nhiều hơn số gốc thì dư vào dòng cuối như splitReverse.
  const frac = roundQty(want - n);
  if (frac > QTY_EPS) {
    const i = n < total ? next(n + 1) : caps.length - 1;
    done[i] = roundQty(done[i]! + frac);
  }
  return done;
}

/**
 * Phân bổ ngược của một movement cũ theo đúng các lô nó đã dùng. Đảo một phần: `already` là phần các lần trước đã đảo,
 * lần này lấy phần cộng dồn sau trừ phần cộng dồn trước (`splitCumulative`) từng dòng, nên nhiều lần lẻ cộng lại đúng phân bổ gốc.
 */
function reverseAlloc(tx: DbOrTx, movementId: number, qty: number, already = 0): { lotId: number; qty: number }[] | null {
  const rows = tx
    .select({ lotId: lotMovements.lotId, qty: lotMovements.qty })
    .from(lotMovements)
    .where(eq(lotMovements.movementId, movementId))
    .orderBy(asc(lotMovements.id))
    .all();
  if (!rows.length) return null;
  const caps = rows.map((r) => Math.abs(r.qty));
  const want = Math.abs(qty);
  const before = already > QTY_EPS ? splitCumulative(caps, already) : caps.map(() => 0);
  const after = splitCumulative(caps, roundQty(already + want));
  const parts = after.map((a, i) => Math.max(0, roundQty(a - before[i]!)));
  // Chốt chặn (hàng cân lệch làm tròn): bỏ phần âm làm Σ vượt qty → bớt từ dòng cuối để Σ lô luôn = tồn.
  let excess = roundQty(parts.reduce((s, p) => s + p, 0) - want);
  for (let i = parts.length - 1; i >= 0 && excess > QTY_EPS; i--) {
    const cut = Math.min(excess, parts[i]!);
    parts[i] = roundQty(parts[i]! - cut);
    excess = roundQty(excess - cut);
  }
  const sign = Math.sign(qty);
  return rows.map((r, i) => ({ lotId: r.lotId, qty: sign * parts[i]! })).filter((o) => Math.abs(o.qty) > QTY_EPS);
}

function allocate(tx: DbOrTx, m: MovementInput): LotAlloc[] {
  if (Math.abs(m.qty) <= QTY_EPS) return [];
  let balances = lotBalances(tx, m.productId);
  const withCost = (xs: { lotId: number; qty: number }[]): LotAlloc[] =>
    xs.map((x) => ({ ...x, costPrice: balances.find((b) => b.id === x.lotId)!.costPrice }));
  if (m.reverseOf !== undefined) {
    const r = reverseAlloc(tx, m.reverseOf, m.qty, m.alreadyReversed ?? 0);
    if (r) return withCost(r);
  }
  if (m.lotId !== undefined) {
    const lot = balances.find((b) => b.id === m.lotId);
    if (!lot) throw new BadRequestError('Lô không thuộc sản phẩm này');
    return [{ lotId: lot.id, qty: roundQty(m.qty), costPrice: lot.costPrice }];
  }
  if (m.qty > 0 && m.newLot) {
    const { importItemId, costPrice, expiresOn } = m.newLot;
    const { id } = tx
      .insert(lots)
      .values({ productId: m.productId, importItemId, qtyIn: roundQty(m.qty), remaining: 0, costPrice, expiresOn })
      .returning({ id: lots.id })
      .get();
    balances = [...balances, { id, remaining: 0, costPrice, expiresOn }];
    return withCost(allocateIn(balances, m.qty, id));
  }
  if (!balances.length) balances = [openingLot(tx, m.productId)];
  if (m.qty > 0) return withCost(allocateIn(balances, m.qty, Math.max(...balances.map((b) => b.id))));
  return withCost(allocateOut(balances, -m.qty));
}

/** Cách DUY NHẤT để đổi tồn kho: ghi movement, tách theo lô (lot_movements + lots.remaining), rồi cộng dồn vào products.stock. */
export function recordMovement(tx: DbOrTx, m: MovementInput): MovementResult {
  // Làm tròn 3 chữ số một lần, dùng chung cho movement, lô và tồn để Σ lô luôn = tồn.
  const qty = roundQty(m.qty);
  const { id: movementId } = tx
    .insert(stockMovements)
    .values({ productId: m.productId, qty, type: m.type, refId: m.refId ?? null, note: m.note ?? null })
    .returning({ id: stockMovements.id })
    .get();
  const alloc = allocate(tx, { ...m, qty });
  for (const a of alloc) {
    tx.insert(lotMovements).values({ movementId, lotId: a.lotId, qty: a.qty }).run();
    tx.update(lots)
      .set({ remaining: sql`round(${lots.remaining} + ${a.qty}, 3)` })
      .where(eq(lots.id, a.lotId))
      .run();
  }
  // Cùng biểu thức round 3 chữ số như lots.remaining (tồn cũ trước 0.17 có thể lẻ hơn 3 chữ số)
  tx.update(products)
    .set({ stock: sql`round(${products.stock} + ${qty}, 3)` })
    .where(eq(products.id, m.productId))
    .run();
  return { movementId, alloc };
}

/**
 * Movement của một chứng từ theo thứ tự ghi, để hủy đảo đúng lô từng dòng.
 * `note`: lọc thêm khi một loại dùng chung cho hai chứng từ (`return`: phiếu trả và hủy hóa đơn trùng số id).
 * Cảnh báo: `adjust` dùng chung refId của nhiều bảng (phiếu nhập, phiếu trả, phiếu trả NCC, kiểm kê) nên không gọi
 * `refMovements(…, 'adjust', …)` nếu không lọc thêm theo note.
 */
export function refMovements(tx: DbOrTx, type: MovementType, refId: number, note?: string): { id: number; productId: number }[] {
  return tx
    .select({ id: stockMovements.id, productId: stockMovements.productId })
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.type, type),
        eq(stockMovements.refId, refId),
        note !== undefined ? eq(stockMovements.note, note) : undefined,
      ),
    )
    .orderBy(asc(stockMovements.id))
    .all();
}

/** id movement thứ `i` của chứng từ nếu đúng sản phẩm; không khớp (dữ liệu lạ) → undefined để rơi về luật tự động. */
export const movementAt = (moves: { id: number; productId: number }[], i: number, productId: number): number | undefined =>
  moves[i]?.productId === productId ? moves[i]!.id : undefined;

/** Đưa tồn về đúng `target` bằng 1 movement adjust (kiểm kê, sửa tay). */
export function adjustStockTo(tx: DbOrTx, productId: number, target: number, note: string): void {
  const row = tx.select({ stock: products.stock }).from(products).where(eq(products.id, productId)).get();
  if (!row) throw new NotFoundError('Không tìm thấy sản phẩm');
  const diff = target - row.stock;
  if (Math.abs(diff) < 1e-9) return;
  recordMovement(tx, { productId, qty: diff, type: 'adjust', note });
}

/** Kiểm bất biến Σ lots.remaining = products.stock (test và tự kiểm). */
export function assertLotInvariant(tx: DbOrTx, productId: number): void {
  const stock = tx.select({ stock: products.stock }).from(products).where(eq(products.id, productId)).get()?.stock ?? 0;
  const sum = lotBalances(tx, productId).reduce((s, l) => s + l.remaining, 0);
  if (Math.abs(sum - stock) > 1e-6) throw new Error(`Lô lệch tồn: sản phẩm #${productId} Σ lô ${sum} ≠ tồn ${stock}`);
}
