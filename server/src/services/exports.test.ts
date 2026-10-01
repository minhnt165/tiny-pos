import { beforeEach, describe, expect, it } from 'vitest';
import {
  customerCreateSchema,
  importInputSchema,
  importListQuerySchema,
  orderInputSchema,
  orderListQuerySchema,
  partyViewQuerySchema,
  PRODUCT_CSV_HEADERS,
  productInputSchema,
  productUnitInputSchema,
  productViewQuerySchema,
  returnInputSchema,
  returnListQuerySchema,
  supplierInputSchema,
} from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { createTestDb } from '../db/test-db.js';
import { readWorkbook } from '../xlsx/workbook.js';
import { createCustomer, deleteCustomer } from './customers.js';
import { exportCustomersXlsx, exportImportsXlsx, exportOrdersXlsx, exportProductsXlsx, exportProductTemplateXlsx, exportReturnsXlsx, exportSuppliersXlsx } from './exports.js';
import { createImport } from './imports.js';
import { importProductsFile } from './product-csv.js';
import { cancelOrder, createOrder } from './orders.js';
import { createUnit } from './product-units.js';
import { createProduct, setProductActive } from './products.js';
import { createReturn } from './returns.js';
import { createSupplier } from './suppliers.js';

const VN = 420;
const CLOCK = { now: new Date('2026-09-29T10:00:00.000Z'), tzOffsetMin: VN }; // 17:00 ngày 29/9 giờ VN
const MORNING = { now: new Date('2026-09-29T03:00:00.000Z'), tzOffsetMin: VN }; // 10:00 ngày 29/9 giờ VN

let db: Db;
beforeEach(() => {
  db = createTestDb();
});
const product = (o: Record<string, unknown>) => createProduct(db, productInputSchema.parse(o));

describe('exportProductsXlsx', () => {
  it('đúng 9 cột như mẫu nhập, theo bộ lọc và kiểu sắp xếp đang chọn', async () => {
    product({ name: 'Sữa', barcode: '0123', unit: 'hộp', costPrice: 10000, sellPrice: 15000, stock: 2, minStock: 5 });
    product({ name: 'Bánh', sellPrice: 20000, stock: 1, minStock: 3 });
    product({ name: 'Gạo', unit: 'kg', sellPrice: 18000, isWeighed: true, stock: 50 });
    const off = product({ name: 'Kẹo', sellPrice: 1000 });
    setProductActive(db, off.id, false);

    const f = await exportProductsXlsx(db, productViewQuerySchema.parse({ stock: 'low', sort: 'price-desc' }), CLOCK);
    expect(f.filename).toBe('san-pham-20260929.xlsx');
    const [s] = await readWorkbook(f.buffer);
    expect(s!.name).toBe('Sản phẩm');
    expect(s!.rows).toEqual([
      [...PRODUCT_CSV_HEADERS],
      [null, 'Bánh', 'cái', 0, 20000, 1, null, null, 3],
      ['0123', 'Sữa', 'hộp', 10000, 15000, 2, null, null, 5],
    ]);

    const [all] = await readWorkbook((await exportProductsXlsx(db, productViewQuerySchema.parse({ includeInactive: '1' }), CLOCK)).buffer);
    expect(all!.rows.slice(1).map((r) => r[1])).toEqual(['Bánh', 'Gạo', 'Kẹo', 'Sữa']);
    expect(all!.rows[2]![6]).toBe('Có');
  });
});

describe('exportProductTemplateXlsx', () => {
  it('đúng tiêu đề 9 cột, có dòng ví dụ và sheet hướng dẫn; nhập lại file mẫu không báo lỗi', async () => {
    const f = await exportProductTemplateXlsx();
    expect(f.filename).toBe('mau-san-pham.xlsx');
    const [s, guide] = await readWorkbook(f.buffer);
    expect(s!.name).toBe('Sản phẩm');
    expect(s!.rows[0]).toEqual([...PRODUCT_CSV_HEADERS]);
    expect(s!.rows.length).toBeGreaterThan(1);
    expect(guide!.name).toBe('Hướng dẫn');
    expect(guide!.rows.map((r) => r[0])).toEqual(expect.arrayContaining([...PRODUCT_CSV_HEADERS]));

    const result = await importProductsFile(db, f.buffer);
    expect(result.errors).toEqual([]);
    expect(result.created).toBe(s!.rows.length - 1);
  });
});

describe('exportOrdersXlsx', () => {
  it('sheet Hóa đơn + Chi tiết; giờ địa phương; Đã trả của đơn tiền mặt là số phải trả; có đơn đã hủy', async () => {
    const a = product({ name: 'Sữa', sellPrice: 15000, costPrice: 10000 });
    const c = createCustomer(db, customerCreateSchema.parse({ name: 'Cô Ba' }));
    const cash = createOrder(
      db,
      orderInputSchema.parse({ paymentMethod: 'cash', paid: 100000, discount: 1000, items: [{ productId: a.id, qty: 2, price: 15000 }] }),
      MORNING,
    );
    createOrder(
      db,
      orderInputSchema.parse({ paymentMethod: 'debt', paid: 5000, customerId: c.id, items: [{ productId: a.id, qty: 1, price: 15000 }] }),
      MORNING,
    );
    cancelOrder(db, cash.id, CLOCK);

    const f = await exportOrdersXlsx(db, orderListQuerySchema.parse({ from: '2026-09-29', to: '2026-09-29' }), CLOCK);
    expect(f.filename).toBe('hoa-don-20260929.xlsx');
    const [head, detail] = await readWorkbook(f.buffer);
    expect(head!.name).toBe('Hóa đơn');
    expect(head!.rows).toEqual([
      ['Mã', 'Ngày giờ', 'Khách', 'Hình thức', 'Tiền hàng', 'Giảm giá', 'Phải trả', 'Đã trả', 'Còn nợ', 'Trả hàng', 'Số món', 'Trạng thái', 'Hủy lúc'],
      ['HD-20260929-0002', '2026-09-29T10:00:00.000Z', 'Cô Ba', 'Ghi nợ', 15000, 0, 15000, 5000, 10000, 0, 1, 'Hoàn tất'],
      ['HD-20260929-0001', '2026-09-29T10:00:00.000Z', null, 'Tiền mặt', 30000, 1000, 29000, 29000, null, 0, 1, 'Đã hủy', '2026-09-29T17:00:00.000Z'],
    ]);
    expect(detail!.name).toBe('Chi tiết');
    expect(detail!.rows).toEqual([
      ['Mã hóa đơn', 'Ngày giờ', 'Trạng thái', 'Tên hàng', 'Đơn vị', 'SL', 'Đơn giá', 'Thành tiền', 'Giá vốn'],
      ['HD-20260929-0002', '2026-09-29T10:00:00.000Z', 'Hoàn tất', 'Sữa', 'cái', 1, 15000, 15000, 10000],
      ['HD-20260929-0001', '2026-09-29T10:00:00.000Z', 'Đã hủy', 'Sữa', 'cái', 2, 15000, 30000, 10000],
    ]);
  });

  it('cột Trả hàng là tổng hoàn của phiếu trả chưa hủy', async () => {
    const a = product({ name: 'Sữa', sellPrice: 15000, costPrice: 10000 });
    const o = createOrder(db, orderInputSchema.parse({ paymentMethod: 'cash', paid: 100000, items: [{ productId: a.id, qty: 2, price: 15000 }] }), MORNING);
    createReturn(db, returnInputSchema.parse({ orderId: o.id, items: [{ orderItemId: o.items[0]!.id, qty: 1 }] }), MORNING);
    const f = await exportOrdersXlsx(db, orderListQuerySchema.parse({ from: '2026-09-29', to: '2026-09-29' }), CLOCK);
    const [head] = await readWorkbook(f.buffer);
    expect(head!.rows[1]![9]).toBe(15000);
  });
});

describe('exportImportsXlsx', () => {
  it('sheet Phiếu nhập + Chi tiết theo bộ lọc; tên file theo khoảng ngày', async () => {
    const p = product({ name: 'Bia', unit: 'lon' });
    const crate = createUnit(db, p.id, productUnitInputSchema.parse({ name: 'Thùng', factor: 24, sellPrice: 280000 }));
    const s = createSupplier(db, supplierInputSchema.parse({ name: 'Đại lý Hùng' }));
    const owe = createImport(
      db,
      importInputSchema.parse({ supplierId: s.id, paid: 100000, note: 'Giao sáng', items: [{ productId: p.id, unitId: crate.id, qty: 2, unitCost: 240000 }] }),
      MORNING,
    );
    createImport(db, importInputSchema.parse({ paid: 9000, items: [{ productId: p.id, qty: 1, unitCost: 9000 }] }), MORNING);

    const f = await exportImportsXlsx(db, importListQuerySchema.parse({ from: '2026-09-01', to: '2026-09-30', unpaid: '1' }), CLOCK);
    expect(f.filename).toBe('phieu-nhap-20260901-20260930.xlsx');
    const [head, detail] = await readWorkbook(f.buffer);
    expect(head!.rows).toEqual([
      ['Mã', 'Ngày giờ', 'NCC', 'Tổng tiền', 'Đã trả', 'Còn nợ', 'Số món', 'Ghi chú', 'Trạng thái', 'Hủy lúc'],
      [owe.code, '2026-09-29T10:00:00.000Z', 'Đại lý Hùng', 480000, 100000, 380000, 1, 'Giao sáng', 'Hoàn tất'],
    ]);
    expect(detail!.rows).toEqual([
      ['Mã phiếu', 'Ngày giờ', 'Trạng thái', 'NCC', 'Tên hàng', 'Đơn vị nhập', 'Quy đổi', 'SL', 'Đơn giá', 'Thành tiền'],
      [owe.code, '2026-09-29T10:00:00.000Z', 'Hoàn tất', 'Đại lý Hùng', 'Bia', 'Thùng', 24, 2, 240000, 480000],
    ]);
  });
});

describe('exportCustomersXlsx / exportSuppliersXlsx', () => {
  it('khách: SĐT giữ số 0 đầu, cả khách đã xóa khi bật, sắp theo nợ', async () => {
    createCustomer(db, customerCreateSchema.parse({ name: 'Cô Ba', phone: '0901234567', openingDebt: 50000 }));
    const tu = createCustomer(db, customerCreateSchema.parse({ name: 'Anh Tư' }));
    deleteCustomer(db, tu.id);

    const f = await exportCustomersXlsx(db, partyViewQuerySchema.parse({ includeInactive: '1', sort: 'debt-desc' }), CLOCK);
    expect(f.filename).toBe('khach-hang-20260929.xlsx');
    const [s] = await readWorkbook(f.buffer);
    expect(s!.name).toBe('Khách hàng');
    expect(s!.rows[0]).toEqual(['Tên', 'SĐT', 'Ghi chú', 'Đang nợ', 'Giao dịch gần nhất', 'Trạng thái']);
    expect(s!.rows.slice(1).map((r) => [r[0], r[1], r[3], r.at(-1)])).toEqual([
      ['Cô Ba', '0901234567', 50000, 'Đang theo dõi'],
      ['Anh Tư', null, 0, 'Đã xóa'],
    ]);
    expect(typeof s!.rows[1]![4]).toBe('string');

    const [debtOnly] = await readWorkbook((await exportCustomersXlsx(db, partyViewQuerySchema.parse({ debtOnly: '1' }), CLOCK)).buffer);
    expect(debtOnly!.rows).toHaveLength(2);
  });

  it('nhà cung cấp: tìm không dấu như trên màn hình', async () => {
    createSupplier(db, supplierInputSchema.parse({ name: 'Đại lý Hùng', phone: '0281234' }));
    createSupplier(db, supplierInputSchema.parse({ name: 'Mì Hảo Hảo' }));
    const f = await exportSuppliersXlsx(db, partyViewQuerySchema.parse({ q: 'hung' }), CLOCK);
    expect(f.filename).toBe('nha-cung-cap-20260929.xlsx');
    const [s] = await readWorkbook(f.buffer);
    expect(s!.name).toBe('Nhà cung cấp');
    expect(s!.rows).toEqual([
      ['Tên', 'SĐT', 'Ghi chú', 'Mình còn nợ', 'Giao dịch gần nhất', 'Trạng thái'],
      ['Đại lý Hùng', '0281234', null, 0, null, 'Đang theo dõi'],
    ]);
  });
});

describe('exportReturnsXlsx', () => {
  it('sheet Phiếu trả + Chi tiết theo bộ lọc; nhập kho Có/Không; tên file theo khoảng ngày', async () => {
    const a = product({ name: 'Sữa', sellPrice: 15000, costPrice: 10000, stock: 10 });
    const o = createOrder(db, orderInputSchema.parse({ paymentMethod: 'cash', paid: 100000, items: [{ productId: a.id, qty: 2, price: 15000 }] }), MORNING);
    createReturn(db, returnInputSchema.parse({ orderId: o.id, items: [{ orderItemId: o.items[0]!.id, qty: 1, restock: false }], note: 'Hỏng' }), MORNING);
    const f = await exportReturnsXlsx(db, returnListQuerySchema.parse({ from: '2026-09-29', to: '2026-09-29' }), CLOCK);
    expect(f.filename).toBe('tra-hang-20260929.xlsx');
    const [head, detail] = await readWorkbook(f.buffer);
    expect(head!.name).toBe('Phiếu trả');
    expect(head!.rows).toEqual([
      ['Mã', 'Ngày giờ', 'Hóa đơn', 'Khách', 'Tổng hoàn', 'Trừ nợ', 'Tiền mặt', 'Số món', 'Trạng thái', 'Hủy lúc', 'Ghi chú'],
      ['TH-20260929-0001', '2026-09-29T10:00:00.000Z', 'HD-20260929-0001', null, 15000, 0, 15000, 1, 'Hoàn tất', null, 'Hỏng'],
    ]);
    expect(detail!.name).toBe('Chi tiết');
    expect(detail!.rows).toEqual([
      ['Mã phiếu', 'Ngày giờ', 'Trạng thái', 'Tên hàng', 'Đơn vị', 'SL', 'Tiền hoàn', 'Nhập kho'],
      ['TH-20260929-0001', '2026-09-29T10:00:00.000Z', 'Hoàn tất', 'Sữa', 'cái', 1, 15000, 'Không'],
    ]);
  });
});
