import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/** Thời điểm ISO 8601 UTC, ví dụ 2026-09-29T08:15:30.123Z. */
const isoNow = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;
const createdAt = () => text('created_at').notNull().default(isoNow);

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const products = sqliteTable(
  'products',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    barcode: text('barcode'),
    name: text('name').notNull(),
    unit: text('unit').notNull().default('cái'),
    costPrice: integer('cost_price').notNull().default(0),
    sellPrice: integer('sell_price').notNull().default(0),
    stock: real('stock').notNull().default(0),
    isWeighed: integer('is_weighed', { mode: 'boolean' }).notNull().default(false),
    categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
    minStock: real('min_stock').notNull().default(0),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: createdAt(),
    updatedAt: text('updated_at').notNull().default(isoNow),
  },
  (t) => [
    uniqueIndex('products_barcode_uq').on(t.barcode),
    index('products_name_idx').on(t.name),
    index('products_category_idx').on(t.categoryId),
  ],
);

export const productUnits = sqliteTable(
  'product_units',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    name: text('name').notNull(), // thùng, lốc
    barcode: text('barcode'),
    factor: real('factor').notNull(), // 1 thùng = 24 đơn vị gốc
    sellPrice: integer('sell_price').notNull(),
  },
  (t) => [uniqueIndex('product_units_barcode_uq').on(t.barcode), index('product_units_product_idx').on(t.productId)],
);

export const customers = sqliteTable('customers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  phone: text('phone'),
  debt: integer('debt').notNull().default(0), // cache, tính từ debt_transactions
  note: text('note'),
});

export const orders = sqliteTable(
  'orders',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    code: text('code').notNull().unique(), // HD-20260929-0001
    total: integer('total').notNull(),
    discount: integer('discount').notNull().default(0),
    paid: integer('paid').notNull().default(0),
    paymentMethod: text('payment_method', { enum: ['cash', 'transfer', 'debt'] }).notNull(),
    customerId: integer('customer_id').references(() => customers.id),
    status: text('status', { enum: ['done', 'cancelled'] }).notNull().default('done'),
    createdAt: createdAt(),
  },
  (t) => [index('orders_created_idx').on(t.createdAt)],
);

export const debtTransactions = sqliteTable(
  'debt_transactions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    customerId: integer('customer_id')
      .notNull()
      .references(() => customers.id),
    orderId: integer('order_id').references(() => orders.id),
    amount: integer('amount').notNull(), // + nợ thêm, - trả nợ
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [index('debt_tx_customer_idx').on(t.customerId, t.createdAt)],
);

export const orderItems = sqliteTable(
  'order_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    productName: text('product_name').notNull(),
    unit: text('unit').notNull(),
    qty: real('qty').notNull(),
    price: integer('price').notNull(),
    costPrice: integer('cost_price').notNull(),
  },
  (t) => [index('order_items_order_idx').on(t.orderId)],
);

export const imports = sqliteTable('imports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  supplierName: text('supplier_name'),
  total: integer('total').notNull().default(0),
  note: text('note'),
  createdAt: createdAt(),
});

export const importItems = sqliteTable('import_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  importId: integer('import_id')
    .notNull()
    .references(() => imports.id, { onDelete: 'cascade' }),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  qty: real('qty').notNull(),
  costPrice: integer('cost_price').notNull(),
});

export const stockMovements = sqliteTable(
  'stock_movements',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    qty: real('qty').notNull(), // +/- theo đơn vị gốc
    type: text('type', { enum: ['sale', 'import', 'return', 'adjust'] }).notNull(),
    refId: integer('ref_id'), // order_id / import_id, null với adjust
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [index('stock_movements_product_idx').on(t.productId, t.createdAt)],
);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
