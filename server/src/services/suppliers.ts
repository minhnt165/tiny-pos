import { asc, eq, sql } from 'drizzle-orm';
import { foldText, type Supplier, type SupplierInput, type SupplierListItem, type SupplierPayment, type SupplierTransaction } from '@tiny-pos/shared';
import type { Db, DbOrTx } from '../db/connection.js';
import { imports, supplierTransactions, suppliers } from '../db/schema.js';
import { BadRequestError, ConflictError, NotFoundError } from '../errors.js';
import { recordSupplierTx } from './supplier-ledger.js';

/** Lọc bằng JS, bỏ dấu và hoa/thường ("dai" khớp "Đại"), vì LIKE của SQLite chỉ bỏ hoa/thường với ASCII. */
export function listSuppliers(db: Db, q?: string, includeInactive = false): SupplierListItem[] {
  // Viết tên bảng cứng trong subquery (drizzle bỏ tiền tố bảng khi render cột)
  const lastActivityAt = sql<string | null>`(select max(created_at) from supplier_transactions where supplier_transactions.supplier_id = suppliers.id)`;
  const rows: SupplierListItem[] = db
    .select({ s: suppliers, lastActivityAt })
    .from(suppliers)
    .where(includeInactive ? undefined : eq(suppliers.isActive, true))
    .orderBy(asc(suppliers.name))
    .all()
    .map((r) => ({ ...r.s, lastActivityAt: r.lastActivityAt }));
  const t = q ? foldText(q.trim()) : '';
  if (!t) return rows;
  return rows.filter((s) => foldText(s.name).includes(t) || (s.phone?.includes(t) ?? false));
}

export function getSupplier(db: DbOrTx, id: number): Supplier {
  const s = db.select().from(suppliers).where(eq(suppliers.id, id)).get();
  if (!s) throw new NotFoundError('Không tìm thấy nhà cung cấp');
  return s;
}

export function createSupplier(db: Db, input: SupplierInput): Supplier {
  const { id } = db.insert(suppliers).values(input).returning({ id: suppliers.id }).get();
  return getSupplier(db, id);
}

export function updateSupplier(db: Db, id: number, input: SupplierInput): Supplier {
  getSupplier(db, id);
  db.update(suppliers).set(input).where(eq(suppliers.id, id)).run();
  return getSupplier(db, id);
}

/** Xóa mềm; còn nợ (kể cả âm) thì không cho, để sổ nợ không bị "treo". */
export function deleteSupplier(db: Db, id: number): void {
  const s = getSupplier(db, id);
  if (s.debt !== 0) throw new ConflictError('Còn nợ, không xóa được');
  db.update(suppliers).set({ isActive: false }).where(eq(suppliers.id, id)).run();
}

export function paySupplier(db: Db, id: number, input: SupplierPayment): Supplier {
  return db.transaction((tx) => {
    const s = getSupplier(tx, id);
    if (!s.isActive) throw new BadRequestError('Nhà cung cấp không còn hoạt động');
    if (input.amount > s.debt) throw new BadRequestError('Trả nhiều hơn số đang nợ');
    recordSupplierTx(tx, { supplierId: id, amount: -input.amount, note: input.note ?? 'Trả nợ' });
    return getSupplier(tx, id);
  });
}

/** Sổ nợ mới nhất trước, kèm số dư sau từng giao dịch. */
export function listSupplierTransactions(db: Db, id: number): SupplierTransaction[] {
  getSupplier(db, id);
  const rows = db
    .select({
      id: supplierTransactions.id,
      supplierId: supplierTransactions.supplierId,
      importId: supplierTransactions.importId,
      importCode: imports.code,
      amount: supplierTransactions.amount,
      note: supplierTransactions.note,
      createdAt: supplierTransactions.createdAt,
    })
    .from(supplierTransactions)
    .leftJoin(imports, eq(supplierTransactions.importId, imports.id))
    .where(eq(supplierTransactions.supplierId, id))
    .orderBy(asc(supplierTransactions.id))
    .all();
  let balance = 0;
  return rows.map((r) => ({ ...r, balance: (balance += r.amount) })).reverse();
}
