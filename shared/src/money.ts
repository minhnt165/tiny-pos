/** Định dạng tiền VNĐ: 15000 → "15.000đ". */
export function formatMoney(amount: number): string {
  const rounded = Math.round(Math.abs(amount));
  const sign = amount < 0 && rounded !== 0 ? '-' : '';
  const grouped = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${grouped}đ`;
}

/** Làm tròn về bội số 500đ gần nhất (dùng cho hàng cân). */
export function round500(amount: number): number {
  return Math.round(amount / 500) * 500;
}
