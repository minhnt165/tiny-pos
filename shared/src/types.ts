export interface Category {
  id: number;
  name: string;
  sortOrder: number;
  productCount: number;
}

export interface Product {
  id: number;
  barcode: string | null;
  name: string;
  unit: string;
  costPrice: number;
  sellPrice: number;
  stock: number;
  isWeighed: boolean;
  categoryId: number | null;
  minStock: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  categoryName: string | null;
}

export interface ProductUnit {
  id: number;
  productId: number;
  name: string;
  barcode: string | null;
  factor: number;
  sellPrice: number;
}

export interface ProductWithUnits extends Product {
  units: ProductUnit[];
}

export interface BarcodeLookup {
  product: Product;
  unit: ProductUnit | null;
}

export interface CsvRowError {
  line: number;
  message: string;
}

export interface CsvImportResult {
  created: number;
  updated: number;
  errors: CsvRowError[];
}

export type PaymentMethod = 'cash' | 'transfer' | 'debt';

export interface OrderItem {
  id: number;
  productId: number | null;
  productName: string;
  unit: string;
  qty: number;
  price: number;
  costPrice: number;
  factor: number;
  amount: number;
}

export interface OrderSummary {
  id: number;
  code: string;
  total: number;
  discount: number;
  /** total − discount, không lưu DB. */
  payable: number;
  paid: number;
  paymentMethod: PaymentMethod;
  status: 'done' | 'cancelled';
  itemCount: number;
  createdAt: string;
  cancelledAt: string | null;
}

export interface OrderDetail extends OrderSummary {
  items: OrderItem[];
}

export interface DaySummary {
  count: number;
  total: number;
  cash: number;
  transfer: number;
}

export interface OrderList {
  orders: OrderSummary[];
  summary: DaySummary;
}
