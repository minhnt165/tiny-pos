import { cartTotals, lineAmount, type Cart, type CollectMethod, type CustomerPaymentResult, type OrderDebt, type OrderDetail, type PaymentMethod, type ReturnDetail } from '@tiny-pos/shared';

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
  /** Đơn ghi nợ: tên khách và nợ tại lúc bán; đơn khác null. */
  customerName: string | null;
  debt: OrderDebt | null;
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
    customerName: o.customerName,
    debt: o.debt,
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
    customerName: null,
    debt: null,
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
    customerName: null,
    debt: null,
  };
}

/** Biên nhận thu nợ: khách giữ làm bằng đã trả. */
export interface DebtReceiptData {
  kind: 'debt-payment';
  customerName: string;
  amount: number;
  method: CollectMethod;
  /** Còn nợ sau lần thu này; âm = tiệm nợ lại khách. */
  balanceAfter: number;
  createdAt: string;
}

export type PrintData = ReceiptData | DebtReceiptData | ReturnReceiptData;

export function debtReceiptFromPayment(r: CustomerPaymentResult): DebtReceiptData {
  return {
    kind: 'debt-payment',
    customerName: r.customer.name,
    amount: -r.transaction.amount,
    method: r.transaction.method ?? 'cash',
    balanceAfter: r.transaction.balanceAfter,
    createdAt: r.transaction.createdAt,
  };
}

/** Phiếu trả hàng 80mm: khách giữ làm bằng đã nhận tiền hoàn / được trừ nợ. */
export interface ReturnReceiptData {
  kind: 'return';
  code: string;
  orderCode: string;
  createdAt: string;
  customerName: string | null;
  items: ReceiptItem[];
  refund: number;
  debtReduced: number;
  cashRefund: number;
  /** Phiếu đã hủy: in lại phải ghi rõ. */
  cancelled: boolean;
}

export function receiptFromReturn(r: ReturnDetail): ReturnReceiptData {
  return {
    kind: 'return',
    code: r.code,
    orderCode: r.orderCode,
    createdAt: r.createdAt,
    customerName: r.customerName,
    items: r.items.map((i) => ({ name: i.productName, unit: i.unit, qty: i.qty, price: i.price, amount: i.amount })),
    refund: r.refund,
    debtReduced: r.debtReduced,
    cashRefund: r.cashRefund,
    cancelled: r.status === 'cancelled',
  };
}
