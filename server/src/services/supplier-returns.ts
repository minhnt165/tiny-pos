import { and, asc, count, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import {
  importLineAmount,
  localDate,
  localDayRange,
  MAX_EXPORT_ROWS,
  MAX_MONEY,
  PAGE_SIZE,
  resolveRange,
  splitSupplierRefund,
  type SupplierReturnDetail,
  type SupplierReturnInput,
  type SupplierReturnItem,
  type SupplierReturnList,
  type SupplierReturnListQuery,
  type SupplierReturnSummary,
} from '@tiny-pos/shared';
import type { Db, DbOrTx } from '../db/connection.js';
import { productUnits, products, supplierReturnItems, supplierReturns, suppliers } from '../db/schema.js';
import { BadRequestError, ConflictError, NotFoundError } from '../errors.js';
import { nextDailyCode, resolveClock, type Clock } from './daily-code.js';
import { likeTerm } from './orders.js';
import { recordMovement } from './stock.js';
import { recordSupplierTx } from './supplier-ledger.js';

type Row = typeof supplierReturns.$inferSelect;

// Viết tên bảng cứng: drizzle bỏ tiền tố bảng khi render cột trong subquery
const itemCount = sql<number>`(select count(*) from supplier_return_items where supplier_return_items.return_id = supplier_returns.id)`;

function toSummary(r: Row, n: number): SupplierReturnSummary {
  return {
    id: r.id,
    code: r.code,
    supplierId: r.supplierId,
    supplierName: r.supplierName,
    total: r.total,
    debtReduced: r.debtReduced,
    cashReceived: r.cashReceived,
    note: r.note,
    status: r.status,
    itemCount: n,
    createdAt: r.createdAt,
    cancelledAt: r.cancelledAt,
  };
}

const itemColumns = {
  id: supplierReturnItems.id,
  productId: supplierReturnItems.productId,
  productName: supplierReturnItems.productName,
  unitName: supplierReturnItems.unitName,
  factor: supplierReturnItems.factor,
  qty: supplierReturnItems.qty,
  unitPrice: supplierReturnItems.unitPrice,
  amount: supplierReturnItems.amount,
};

/** Dòng của nhiều phiếu, theo lô: SQLite giới hạn số tham số trong một câu lệnh. */
function itemsOf(db: DbOrTx, ids: number[]): Map<number, SupplierReturnItem[]> {
  const out = new Map<number, SupplierReturnItem[]>();
  for (let i = 0; i < ids.length; i += 500) {
    const batch = db
      .select({ returnId: supplierReturnItems.returnId, ...itemColumns })
      .from(supplierReturnItems)
      .where(inArray(supplierReturnItems.returnId, ids.slice(i, i + 500)))
      .orderBy(asc(supplierReturnItems.id))
      .all();
    for (const { returnId, ...it } of batch) {
      const list = out.get(returnId);
      if (list) list.push(it);
      else out.set(returnId, [it]);
    }
  }
  return out;
}

export function getSupplierReturn(db: DbOrTx, id: number): SupplierReturnDetail {
  const r = db.select().from(supplierReturns).where(eq(supplierReturns.id, id)).get();
  if (!r) throw new NotFoundError('Không tìm thấy phiếu trả NCC');
  const items = itemsOf(db, [id]).get(id) ?? [];
  return { ...toSummary(r, items.length), items };
}

/** Sản phẩm ngừng bán vẫn trả được (trả hàng tồn cũ). */
function resolveLine(tx: DbOrTx, it: SupplierReturnInput['items'][number]) {
  const p = tx.select().from(products).where(eq(products.id, it.productId)).get();
  if (!p) throw new BadRequestError('Sản phẩm không hợp lệ');
  let factor = 1;
  let unitName = p.unit;
  if (it.unitId !== null) {
    const u = tx
      .select()
      .from(productUnits)
      .where(and(eq(productUnits.id, it.unitId), eq(productUnits.productId, p.id)))
      .get();
    if (!u) throw new BadRequestError('Đơn vị không hợp lệ');
    factor = u.factor;
    unitName = u.name;
  }
  return { productId: p.id, productName: p.name, unitName, factor, qty: it.qty, unitPrice: it.unitPrice, amount: importLineAmount(it.qty, it.unitPrice) };
}

/**
 * Lập phiếu trả NCC, tính vào ngày lập: trừ tồn theo đơn vị gốc (movement supplier_return, được âm),
 * trừ nợ NCC hiện tại trước, phần dư NCC trả tiền mặt. Giá vốn giữ nguyên.
 */
export function createSupplierReturn(db: Db, input: SupplierReturnInput, clock?: Clock): SupplierReturnDetail {
  const { now, tz } = resolveClock(clock);
  return db.transaction((tx) => {
    const s = tx.select().from(suppliers).where(eq(suppliers.id, input.supplierId)).get();
    if (!s || !s.isActive) throw new BadRequestError('Nhà cung cấp không còn hoạt động');
    if (!input.items.length) throw new BadRequestError('Chưa chọn món nào để trả');
    const lines = input.items.map((it) => resolveLine(tx, it));
    const total = lines.reduce((sum, l) => sum + l.amount, 0);
    if (total > MAX_MONEY) throw new BadRequestError('Tổng tiền vượt giới hạn');
    const { debtReduced, cashReceived } = splitSupplierRefund(total, s.debt);
    const code = nextDailyCode(tx, 'supplier_returns', 'TN', localDate(now, tz), 4);
    const createdAt = now.toISOString();
    const { id } = tx
      .insert(supplierReturns)
      .values({ code, supplierId: s.id, supplierName: s.name, total, debtReduced, cashReceived, note: input.note, createdAt })
      .returning({ id: supplierReturns.id })
      .get();
    for (const l of lines) {
      tx.insert(supplierReturnItems).values({ returnId: id, ...l }).run();
      recordMovement(tx, { productId: l.productId, qty: -l.qty * l.factor, type: 'supplier_return', refId: id, note: `Trả NCC ${code}` });
    }
    if (debtReduced > 0) recordSupplierTx(tx, { supplierId: s.id, amount: -debtReduced, note: `Trả NCC ${code}`, createdAt });
    return getSupplierReturn(tx, id);
  });
}

/** Hủy: cộng lại tồn (movement adjust), cộng lại nợ đã trừ; phiếu giữ lại với trạng thái cancelled. */
export function cancelSupplierReturn(db: Db, id: number, clock?: Clock): SupplierReturnDetail {
  const { now } = resolveClock(clock);
  return db.transaction((tx) => {
    const r = getSupplierReturn(tx, id);
    if (r.status === 'cancelled') throw new ConflictError('Phiếu trả NCC đã hủy');
    // NCC đã xóa không hiện trong danh sách và không trả nợ được: cộng lại nợ cho họ sẽ thành khoản treo
    const active = tx.select({ v: suppliers.isActive }).from(suppliers).where(eq(suppliers.id, r.supplierId)).get()?.v;
    if (r.debtReduced > 0 && !active) throw new ConflictError('Nhà cung cấp đã xóa, không hủy được phiếu đã trừ nợ');
    for (const it of r.items) {
      recordMovement(tx, { productId: it.productId, qty: it.qty * it.factor, type: 'adjust', refId: id, note: `Hủy phiếu trả NCC ${r.code}` });
    }
    if (r.debtReduced > 0)
      recordSupplierTx(tx, { supplierId: r.supplierId, amount: r.debtReduced, note: `Hủy phiếu trả NCC ${r.code}`, createdAt: now.toISOString() });
    tx.update(supplierReturns).set({ status: 'cancelled', cancelledAt: now.toISOString() }).where(eq(supplierReturns.id, id)).run();
    return getSupplierReturn(tx, id);
  });
}

/** Điều kiện lọc dùng chung cho danh sách và file xuất; tìm theo mã phiếu và tên món (không dấu). */
function supplierReturnFilter(query: SupplierReturnListQuery, clock?: Clock) {
  const { now, tz } = resolveClock(clock);
  const { from, to } = resolveRange(query, localDate(now, tz));
  const start = localDayRange(from, tz).start;
  const end = localDayRange(to, tz).end;
  const inRange = and(gte(supplierReturns.createdAt, start), lt(supplierReturns.createdAt, end));
  const term = likeTerm(query.q);
  const where = and(
    inRange,
    query.status?.length ? inArray(supplierReturns.status, query.status) : undefined,
    query.supplierId ? eq(supplierReturns.supplierId, query.supplierId) : undefined,
    // Viết tên bảng cứng như itemCount: drizzle bỏ tiền tố bảng trong sql``
    term
      ? sql`(vn_fold(supplier_returns.code) like ${term} escape '\\' or exists (select 1 from supplier_return_items
          where supplier_return_items.return_id = supplier_returns.id and vn_fold(supplier_return_items.product_name) like ${term} escape '\\'))`
      : undefined,
  );
  return { from, to, inRange, where };
}

export function listSupplierReturns(db: Db, query: SupplierReturnListQuery, clock?: Clock): SupplierReturnList {
  const { inRange, where } = supplierReturnFilter(query, clock);
  const page = query.page ?? 1;
  const total = db.select({ n: count() }).from(supplierReturns).where(where).get()?.n ?? 0;
  const list = db
    .select({ row: supplierReturns, itemCount })
    .from(supplierReturns)
    .where(where)
    .orderBy(desc(supplierReturns.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
    .all()
    .map((r) => toSummary(r.row, Number(r.itemCount)));
  // Số liệu theo khoảng ngày, không theo lọc khác
  const done = db
    .select({ total: supplierReturns.total, debt: supplierReturns.debtReduced, cash: supplierReturns.cashReceived })
    .from(supplierReturns)
    .where(and(inRange, eq(supplierReturns.status, 'done')))
    .all();
  const sum = (k: 'total' | 'debt' | 'cash') => done.reduce((s, r) => s + r[k], 0);
  return { returns: list, summary: { count: done.length, total: sum('total'), debt: sum('debt'), cash: sum('cash') }, total, page, pageSize: PAGE_SIZE };
}

/** Mọi phiếu khớp bộ lọc (không phân trang), mới nhất trước, kèm dòng; quá `maxRows` thì báo lỗi. */
export function listSupplierReturnsForExport(
  db: Db,
  query: SupplierReturnListQuery,
  clock?: Clock,
  maxRows = MAX_EXPORT_ROWS,
): { from: string; to: string; returns: SupplierReturnDetail[] } {
  const { from, to, where } = supplierReturnFilter(query, clock);
  const n = db.select({ n: count() }).from(supplierReturns).where(where).get()?.n ?? 0;
  if (n > maxRows) throw new BadRequestError('Quá nhiều phiếu trả NCC, hãy chọn khoảng ngày ngắn hơn');
  const rows = db.select().from(supplierReturns).where(where).orderBy(desc(supplierReturns.id)).all();
  const items = itemsOf(db, rows.map((r) => r.id));
  return {
    from,
    to,
    returns: rows.map((r) => {
      const list = items.get(r.id) ?? [];
      return { ...toSummary(r, list.length), items: list };
    }),
  };
}
