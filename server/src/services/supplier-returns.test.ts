import { beforeEach, describe, expect, it } from 'vitest';
import {
  importInputSchema,
  productInputSchema,
  productUnitInputSchema,
  settingsInputSchema,
  supplierInputSchema,
  supplierReturnInputSchema,
  supplierReturnListQuerySchema,
} from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { stockMovements } from '../db/schema.js';
import { createTestDb } from '../db/test-db.js';
import { readWorkbook } from '../xlsx/workbook.js';
import { exportSupplierReturnsXlsx } from './exports.js';
import { createImport } from './imports.js';
import { listMovements } from './movements.js';
import { createUnit } from './product-units.js';
import { createProduct, getProduct, setProductActive } from './products.js';
import { getSettings, saveSettings } from './settings.js';
import { cancelSupplierReturn, createSupplierReturn, getSupplierReturn, listSupplierReturns } from './supplier-returns.js';
import { createSupplier, deleteSupplier, getSupplier, listSupplierTransactions } from './suppliers.js';

const VN = 420;
const at = (iso: string) => ({ now: new Date(iso), tzOffsetMin: VN });
const D29 = at('2026-09-29T03:00:00.000Z'); // 10:00 ngày 29/9 giờ VN: ngày nhập
const D30 = at('2026-09-30T03:00:00.000Z'); // 10:00 ngày 30/9 giờ VN: ngày trả

let db: Db;
beforeEach(() => {
  db = createTestDb();
});
const product = (o: Record<string, unknown>) => createProduct(db, productInputSchema.parse(o));
const supplier = (name = 'Đại lý Hùng') => createSupplier(db, supplierInputSchema.parse({ name }));
const ret = (o: Record<string, unknown>, clock = D30) => createSupplierReturn(db, supplierReturnInputSchema.parse(o), clock);
const list = (q: Record<string, unknown>) => listSupplierReturns(db, supplierReturnListQuerySchema.parse(q), { tzOffsetMin: VN });
const movements = () =>
  db
    .select()
    .from(stockMovements)
    .all()
    .filter((m) => m.type !== 'import' && m.note !== 'Tồn đầu')
    .map((m) => [m.type, m.productId, m.qty, m.note]);

/** Bia lon vốn 10.000, thùng 24 lon; nhập nợ 2 thùng (480.000) của Đại lý Hùng. */
function seed() {
  const bia = product({ name: 'Bia', unit: 'lon', costPrice: 10000, sellPrice: 12000 });
  const crate = createUnit(db, bia.id, productUnitInputSchema.parse({ name: 'Thùng', factor: 24, sellPrice: 280000 }));
  const s = supplier();
  createImport(db, importInputSchema.parse({ supplierId: s.id, paid: 0, items: [{ productId: bia.id, unitId: crate.id, qty: 2, unitCost: 240000 }] }), D29);
  return { bia, crate, s };
}

describe('createSupplierReturn', () => {
  it('trả theo thùng: mã TN theo ngày trả, −qty×factor loại supplier_return, trừ nợ NCC, giá vốn giữ nguyên', () => {
    const { bia, crate, s } = seed();
    const r = ret({ supplierId: s.id, note: 'Hết hạn', items: [{ productId: bia.id, unitId: crate.id, qty: 1, unitPrice: 230000 }] });
    expect(r).toMatchObject({
      code: 'TN-20260930-0001',
      supplierId: s.id,
      supplierName: 'Đại lý Hùng',
      total: 230000,
      debtReduced: 230000,
      cashReceived: 0,
      status: 'done',
      itemCount: 1,
      note: 'Hết hạn',
      createdAt: '2026-09-30T03:00:00.000Z',
    });
    expect(r.items).toMatchObject([{ productId: bia.id, productName: 'Bia', unitName: 'Thùng', factor: 24, qty: 1, unitPrice: 230000, amount: 230000 }]);
    expect(getProduct(db, bia.id)).toMatchObject({ stock: 24, costPrice: 10000 });
    expect(movements()).toEqual([['supplier_return', bia.id, -24, 'Trả NCC TN-20260930-0001']]);
    expect(getSupplier(db, s.id).debt).toBe(250000);
    expect(listSupplierTransactions(db, s.id)[0]).toMatchObject({ amount: -230000, note: 'Trả NCC TN-20260930-0001', importId: null });
    expect(listMovements(db, bia.id, 10)[0]).toMatchObject({ type: 'supplier_return', refCode: 'TN-20260930-0001' });
  });

  it('nợ ít hơn tiền trả: trừ hết nợ, phần dư NCC trả tiền mặt; NCC nợ 0 thì tiền mặt hết', () => {
    const { bia, s } = seed();
    const a = ret({ supplierId: s.id, items: [{ productId: bia.id, qty: 50, unitPrice: 10000 }] });
    expect(a).toMatchObject({ total: 500000, debtReduced: 480000, cashReceived: 20000 });
    expect(getSupplier(db, s.id).debt).toBe(0);
    const other = supplier('Tạp hóa sỉ An');
    const b = ret({ supplierId: other.id, items: [{ productId: bia.id, qty: 1, unitPrice: 10000 }] });
    expect(b).toMatchObject({ code: 'TN-20260930-0002', debtReduced: 0, cashReceived: 10000 });
    expect(listSupplierTransactions(db, other.id)).toEqual([]);
  });

  it('trả quá tồn vẫn lưu (tồn âm); sản phẩm ngừng bán vẫn trả được; hàng cân số lẻ', () => {
    const s = supplier();
    const thit = product({ name: 'Thịt heo', unit: 'kg', isWeighed: true, costPrice: 120000, stock: 0.2 });
    setProductActive(db, thit.id, false);
    const r = ret({ supplierId: s.id, items: [{ productId: thit.id, qty: 0.35, unitPrice: 120000 }] });
    expect(r.total).toBe(42000);
    expect(getProduct(db, thit.id).stock).toBeCloseTo(-0.15, 9);
  });

  it('từ chối: NCC ngừng hoạt động, sản phẩm lạ, đơn vị của sản phẩm khác, tổng vượt trần', () => {
    const { bia, s } = seed();
    const other = product({ name: 'Nước', costPrice: 4000 });
    const otherUnit = createUnit(db, other.id, productUnitInputSchema.parse({ name: 'Lốc', factor: 6, sellPrice: 30000 }));
    const gone = supplier('Đã nghỉ');
    deleteSupplier(db, gone.id);
    expect(() => ret({ supplierId: gone.id, items: [{ productId: bia.id, qty: 1, unitPrice: 1 }] })).toThrow('Nhà cung cấp không còn hoạt động');
    expect(() => ret({ supplierId: 999, items: [{ productId: bia.id, qty: 1, unitPrice: 1 }] })).toThrow('Nhà cung cấp không còn hoạt động');
    expect(() => ret({ supplierId: s.id, items: [{ productId: 999, qty: 1, unitPrice: 1 }] })).toThrow('Sản phẩm không hợp lệ');
    expect(() => ret({ supplierId: s.id, items: [{ productId: bia.id, unitId: otherUnit.id, qty: 1, unitPrice: 1 }] })).toThrow('Đơn vị không hợp lệ');
    expect(() =>
      ret({ supplierId: s.id, items: [{ productId: bia.id, qty: 2, unitPrice: 600_000_000 }] }),
    ).toThrow('Tổng tiền vượt giới hạn');
    expect(movements()).toEqual([]);
    expect(getSupplier(db, s.id).debt).toBe(480000);
  });
});

describe('cancelSupplierReturn', () => {
  it('đưa tồn và nợ về như trước; phiếu giữ lại Đã hủy; hủy hai lần 409', () => {
    const { bia, crate, s } = seed();
    const r = ret({ supplierId: s.id, items: [{ productId: bia.id, unitId: crate.id, qty: 1, unitPrice: 240000 }] });
    const c = cancelSupplierReturn(db, r.id, at('2026-09-30T05:00:00.000Z'));
    expect(c).toMatchObject({ status: 'cancelled', cancelledAt: '2026-09-30T05:00:00.000Z' });
    expect(getProduct(db, bia.id).stock).toBe(48);
    expect(getSupplier(db, s.id).debt).toBe(480000);
    expect(movements()).toEqual([
      ['supplier_return', bia.id, -24, `Trả NCC ${r.code}`],
      ['adjust', bia.id, 24, `Hủy phiếu trả NCC ${r.code}`],
    ]);
    expect(listSupplierTransactions(db, s.id)[0]).toMatchObject({ amount: 240000, note: `Hủy phiếu trả NCC ${r.code}` });
    expect(() => cancelSupplierReturn(db, r.id)).toThrow('Phiếu trả NCC đã hủy');
    expect(() => getSupplierReturn(db, 999)).toThrow('Không tìm thấy phiếu trả NCC');
  });

  it('NCC đã xóa: phiếu có trừ nợ thì không hủy được, phiếu chỉ nhận tiền mặt thì hủy được', () => {
    const { bia, s } = seed();
    const debtReturn = ret({ supplierId: s.id, items: [{ productId: bia.id, qty: 48, unitPrice: 10000 }] }); // trừ hết 480.000
    const cashReturn = ret({ supplierId: s.id, items: [{ productId: bia.id, qty: 1, unitPrice: 10000 }] }); // nợ 0 → tiền mặt
    deleteSupplier(db, s.id);
    expect(() => cancelSupplierReturn(db, debtReturn.id)).toThrow('Nhà cung cấp đã xóa, không hủy được phiếu đã trừ nợ');
    expect(cancelSupplierReturn(db, cashReturn.id).status).toBe('cancelled');
    expect(getSupplier(db, s.id).debt).toBe(0);
  });
});

describe('listSupplierReturns', () => {
  it('lọc ngày (mặc định hôm nay), NCC, trạng thái, tìm không dấu theo mã / tên hàng; summary chỉ theo ngày và phiếu done', () => {
    const { bia, s } = seed();
    const nuoc = product({ name: 'Nước suối', costPrice: 4000 });
    const other = supplier('Tạp hóa sỉ An');
    const a = ret({ supplierId: s.id, items: [{ productId: bia.id, qty: 2, unitPrice: 10000 }] });
    const b = ret({ supplierId: other.id, items: [{ productId: nuoc.id, qty: 5, unitPrice: 4000 }] });
    cancelSupplierReturn(db, b.id);
    ret({ supplierId: s.id, items: [{ productId: bia.id, qty: 1, unitPrice: 10000 }] }, at('2026-10-01T03:00:00.000Z'));

    const day = list({ from: '2026-09-30', to: '2026-09-30' });
    expect(day.returns.map((r) => r.code)).toEqual([b.code, a.code]);
    expect(day.summary).toEqual({ count: 1, total: 20000, debt: 20000, cash: 0 });
    expect(day.total).toBe(2);
    expect(list({ from: '2026-09-30', to: '2026-09-30', supplierId: String(other.id) }).returns.map((r) => r.id)).toEqual([b.id]);
    expect(list({ from: '2026-09-30', to: '2026-09-30', status: 'done' }).returns.map((r) => r.id)).toEqual([a.id]);
    expect(list({ from: '2026-09-30', to: '2026-09-30', q: 'nuoc suoi' }).returns.map((r) => r.id)).toEqual([b.id]);
    expect(list({ from: '2026-09-30', to: '2026-09-30', q: 'TN-20260930-0001' }).returns.map((r) => r.id)).toEqual([a.id]);
    expect(list({ from: '2026-09-29', to: '2026-10-01' }).total).toBe(3);
  });
});

describe('exportSupplierReturnsXlsx', () => {
  it('sheet Phiếu trả NCC + Chi tiết theo bộ lọc; tên file theo khoảng ngày', async () => {
    const { bia, crate, s } = seed();
    ret({ supplierId: s.id, note: 'Móp', items: [{ productId: bia.id, unitId: crate.id, qty: 1, unitPrice: 240000 }] });
    const f = await exportSupplierReturnsXlsx(db, supplierReturnListQuerySchema.parse({ from: '2026-09-30', to: '2026-09-30' }), D30);
    expect(f.filename).toBe('tra-ncc-20260930.xlsx');
    const [head, detail] = await readWorkbook(f.buffer);
    expect(head!.name).toBe('Phiếu trả NCC');
    expect(head!.rows).toEqual([
      ['Mã', 'Ngày giờ', 'NCC', 'Tổng trả', 'Trừ nợ', 'NCC trả tiền mặt', 'Số món', 'Trạng thái', 'Hủy lúc', 'Ghi chú'],
      ['TN-20260930-0001', '2026-09-30T10:00:00.000Z', 'Đại lý Hùng', 240000, 240000, 0, 1, 'Hoàn tất', null, 'Móp'],
    ]);
    expect(detail!.name).toBe('Chi tiết');
    expect(detail!.rows).toEqual([
      ['Mã phiếu', 'Ngày giờ', 'Trạng thái', 'NCC', 'Tên hàng', 'Đơn vị', 'Quy đổi', 'SL', 'Giá trả', 'Thành tiền'],
      ['TN-20260930-0001', '2026-09-30T10:00:00.000Z', 'Hoàn tất', 'Đại lý Hùng', 'Bia', 'Thùng', 24, 1, 240000, 240000],
    ]);
  });
});

describe('cài đặt tem', () => {
  it('mặc định 40×30 có in giá; lưu rồi đọc lại đúng kiểu boolean', () => {
    expect(getSettings(db)).toMatchObject({ labelSize: '40x30', labelShowPrice: true });
    saveSettings(db, settingsInputSchema.parse({ labelSize: '35x22x2', labelShowPrice: false }));
    expect(getSettings(db)).toMatchObject({ labelSize: '35x22x2', labelShowPrice: false });
  });
});
