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
    /** Tên file ảnh trong data/images (p<id>-<ms>.jpg); null = chưa có. Chỉ đổi qua services/product-images.ts. */
    image: text('image'),
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
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
});

export const suppliers = sqliteTable('suppliers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  phone: text('phone'),
  note: text('note'),
  debt: integer('debt').notNull().default(0), // cache, tính từ supplier_transactions
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: createdAt(),
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
    cancelledAt: text('cancelled_at'),
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
    kind: text('kind', { enum: ['opening', 'order', 'order_cancel', 'payment', 'manual', 'return', 'return_cancel'] }).notNull().default('manual'),
    method: text('method', { enum: ['cash', 'transfer'] }), // chỉ dòng thu nợ
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
    productId: integer('product_id').references(() => products.id), // null = món ngoài
    productName: text('product_name').notNull(),
    unit: text('unit').notNull(),
    qty: real('qty').notNull(),
    price: integer('price').notNull(),
    costPrice: integer('cost_price').notNull(),
    factor: real('factor').notNull().default(1), // hệ số đơn vị lúc bán, dùng khi hủy đơn
    amount: integer('amount').notNull().default(0), // thành tiền dòng lúc bán
  },
  (t) => [index('order_items_order_idx').on(t.orderId)],
);

export const returns = sqliteTable(
  'returns',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    code: text('code').notNull().unique(), // TH-20261001-0001
    orderId: integer('order_id')
      .notNull()
      .references(() => orders.id),
    refund: integer('refund').notNull(), // tổng hoàn = Σ return_items.amount
    debtReduced: integer('debt_reduced').notNull().default(0), // phần trừ vào nợ khách
    cashRefund: integer('cash_refund').notNull().default(0), // phần trả tiền mặt
    note: text('note'),
    status: text('status', { enum: ['done', 'cancelled'] }).notNull().default('done'),
    createdAt: createdAt(),
    cancelledAt: text('cancelled_at'),
  },
  (t) => [index('returns_created_idx').on(t.createdAt), index('returns_order_idx').on(t.orderId)],
);

export const returnItems = sqliteTable(
  'return_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    returnId: integer('return_id')
      .notNull()
      .references(() => returns.id, { onDelete: 'cascade' }),
    orderItemId: integer('order_item_id')
      .notNull()
      .references(() => orderItems.id),
    qty: real('qty').notNull(), // theo đơn vị lúc bán
    restock: integer('restock', { mode: 'boolean' }).notNull().default(true),
    amount: integer('amount').notNull(), // tiền hoàn của dòng (đã trừ giảm giá phân bổ)
    cost: integer('cost').notNull(), // round(qty × cost_price lúc bán), không nhân factor như báo cáo
  },
  (t) => [index('return_items_return_idx').on(t.returnId), index('return_items_order_item_idx').on(t.orderItemId)],
);

export const imports = sqliteTable(
  'imports',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    code: text('code').notNull().unique(), // PN-20260929-0001
    supplierId: integer('supplier_id').references(() => suppliers.id),
    supplierName: text('supplier_name'), // snapshot tên NCC lúc nhập
    total: integer('total').notNull().default(0),
    paid: integer('paid').notNull().default(0),
    note: text('note'),
    status: text('status', { enum: ['done', 'cancelled'] }).notNull().default('done'),
    createdAt: createdAt(),
    cancelledAt: text('cancelled_at'),
  },
  (t) => [index('imports_created_idx').on(t.createdAt)],
);

export const importItems = sqliteTable('import_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  importId: integer('import_id')
    .notNull()
    .references(() => imports.id, { onDelete: 'cascade' }),
  productId: integer('product_id')
    .notNull()
    .references(() => products.id),
  productName: text('product_name').notNull().default(''),
  unitName: text('unit_name').notNull().default(''),
  factor: real('factor').notNull().default(1), // hệ số đơn vị đã chọn
  qty: real('qty').notNull(), // theo đơn vị đã chọn
  unitCost: integer('unit_cost').notNull().default(0), // giá nhập 1 đơn vị đã chọn
  costPrice: integer('cost_price').notNull(), // giá vốn 1 đơn vị gốc
  amount: integer('amount').notNull().default(0),
});

export const supplierReturns = sqliteTable(
  'supplier_returns',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    code: text('code').notNull().unique(), // TN-20261001-0001
    supplierId: integer('supplier_id')
      .notNull()
      .references(() => suppliers.id),
    supplierName: text('supplier_name').notNull(), // snapshot tên NCC lúc lập
    total: integer('total').notNull(), // Σ supplier_return_items.amount
    debtReduced: integer('debt_reduced').notNull().default(0), // phần trừ vào nợ NCC
    cashReceived: integer('cash_received').notNull().default(0), // phần NCC trả tiền mặt
    note: text('note'),
    status: text('status', { enum: ['done', 'cancelled'] }).notNull().default('done'),
    createdAt: createdAt(),
    cancelledAt: text('cancelled_at'),
  },
  (t) => [index('supplier_returns_created_idx').on(t.createdAt), index('supplier_returns_supplier_idx').on(t.supplierId)],
);

export const supplierReturnItems = sqliteTable(
  'supplier_return_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    returnId: integer('return_id')
      .notNull()
      .references(() => supplierReturns.id, { onDelete: 'cascade' }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    productName: text('product_name').notNull(),
    unitName: text('unit_name').notNull(),
    factor: real('factor').notNull().default(1), // hệ số đơn vị đã chọn
    qty: real('qty').notNull(), // theo đơn vị đã chọn
    unitPrice: integer('unit_price').notNull(), // giá trả 1 đơn vị đã chọn
    amount: integer('amount').notNull(),
  },
  (t) => [index('supplier_return_items_return_idx').on(t.returnId)],
);

export const supplierTransactions = sqliteTable(
  'supplier_transactions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    supplierId: integer('supplier_id')
      .notNull()
      .references(() => suppliers.id),
    importId: integer('import_id').references(() => imports.id),
    amount: integer('amount').notNull(), // + nợ thêm, - trả nợ / hủy phiếu
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [index('supplier_tx_supplier_idx').on(t.supplierId, t.createdAt)],
);

export const stockMovements = sqliteTable(
  'stock_movements',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    qty: real('qty').notNull(), // +/- theo đơn vị gốc
    type: text('type', { enum: ['sale', 'import', 'return', 'adjust', 'supplier_return'] }).notNull(),
    refId: integer('ref_id'), // order_id / import_id / stocktake_id (adjust do hủy phiếu nhập hoặc chốt kiểm kê)
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [index('stock_movements_product_idx').on(t.productId, t.createdAt)],
);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const stocktakes = sqliteTable('stocktakes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(), // KK-20260929-01
  status: text('status', { enum: ['open', 'done', 'cancelled'] }).notNull().default('open'),
  note: text('note'),
  createdAt: createdAt(),
  finishedAt: text('finished_at'),
});

export const stocktakeItems = sqliteTable(
  'stocktake_items',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    stocktakeId: integer('stocktake_id')
      .notNull()
      .references(() => stocktakes.id, { onDelete: 'cascade' }),
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
    counted: real('counted').notNull(), // theo đơn vị gốc
    expected: real('expected').notNull(), // tồn máy lúc đếm
    countedAt: text('counted_at').notNull(),
  },
  (t) => [uniqueIndex('stocktake_items_uq').on(t.stocktakeId, t.productId)],
);
