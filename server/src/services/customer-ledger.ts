import { and, eq, lte, sql } from 'drizzle-orm';
import type { CollectMethod, DebtTxKind } from '@tiny-pos/shared';
import type { DbOrTx } from '../db/connection.js';
import { customers, debtTransactions } from '../db/schema.js';

export interface CustomerDebtTxInput {
  customerId: number;
  amount: number;
  kind: DebtTxKind;
  orderId?: number | null;
  method?: CollectMethod | null;
  note?: string | null;
  createdAt?: string;
}

/** Cách DUY NHẤT để đổi nợ khách: ghi sổ rồi cộng dồn vào customers.debt. Trả id dòng sổ. */
export function recordCustomerDebtTx(tx: DbOrTx, t: CustomerDebtTxInput): number {
  const { id } = tx
    .insert(debtTransactions)
    .values({
      customerId: t.customerId,
      amount: t.amount,
      kind: t.kind,
      orderId: t.orderId ?? null,
      method: t.method ?? null,
      note: t.note ?? null,
      ...(t.createdAt ? { createdAt: t.createdAt } : {}),
    })
    .returning({ id: debtTransactions.id })
    .get();
  tx.update(customers)
    .set({ debt: sql`${customers.debt} + ${t.amount}` })
    .where(eq(customers.id, t.customerId))
    .run();
  return id;
}

/** Số nợ của khách ngay sau dòng sổ `txId` (dùng cho "nợ cũ / tổng nợ" khi in lại hóa đơn). */
export function debtBalanceAt(db: DbOrTx, customerId: number, txId: number): number {
  const r = db
    .select({ s: sql<number>`coalesce(sum(${debtTransactions.amount}), 0)` })
    .from(debtTransactions)
    .where(and(eq(debtTransactions.customerId, customerId), lte(debtTransactions.id, txId)))
    .get();
  return Number(r?.s ?? 0);
}
