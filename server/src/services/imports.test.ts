import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  importInputSchema,
  importListQuerySchema,
  orderInputSchema,
  productInputSchema,
  productUnitInputSchema,
  supplierInputSchema,
} from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { productUnits, stockMovements } from '../db/schema.js';
import { createTestDb } from '../db/test-db.js';
import { cancelImport, createImport, getImport, listImports } from './imports.js';
import { createOrder } from './orders.js';
import { createUnit, deleteUnit } from './product-units.js';
import { createProduct, getProduct, setProductActive } from './products.js';
import { createSupplier, deleteSupplier, getSupplier, listSupplierTransactions, paySupplier } from './suppliers.js';

const VN = 420;
const at = (iso: string) => ({ now: new Date(iso), tzOffsetMin: VN });
const MORNING = at('2026-09-29T03:00:00.000Z');

let db: Db;
beforeEach(() => {
  db = createTestDb();
});
const product = (o: Record<string, unknown>) => createProduct(db, productInputSchema.parse(o));
const supplier = (name = 'Đại lý Hùng') => createSupplier(db, supplierInputSchema.parse({ name }));
const crateOf = (productId: number) =>
  createUnit(db, productId, productUnitInputSchema.parse({ name: 'Thùng', factor: 24, sellPrice: 280000 }));
const imp = (o: Record<string, unknown>, clock = MORNING) => createImport(db, importInputSchema.parse(o), clock);
const list = (q: Record<string, unknown>) => listImports(db, importListQuerySchema.parse(q), { tzOffsetMin: VN });

describe('createImport', () => {
  it('nhập theo thùng: +qty×factor, giá vốn gốc, giá bán thùng; ghi nợ phần chưa trả', () => {
    const p = product({ name: 'Bia', unit: 'lon', costPrice: 9000, sellPrice: 12000 });
    const crate = crateOf(p.id);
    const s = supplier();
    const r = imp({
      supplierId: s.id,
      paid: 400000,
      items: [{ productId: p.id, unitId: crate.id, qty: 2, unitCost: 240000, sellPrice: 290000 }],
    });
    expect(r).toMatchObject({ code: 'PN-20260929-0001', supplierName: 'Đại lý Hùng', total: 480000, paid: 400000, status: 'done', itemCount: 1 });
    expect(r.items).toMatchObject([{ productName: 'Bia', unitName: 'Thùng', factor: 24, qty: 2, unitCost: 240000, costPrice: 10000, amount: 480000 }]);
    expect(getProduct(db, p.id)).toMatchObject({ stock: 48, costPrice: 10000, sellPrice: 12000 });
    expect(db.select().from(productUnits).where(eq(productUnits.id, crate.id)).get()?.sellPrice).toBe(290000);
    expect(db.select().from(stockMovements).all().map((m) => [m.type, m.qty, m.refId, m.note])).toEqual([
      ['import', 48, r.id, 'Nhập PN-20260929-0001'],
    ]);
    expect(getSupplier(db, s.id).debt).toBe(80000);
    expect(listSupplierTransactions(db, s.id)).toMatchObject([{ amount: 80000, importCode: 'PN-20260929-0001' }]);
  });

  it('hai dòng cùng sản phẩm → giá vốn theo dòng cuối; sửa giá bán đơn vị gốc; hàng ngừng bán vẫn nhập', () => {
    const p = product({ name: 'Mì', costPrice: 3000, sellPrice: 4000 });
    setProductActive(db, p.id, false);
    imp({
      paid: 21000,
      items: [
        { productId: p.id, qty: 4, unitCost: 3000 },
        { productId: p.id, qty: 3, unitCost: 3000, sellPrice: 4500 },
      ],
    });
    imp({ paid: 3200, items: [{ productId: p.id, qty: 1, unitCost: 3200 }] });
    expect(getProduct(db, p.id)).toMatchObject({ stock: 8, costPrice: 3200, sellPrice: 4500 });
  });

  it('400: không NCC mà chưa trả đủ, trả vượt tổng, NCC đã xóa, đơn vị không thuộc sản phẩm, sản phẩm không có', () => {
    const a = product({ name: 'A', barcode: '1' });
    const b = product({ name: 'B', barcode: '2' });
    const crateB = crateOf(b.id);
    const gone = supplier('Cũ');
    deleteSupplier(db, gone.id);
    expect(() => imp({ paid: 0, items: [{ productId: a.id, qty: 1, unitCost: 1000 }] })).toThrow('Không ghi nhà cung cấp thì phải trả đủ');
    expect(() => imp({ paid: 2000, items: [{ productId: a.id, qty: 1, unitCost: 1000 }] })).toThrow('Số đã trả lớn hơn tổng tiền');
    expect(() => imp({ supplierId: gone.id, paid: 0, items: [{ productId: a.id, qty: 1, unitCost: 1000 }] })).toThrow(
      'Nhà cung cấp không còn hoạt động',
    );
    expect(() => imp({ paid: 1000, items: [{ productId: a.id, unitId: crateB.id, qty: 1, unitCost: 1000 }] })).toThrow(
      'Đơn vị của "A" không hợp lệ',
    );
    expect(() => imp({ paid: 1000, items: [{ productId: 999, qty: 1, unitCost: 1000 }] })).toThrow('Sản phẩm #999 không tồn tại');
    expect(db.select().from(stockMovements).all()).toEqual([]);
  });

  it('phiếu nháp cũ tham chiếu đơn vị đã xóa → 400 nêu tên sản phẩm', () => {
    const p = product({ name: 'Bia' });
    const crate = crateOf(p.id);
    deleteUnit(db, p.id, crate.id);
    expect(() => imp({ paid: 240000, items: [{ productId: p.id, unitId: crate.id, qty: 1, unitCost: 240000 }] })).toThrow(
      'Đơn vị của "Bia" không hợp lệ',
    );
  });

  it('mã tăng dần trong ngày VN, sang ngày mới về 0001', () => {
    const p = product({ name: 'A' });
    const one = { paid: 1000, items: [{ productId: p.id, qty: 1, unitCost: 1000 }] };
    expect(imp(one).code).toBe('PN-20260929-0001');
    expect(imp(one, at('2026-09-29T10:00:00.000Z')).code).toBe('PN-20260929-0002');
    expect(imp(one, at('2026-09-29T17:30:00.000Z')).code).toBe('PN-20260930-0001');
  });
});

describe('cancelImport', () => {
  it('trừ lại kho (được âm nếu đã bán), trừ lại nợ, giữ giá; hủy lần hai 409', () => {
    const p = product({ name: 'Bia', costPrice: 9000, sellPrice: 12000 });
    const s = supplier();
    const r = imp({ supplierId: s.id, paid: 0, items: [{ productId: p.id, qty: 48, unitCost: 10000 }] });
    createOrder(db, orderInputSchema.parse({ items: [{ productId: p.id, qty: 50, price: 12000 }], paymentMethod: 'cash', paid: 600000 }), MORNING);
    const c = cancelImport(db, r.id, at('2026-09-29T04:00:00.000Z'));
    expect(c).toMatchObject({ status: 'cancelled', cancelledAt: '2026-09-29T04:00:00.000Z' });
    expect(getProduct(db, p.id)).toMatchObject({ stock: -50, costPrice: 10000 });
    expect(getSupplier(db, s.id).debt).toBe(0);
    expect(listSupplierTransactions(db, s.id).map((t) => [t.amount, t.note])).toEqual([
      [-480000, 'Hủy PN-20260929-0001'],
      [480000, 'Nhập PN-20260929-0001'],
    ]);
    expect(() => cancelImport(db, r.id)).toThrow('Phiếu nhập đã hủy');
    expect(() => cancelImport(db, 999)).toThrow('Không tìm thấy phiếu nhập');
  });

  it('hủy sau khi đã trả hết nợ → NCC nợ lại mình (debt âm), không lỗi', () => {
    const p = product({ name: 'A' });
    const s = supplier();
    const r = imp({ supplierId: s.id, paid: 0, items: [{ productId: p.id, qty: 1, unitCost: 50000 }] });
    paySupplier(db, s.id, { amount: 50000, note: null });
    cancelImport(db, r.id);
    expect(getSupplier(db, s.id).debt).toBe(-50000);
  });
});

describe('listImports / getImport', () => {
  it('lọc theo ngày VN, mới nhất trước; tóm tắt bỏ phiếu hủy', () => {
    const p = product({ name: 'A' });
    const one = { paid: 1000, items: [{ productId: p.id, qty: 1, unitCost: 1000 }] };
    imp(one, at('2026-09-28T16:59:59.000Z'));
    const a = imp(one, at('2026-09-28T17:00:00.000Z'));
    const b = imp({ paid: 3000, items: [{ productId: p.id, qty: 3, unitCost: 1000 }] });
    const c = imp(one);
    cancelImport(db, c.id);
    const r = list({ date: '2026-09-29' });
    expect(r.imports.map((i) => i.id)).toEqual([c.id, b.id, a.id]);
    expect(r.summary).toEqual({ count: 2, total: 4000, paid: 4000 });
    expect(getImport(db, b.id).items).toHaveLength(1);
  });

  it('lọc NCC / không ghi NCC / còn nợ / trạng thái / tìm tên hàng; summary theo ngày; phân trang', () => {
    const s = createSupplier(db, supplierInputSchema.parse({ name: 'Đại lý Hùng' }));
    const milk = product({ name: 'Sữa đặc' });
    const other = product({ name: 'Mì gói' });
    const owe = imp({ supplierId: s.id, paid: 0, items: [{ productId: milk.id, qty: 2, unitCost: 1000 }] });
    const full = imp({ supplierId: s.id, paid: 1000, items: [{ productId: other.id, qty: 1, unitCost: 1000 }] });
    const none = imp({ paid: 1000, items: [{ productId: other.id, qty: 1, unitCost: 1000 }] });
    const ids = (q: Record<string, unknown>) => list({ date: '2026-09-29', ...q }).imports.map((i) => i.id);
    expect(ids({ supplierId: String(s.id) })).toEqual([full.id, owe.id]);
    expect(ids({ supplierId: 'none' })).toEqual([none.id]);
    expect(ids({ unpaid: '1' })).toEqual([owe.id]);
    expect(ids({ q: 'sua dac' })).toEqual([owe.id]);
    cancelImport(db, full.id);
    expect(ids({ status: 'cancelled' })).toEqual([full.id]);
    const r = list({ date: '2026-09-29', supplierId: 'none' });
    expect(r).toMatchObject({ total: 1, page: 1, pageSize: 50 });
    expect(r.summary).toEqual(list({ date: '2026-09-29' }).summary);
  });
});
