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
  /** Tên file ảnh (`/images/<image>`); null = chưa có. */
  image: string | null;
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
  /** Đã trả ở các phiếu trả chưa hủy (theo đơn vị lúc bán). */
  returnedQty: number;
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
  /** Chỉ đơn ghi nợ có khách; tên lấy theo tên hiện tại của khách. */
  customerId: number | null;
  customerName: string | null;
  status: 'done' | 'cancelled';
  itemCount: number;
  /** Σ tiền hoàn của các phiếu trả chưa hủy. */
  refunded: number;
  createdAt: string;
  cancelledAt: string | null;
}

export interface OrderDetail extends OrderSummary {
  items: OrderItem[];
  /** Đơn ghi nợ: số nợ của đơn và tổng nợ của khách ngay sau đơn; đơn khác: null. */
  debt: OrderDebt | null;
  /** Mọi phiếu trả của đơn, kể cả đã hủy, mới nhất trước. */
  returns: ReturnSummaryRow[];
  /** Nợ hiện tại của khách (đơn ghi nợ); đơn không có khách: null. */
  customerDebt: number | null;
}

export interface DaySummary {
  count: number;
  total: number;
  /** Đơn tiền mặt + phần khách trả trước của đơn ghi nợ. */
  cash: number;
  transfer: number;
  /** Số ghi nợ mới trong ngày; total = cash + transfer + debt. */
  debt: number;
  /** Thu nợ trong ngày theo hình thức (không tính vào total). */
  debtCollected: { cash: number; transfer: number };
  /** Phiếu trả chưa hủy trong ngày (ngày lập phiếu); các số trên là bán ra, chưa trừ phần trả. */
  returns: ReturnSummary;
}

export interface OrderList {
  orders: OrderSummary[];
  summary: DaySummary;
  /** Số đơn khớp mọi bộ lọc; orders chỉ là trang hiện tại. */
  total: number;
  page: number;
  pageSize: number;
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

/** Dòng danh sách nhà cung cấp: thêm thời điểm giao dịch sổ nợ gần nhất (null nếu chưa có). */
export interface SupplierListItem extends Supplier {
  lastActivityAt: string | null;
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
  /** Số phiếu khớp mọi bộ lọc; imports chỉ là trang hiện tại. */
  total: number;
  page: number;
  pageSize: number;
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

export type MovementType = 'sale' | 'import' | 'return' | 'adjust' | 'supplier_return';

export interface StockMovement {
  id: number;
  type: MovementType;
  /** +/- theo đơn vị gốc. */
  qty: number;
  note: string | null;
  createdAt: string;
  /** Mã chứng từ liên quan: HD-…, PN-…, KK-…, TH-…, TN-… hoặc null. */
  refCode: string | null;
}

export type DebtTxKind = 'opening' | 'order' | 'order_cancel' | 'payment' | 'manual' | 'return' | 'return_cancel';
export type CollectMethod = 'cash' | 'transfer';

export interface Customer {
  id: number;
  name: string;
  phone: string | null;
  note: string | null;
  /** Khách đang nợ tiệm (cache của debt_transactions); âm = tiệm nợ lại khách. */
  debt: number;
  isActive: boolean;
}

/** Dòng danh sách khách: thêm thời điểm giao dịch sổ nợ gần nhất (null nếu chưa có). */
export interface CustomerListItem extends Customer {
  lastActivityAt: string | null;
}

export interface CustomerList {
  customers: CustomerListItem[];
  /** Σ nợ dương của mọi khách đang theo dõi, không phụ thuộc ô tìm. */
  totalDebt: number;
}

export interface CustomerTransaction {
  id: number;
  customerId: number;
  kind: DebtTxKind;
  /** + nợ thêm, − thu nợ / hủy đơn. */
  amount: number;
  method: CollectMethod | null;
  note: string | null;
  orderId: number | null;
  orderCode: string | null;
  createdAt: string;
  /** Số nợ sau giao dịch này. */
  balanceAfter: number;
}

export interface CustomerPaymentResult {
  customer: Customer;
  transaction: CustomerTransaction;
}

/** Nợ của một đơn ghi nợ tại lúc bán. Nợ cũ = balanceAfter − amount. */
export interface OrderDebt {
  amount: number;
  balanceAfter: number;
}

// Báo cáo (0.8.0) – chỉ đọc, tính từ hóa đơn `done` và snapshot giá vốn trên dòng
export type ProductReportSort = 'revenue' | 'qty' | 'profit';

export interface ReportRange {
  from: string;
  to: string;
  /** ≤ 31 ngày gom theo ngày, dài hơn theo tháng. */
  groupBy: 'day' | 'month';
}

export interface ProfitRow {
  /** "YYYY-MM-DD" hoặc "YYYY-MM"; dòng tổng để ''. */
  period: string;
  orders: number;
  /** Σ (total − discount) của đơn hoàn tất − tiền hoàn của phiếu trả trong kỳ. */
  revenue: number;
  /** Σ qty × costPrice của dòng (giá vốn lúc bán, theo đơn vị bán) − giá vốn phần trả có nhập lại kho. */
  cost: number;
  profit: number;
  cash: number;
  transfer: number;
  debt: number;
  debtCollected: { cash: number; transfer: number };
  /** Tiền hoàn của phiếu trả trong kỳ (ngày lập phiếu); cash / debt đã trừ phần tương ứng. */
  returns: number;
}

export interface ProfitReport {
  range: ReportRange;
  total: ProfitRow;
  /** Đủ mọi kỳ trong khoảng (kỳ trống là số 0), mới nhất trước. */
  rows: ProfitRow[];
}

export interface ProductSalesRow {
  /** null = món ngoài danh mục, gom một dòng. */
  productId: number | null;
  name: string;
  unit: string;
  /** Theo đơn vị gốc (qty × factor). */
  qty: number;
  revenue: number;
  /** Σ (amount − qty × costPrice); chưa trừ giảm giá của đơn. */
  profit: number;
}

export interface SlowProductRow {
  productId: number;
  name: string;
  unit: string;
  stock: number;
  /** round(stock × costPrice). */
  value: number;
}

export interface ProductReport {
  range: ReportRange;
  sort: ProductReportSort;
  /** Tại thời điểm xem, chỉ hàng đang bán. */
  stock: { costValue: number; sellValue: number; lowCount: number; outCount: number };
  topSelling: ProductSalesRow[];
  /** Tổng của mọi mặt hàng đã bán, không chỉ các dòng trả về. */
  topSellingTotal: { count: number; qty: number; revenue: number; profit: number };
  slow: SlowProductRow[];
  slowCount: number;
}

export interface DebtPartyRow {
  id: number;
  name: string;
  phone: string | null;
  debt: number;
}

export interface DebtReport {
  range: ReportRange;
  customers: { total: number; count: number; top: DebtPartyRow[] };
  suppliers: { total: number; count: number; top: DebtPartyRow[] };
  /** Ghi nợ mới và thu nợ trong khoảng (bằng DaySummary cùng khoảng). */
  period: { debt: number; collected: { cash: number; transfer: number }; returnDebt: number };
}

export type BackupKind = 'auto' | 'manual' | 'before-restore';

export interface BackupItem {
  name: string;
  kind: BackupKind;
  /** ISO, lấy từ mtime của file. */
  createdAt: string;
  /** Byte. */
  size: number;
}

export interface BackupStatus {
  dir: string;
  extraDir: string;
  /** Lỗi chép sang thư mục thêm ở lần sao lưu gần nhất; null = ổn. */
  extraError: string | null;
  lastAutoAt: string | null;
  /** Lỗi sao lưu tự động gần nhất; null = ổn. */
  lastError: string | null;
  /** Mới nhất trước. */
  items: BackupItem[];
}

export interface RestoreResult {
  /** Tên bản sao hoặc 'upload'. */
  restoredFrom: string;
  beforeRestore: BackupItem;
}

// Tổng quan (0.10.0) – một API gom: 7 ngày qua profitReport, hóa đơn hôm nay, tồn thấp, công nợ, kiểm kê dở, sao lưu
export interface LowStockRow {
  productId: number;
  name: string;
  image: string | null;
  unit: string;
  stock: number;
  minStock: number;
}

export interface OverdueCustomerRow extends DebtPartyRow {
  /** Lần trả nợ gần nhất; null nếu chưa trả lần nào. */
  lastPaymentAt: string | null;
  /** Khoản ghi nợ sớm nhất sau lần trả gần nhất (nợ "từ ngày"); null nếu sau lần trả không ghi nợ thêm. */
  owingSince: string | null;
  /** Còn nợ và (owingSince ?? lastPaymentAt) cách hôm nay ≥ DEBT_OVERDUE_DAYS: mua chịu thêm không làm mới mốc. */
  overdue: boolean;
}

export interface OverviewBackup {
  /** Bản sao mới nhất bất kỳ loại nào; null = chưa có. */
  lastBackupAt: string | null;
  lastAutoAt: string | null;
  lastError: string | null;
  extraError: string | null;
}

export interface Overview {
  /** Ngày địa phương hôm nay theo đồng hồ server, "YYYY-MM-DD". */
  today: string;
  /** profitReport 7 ngày đến hôm nay, gom theo ngày, rows[0] = hôm nay, rows[1] = hôm qua. */
  week: ProfitReport;
  /** Hóa đơn hôm nay mới nhất trước, kể cả đơn hủy. */
  recentOrders: OrderSummary[];
  /** count = số hàng đang bán có stock < minStock; outCount = stock ≤ 0; items cắt theo giới hạn, thiếu nặng nhất trước. */
  lowStock: { count: number; outCount: number; items: LowStockRow[] };
  customers: { total: number; count: number; overdueCount: number; overdueTotal: number; top: OverdueCustomerRow[] };
  suppliers: { total: number; count: number; top: DebtPartyRow[] };
  /** Phiếu kiểm kê đang mở, không kèm items; null nếu không có. */
  stocktake: StocktakeSummary | null;
  /** null khi server không cấu hình sao lưu (test). */
  backup: OverviewBackup | null;
}

/** Phiếu trả chưa hủy trong một khoảng ngày: refund = cash + debt. */
export interface ReturnSummary {
  count: number;
  refund: number;
  /** Tiền mặt chi ra từ két. */
  cash: number;
  /** Phần trừ vào nợ khách. */
  debt: number;
}

export interface ReturnSummaryRow {
  id: number;
  code: string;
  orderId: number;
  orderCode: string;
  /** Khách của đơn ghi nợ (tên hiện tại); đơn khác null. */
  customerId: number | null;
  customerName: string | null;
  refund: number;
  debtReduced: number;
  cashRefund: number;
  note: string | null;
  status: 'done' | 'cancelled';
  itemCount: number;
  createdAt: string;
  cancelledAt: string | null;
}

/** Dòng phiếu trả; tên, đơn vị, giá, hệ số lấy từ dòng hóa đơn gốc. */
export interface ReturnItem {
  id: number;
  orderItemId: number;
  productId: number | null;
  productName: string;
  unit: string;
  /** Theo đơn vị lúc bán. */
  qty: number;
  price: number;
  factor: number;
  restock: boolean;
  /** Tiền hoàn của dòng (đã trừ phần giảm giá phân bổ). */
  amount: number;
  /** qty × giá vốn lúc bán. */
  cost: number;
}

export interface ReturnDetail extends ReturnSummaryRow {
  items: ReturnItem[];
}

export interface ReturnList {
  returns: ReturnSummaryRow[];
  summary: ReturnSummary;
  /** Số phiếu khớp mọi bộ lọc; returns chỉ là trang hiện tại. */
  total: number;
  page: number;
  pageSize: number;
}

export interface SupplierReturnItem {
  id: number;
  productId: number;
  productName: string;
  unitName: string;
  factor: number;
  /** Theo đơn vị đã chọn. */
  qty: number;
  /** Giá trả 1 đơn vị đã chọn. */
  unitPrice: number;
  amount: number;
}

export interface SupplierReturnSummary {
  id: number;
  code: string;
  supplierId: number;
  /** Snapshot tên NCC lúc lập phiếu. */
  supplierName: string;
  total: number;
  /** Phần trừ vào nợ NCC. */
  debtReduced: number;
  /** Phần NCC trả tiền mặt = total − debtReduced. */
  cashReceived: number;
  note: string | null;
  status: 'done' | 'cancelled';
  itemCount: number;
  createdAt: string;
  cancelledAt: string | null;
}

export interface SupplierReturnDetail extends SupplierReturnSummary {
  items: SupplierReturnItem[];
}

/** Phiếu trả NCC `done` trong khoảng ngày. */
export interface SupplierReturnTotals {
  count: number;
  total: number;
  debt: number;
  cash: number;
}

export interface SupplierReturnList {
  returns: SupplierReturnSummary[];
  summary: SupplierReturnTotals;
  total: number;
  page: number;
  pageSize: number;
}

/** Kết quả lệnh in tem: server đã mở cửa sổ in ở máy quầy (opened) hay client phải tự mở `url`. */
export interface LabelPrintResult {
  opened: boolean;
  url: string;
}

/** Trạng thái Xem từ xa (GET /api/remote). `configured` = có file khóa data/remote/service-account.json. */
export interface RemoteStatus {
  configured: boolean;
  /** `project_id` trong file khóa; null khi chưa có / file hỏng. */
  projectId: string | null;
  /** https://<projectId>.web.app */
  url: string | null;
  enabled: boolean;
  emails: string[];
  /** Lần đẩy thành công gần nhất trong phiên server; null khi chưa đẩy. */
  lastPushAt: string | null;
  lastError: string | null;
}

/** Tài liệu Firestore remote/overview: server ghi, trang remote/ đọc. */
export interface RemoteOverviewDoc {
  storeName: string;
  /** ISO, theo đồng hồ server lúc đẩy. */
  updatedAt: string;
  appVersion: string;
  data: Overview;
}
