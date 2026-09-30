import { eq, sql } from 'drizzle-orm';
import type { DbOrTx } from '../db/connection.js';
import { supplierTransactions, suppliers } from '../db/schema.js';

export interface SupplierTxInput {
  supplierId: number;
  amount: number;
  importId?: number | null;
  note?: string | null;
  createdAt?: string;
}

/** Cách DUY NHẤT để đổi nợ nhà cung cấp: ghi sổ rồi cộng dồn vào suppliers.debt. */
export function recordSupplierTx(tx: DbOrTx, t: SupplierTxInput): void {
  tx.insert(supplierTransactions)
    .values({
      supplierId: t.supplierId,
      amount: t.amount,
      importId: t.importId ?? null,
      note: t.note ?? null,
      ...(t.createdAt ? { createdAt: t.createdAt } : {}),
    })
    .run();
  tx.update(suppliers)
    .set({ debt: sql`${suppliers.debt} + ${t.amount}` })
    .where(eq(suppliers.id, t.supplierId))
    .run();
}
