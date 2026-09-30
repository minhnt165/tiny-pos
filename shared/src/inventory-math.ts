/** Giá vốn 1 đơn vị gốc từ giá nhập 1 đơn vị đã chọn (thùng = 24 lon…). */
export function baseCost(unitCost: number, factor: number): number {
  return Math.round(unitCost / factor);
}

/** % lãi so với giá nhập, 1 số lẻ; chưa có giá nhập thì không tính được. */
export function marginPercent(sellPrice: number, unitCost: number): number | null {
  if (unitCost <= 0) return null;
  return Math.round(((sellPrice - unitCost) / unitCost) * 1000) / 10;
}

/** Thành tiền 1 dòng phiếu nhập. */
export function importLineAmount(qty: number, unitCost: number): number {
  return Math.round(qty * unitCost);
}
