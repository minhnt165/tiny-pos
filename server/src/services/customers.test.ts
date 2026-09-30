import { beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { customerCreateSchema, customerInputSchema } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { createTestDb } from '../db/test-db.js';
import { debtBalanceAt, recordCustomerDebtTx } from './customer-ledger.js';
import {
  addManualDebt,
  collectDebt,
  createCustomer,
  deleteCustomer,
  getCustomer,
  listCustomerTransactions,
  listCustomers,
  updateCustomer,
} from './customers.js';

let db: Db;
beforeEach(() => {
  db = createTestDb();
});
const make = (o: Record<string, unknown>) => createCustomer(db, customerCreateSchema.parse(o));
/** Bất biến: cache customers.debt luôn bằng tổng sổ. */
const ledgerSum = (id: number) =>
  db.get<{ s: number }>(sql`select coalesce(sum(amount), 0) as s from debt_transactions where customer_id = ${id}`)?.s;

describe('customers', () => {
  it('tạo có nợ đầu kỳ → dòng opening; không nợ đầu kỳ → sổ trống; sửa không đổi nợ', () => {
    const a = make({ name: 'Chị Lan', phone: '0909', openingDebt: 150000 });
    expect(a).toMatchObject({ name: 'Chị Lan', phone: '0909', note: null, debt: 150000, isActive: true });
    expect(listCustomerTransactions(db, a.id).map((t) => [t.kind, t.amount, t.note, t.balanceAfter])).toEqual([
      ['opening', 150000, 'Nợ đầu kỳ', 150000],
    ]);
    const b = make({ name: 'Anh Tư' });
    expect(listCustomerTransactions(db, b.id)).toEqual([]);
    expect(updateCustomer(db, a.id, customerInputSchema.parse({ name: 'Chị Lan chợ' }))).toMatchObject({ name: 'Chị Lan chợ', debt: 150000 });
  });

  it('danh sách: chỉ khách đang theo dõi, nợ nhiều trước; tìm tên có dấu hoặc SĐT; totalDebt không theo q và bỏ nợ âm', () => {
    const lan = make({ name: 'Chị Lan', openingDebt: 50000 });
    const duc = make({ name: 'Đức Tư', phone: '0911', openingDebt: 90000 });
    const ba = make({ name: 'Bà Ba' });
    recordCustomerDebtTx(db, { customerId: ba.id, amount: -20000, kind: 'order_cancel' });
    const old = make({ name: 'Khách cũ' });
    deleteCustomer(db, old.id);
    expect(listCustomers(db).customers.map((c) => c.name)).toEqual(['Đức Tư', 'Chị Lan', 'Bà Ba']);
    expect(listCustomers(db, 'đức').customers.map((c) => c.id)).toEqual([duc.id]);
    expect(listCustomers(db, 'duc').customers.map((c) => c.id)).toEqual([duc.id]);
    expect(listCustomers(db, '0911').customers.map((c) => c.id)).toEqual([duc.id]);
    expect(listCustomers(db, 'lan')).toMatchObject({ customers: [{ id: lan.id }], totalDebt: 140000 });
  });

  it('thu nợ: trả kèm dòng sổ + số dư; ghi chú mặc định "Thu nợ"; thời gian theo clock', () => {
    const c = make({ name: 'Chị Lan', openingDebt: 50000 });
    const r = collectDebt(db, c.id, { amount: 30000, method: 'transfer', note: null }, { now: new Date('2026-09-29T03:00:00.000Z') });
    expect(r.customer.debt).toBe(20000);
    expect(r.transaction).toMatchObject({
      kind: 'payment',
      amount: -30000,
      method: 'transfer',
      note: 'Thu nợ',
      balanceAfter: 20000,
      createdAt: '2026-09-29T03:00:00.000Z',
    });
    expect(collectDebt(db, c.id, { amount: 5000, method: 'cash', note: 'Con trả hộ' }).transaction.note).toBe('Con trả hộ');
  });

  it('thu vượt nợ → 400; thu/ghi tay khách đã xóa → 400; khách không có → 404', () => {
    const c = make({ name: 'Chị Lan', openingDebt: 10000 });
    expect(() => collectDebt(db, c.id, { amount: 10001, method: 'cash', note: null })).toThrow('Thu nhiều hơn số đang nợ');
    collectDebt(db, c.id, { amount: 10000, method: 'cash', note: null });
    deleteCustomer(db, c.id);
    expect(() => collectDebt(db, c.id, { amount: 1, method: 'cash', note: null })).toThrow('Khách hàng không còn theo dõi');
    expect(() => addManualDebt(db, c.id, { amount: 1, note: 'x' })).toThrow('Khách hàng không còn theo dõi');
    expect(() => getCustomer(db, 999)).toThrow('Không tìm thấy khách hàng');
  });

  it('ghi nợ tay cộng nợ với ghi chú; xóa khi còn nợ (kể cả âm) → 409; hết nợ thì xóa mềm', () => {
    const c = make({ name: 'Chị Lan' });
    expect(addManualDebt(db, c.id, { amount: 7000, note: 'Quên ghi gói thuốc' }).debt).toBe(7000);
    expect(listCustomerTransactions(db, c.id)[0]).toMatchObject({ kind: 'manual', amount: 7000, note: 'Quên ghi gói thuốc', method: null });
    expect(() => deleteCustomer(db, c.id)).toThrow('Còn nợ, không xóa được');
    recordCustomerDebtTx(db, { customerId: c.id, amount: -8000, kind: 'order_cancel' });
    expect(() => deleteCustomer(db, c.id)).toThrow('Còn nợ, không xóa được');
    recordCustomerDebtTx(db, { customerId: c.id, amount: 1000, kind: 'manual', note: 'bù' });
    deleteCustomer(db, c.id);
    expect(getCustomer(db, c.id).isActive).toBe(false);
  });

  it('sổ nợ mới nhất trước, số dư từng dòng; debtBalanceAt; cache debt = tổng sổ', () => {
    const c = make({ name: 'Chị Lan', openingDebt: 100000 });
    const t2 = recordCustomerDebtTx(db, { customerId: c.id, amount: 20000, kind: 'manual', note: 'a' });
    collectDebt(db, c.id, { amount: 50000, method: 'cash', note: null });
    expect(listCustomerTransactions(db, c.id).map((t) => [t.kind, t.amount, t.balanceAfter])).toEqual([
      ['payment', -50000, 70000],
      ['manual', 20000, 120000],
      ['opening', 100000, 100000],
    ]);
    expect(debtBalanceAt(db, c.id, t2)).toBe(120000);
    expect(getCustomer(db, c.id).debt).toBe(ledgerSum(c.id));
  });
});
