import { cartTotals, lineAmount, type Cart, type OrderDetail, type PaymentMethod } from '@tiny-pos/shared';

export interface ReceiptItem {
  name: string;
  unit: string;
  qty: number;
  price: number;
  amount: number;
}

export interface ReceiptData {
  /** null = phiếu tạm tính (chưa thanh toán). */
  code: string | null;
  createdAt: string;
  items: ReceiptItem[];
  total: number;
  discount: number;
  payable: number;
  paid: number;
  paymentMethod: PaymentMethod;
  /** Đơn đã hủy: phiếu in lại phải ghi rõ để không lẫn với hóa đơn hợp lệ. */
  cancelled: boolean;
  /** Chuỗi VietQR in kèm phiếu tạm tính. */
  qrPayload: string | null;
}

export function receiptFromOrder(o: OrderDetail): ReceiptData {
  return {
    code: o.code,
    createdAt: o.createdAt,
    items: o.items.map((i) => ({ name: i.productName, unit: i.unit, qty: i.qty, price: i.price, amount: i.amount })),
    total: o.total,
    discount: o.discount,
    payable: o.payable,
    paid: o.paid,
    paymentMethod: o.paymentMethod,
    cancelled: o.status === 'cancelled',
    qrPayload: null,
  };
}

export function draftReceipt(cart: Cart, qrPayload: string | null): ReceiptData {
  const t = cartTotals(cart.lines, cart.discount);
  return {
    code: null,
    createdAt: new Date().toISOString(),
    items: cart.lines.map((l) => ({ name: l.name, unit: l.unitName, qty: l.qty, price: l.price, amount: lineAmount(l) })),
    ...t,
    paid: 0,
    paymentMethod: 'transfer',
    cancelled: false,
    qrPayload,
  };
}

/** Hóa đơn mẫu cho nút "In thử" ở Cài đặt. */
export function sampleReceipt(): ReceiptData {
  const items: ReceiptItem[] = [
    { name: 'Nước suối 500ml', unit: 'chai', qty: 2, price: 5000, amount: 10000 },
    { name: 'Thịt heo', unit: 'kg', qty: 0.35, price: 120000, amount: 42000 },
  ];
  return {
    code: 'HD-MAU-0001',
    createdAt: new Date().toISOString(),
    items,
    total: 52000,
    discount: 2000,
    payable: 50000,
    paid: 100000,
    paymentMethod: 'cash',
    cancelled: false,
    qrPayload: null,
  };
}
