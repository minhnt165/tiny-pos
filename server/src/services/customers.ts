import { asc, desc, eq, sql } from 'drizzle-orm';
import { stripDiacritics } from '@tiny-pos/shared';
import type {
  Customer,
  CustomerAdjustment,
  CustomerCreate,
  CustomerInput,
  CustomerList,
  CustomerListItem,
  CustomerPayment,
  CustomerPaymentResult,
  CustomerTransaction,
} from '@tiny-pos/shared';
import type { Db, DbOrTx } from '../db/connection.js';
import { customers, debtTransactions, orders } from '../db/schema.js';
import { BadRequestError, ConflictError, NotFoundError } from '../errors.js';
import { recordCustomerDebtTx } from './customer-ledger.js';
import { resolveClock, type Clock } from './daily-code.js';

/** Lọc bằng JS vì LIKE của SQLite không bỏ hoa/thường với chữ có dấu ("đức" ≠ "Đức"); tên so khớp cả khi gõ không dấu ("duc" → "Đức"). */
export function listCustomers(db: Db, q?: string, includeInactive = false): CustomerList {
  // Viết tên bảng cứng trong subquery (drizzle bỏ tiền tố bảng khi render cột)
  const lastActivityAt = sql<string | null>`(select max(created_at) from debt_transactions where debt_transactions.customer_id = customers.id)`;
  const rows: CustomerListItem[] = db
    .select({ c: customers, lastActivityAt })
    .from(customers)
    .where(includeInactive ? undefined : eq(customers.isActive, true))
    .orderBy(desc(customers.debt), asc(customers.name))
    .all()
    .map((r) => ({ ...r.c, lastActivityAt: r.lastActivityAt }));
  const totalDebt = rows.filter((c) => c.isActive).reduce((s, c) => s + Math.max(0, c.debt), 0);
  const t = q ? stripDiacritics(q.trim()).toLowerCase() : '';
  if (!t) return { customers: rows, totalDebt };
  return { customers: rows.filter((c) => stripDiacritics(c.name).toLowerCase().includes(t) || (c.phone?.includes(t) ?? false)), totalDebt };
}

export function getCustomer(db: DbOrTx, id: number): Customer {
  const c = db.select().from(customers).where(eq(customers.id, id)).get();
  if (!c) throw new NotFoundError('Không tìm thấy khách hàng');
  return c;
}

function activeCustomer(db: DbOrTx, id: number): Customer {
  const c = getCustomer(db, id);
  if (!c.isActive) throw new BadRequestError('Khách hàng không còn theo dõi');
  return c;
}

export function createCustomer(db: Db, input: CustomerCreate): Customer {
  const { openingDebt, ...fields } = input;
  return db.transaction((tx) => {
    const { id } = tx.insert(customers).values(fields).returning({ id: customers.id }).get();
    if (openingDebt > 0) recordCustomerDebtTx(tx, { customerId: id, amount: openingDebt, kind: 'opening', note: 'Nợ đầu kỳ' });
    return getCustomer(tx, id);
  });
}

export function updateCustomer(db: Db, id: number, input: CustomerInput): Customer {
  getCustomer(db, id);
  db.update(customers).set(input).where(eq(customers.id, id)).run();
  return getCustomer(db, id);
}

/** Xóa mềm; còn nợ (kể cả âm) thì không cho, để sổ nợ không bị "treo". */
export function deleteCustomer(db: Db, id: number): void {
  const c = getCustomer(db, id);
  if (c.debt !== 0) throw new ConflictError('Còn nợ, không xóa được');
  db.update(customers).set({ isActive: false }).where(eq(customers.id, id)).run();
}

export function collectDebt(db: Db, id: number, input: CustomerPayment, clock?: Clock): CustomerPaymentResult {
  const { now } = resolveClock(clock);
  return db.transaction((tx) => {
    const c = activeCustomer(tx, id);
    if (input.amount > c.debt) throw new BadRequestError('Thu nhiều hơn số đang nợ');
    recordCustomerDebtTx(tx, {
      customerId: id,
      amount: -input.amount,
      kind: 'payment',
      method: input.method,
      note: input.note ?? 'Thu nợ',
      createdAt: now.toISOString(),
    });
    return { customer: getCustomer(tx, id), transaction: listCustomerTransactions(tx, id)[0]! };
  });
}

export function addManualDebt(db: Db, id: number, input: CustomerAdjustment): Customer {
  return db.transaction((tx) => {
    activeCustomer(tx, id);
    recordCustomerDebtTx(tx, { customerId: id, amount: input.amount, kind: 'manual', note: input.note });
    return getCustomer(tx, id);
  });
}

/** Sổ nợ mới nhất trước, kèm số dư sau từng giao dịch và mã hóa đơn nếu có. */
export function listCustomerTransactions(db: DbOrTx, id: number): CustomerTransaction[] {
  getCustomer(db, id);
  const rows = db
    .select({
      id: debtTransactions.id,
      customerId: debtTransactions.customerId,
      kind: debtTransactions.kind,
      amount: debtTransactions.amount,
      method: debtTransactions.method,
      note: debtTransactions.note,
      orderId: debtTransactions.orderId,
      orderCode: orders.code,
      createdAt: debtTransactions.createdAt,
    })
    .from(debtTransactions)
    .leftJoin(orders, eq(debtTransactions.orderId, orders.id))
    .where(eq(debtTransactions.customerId, id))
    .orderBy(asc(debtTransactions.id))
    .all();
  let balance = 0;
  return rows.map((r) => ({ ...r, balanceAfter: (balance += r.amount) })).reverse();
}
