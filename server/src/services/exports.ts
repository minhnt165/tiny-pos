import {
  filterParties,
  filterProducts,
  localDate,
  productToCsvRow,
  sortParties,
  sortProducts,
  type ImportListQuery,
  type OrderListQuery,
  type PartyLike,
  type PartyView,
  type PaymentMethod,
  type ProductView,
  type ReturnListQuery,
  type SupplierReturnListQuery,
} from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { addSheet, newWorkbook, toBuffer, type XlsxColumn, type XlsxValue } from '../xlsx/workbook.js';
import { listCustomers } from './customers.js';
import { resolveClock, type Clock } from './daily-code.js';
import { listImportsForExport } from './imports.js';
import { listOrdersForExport } from './orders.js';
import { listProducts } from './products.js';
import { listReturnsForExport } from './returns.js';
import { listSupplierReturnsForExport } from './supplier-returns.js';
import { listSuppliers } from './suppliers.js';

export interface XlsxFile {
  filename: string;
  buffer: Buffer;
}

export interface SheetSpec {
  name: string;
  columns: XlsxColumn[];
  rows: XlsxValue[][];
}

const METHOD_LABEL: Record<PaymentMethod, string> = { cash: 'Tiền mặt', transfer: 'Chuyển khoản', debt: 'Ghi nợ' };
const STATUS_LABEL = { done: 'Hoàn tất', cancelled: 'Đã hủy' } as const;

export const col = (header: string, width: number, kind: XlsxColumn['kind'] = 'text'): XlsxColumn => ({ header, width, kind });
const compact = (d: string) => d.replaceAll('-', '');
/** Tên file theo khoảng ngày; một ngày thì chỉ ghi một mốc. */
export const rangeName = (prefix: string, from: string, to: string) => `${prefix}-${compact(from)}${from === to ? '' : `-${compact(to)}`}.xlsx`;

export async function build(filename: string, sheets: SheetSpec[], tz: number): Promise<XlsxFile> {
  const wb = newWorkbook();
  for (const s of sheets) addSheet(wb, s.name, s.columns, s.rows, tz);
  return { filename, buffer: await toBuffer(wb) };
}

// Cùng thứ tự với PRODUCT_CSV_HEADERS để file xuất nhập lại được
const PRODUCT_COLUMNS = [
  col('Mã vạch', 16, 'code'),
  col('Tên', 32),
  col('Đơn vị', 10),
  col('Giá nhập', 12, 'money'),
  col('Giá bán', 12, 'money'),
  col('Tồn', 10, 'qty'),
  col('Hàng cân', 10),
  col('Danh mục', 18),
  col('Tồn tối thiểu', 14, 'qty'),
];

/** Sản phẩm theo bộ lọc/sắp xếp của trang (lọc bằng chính hàm của trình duyệt). */
export async function exportProductsXlsx(db: Db, view: ProductView, clock?: Clock): Promise<XlsxFile> {
  const { now, tz } = resolveClock(clock);
  const list = sortProducts(filterProducts(listProducts(db, { includeInactive: true }), view), view.sort);
  const rows = list.map((p) => productToCsvRow(p, p.categoryName).map((v) => (typeof v === 'boolean' ? (v ? 'Có' : null) : v)));
  return build(`san-pham-${compact(localDate(now, tz))}.xlsx`, [{ name: 'Sản phẩm', columns: PRODUCT_COLUMNS, rows }], tz);
}

// Dòng ví dụ trong file mẫu: một hàng có mã vạch, một hàng cân không mã vạch (khớp theo tên khi nhập)
const TEMPLATE_ROWS: XlsxValue[][] = [
  ['8934588012345', 'Nước ngọt Coca 330ml', 'lon', 8000, 10000, 24, null, 'Đồ uống', 6],
  [null, 'Cà chua', 'kg', 20000, 25000, 5.5, 'Có', 'Rau củ', 1],
];
const GUIDE_COLUMNS = [col('Cột', 16), col('Cách điền', 90)];
const GUIDE_ROWS: XlsxValue[][] = [
  ['Mã vạch', 'Mã in trên bao bì; để trống nếu hàng không có mã (rau, hàng cân). Trùng mã đã có → cập nhật hàng đó, không đổi tồn.'],
  ['Tên', 'Bắt buộc. Hàng không mã vạch khớp theo tên: tên đã có → cập nhật, chưa có → tạo mới.'],
  ['Đơn vị', 'Đơn vị bán nhỏ nhất: cái, lon, gói, kg… Để trống thì là "cái".'],
  ['Giá nhập', 'Giá mua vào một đơn vị, số nguyên đồng (ví dụ 8000). Để trống thì là 0.'],
  ['Giá bán', 'Giá bán một đơn vị, số nguyên đồng. Để trống thì là 0.'],
  ['Tồn', 'Số lượng đang có. Chỉ dùng khi tạo mới; hàng đã có thì giữ tồn hiện tại.'],
  ['Hàng cân', 'Ghi "Có" với hàng bán theo cân (kg); để trống với hàng đếm cái.'],
  ['Danh mục', 'Tên danh mục; chưa có sẽ được tạo. Để trống thì không xếp danh mục.'],
  ['Tồn tối thiểu', 'Dưới mức này thì báo sắp hết. Để trống thì là 0.'],
  [null, null],
  ['Lưu ý', 'Giữ nguyên dòng tiêu đề của sheet "Sản phẩm". Hai dòng ví dụ: sửa thành hàng của mình hoặc xóa đi trước khi nhập.'],
];

/** File mẫu để điền sản phẩm rồi nhập: sheet 1 đúng cột như file xuất, sheet 2 hướng dẫn (khi nhập chỉ đọc sheet 1). */
export async function exportProductTemplateXlsx(): Promise<XlsxFile> {
  return build(
    'mau-san-pham.xlsx',
    [
      { name: 'Sản phẩm', columns: PRODUCT_COLUMNS, rows: TEMPLATE_ROWS },
      { name: 'Hướng dẫn', columns: GUIDE_COLUMNS, rows: GUIDE_ROWS },
    ],
    0,
  );
}

const ORDER_COLUMNS = [
  col('Mã', 18),
  col('Ngày giờ', 17, 'datetime'),
  col('Khách', 22),
  col('Hình thức', 13),
  col('Tiền hàng', 12, 'money'),
  col('Giảm giá', 11, 'money'),
  col('Phải trả', 12, 'money'),
  col('Đã trả', 12, 'money'),
  col('Còn nợ', 12, 'money'),
  col('Trả hàng', 12, 'money'),
  col('Số món', 8, 'qty'),
  col('Trạng thái', 11),
  col('Hủy lúc', 17, 'datetime'),
];
const ORDER_ITEM_COLUMNS = [
  col('Mã hóa đơn', 18),
  col('Ngày giờ', 17, 'datetime'),
  col('Trạng thái', 11),
  col('Tên hàng', 32),
  col('Đơn vị', 10),
  col('SL', 8, 'qty'),
  col('Đơn giá', 12, 'money'),
  col('Thành tiền', 12, 'money'),
  col('Giá vốn', 12, 'money'),
];

export async function exportOrdersXlsx(db: Db, query: OrderListQuery, clock?: Clock): Promise<XlsxFile> {
  const { now, tz } = resolveClock(clock);
  const { from, to, orders } = listOrdersForExport(db, query, { now, tzOffsetMin: tz });
  const rows = orders.map((o) => {
    const isDebt = o.paymentMethod === 'debt';
    // Đơn tiền mặt: `paid` là tiền khách đưa (gồm tiền thối) nên ghi số phải trả
    const paid = isDebt ? o.paid : o.payable;
    return [o.code, o.createdAt, o.customerName, METHOD_LABEL[o.paymentMethod], o.total, o.discount, o.payable, paid,
      isDebt ? o.payable - o.paid : null, o.refunded, o.itemCount, STATUS_LABEL[o.status], o.cancelledAt];
  });
  const items = orders.flatMap((o) =>
    o.items.map((it) => [o.code, o.createdAt, STATUS_LABEL[o.status], it.productName, it.unit, it.qty, it.price, it.amount, it.costPrice]),
  );
  return build(
    rangeName('hoa-don', from, to),
    [
      { name: 'Hóa đơn', columns: ORDER_COLUMNS, rows },
      { name: 'Chi tiết', columns: ORDER_ITEM_COLUMNS, rows: items },
    ],
    tz,
  );
}

const RETURN_COLUMNS = [
  col('Mã', 18),
  col('Ngày giờ', 17, 'datetime'),
  col('Hóa đơn', 18),
  col('Khách', 22),
  col('Tổng hoàn', 12, 'money'),
  col('Trừ nợ', 12, 'money'),
  col('Tiền mặt', 12, 'money'),
  col('Số món', 8, 'qty'),
  col('Trạng thái', 11),
  col('Hủy lúc', 17, 'datetime'),
  col('Ghi chú', 30),
];
const RETURN_ITEM_COLUMNS = [
  col('Mã phiếu', 18),
  col('Ngày giờ', 17, 'datetime'),
  col('Trạng thái', 11),
  col('Tên hàng', 32),
  col('Đơn vị', 10),
  col('SL', 8, 'qty'),
  col('Tiền hoàn', 12, 'money'),
  col('Nhập kho', 10),
];

export async function exportReturnsXlsx(db: Db, query: ReturnListQuery, clock?: Clock): Promise<XlsxFile> {
  const { now, tz } = resolveClock(clock);
  const { from, to, returns } = listReturnsForExport(db, query, { now, tzOffsetMin: tz });
  const rows = returns.map((r) => [r.code, r.createdAt, r.orderCode, r.customerName, r.refund, r.debtReduced, r.cashRefund, r.itemCount,
    STATUS_LABEL[r.status], r.cancelledAt, r.note]);
  const items = returns.flatMap((r) =>
    r.items.map((it) => [r.code, r.createdAt, STATUS_LABEL[r.status], it.productName, it.unit, it.qty, it.amount, it.restock ? 'Có' : 'Không']),
  );
  return build(
    rangeName('tra-hang', from, to),
    [
      { name: 'Phiếu trả', columns: RETURN_COLUMNS, rows },
      { name: 'Chi tiết', columns: RETURN_ITEM_COLUMNS, rows: items },
    ],
    tz,
  );
}

const SUPPLIER_RETURN_COLUMNS = [
  col('Mã', 18),
  col('Ngày giờ', 17, 'datetime'),
  col('NCC', 22),
  col('Tổng trả', 12, 'money'),
  col('Trừ nợ', 12, 'money'),
  col('NCC trả tiền mặt', 14, 'money'),
  col('Số món', 8, 'qty'),
  col('Trạng thái', 11),
  col('Hủy lúc', 17, 'datetime'),
  col('Ghi chú', 28),
];
const SUPPLIER_RETURN_ITEM_COLUMNS = [
  col('Mã phiếu', 18),
  col('Ngày giờ', 17, 'datetime'),
  col('Trạng thái', 11),
  col('NCC', 22),
  col('Tên hàng', 32),
  col('Đơn vị', 12),
  col('Quy đổi', 9, 'qty'),
  col('SL', 8, 'qty'),
  col('Giá trả', 12, 'money'),
  col('Thành tiền', 12, 'money'),
];

export async function exportSupplierReturnsXlsx(db: Db, query: SupplierReturnListQuery, clock?: Clock): Promise<XlsxFile> {
  const { now, tz } = resolveClock(clock);
  const { from, to, returns } = listSupplierReturnsForExport(db, query, { now, tzOffsetMin: tz });
  const rows = returns.map((r) => [r.code, r.createdAt, r.supplierName, r.total, r.debtReduced, r.cashReceived, r.itemCount, STATUS_LABEL[r.status],
    r.cancelledAt, r.note]);
  const items = returns.flatMap((r) =>
    r.items.map((it) => [r.code, r.createdAt, STATUS_LABEL[r.status], r.supplierName, it.productName, it.unitName, it.factor, it.qty, it.unitPrice, it.amount]),
  );
  return build(
    rangeName('tra-ncc', from, to),
    [
      { name: 'Phiếu trả NCC', columns: SUPPLIER_RETURN_COLUMNS, rows },
      { name: 'Chi tiết', columns: SUPPLIER_RETURN_ITEM_COLUMNS, rows: items },
    ],
    tz,
  );
}

const IMPORT_COLUMNS = [
  col('Mã', 18),
  col('Ngày giờ', 17, 'datetime'),
  col('NCC', 22),
  col('Tổng tiền', 12, 'money'),
  col('Đã trả', 12, 'money'),
  col('Còn nợ', 12, 'money'),
  col('Số món', 8, 'qty'),
  col('Ghi chú', 28),
  col('Trạng thái', 11),
  col('Hủy lúc', 17, 'datetime'),
];
const IMPORT_ITEM_COLUMNS = [
  col('Mã phiếu', 18),
  col('Ngày giờ', 17, 'datetime'),
  col('Trạng thái', 11),
  col('NCC', 22),
  col('Tên hàng', 32),
  col('Đơn vị nhập', 12),
  col('Quy đổi', 9, 'qty'),
  col('SL', 8, 'qty'),
  col('Đơn giá', 12, 'money'),
  col('Thành tiền', 12, 'money'),
];

export async function exportImportsXlsx(db: Db, query: ImportListQuery, clock?: Clock): Promise<XlsxFile> {
  const { now, tz } = resolveClock(clock);
  const { from, to, imports } = listImportsForExport(db, query, { now, tzOffsetMin: tz });
  const rows = imports.map((r) => [r.code, r.createdAt, r.supplierName, r.total, r.paid, r.total - r.paid, r.itemCount, r.note,
    STATUS_LABEL[r.status], r.cancelledAt]);
  const items = imports.flatMap((r) =>
    r.items.map((it) => [r.code, r.createdAt, STATUS_LABEL[r.status], r.supplierName, it.productName, it.unitName, it.factor, it.qty,
      it.unitCost, it.amount]),
  );
  return build(
    rangeName('phieu-nhap', from, to),
    [
      { name: 'Phiếu nhập', columns: IMPORT_COLUMNS, rows },
      { name: 'Chi tiết', columns: IMPORT_ITEM_COLUMNS, rows: items },
    ],
    tz,
  );
}

const partyColumns = (debtHeader: string) => [
  col('Tên', 28),
  col('SĐT', 14, 'code'),
  col('Ghi chú', 28),
  col(debtHeader, 14, 'money'),
  col('Giao dịch gần nhất', 18, 'datetime'),
  col('Trạng thái', 14),
];
const partyRows = (list: (PartyLike & { note: string | null })[]) =>
  list.map((x) => [x.name, x.phone, x.note, x.debt, x.lastActivityAt, x.isActive ? 'Đang theo dõi' : 'Đã xóa']);

export async function exportCustomersXlsx(db: Db, view: PartyView, clock?: Clock): Promise<XlsxFile> {
  const { now, tz } = resolveClock(clock);
  const list = sortParties(filterParties(listCustomers(db, undefined, true).customers, view), view.sort);
  return build(`khach-hang-${compact(localDate(now, tz))}.xlsx`, [{ name: 'Khách hàng', columns: partyColumns('Đang nợ'), rows: partyRows(list) }], tz);
}

export async function exportSuppliersXlsx(db: Db, view: PartyView, clock?: Clock): Promise<XlsxFile> {
  const { now, tz } = resolveClock(clock);
  const list = sortParties(filterParties(listSuppliers(db, undefined, true), view), view.sort);
  return build(
    `nha-cung-cap-${compact(localDate(now, tz))}.xlsx`,
    [{ name: 'Nhà cung cấp', columns: partyColumns('Mình còn nợ'), rows: partyRows(list) }],
    tz,
  );
}
