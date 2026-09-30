import { and, asc, count, desc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import {
  baseCost,
  importLineAmount,
  localDate,
  localDayRange,
  MAX_EXPORT_ROWS,
  PAGE_SIZE,
  resolveRange,
  type ImportDetail,
  type ImportInput,
  type ImportItem,
  type ImportList,
  type ImportListQuery,
  type ImportSummary,
} from '@tiny-pos/shared';
import type { Db, DbOrTx } from '../db/connection.js';
import { importItems, imports, productUnits, products, suppliers } from '../db/schema.js';
import { BadRequestError, ConflictError, NotFoundError } from '../errors.js';
import { nextDailyCode, resolveClock, type Clock } from './daily-code.js';
import { recordMovement } from './stock.js';
import { recordSupplierTx } from './supplier-ledger.js';
import { likeTerm } from './orders.js';

interface ResolvedLine {
  productId: number;
  unitId: number | null;
  productName: string;
  unitName: string;
  factor: number;
  qty: number;
  unitCost: number;
  costPrice: number;
  amount: number;
  sellPrice: number | null;
}

/** Sản phẩm ngừng bán vẫn nhập được (nhập lại hàng cũ). */
function resolveLine(tx: DbOrTx, it: ImportInput['items'][number]): ResolvedLine {
  const p = tx.select().from(products).where(eq(products.id, it.productId)).get();
  if (!p) throw new BadRequestError(`Sản phẩm #${it.productId} không tồn tại`);
  let factor = 1;
  let unitName = p.unit;
  if (it.unitId !== null) {
    const u = tx
      .select()
      .from(productUnits)
      .where(and(eq(productUnits.id, it.unitId), eq(productUnits.productId, p.id)))
      .get();
    if (!u) throw new BadRequestError(`Đơn vị của "${p.name}" không hợp lệ`);
    factor = u.factor;
    unitName = u.name;
  }
  return {
    productId: p.id,
    unitId: it.unitId,
    productName: p.name,
    unitName,
    factor,
    qty: it.qty,
    unitCost: it.unitCost,
    costPrice: baseCost(it.unitCost, factor),
    amount: importLineAmount(it.qty, it.unitCost),
    sellPrice: it.sellPrice,
  };
}

/** Giá vốn theo dòng cuối của mỗi sản phẩm; giá bán áp vào đúng đơn vị của dòng (dòng cuối thắng). */
function applyPrices(tx: DbOrTx, lines: ResolvedLine[], updatedAt: string): void {
  const cost = new Map<number, number>();
  const baseSell = new Map<number, number>();
  const unitSell = new Map<number, number>();
  for (const l of lines) {
    cost.set(l.productId, l.costPrice);
    if (l.sellPrice === null) continue;
    if (l.unitId === null) baseSell.set(l.productId, l.sellPrice);
    else unitSell.set(l.unitId, l.sellPrice);
  }
  for (const [id, costPrice] of cost) {
    const sell = baseSell.get(id);
    tx.update(products)
      .set({ costPrice, updatedAt, ...(sell !== undefined ? { sellPrice: sell } : {}) })
      .where(eq(products.id, id))
      .run();
  }
  for (const [id, sellPrice] of unitSell) tx.update(productUnits).set({ sellPrice }).where(eq(productUnits.id, id)).run();
}

type ImportRow = typeof imports.$inferSelect;

function toSummary(r: ImportRow, itemCount: number): ImportSummary {
  return {
    id: r.id,
    code: r.code,
    supplierId: r.supplierId,
    supplierName: r.supplierName,
    total: r.total,
    paid: r.paid,
    note: r.note,
    status: r.status,
    itemCount,
    createdAt: r.createdAt,
    cancelledAt: r.cancelledAt,
  };
}

/** Cột của một món nhập, dùng chung cho getImport và file xuất. */
const importItemColumns = {
  id: importItems.id,
  productId: importItems.productId,
  productName: importItems.productName,
  unitName: importItems.unitName,
  factor: importItems.factor,
  qty: importItems.qty,
  unitCost: importItems.unitCost,
  costPrice: importItems.costPrice,
  amount: importItems.amount,
};

export function getImport(db: DbOrTx, id: number): ImportDetail {
  const r = db.select().from(imports).where(eq(imports.id, id)).get();
  if (!r) throw new NotFoundError('Không tìm thấy phiếu nhập');
  const items = db
    .select(importItemColumns)
    .from(importItems)
    .where(eq(importItems.importId, id))
    .orderBy(asc(importItems.id))
    .all();
  return { ...toSummary(r, items.length), items };
}

export function createImport(db: Db, input: ImportInput, clock?: Clock): ImportDetail {
  const { now, tz } = resolveClock(clock);
  return db.transaction((tx) => {
    const lines = input.items.map((it) => resolveLine(tx, it));
    const total = lines.reduce((s, l) => s + l.amount, 0);
    if (input.paid > total) throw new BadRequestError('Số đã trả lớn hơn tổng tiền');
    let supplierName: string | null = null;
    if (input.supplierId !== null) {
      const s = tx.select().from(suppliers).where(eq(suppliers.id, input.supplierId)).get();
      if (!s || !s.isActive) throw new BadRequestError('Nhà cung cấp không còn hoạt động');
      supplierName = s.name;
    } else if (input.paid !== total) throw new BadRequestError('Không ghi nhà cung cấp thì phải trả đủ');

    const code = nextDailyCode(tx, 'imports', 'PN', localDate(now, tz), 4);
    const createdAt = now.toISOString();
    const { id } = tx
      .insert(imports)
      .values({ code, supplierId: input.supplierId, supplierName, total, paid: input.paid, note: input.note, createdAt })
      .returning({ id: imports.id })
      .get();
    for (const l of lines) {
      tx.insert(importItems)
        .values({
          importId: id,
          productId: l.productId,
          productName: l.productName,
          unitName: l.unitName,
          factor: l.factor,
          qty: l.qty,
          unitCost: l.unitCost,
          costPrice: l.costPrice,
          amount: l.amount,
        })
        .run();
      recordMovement(tx, { productId: l.productId, qty: l.qty * l.factor, type: 'import', refId: id, note: `Nhập ${code}` });
    }
    applyPrices(tx, lines, createdAt);
    const debt = total - input.paid;
    if (input.supplierId !== null && debt > 0) {
      recordSupplierTx(tx, { supplierId: input.supplierId, amount: debt, importId: id, note: `Nhập ${code}`, createdAt });
    }
    return getImport(tx, id);
  });
}

// Viết tên bảng cứng: drizzle bỏ tiền tố bảng khi render cột trong subquery
const itemCount = sql<number>`(select count(*) from import_items where import_items.import_id = imports.id)`;

/** Điều kiện lọc phiếu nhập dùng chung cho danh sách (phân trang) và file xuất. */
function importFilter(query: ImportListQuery, clock?: Clock) {
  const { now, tz } = resolveClock(clock);
  const { from, to } = resolveRange(query, localDate(now, tz));
  const start = localDayRange(from, tz).start;
  const end = localDayRange(to, tz).end;
  const inRange = and(gte(imports.createdAt, start), lt(imports.createdAt, end));
  const term = likeTerm(query.q);
  const where = and(
    inRange,
    query.status?.length ? inArray(imports.status, query.status) : undefined,
    query.supplierId === 'none' ? isNull(imports.supplierId) : query.supplierId ? eq(imports.supplierId, query.supplierId) : undefined,
    query.unpaid ? sql`(imports.status = 'done' and imports.paid < imports.total)` : undefined,
    // Viết tên bảng cứng như itemCount: drizzle bỏ tiền tố bảng trong sql``
    term
      ? sql`(vn_fold(imports.code) like ${term} escape '\\' or exists (select 1 from import_items where import_items.import_id = imports.id and vn_fold(import_items.product_name) like ${term} escape '\\'))`
      : undefined,
  );
  return { from, to, inRange, where };
}

export function listImports(db: Db, query: ImportListQuery, clock?: Clock): ImportList {
  const { inRange, where } = importFilter(query, clock);
  const page = query.page ?? 1;
  const total = db.select({ n: count() }).from(imports).where(where).get()?.n ?? 0;
  const list = db
    .select({ row: imports, itemCount })
    .from(imports)
    .where(where)
    .orderBy(desc(imports.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)
    .all()
    .map((r) => toSummary(r.row, Number(r.itemCount)));
  // Số liệu theo khoảng ngày, không theo lọc khác
  const done = db
    .select({ total: imports.total, paid: imports.paid })
    .from(imports)
    .where(and(inRange, eq(imports.status, 'done')))
    .all();
  return {
    imports: list,
    summary: {
      count: done.length,
      total: done.reduce((s, i) => s + i.total, 0),
      paid: done.reduce((s, i) => s + i.paid, 0),
    },
    total,
    page,
    pageSize: PAGE_SIZE,
  };
}

/** Mọi phiếu nhập khớp bộ lọc (không phân trang), mới nhất trước, kèm món; quá `maxRows` thì báo lỗi. */
export function listImportsForExport(
  db: Db,
  query: ImportListQuery,
  clock?: Clock,
  maxRows = MAX_EXPORT_ROWS,
): { from: string; to: string; imports: ImportDetail[] } {
  const { from, to, where } = importFilter(query, clock);
  const n = db.select({ n: count() }).from(imports).where(where).get()?.n ?? 0;
  if (n > maxRows) throw new BadRequestError('Quá nhiều phiếu nhập, hãy chọn khoảng ngày ngắn hơn');
  const rows = db.select().from(imports).where(where).orderBy(desc(imports.id)).all();
  const itemsOf = new Map<number, ImportItem[]>();
  const ids = rows.map((r) => r.id);
  // Lấy món theo lô: SQLite giới hạn số tham số trong một câu lệnh
  for (let i = 0; i < ids.length; i += 500) {
    const batch = db
      .select({ importId: importItems.importId, ...importItemColumns })
      .from(importItems)
      .where(inArray(importItems.importId, ids.slice(i, i + 500)))
      .orderBy(asc(importItems.id))
      .all();
    for (const { importId, ...it } of batch) {
      const list = itemsOf.get(importId);
      if (list) list.push(it);
      else itemsOf.set(importId, [it]);
    }
  }
  return {
    from,
    to,
    imports: rows.map((r) => {
      const items = itemsOf.get(r.id) ?? [];
      return { ...toSummary(r, items.length), items };
    }),
  };
}

/** Hủy: trừ lại kho (movement adjust, được âm) và phần nợ đã ghi; giá vốn/giá bán giữ nguyên. */
export function cancelImport(db: Db, id: number, clock?: Clock): ImportDetail {
  const { now } = resolveClock(clock);
  return db.transaction((tx) => {
    const r = getImport(tx, id);
    if (r.status === 'cancelled') throw new ConflictError('Phiếu nhập đã hủy');
    for (const it of r.items) {
      recordMovement(tx, { productId: it.productId, qty: -it.qty * it.factor, type: 'adjust', refId: id, note: `Hủy ${r.code}` });
    }
    const debt = r.total - r.paid;
    if (r.supplierId !== null && debt > 0) {
      recordSupplierTx(tx, { supplierId: r.supplierId, amount: -debt, importId: id, note: `Hủy ${r.code}` });
    }
    tx.update(imports).set({ status: 'cancelled', cancelledAt: now.toISOString() }).where(eq(imports.id, id)).run();
    return getImport(tx, id);
  });
}
