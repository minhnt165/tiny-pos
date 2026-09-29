import { round500 } from './money.js';

export interface LineLike {
  qty: number;
  price: number;
  isWeighed: boolean;
}

export interface Totals {
  total: number;
  discount: number;
  payable: number;
}

/** Thành tiền 1 dòng: hàng cân làm tròn 500đ, còn lại làm tròn về đồng. */
export function lineAmount(l: LineLike): number {
  const raw = l.qty * l.price;
  return l.isWeighed ? round500(raw) : Math.round(raw);
}

/** Tổng trước giảm giá, giảm giá và số phải trả; client và server cùng dùng để số tiền luôn khớp. */
export function cartTotals(lines: LineLike[], discount: number): Totals {
  const total = lines.reduce((sum, l) => sum + lineAmount(l), 0);
  return { total, discount, payable: total - discount };
}

/** Gợi ý tiền khách đưa: đủ tiền, bội 10k/50k/100k gần nhất phía trên, 200k, 500k (tối đa 4). */
export function suggestCash(payable: number): number[] {
  if (payable <= 0) return [0];
  const up = (step: number) => Math.ceil(payable / step) * step;
  const candidates = [payable, up(10_000), up(50_000), up(100_000), 200_000, 500_000].filter((v) => v >= payable);
  return [...new Set(candidates)].sort((a, b) => a - b).slice(0, 4);
}

const qtyFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 });

/** 0.35 → "0,35"; 2 → "2"; 1234.5 → "1.234,5". */
export function formatQty(qty: number): string {
  return qtyFormat.format(qty);
}
