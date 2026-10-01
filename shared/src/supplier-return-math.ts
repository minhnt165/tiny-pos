/** NCC bù cho hàng trả: trừ vào nợ hiện tại (nếu dương) trước, phần dư NCC trả tiền mặt. */
export function splitSupplierRefund(total: number, supplierDebt: number): { debtReduced: number; cashReceived: number } {
  const debtReduced = Math.min(total, Math.max(supplierDebt, 0));
  return { debtReduced, cashReceived: total - debtReduced };
}
