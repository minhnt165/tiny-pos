import { beforeEach, describe, expect, it } from 'vitest';
import { supplierInputSchema } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { createTestDb } from '../db/test-db.js';
import { nextDailyCode } from './daily-code.js';
import { recordSupplierTx } from './supplier-ledger.js';
import {
  createSupplier,
  deleteSupplier,
  getSupplier,
  listSupplierTransactions,
  listSuppliers,
  paySupplier,
  updateSupplier,
} from './suppliers.js';

let db: Db;
beforeEach(() => {
  db = createTestDb();
});
const make = (o: Record<string, unknown>) => createSupplier(db, supplierInputSchema.parse(o));

describe('suppliers', () => {
  it('tạo, sửa, tìm theo tên có dấu không phân biệt hoa/thường, sắp theo tên', () => {
    const a = make({ name: 'Đại lý Hùng', phone: '0909' });
    make({ name: 'Bánh kẹo Minh' });
    expect(a).toMatchObject({ name: 'Đại lý Hùng', phone: '0909', note: null, debt: 0, isActive: true });
    expect(listSuppliers(db).map((s) => s.name)).toEqual(['Bánh kẹo Minh', 'Đại lý Hùng']);
    expect(listSuppliers(db, 'đại').map((s) => s.name)).toEqual(['Đại lý Hùng']);
    expect(listSuppliers(db, '0909').map((s) => s.id)).toEqual([a.id]);
    expect(updateSupplier(db, a.id, supplierInputSchema.parse({ name: 'Đại lý Hùng 2' })).name).toBe('Đại lý Hùng 2');
  });

  it('sổ nợ: recordSupplierTx cộng dồn debt; trả nợ trừ; số dư theo từng dòng, mới nhất trước', () => {
    const s = make({ name: 'NCC' });
    recordSupplierTx(db, { supplierId: s.id, amount: 80000, note: 'Nhập PN-1' });
    recordSupplierTx(db, { supplierId: s.id, amount: 20000, note: 'Nhập PN-2' });
    expect(paySupplier(db, s.id, { amount: 30000, note: null }).debt).toBe(70000);
    expect(listSupplierTransactions(db, s.id).map((t) => [t.amount, t.balance, t.note])).toEqual([
      [-30000, 70000, 'Trả nợ'],
      [20000, 100000, 'Nhập PN-2'],
      [80000, 80000, 'Nhập PN-1'],
    ]);
  });

  it('trả nhiều hơn số đang nợ → 400; xóa khi còn nợ → 409; hết nợ thì xóa mềm được', () => {
    const s = make({ name: 'NCC' });
    recordSupplierTx(db, { supplierId: s.id, amount: 10000 });
    expect(() => paySupplier(db, s.id, { amount: 10001, note: null })).toThrow('Trả nhiều hơn số đang nợ');
    expect(() => deleteSupplier(db, s.id)).toThrow('Còn nợ, không xóa được');
    paySupplier(db, s.id, { amount: 10000, note: 'tiền mặt' });
    deleteSupplier(db, s.id);
    expect(listSuppliers(db)).toEqual([]);
    expect(getSupplier(db, s.id).isActive).toBe(false);
    expect(() => paySupplier(db, s.id, { amount: 1, note: null })).toThrow('Nhà cung cấp không còn hoạt động');
    expect(() => getSupplier(db, 999)).toThrow('Không tìm thấy nhà cung cấp');
  });

  it('includeInactive trả cả NCC đã xóa; lastActivityAt là dòng sổ nợ mới nhất', () => {
    const a = make({ name: 'A' });
    const b = make({ name: 'B' });
    recordSupplierTx(db, { supplierId: a.id, amount: 1000, note: 'x', createdAt: '2026-09-01T00:00:00.000Z' });
    recordSupplierTx(db, { supplierId: a.id, amount: 1000, note: 'y', createdAt: '2026-09-05T00:00:00.000Z' });
    deleteSupplier(db, b.id);
    expect(listSuppliers(db).map((s) => [s.name, s.lastActivityAt])).toEqual([['A', '2026-09-05T00:00:00.000Z']]);
    expect(listSuppliers(db, undefined, true).map((s) => [s.name, s.isActive, s.lastActivityAt])).toEqual([
      ['A', true, '2026-09-05T00:00:00.000Z'],
      ['B', false, null],
    ]);
  });
});

describe('nextDailyCode', () => {
  it('bắt đầu 1 mỗi ngày, độ rộng theo tham số', () => {
    expect(nextDailyCode(db, 'imports', 'PN', '2026-09-29', 4)).toBe('PN-20260929-0001');
    expect(nextDailyCode(db, 'stocktakes', 'KK', '2026-09-29', 2)).toBe('KK-20260929-01');
  });
});
