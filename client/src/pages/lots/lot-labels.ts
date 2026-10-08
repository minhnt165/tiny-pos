import type { LotState } from '@tiny-pos/shared';

export const LOT_STATE_LABEL: Record<LotState, string> = { ok: 'Còn hạn', expiring: 'Sắp hết hạn', expired: 'Đã hết hạn', empty: 'Hết hàng' };

/** Chữ nhỏ cạnh hạn: "còn 12 ngày" / "quá 7 ngày" / "hôm nay". */
export function daysLabel(daysLeft: number | null): string {
  if (daysLeft === null) return 'không hạn';
  if (daysLeft === 0) return 'hết hạn hôm nay';
  return daysLeft > 0 ? `còn ${daysLeft} ngày` : `quá ${-daysLeft} ngày`;
}
