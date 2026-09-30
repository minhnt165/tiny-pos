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

export interface Supplier {
  id: number;
  name: string;
  phone: string | null;
  note: string | null;
  /** Mình còn nợ NCC (cache của supplier_transactions); âm = NCC nợ lại. */
  debt: number;
  isActive: boolean;
  createdAt: string;
}

export interface SupplierTransaction {
  id: number;
  supplierId: number;
  importId: number | null;
  importCode: string | null;
  /** + nợ thêm, − trả nợ / hủy phiếu. */
  amount: number;
  note: string | null;
  createdAt: string;
  /** Số nợ sau giao dịch này. */
  balance: number;
}

export interface ImportItem {
  id: number;
  productId: number;
  productName: string;
  unitName: string;
  factor: number;
  qty: number;
  unitCost: number;
  /** Giá vốn 1 đơn vị gốc. */
  costPrice: number;
  amount: number;
}

export interface ImportSummary {
  id: number;
  code: string;
  supplierId: number | null;
  supplierName: string | null;
  total: number;
  paid: number;
  note: string | null;
  status: 'done' | 'cancelled';
  itemCount: number;
  createdAt: string;
  cancelledAt: string | null;
}

export interface ImportDetail extends ImportSummary {
  items: ImportItem[];
}

export interface ImportList {
  imports: ImportSummary[];
  summary: { count: number; total: number; paid: number };
}

export interface StocktakeItem {
  productId: number;
  productName: string;
  unit: string;
  costPrice: number;
  counted: number;
  /** Tồn máy lúc đếm. */
  expected: number;
  /** counted − expected, làm tròn 3 số lẻ. */
  diff: number;
  countedAt: string;
}

export interface StocktakeSummary {
  id: number;
  code: string;
  status: 'open' | 'done' | 'cancelled';
  note: string | null;
  createdAt: string;
  finishedAt: string | null;
  itemCount: number;
  diffCount: number;
  /** Σ diff × giá vốn hiện tại, làm tròn đồng. */
  diffValue: number;
}

export interface StocktakeDetail extends StocktakeSummary {
  items: StocktakeItem[];
}

export type MovementType = 'sale' | 'import' | 'return' | 'adjust';

export interface StockMovement {
  id: number;
  type: MovementType;
  /** +/- theo đơn vị gốc. */
  qty: number;
  note: string | null;
  createdAt: string;
  /** Mã chứng từ liên quan: HD-…, PN-…, KK-… hoặc null. */
  refCode: string | null;
}
