import type { PaymentMethod } from './types.js';

/** Sai số khi so số lượng thực (hàng cân). */
export const QTY_EPS = 1e-9;

/** Làm tròn số lượng 3 chữ số (0,2 + 0,15 → 0,35). */
export const roundQty = (n: number) => Math.round(n * 1000) / 1000;

/** Số còn trả được của một dòng hóa đơn (theo đơn vị lúc bán). */
export const remainingQty = (qty: number, returnedQty: number) => Math.max(roundQty(qty - returnedQty), 0);

/**
 * Giá trị sau giảm giá của từng dòng: chia giảm giá của đơn theo tỷ lệ thành tiền, phần lẻ (từng đồng) cho các dòng có
 * phần thập phân lớn nhất (dòng trước thắng khi bằng nhau). Σ kết quả = Σ amounts − discount; không dòng nào âm.
 */
export function lineValues(amounts: number[], discount: number): number[] {
  const total = amounts.reduce((s, a) => s + a, 0);
  if (total <= 0 || discount <= 0) return [...amounts];
  const exact = amounts.map((a) => (discount * a) / total);
  const shares = exact.map((e) => Math.floor(e));
  let left = discount - shares.reduce((s, x) => s + x, 0);
  const byFraction = exact.map((e, i) => ({ i, frac: e - Math.floor(e) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of byFraction) {
    if (left <= 0) break;
    shares[i] = shares[i]! + 1;
    left -= 1;
  }
  return amounts.map((a, i) => a - shares[i]!);
}

/**
 * Tiền hoàn khi trả thêm `now` của dòng có giá trị `value`, mua `qty`, đã trả `before`. Tính theo lũy kế nên trả nhiều
 * lần cộng lại bằng trả một lần; trả tới hết dòng thì đúng bằng `value`.
 */
export function refundFor(value: number, qty: number, before: number, now: number): number {
  const upTo = (q: number) => (q >= qty - QTY_EPS ? value : Math.round((value * q) / qty));
  return upTo(before + now) - upTo(before);
}

export interface RefundSplit {
  debtReduced: number;
  cashRefund: number;
}

/** Đơn ghi nợ: trừ vào nợ hiện tại của khách trước (nợ ≤ 0 thì không trừ), phần dư trả tiền mặt; đơn khác: tiền mặt hết. */
export function splitRefund(refund: number, paymentMethod: PaymentMethod, customerDebt: number | null): RefundSplit {
  const debtReduced = paymentMethod === 'debt' ? Math.min(refund, Math.max(customerDebt ?? 0, 0)) : 0;
  return { debtReduced, cashRefund: refund - debtReduced };
}

export interface ReturnableLine {
  id: number;
  qty: number;
  amount: number;
  returnedQty: number;
}

/** Tiền hoàn từng dòng đang chọn (`picks`: id dòng → số lượng trả); dòng không chọn hoặc 0 không có trong kết quả. */
export function returnAmounts(lines: ReturnableLine[], discount: number, picks: Map<number, number>): Map<number, number> {
  const values = lineValues(lines.map((l) => l.amount), discount);
  const out = new Map<number, number>();
  lines.forEach((l, i) => {
    const q = picks.get(l.id) ?? 0;
    if (q > 0) out.set(l.id, refundFor(values[i]!, l.qty, l.returnedQty, q));
  });
  return out;
}
