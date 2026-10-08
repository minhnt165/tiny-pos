import { QTY_EPS, roundQty } from './return-math.js';
import type { LotState } from './types.js';

/** Số dư một lô, đủ để quyết định thứ tự trừ và giá vốn. */
export interface LotBalance {
  id: number;
  remaining: number;
  costPrice: number;
  expiresOn: string | null;
}

/** Một phần của movement rơi vào một lô: cùng dấu với movement. */
export interface LotDelta {
  lotId: number;
  qty: number;
}

const DAY = 86_400_000;

/** Thứ tự trừ hàng: hết hạn sớm trước, không hạn cuối, cùng hạn thì lô nhập trước (id nhỏ) trước. */
export function sortFefo(lots: LotBalance[]): LotBalance[] {
  return [...lots].sort((a, b) => {
    if (a.expiresOn !== b.expiresOn) {
      if (a.expiresOn === null) return 1;
      if (b.expiresOn === null) return -1;
      return a.expiresOn < b.expiresOn ? -1 : 1;
    }
    return a.id - b.id;
  });
}

/**
 * Trừ `qty` (> 0) khỏi các lô theo FEFO, chỉ lấy phần dương; còn thiếu thì trừ nốt vào lô cuối (cho âm).
 * Danh sách rỗng → [] (caller tạo lô tồn đầu rồi gọi lại). Delta trả về là số âm.
 */
export function allocateOut(lots: LotBalance[], qty: number): LotDelta[] {
  const order = sortFefo(lots);
  if (!order.length) return [];
  const out: LotDelta[] = [];
  let left = roundQty(qty);
  for (const l of order) {
    if (left <= QTY_EPS) break;
    if (l.remaining <= QTY_EPS) continue;
    const take = roundQty(Math.min(l.remaining, left));
    out.push({ lotId: l.id, qty: -take });
    left = roundQty(left - take);
  }
  if (left > QTY_EPS) {
    const last = order[order.length - 1]!;
    const prev = out.find((o) => o.lotId === last.id);
    if (prev) prev.qty = roundQty(prev.qty - left);
    else out.push({ lotId: last.id, qty: -left });
  }
  return out;
}

/** Cộng `qty` (> 0): bù các lô âm về 0 theo FEFO, phần dư vào `targetId`. Delta dương. */
export function allocateIn(lots: LotBalance[], qty: number, targetId: number): LotDelta[] {
  const out: LotDelta[] = [];
  let left = roundQty(qty);
  for (const l of sortFefo(lots)) {
    if (left <= QTY_EPS) break;
    if (l.remaining >= -QTY_EPS) continue;
    const fill = roundQty(Math.min(-l.remaining, left));
    out.push({ lotId: l.id, qty: fill });
    left = roundQty(left - fill);
  }
  if (left > QTY_EPS) {
    const t = out.find((o) => o.lotId === targetId);
    if (t) t.qty = roundQty(t.qty + left);
    else out.push({ lotId: targetId, qty: left });
  }
  return out;
}

/** Giá vốn 1 đơn vị bán từ phân bổ: làm tròn theo đơn vị gốc rồi nhân hệ số (như cách cũ round(cost × factor)). */
export function lineCostPrice(alloc: { qty: number; costPrice: number }[], qtyBase: number, factor: number): number {
  if (qtyBase <= QTY_EPS) return 0;
  const total = alloc.reduce((s, a) => s + Math.abs(a.qty) * a.costPrice, 0);
  return Math.max(0, Math.round(Math.round(total / qtyBase) * factor));
}

/** Số ngày từ `today` tới hạn (âm = đã quá hạn); null khi không hạn. */
export function daysLeft(expiresOn: string | null, today: string): number | null {
  if (expiresOn === null) return null;
  return Math.round((Date.parse(`${expiresOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);
}

/** Trạng thái lô để lọc/tô màu; hết hàng thắng mọi trạng thái hạn. */
export function lotState(lot: { remaining: number; expiresOn: string | null }, today: string, warnDays: number): LotState {
  if (lot.remaining <= QTY_EPS) return 'empty';
  const d = daysLeft(lot.expiresOn, today);
  if (d === null) return 'ok';
  if (d < 0) return 'expired';
  return d <= warnDays ? 'expiring' : 'ok';
}
