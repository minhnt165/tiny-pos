import { and, eq } from 'drizzle-orm';
import { importLineAmount } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { imports, productUnits, products, stockMovements, supplierTransactions, suppliers } from '../db/schema.js';
import { createCategory, listCategories } from '../services/categories.js';
import { cancelImport, createImport } from '../services/imports.js';
import { createUnit } from '../services/product-units.js';
import { createProduct } from '../services/products.js';
import { recordSupplierTx } from '../services/supplier-ledger.js';
import { createSupplier } from '../services/suppliers.js';
import {
  SEED_CATEGORIES,
  SEED_IMPORTS,
  SEED_PRODUCTS,
  SEED_SUPPLIERS,
  SEED_SUPPLIER_PAYMENTS,
  type SeedImport,
  type SeedSupplierPayment,
  ean13,
} from './seed-data.js';

export interface SeedResult {
  categoriesCreated: number;
  productsCreated: number;
  productsSkipped: number;
  unitsCreated: number;
  suppliersCreated: number;
  importsCreated: number;
  importsSkipped: number;
  paymentsCreated: number;
}

/**
 * Nạp dữ liệu mẫu. An toàn khi chạy nhiều lần: danh mục khớp theo tên,
 * sản phẩm bỏ qua nếu đã có cùng mã vạch (hoặc cùng tên với hàng không mã).
 */
export function seed(db: Db, now: Date = new Date()): SeedResult {
  const result: SeedResult = {
    categoriesCreated: 0,
    productsCreated: 0,
    productsSkipped: 0,
    unitsCreated: 0,
    suppliersCreated: 0,
    importsCreated: 0,
    importsSkipped: 0,
    paymentsCreated: 0,
  };

  const byName = new Map(listCategories(db).map((c) => [c.name.toLowerCase(), c.id]));
  SEED_CATEGORIES.forEach((name, i) => {
    if (byName.has(name.toLowerCase())) return;
    const c = createCategory(db, { name, sortOrder: i });
    byName.set(name.toLowerCase(), c.id);
    result.categoriesCreated++;
  });

  SEED_PRODUCTS.forEach((sp, i) => {
    const barcode = sp.noBarcode ? null : ean13(i + 1);
    const exists = barcode
      ? db.select({ id: products.id }).from(products).where(eq(products.barcode, barcode)).get()
      : db.select({ id: products.id }).from(products).where(eq(products.name, sp.name)).get();
    if (exists) {
      result.productsSkipped++;
      return;
    }
    const created = createProduct(db, {
      barcode,
      name: sp.name,
      unit: sp.unit,
      costPrice: sp.costPrice,
      sellPrice: sp.sellPrice,
      stock: sp.stock,
      isWeighed: sp.isWeighed ?? false,
      categoryId: byName.get(sp.category.toLowerCase()) ?? null,
      minStock: sp.minStock ?? 0,
    });
    result.productsCreated++;
    if (sp.inactive) db.update(products).set({ isActive: false }).where(eq(products.id, created.id)).run();
    for (const [j, u] of (sp.units ?? []).entries()) {
      createUnit(db, created.id, { name: u.name, barcode: barcode ? `${barcode}${j + 1}` : null, factor: u.factor, sellPrice: u.sellPrice });
      result.unitsCreated++;
    }
  });

  seedInventory(db, now, result);
  return result;
}

/** Giờ địa phương của `daysAgo` ngày trước, theo máy chạy seed. */
function at(now: Date, daysAgo: number, hour: number): Date {
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d;
}

type InventoryEvent = { kind: 'import'; data: SeedImport } | { kind: 'payment'; data: SeedSupplierPayment };

/**
 * NCC + phiếu nhập + trả nợ, đi qua service thật để tồn kho, giá vốn, công nợ khớp nhau.
 * Phiếu nhập/lần trả nhận ra theo ghi chú nên chạy lại không tạo trùng.
 */
function seedInventory(db: Db, now: Date, result: SeedResult): void {
  const supplierIds = new Map<string, number>();
  for (const s of SEED_SUPPLIERS) {
    const found = db
      .select({ id: suppliers.id })
      .from(suppliers)
      .where(and(eq(suppliers.name, s.name), eq(suppliers.isActive, true)))
      .get();
    supplierIds.set(s.name, found?.id ?? createSupplier(db, s).id);
    if (!found) result.suppliersCreated++;
  }
  const supplierId = (name: string) => {
    const id = supplierIds.get(name);
    if (id === undefined) throw new Error(`Seed: không có NCC "${name}"`);
    return id;
  };

  // Xếp theo thời gian để sổ nợ và giá vốn "lần nhập sau cùng" đúng thứ tự
  const events: InventoryEvent[] = [
    ...SEED_IMPORTS.map((data) => ({ kind: 'import' as const, data })),
    ...SEED_SUPPLIER_PAYMENTS.map((data) => ({ kind: 'payment' as const, data })),
  ];
  const time = (e: InventoryEvent) => at(now, e.data.daysAgo, e.data.hour).getTime();
  events.sort((a, b) => time(a) - time(b));

  for (const e of events) {
    if (e.kind === 'payment') {
      const p = e.data;
      const sid = supplierId(p.supplier);
      const exists = db
        .select({ id: supplierTransactions.id })
        .from(supplierTransactions)
        .where(and(eq(supplierTransactions.supplierId, sid), eq(supplierTransactions.note, p.note)))
        .get();
      if (exists) continue;
      recordSupplierTx(db, { supplierId: sid, amount: -p.amount, note: p.note, createdAt: at(now, p.daysAgo, p.hour).toISOString() });
      result.paymentsCreated++;
      continue;
    }

    const im = e.data;
    if (db.select({ id: imports.id }).from(imports).where(eq(imports.note, im.note)).get()) {
      result.importsSkipped++;
      continue;
    }
    const items = im.items.map((it) => {
      const p = db.select({ id: products.id }).from(products).where(eq(products.name, it.product)).get();
      if (!p) throw new Error(`Seed: không có sản phẩm "${it.product}"`);
      let unitId: number | null = null;
      if (it.unit) {
        const u = db
          .select({ id: productUnits.id })
          .from(productUnits)
          .where(and(eq(productUnits.productId, p.id), eq(productUnits.name, it.unit)))
          .get();
        if (!u) throw new Error(`Seed: "${it.product}" không có đơn vị "${it.unit}"`);
        unitId = u.id;
      }
      return { productId: p.id, unitId, qty: it.qty, unitCost: it.unitCost, sellPrice: null, expiresOn: null };
    });
    const total = items.reduce((s, it) => s + importLineAmount(it.qty, it.unitCost), 0);
    const createdAt = at(now, im.daysAgo, im.hour);
    const created = createImport(
      db,
      {
        supplierId: im.supplier === null ? null : supplierId(im.supplier),
        note: im.note,
        paid: im.paid === 'all' ? total : im.paid,
        items,
      },
      { now: createdAt },
    );
    // recordMovement ghi giờ hiện tại: lùi về đúng giờ nhập để lịch sử tồn hợp lý
    db.update(stockMovements)
      .set({ createdAt: createdAt.toISOString() })
      .where(and(eq(stockMovements.refId, created.id), eq(stockMovements.type, 'import')))
      .run();
    if (im.cancelled) {
      const cancelledAt = new Date(createdAt.getTime() + 2 * 3600_000);
      cancelImport(db, created.id, { now: cancelledAt });
      const cancelNote = `Hủy ${created.code}`;
      db.update(stockMovements)
        .set({ createdAt: cancelledAt.toISOString() })
        .where(and(eq(stockMovements.refId, created.id), eq(stockMovements.note, cancelNote)))
        .run();
      db.update(supplierTransactions)
        .set({ createdAt: cancelledAt.toISOString() })
        .where(and(eq(supplierTransactions.importId, created.id), eq(supplierTransactions.note, cancelNote)))
        .run();
    }
    result.importsCreated++;
  }
}
