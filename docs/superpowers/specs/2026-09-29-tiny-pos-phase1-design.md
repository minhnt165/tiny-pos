# Tiny POS – Thiết kế nền tảng và Giai đoạn 1 (Sản phẩm)

Ngày: 2026-09-29

## 1. Mục tiêu

Phần mềm quản lý tạp hóa cho cửa hàng nhỏ 1 quầy, chạy local trên máy Windows
(`localhost:3000`), điện thoại trong nhà truy cập qua IP LAN. Hoạt động khi mất
mạng, không phụ thuộc cloud. Người dùng không rành công nghệ: UI tiếng Việt, chữ
to, nút to.

Tài liệu này mô tả nền tảng dùng chung cho mọi giai đoạn (cấu trúc, schema, quy
ước) và chi tiết phạm vi Giai đoạn 1. Các giai đoạn sau có spec riêng.

## 2. Stack (cố định)

- Backend: Node.js 20+ (máy dev đang dùng 24), Express 5, TypeScript, better-sqlite3,
  Drizzle ORM + drizzle-kit, zod.
- DB: SQLite 1 file `data/grocery.db`, `journal_mode = WAL`.
- Frontend: React 18 + Vite + TypeScript + Tailwind v4, TanStack Query, react-router,
  vite-plugin-pwa.
- Mã vạch: jsbarcode. QR: qrcode. In: `window.print()` + CSS `@page`.
- Production: pm2. Dev: `npm run dev` (concurrently: tsc -w shared, tsx watch server, vite).
- Monorepo npm workspaces: `shared/`, `server/`, `client/`.

## 3. Cấu trúc thư mục

```
tiny-pos/
├── package.json              # workspaces, script dev/build/test/typecheck
├── tsconfig.base.json        # strict, ESM, NodeNext
├── ecosystem.config.cjs      # pm2
├── .gitignore                # node_modules, dist, data/
├── data/                     # grocery.db, backups/
├── shared/                   # @tiny-pos/shared (build ra dist/ bằng tsc)
│   └── src/
│       ├── index.ts
│       ├── money.ts          # formatMoney, round500
│       ├── csv.ts            # parseCsv / toCsv (không thư viện ngoài)
│       └── schemas/
│           ├── category.ts
│           ├── product.ts
│           ├── product-unit.ts
│           └── product-csv.ts
├── server/                   # @tiny-pos/server
│   ├── drizzle/              # migration SQL do drizzle-kit sinh
│   ├── drizzle.config.ts
│   ├── vitest.config.ts
│   └── src/
│       ├── index.ts          # khởi động Express, listen 0.0.0.0:3000
│       ├── app.ts            # tạo app (tách khỏi listen để test)
│       ├── db/
│       │   ├── schema.ts     # Drizzle schema toàn bộ 12 bảng
│       │   ├── connection.ts # mở file DB, WAL, chạy migrate()
│       │   └── test-db.ts    # DB :memory: đã migrate cho vitest
│       ├── services/         # nghiệp vụ, nhận db làm tham số
│       │   ├── categories.ts
│       │   ├── products.ts
│       │   ├── product-units.ts
│       │   └── product-csv.ts
│       ├── routes/
│       │   ├── index.ts      # mount /api/*
│       │   ├── categories.ts
│       │   └── products.ts   # gồm by-barcode, units, csv
│       └── middleware/
│           ├── validate.ts   # validate(schema) gắn body đã parse
│           └── error.ts      # { error } ; 400 zod, 404, 409 unique, 500
└── client/                   # @tiny-pos/client
    ├── vite.config.ts        # proxy /api → 3000, PWA, tailwind
    └── src/
        ├── main.tsx
        ├── router.tsx
        ├── App.tsx           # layout: menu trái + nội dung
        ├── api/
        │   ├── client.ts     # fetch wrapper, ném ApiError từ { error }
        │   ├── categories.ts # hooks TanStack Query
        │   └── products.ts
        ├── components/ui/    # Button, Input, Select, Dialog, NumberInput, Toast
        ├── hooks/useScanInput.ts
        └── pages/
            ├── products/     # ProductListPage, ProductFormDialog, ProductUnitsEditor, CsvDialog
            ├── categories/   # CategoriesPage
            └── quick-add/    # QuickAddPage
```

## 4. Quy tắc dữ liệu

- Tiền: `integer` (đồng). Số lượng, tồn, hệ số quy đổi: `real`.
- `products.stock` và `customers.debt` là cột cache. Mọi thay đổi tồn phải đi kèm
  1 dòng `stock_movements` trong cùng transaction; mọi thay đổi nợ đi kèm 1 dòng
  `debt_transactions`.
- `order_items` lưu snapshot `product_name`, `unit`, `price`, `cost_price`.
- Sản phẩm xóa mềm (`is_active = false`).
- Thời gian lưu `text` ISO 8601 (UTC), default `CURRENT_TIMESTAMP`; client hiển thị
  giờ địa phương.

## 5. Schema Drizzle (`server/src/db/schema.ts`)

```ts
import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

const now = () => text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`);

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const products = sqliteTable('products', {
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
  createdAt: now(),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [
  uniqueIndex('products_barcode_uq').on(t.barcode),
  index('products_name_idx').on(t.name),
  index('products_category_idx').on(t.categoryId),
]);

export const productUnits = sqliteTable('product_units', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),          // thùng, lốc
  barcode: text('barcode'),
  factor: real('factor').notNull(),      // 1 thùng = 24 đơn vị gốc
  sellPrice: integer('sell_price').notNull(),
}, (t) => [
  uniqueIndex('product_units_barcode_uq').on(t.barcode),
  index('product_units_product_idx').on(t.productId),
]);

export const customers = sqliteTable('customers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  phone: text('phone'),
  debt: integer('debt').notNull().default(0),
  note: text('note'),
});

export const orders = sqliteTable('orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').notNull().unique(),   // HD-20260929-0001
  total: integer('total').notNull(),
  discount: integer('discount').notNull().default(0),
  paid: integer('paid').notNull().default(0),
  paymentMethod: text('payment_method', { enum: ['cash', 'transfer', 'debt'] }).notNull(),
  customerId: integer('customer_id').references(() => customers.id),
  status: text('status', { enum: ['done', 'cancelled'] }).notNull().default('done'),
  createdAt: now(),
}, (t) => [index('orders_created_idx').on(t.createdAt)]);

export const debtTransactions = sqliteTable('debt_transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  customerId: integer('customer_id').notNull().references(() => customers.id),
  orderId: integer('order_id').references(() => orders.id),
  amount: integer('amount').notNull(),   // + nợ thêm, - trả nợ
  note: text('note'),
  createdAt: now(),
}, (t) => [index('debt_tx_customer_idx').on(t.customerId, t.createdAt)]);

export const orderItems = sqliteTable('order_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orderId: integer('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: integer('product_id').notNull().references(() => products.id),
  productName: text('product_name').notNull(),
  unit: text('unit').notNull(),
  qty: real('qty').notNull(),
  price: integer('price').notNull(),
  costPrice: integer('cost_price').notNull(),
}, (t) => [index('order_items_order_idx').on(t.orderId)]);

export const imports = sqliteTable('imports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  supplierName: text('supplier_name'),
  total: integer('total').notNull().default(0),
  note: text('note'),
  createdAt: now(),
});

export const importItems = sqliteTable('import_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  importId: integer('import_id').notNull().references(() => imports.id, { onDelete: 'cascade' }),
  productId: integer('product_id').notNull().references(() => products.id),
  qty: real('qty').notNull(),
  costPrice: integer('cost_price').notNull(),
});

export const stockMovements = sqliteTable('stock_movements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').notNull().references(() => products.id),
  qty: real('qty').notNull(),            // +/- theo đơn vị gốc
  type: text('type', { enum: ['sale', 'import', 'return', 'adjust'] }).notNull(),
  refId: integer('ref_id'),              // order_id / import_id, null với adjust
  note: text('note'),
  createdAt: now(),
}, (t) => [index('stock_movements_product_idx').on(t.productId, t.createdAt)]);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
```

Migration đầu tiên tạo đủ 12 bảng.

## 6. Quy ước API

- Prefix `/api`, JSON. Lỗi: `{ error: string }`. Zod lỗi → 400 với thông điệp
  tiếng Việt ghép từ `issues`. Không tìm thấy → 404. Trùng unique (barcode) → 409.
- Body được validate bằng schema trong `shared/` qua middleware `validate(schema)`.
- Tên trường JSON dùng camelCase (theo Drizzle), DB dùng snake_case.

### Giai đoạn 1

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/api/categories` | sắp theo `sortOrder`, kèm số sản phẩm |
| POST | `/api/categories` | `{ name, sortOrder? }` |
| PUT | `/api/categories/:id` | |
| DELETE | `/api/categories/:id` | sản phẩm thuộc danh mục → `categoryId = null` |
| GET | `/api/products` | query `q` (tên hoặc barcode, LIKE), `categoryId`, `includeInactive` |
| GET | `/api/products/:id` | kèm `units[]` |
| GET | `/api/products/by-barcode/:code` | tìm `products.barcode` rồi `product_units.barcode`; trả `{ product, unit: ProductUnit \| null }`; 404 nếu không có |
| POST | `/api/products` | `stock` ban đầu > 0 → movement `adjust`, ghi chú "Tồn đầu" |
| PUT | `/api/products/:id` | `stock` khác hiện tại → movement `adjust` chênh lệch, ghi chú "Sửa thủ công"; cập nhật `updatedAt` |
| DELETE | `/api/products/:id` | xóa mềm |
| POST | `/api/products/:id/restore` | bật lại `isActive` |
| POST | `/api/products/:id/units` | `{ name, barcode?, factor, sellPrice }` |
| PUT | `/api/products/:id/units/:unitId` | |
| DELETE | `/api/products/:id/units/:unitId` | xóa cứng (không có lịch sử) |
| GET | `/api/products/csv` | tải file `san-pham-YYYY-MM-DD.csv`, UTF-8 BOM |
| POST | `/api/products/csv` | body `text/csv` (raw); trả `{ created, updated, errors: { line, message }[] }` |

Thứ tự route: `/csv` và `/by-barcode/:code` khai báo trước `/:id`.

### Zod (shared)

- `categoryInput`: `name` 1–100 ký tự (trim), `sortOrder` int ≥ 0 mặc định 0.
- `productInput`: `barcode` trim, rỗng → `null`; `name` 1–200; `unit` 1–20 mặc định
  `cái`; `costPrice`, `sellPrice` int ≥ 0; `stock` số ≥ 0 mặc định 0; `isWeighed`
  bool; `categoryId` int hoặc null; `minStock` số ≥ 0.
- `productUnitInput`: `name` 1–20; `barcode` như trên; `factor` số > 0;
  `sellPrice` int ≥ 0.

## 7. CSV sản phẩm

Cột (đúng thứ tự, tiêu đề tiếng Việt):

```
Mã vạch,Tên,Đơn vị,Giá nhập,Giá bán,Tồn,Hàng cân,Danh mục,Tồn tối thiểu
```

- Xuất: dấu phẩy, ngoặc kép khi cần, UTF-8 có BOM để Excel mở đúng dấu. `Hàng cân`
  ghi `1`/`0`. Chỉ xuất sản phẩm đang bán.
- Nhập: đọc tiêu đề, khớp theo tên cột (bỏ qua thứ tự, chấp nhận thiếu cột không
  bắt buộc). Bắt buộc: `Tên`. Mỗi dòng:
  - Có `Mã vạch` và trùng sản phẩm hiện có → cập nhật tên, đơn vị, giá, hàng cân,
    danh mục, tồn tối thiểu. **Bỏ qua cột Tồn** để không phá lịch sử kho.
  - Không trùng → tạo mới; `Tồn` > 0 → movement `adjust` ghi chú "Nhập CSV".
  - `Danh mục` khớp theo tên (không phân biệt hoa thường); chưa có thì tạo.
  - Dòng lỗi (tên trống, số không hợp lệ) ghi vào `errors` với số dòng, các dòng
    khác vẫn được xử lý. Toàn bộ chạy trong 1 transaction; lỗi hệ thống → rollback.
- Parser/serializer tự viết trong `shared/src/csv.ts` (xử lý ngoặc kép, dấu phẩy
  trong ô, xuống dòng CRLF/LF).

## 8. Giao diện Giai đoạn 1

Layout: menu trái (Bán hàng – tạm khóa, Sản phẩm, Danh mục, Nhập nhanh, Cài đặt –
tạm khóa), nội dung bên phải. Cỡ chữ cơ bản 18px, nút cao ≥ 44px. Trên điện thoại
menu thu thành thanh dưới.

- **Sản phẩm** (`/products`): ô tìm (tên/mã), lọc danh mục, checkbox "Hiện hàng
  ngừng bán", nút Thêm, nút Nhập CSV, Xuất CSV. Bảng: mã vạch, tên, đơn vị, giá
  bán, tồn (đỏ nếu < tồn tối thiểu), danh mục, thao tác Sửa / Ngừng bán / Bán lại.
- **Form sản phẩm** (dialog): các trường theo schema; ô mã vạch nhận từ máy quét;
  phần "Đơn vị quy đổi" liệt kê units với thêm/sửa/xóa inline (chỉ hiện khi sửa
  sản phẩm đã có id; khi tạo mới thì lưu xong mới thêm được). Enter trong ô cuối →
  lưu. Esc → đóng.
- **Danh mục** (`/categories`): danh sách kèm số sản phẩm, thêm/sửa tên/xóa, nút
  lên/xuống để đổi `sortOrder`.
- **Nhập nhanh** (`/quick-add`): ô quét lớn luôn focus (hook `useScanInput`: focus
  lại khi click ra ngoài, khi dialog đóng, sau khi lưu). Enter → gọi
  `by-barcode`. Có → hiện thẻ thông tin (tên, giá, tồn, nếu là đơn vị quy đổi thì
  ghi rõ) với nút Sửa. Không có → mở form tạo mới với barcode điền sẵn, focus vào
  Tên; lưu xong → toast "Đã thêm …", đóng form, focus lại ô quét. Danh sách 10 mã
  vừa quét bên dưới.
- **CSV dialog**: chọn file → gửi → hiện kết quả tạo/cập nhật và bảng lỗi theo dòng.

## 9. Xử lý lỗi

- Server: middleware cuối cùng bắt mọi lỗi; `ZodError` → 400; `NotFoundError` →
  404; SQLite `SQLITE_CONSTRAINT_UNIQUE` → 409 "Mã vạch đã tồn tại"; còn lại → 500
  và log ra console.
- Client: `apiFetch` ném `ApiError(message, status)`; mutation lỗi → toast đỏ với
  message từ server; form giữ nguyên dữ liệu.

## 10. Kiểm thử

- `shared`: vitest cho `formatMoney`, `round500`, `parseCsv`/`toCsv` (ngoặc kép,
  dấu phẩy, CRLF).
- `server`: vitest với DB `:memory:` chạy migration thật:
  - tạo sản phẩm với tồn đầu → có movement `adjust` đúng qty;
  - sửa tồn → movement chênh lệch, không đổi tồn → không có movement;
  - by-barcode tìm được qua barcode của unit;
  - import CSV: tạo mới, cập nhật không đổi tồn, dòng lỗi báo đúng số dòng;
  - trùng barcode → 409.
- `npm run typecheck` chạy `tsc --noEmit` cho cả 3 workspace.

## 11. Ngoài phạm vi Giai đoạn 1

Bán hàng, in hóa đơn, nhập hàng, kiểm kê, công nợ, báo cáo, backup, script cài
đặt, seed. Schema đã có sẵn bảng cho các phần này nhưng chưa có API/UI.
