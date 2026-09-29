# Tiny POS – Giai đoạn 3 (Nhập hàng, nhà cung cấp, kiểm kê)

Ngày: 2026-09-29

Nền tảng giữ nguyên như `2026-09-29-tiny-pos-phase1-design.md`; màn Bán hàng, hóa
đơn, ngày địa phương, tiện ích dùng chung như `2026-09-29-tiny-pos-phase2-sales-design.md`.
Tài liệu này chỉ mô tả phần thêm mới.

## 1. Mục tiêu

Khép vòng kho: hàng vào (phiếu nhập từ nhà cung cấp, theo đơn vị gốc hoặc
thùng/lốc, cập nhật giá vốn và giá bán), nợ nhà cung cấp, đếm thực tế (phiên kiểm
kê) và xem lịch sử tồn của từng sản phẩm. Từ giai đoạn 2 tồn có thể âm; giai đoạn
này cho người bán công cụ đưa số kho về đúng.

Tiêu chí thành công:

- Nhập một phiếu 10 dòng chỉ bằng máy quét + bàn phím; quét mã thùng tự chọn đơn vị
  thùng; mã lạ tạo sản phẩm ngay trong luồng nhập.
- Mọi thay đổi tồn đi qua `stock_movements`, mọi thay đổi nợ nhà cung cấp đi qua
  `supplier_transactions`, trong cùng transaction với nghiệp vụ.
- Kiểm kê trong giờ bán vẫn cho số đúng: bán sau lúc đếm không bị "mất".
- Kiểm kê dùng được trên điện thoại (quét bằng máy quét Bluetooth hoặc gõ mã).

## 2. Phạm vi

Trong phạm vi: phiếu nhập (tạo, xem theo ngày, hủy), nhà cung cấp (CRUD mềm, sổ nợ,
trả nợ), phiên kiểm kê (mở, đếm, chốt, hủy, lịch sử), lịch sử tồn sản phẩm, menu
mới (điện thoại có nút *Thêm*).

Ngoài phạm vi: công nợ khách hàng, báo cáo, backup, trả hàng cho nhà cung cấp, đơn
đặt hàng, in phiếu nhập, nhập phiếu từ file CSV, sửa phiếu nhập đã lưu.

## 3. Quyết định đã chốt

| Vấn đề | Chọn | Lý do |
|---|---|---|
| Giá vốn khi nhập | Giá nhập lần gần nhất (quy về đơn vị gốc) | Dễ hiểu; lãi theo đơn đã dùng snapshot giá vốn lúc bán |
| Sửa phiếu nhập | Không sửa; chỉ **hủy** rồi nhập lại | Lịch sử kho và nợ luôn khớp |
| Hủy phiếu | Trừ lại kho (movement `adjust`) và nợ; **giữ nguyên** giá vốn/giá bán | Không đoán được giá "trước đó" nếu có phiếu khác xen giữa |
| Kiểm kê | Phiên: đếm dần, chốt mới ghi kho | Làm được nhiều lượt, nhiều máy; có bảng chênh lệch |
| Kho đổi trong lúc kiểm | Lưu `expected` = tồn máy **lúc đếm**; chốt ghi `counted − expected` | Bán sau lúc đếm vẫn được trừ |
| Món không đếm | Bỏ qua (kiểm kê từng phần) | Quên một món không làm tồn về 0 |
| Nợ nhà cung cấp | Bảng `suppliers` + `supplier_transactions`, giống cặp khách hàng/nợ | Một quy tắc cache + sổ cho cả hai phía |
| Sản phẩm ngừng bán | Vẫn nhập được (UI cảnh báo) | Nhập lại hàng cũ |

## 4. Dữ liệu

### Migration `0002` (sinh bằng `npm run db:generate`, đọc lại SQL trước khi commit)

Bảng `imports` (đã có `id`, `supplier_name`, `total`, `note`, `created_at`) thêm:

- `code text not null` unique – `PN-YYYYMMDD-NNNN` theo ngày địa phương (cùng cách
  sinh với hóa đơn: số lớn nhất trong ngày + 1, trong transaction);
- `supplier_id integer` references `suppliers.id`, nullable (không ghi NCC);
- `paid integer not null default 0`;
- `status text not null default 'done'` enum `done | cancelled`;
- `cancelled_at text` nullable.

`supplier_name` giữ làm snapshot tên NCC lúc nhập. Bảng hiện chưa có dữ liệu thật;
migration phải chạy được trên DB giai đoạn 2 (dòng cũ nếu có nhận `code` duy nhất –
xem mục 9).

Bảng `import_items` (đã có `id`, `import_id`, `product_id`, `qty`, `cost_price`)
thêm snapshot:

- `product_name text not null default ''`, `unit_name text not null default ''`;
- `factor real not null default 1` – hệ số đơn vị đã chọn;
- `unit_cost integer not null default 0` – giá nhập 1 đơn vị đã chọn;
- `amount integer not null default 0` – `round(qty × unit_cost)`.

Nghĩa cột cũ: `qty` = số lượng theo đơn vị đã chọn; `cost_price` = giá vốn 1 đơn vị
gốc = `round(unit_cost / factor)`.

Bảng mới:

```ts
suppliers: id, name text not null, phone text, note text,
  debt integer not null default 0,        // cache, tính từ supplier_transactions
  isActive integer(boolean) not null default true, createdAt
supplier_transactions: id, supplierId → suppliers (not null),
  importId → imports (nullable), amount integer not null, // + nợ thêm, − trả/hủy
  note text, createdAt ; index (supplierId, createdAt)
stocktakes: id, code text not null unique,   // KK-YYYYMMDD-NN
  status enum open|done|cancelled default open, note text,
  createdAt, finishedAt text nullable
stocktake_items: id, stocktakeId → stocktakes (cascade), productId → products,
  counted real not null, expected real not null, countedAt text not null
  ; unique (stocktakeId, productId)
```

### Quy tắc

- Mọi thay đổi `suppliers.debt` = 1 dòng `supplier_transactions` trong cùng
  transaction (hàm duy nhất `recordSupplierTx`, giống `recordMovement`).
- Tối đa **một** phiên kiểm kê `open` (kiểm trong service; mở phiên thứ hai → 409).
- `counted`, `expected` theo đơn vị gốc; số lẻ được (hàng cân).

## 5. Nghiệp vụ (server)

### Lưu phiếu nhập – `createImport(db, input, clock?)`, một transaction

1. Với mỗi dòng: đọc sản phẩm (không có → 400; ngừng bán vẫn cho). `unitId` có thì
   phải thuộc sản phẩm (không → 400) → `factor`, `unit_name`; không thì `factor = 1`,
   `unit_name = product.unit`.
2. `amount = round(qty × unitCost)`, `cost_price = round(unitCost / factor)`.
3. `total = Σ amount`. `supplierId` có: NCC phải tồn tại và đang hoạt động (không →
   400 "Nhà cung cấp không còn hoạt động"); không có: `paid` phải bằng `total`
   (khác → 400 "Không ghi nhà cung cấp thì phải trả đủ"). `paid > total` → 400.
4. Insert `imports` (`code`, `supplier_id`, `supplier_name` snapshot, `total`, `paid`,
   `note`, `created_at` = giờ hiện tại ISO) và `import_items`.
5. Mỗi dòng: `recordMovement(tx, { type: 'import', qty: +qty × factor, refId: importId,
   note: 'Nhập PN-…' })`.
6. Giá: với mỗi sản phẩm lấy **dòng cuối** trong phiếu → `products.costPrice =
   cost_price`, `updatedAt`. Dòng có `sellPrice`: đơn vị gốc → `products.sellPrice`;
   thùng/lốc → `product_units.sellPrice` của đơn vị đó (dòng cuối thắng nếu trùng).
7. `supplierId` có và `total − paid > 0` → `recordSupplierTx(+ (total − paid),
   importId, 'Nhập PN-…')`.

### Hủy phiếu – `cancelImport(db, id, clock?)`

`status = 'done'` mới hủy được (không → 409 "Phiếu nhập đã hủy"). Mỗi dòng:
`recordMovement({ type: 'adjust', qty: −qty × factor, refId: importId, note:
'Hủy PN-…' })` (được âm). Nợ đã ghi (`total − paid` > 0) → `recordSupplierTx(−(total −
paid), importId, 'Hủy PN-…')`. Giá vốn/giá bán giữ nguyên. Đặt `cancelled`,
`cancelled_at`.

### Nhà cung cấp

- `createSupplier`, `updateSupplier` (tên 1–100, SĐT ≤ 20, ghi chú ≤ 200),
  `deleteSupplier` (xóa mềm; `debt ≠ 0` → 409 "Còn nợ, không xóa được").
- `paySupplier(id, { amount, note })`: `amount` nguyên > 0, `≤ debt` (vượt → 400 "Trả
  nhiều hơn số đang nợ") → `recordSupplierTx(−amount, null, note || 'Trả nợ')`.
- `listSupplierTransactions(id)`: mới nhất trước, kèm `importCode` nếu có và số dư
  sau từng giao dịch (tính trong service).

### Kiểm kê

- `openStocktake(note?)`: đã có phiên `open` → 409 "Đang có phiên kiểm kê chưa chốt".
  Mã `KK-YYYYMMDD-NN`.
- `countItem(stocktakeId, productId, counted)`: phiên phải `open` (không → 409 "Phiên
  kiểm kê đã đóng"); sản phẩm phải tồn tại. Upsert dòng với `expected =
  products.stock` hiện tại, `counted_at = now`.
- `removeItem(stocktakeId, productId)`: phiên phải `open`.
- `finishStocktake(id)`: phiên phải `open`. Mỗi dòng có `|counted − expected| > 1e-9`
  → `recordMovement({ type: 'adjust', qty: counted − expected, refId: stocktakeId,
  note: 'Kiểm kê KK-…' })`. Đặt `done`, `finished_at`. Trả tóm tắt.
- `cancelStocktake(id)`: phiên phải `open`; không ghi kho.
- `getStocktake(id)` / `getCurrentStocktake()`: kèm dòng (tên, đơn vị, giá vốn hiện
  tại, `counted`, `expected`, `diff`) và tóm tắt `{ itemCount, diffCount,
  diffValue = Σ diff × costPrice }`.

### Lịch sử tồn – `listMovements(productId, limit = 100)`

Mới nhất trước. Mỗi dòng `{ id, type, qty, note, createdAt, refCode }`: `refCode`
lấy theo `type`/`note`: `sale`/`return` → `orders.code`; `import` → `imports.code`;
`adjust` có ghi chú bắt đầu "Hủy PN-" → `imports.code`, "Kiểm kê KK-" →
`stocktakes.code`; còn lại `null`.

## 6. API

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/api/suppliers?q=` | đang hoạt động, sắp theo tên, kèm `debt` |
| POST | `/api/suppliers` | 201 |
| PUT | `/api/suppliers/:id` | |
| DELETE | `/api/suppliers/:id` | xóa mềm; còn nợ → 409 |
| GET | `/api/suppliers/:id/transactions` | sổ nợ |
| POST | `/api/suppliers/:id/payments` | `{ amount, note? }` |
| POST | `/api/imports` | `{ supplierId?, note?, paid, items: [{ productId, unitId?, qty, unitCost, sellPrice? }] }` → 201 chi tiết |
| GET | `/api/imports?date=YYYY-MM-DD` | mặc định hôm nay; `{ imports, summary: { count, total, paid } }` (bỏ phiếu hủy khỏi summary) |
| GET | `/api/imports/:id` | chi tiết kèm dòng |
| POST | `/api/imports/:id/cancel` | |
| GET | `/api/stocktakes/current` | phiên `open` hoặc `null` |
| GET | `/api/stocktakes?limit=20` | phiên đã chốt/hủy, mới nhất trước |
| GET | `/api/stocktakes/:id` | |
| POST | `/api/stocktakes` | `{ note? }` → 201 |
| PUT | `/api/stocktakes/:id/items/:productId` | `{ counted }` |
| DELETE | `/api/stocktakes/:id/items/:productId` | |
| POST | `/api/stocktakes/:id/finish` | |
| POST | `/api/stocktakes/:id/cancel` | |
| GET | `/api/products/:id/movements?limit=100` | lịch sử tồn |

Zod (shared, `schemas/import.ts`, `schemas/supplier.ts`, `schemas/stocktake.ts`):
`qty` > 0 ≤ 100.000; `unitCost`, `sellPrice`, `paid`, `amount` nguyên 0–1 tỷ;
`counted` ≥ 0 ≤ 1.000.000; `items` ≥ 1 dòng; `date` như `orderListQuerySchema`.
Nhãn tiếng Việt thêm vào `FIELD_LABELS` (`unitCost: 'Giá nhập'`, `counted: 'Số
đếm'`, `supplierId: 'Nhà cung cấp'`, `amount: 'Số tiền'`, `phone: 'Số điện thoại'`,
`note: 'Ghi chú'`).

Hàm thuần dùng chung (`shared/src/inventory-math.ts`): `baseCost(unitCost, factor)`,
`marginPercent(sellPrice, unitCost)` (làm tròn 1 số lẻ; `unitCost = 0` → `null`).

## 7. Giao diện

### Menu

Thứ tự: Bán hàng, Hóa đơn, Nhập hàng (`/imports`), Kiểm kê (`/stocktake`), Sản
phẩm, Danh mục, Nhà cung cấp (`/suppliers`), Nhập nhanh, Cài đặt. Sidebar hiện đủ.
Điện thoại: thanh dưới 4 mục cố định (Bán hàng, Hóa đơn, Kiểm kê, Sản phẩm) + nút
**Thêm** (DropdownMenu hướng lên) chứa các mục còn lại; nhãn một dòng, nút ≥ 44px.
`NavItem` thêm cờ `mobile?: boolean` để chọn 4 mục thanh dưới.

### Nhập hàng

- `ProductSearch` chuyển từ `client/src/pages/sell/` sang `client/src/components/`
  (`git mv`, sửa import ở `SellPage`), dùng chung cho Bán hàng / Nhập hàng / Kiểm kê.
- `/imports` (`ImportsPage`): `DayPicker` (chuyển sang `components/` cùng lý do),
  thẻ tổng (số phiếu, tổng nhập, đã trả), bảng phiếu (mã, giờ, NCC, số dòng, tổng,
  trạng thái), nút **Tạo phiếu nhập** → `/imports/new`; bấm dòng → dialog chi tiết
  với *Hủy phiếu* (`ConfirmDialog` "Hủy PN-… và trừ lại kho?").
- `/imports/new` (`ImportFormPage`):
  - Chọn NCC: ô chọn có tìm (shadcn `Popover` + `Command`, thêm bằng
    `npx shadcn@latest add popover command` với `NODE_EXTRA_CA_CERTS=.certs/corp-root.pem`),
    mục "Không ghi nhà cung cấp" và "+ Thêm nhà cung cấp" (dialog tên + SĐT).
  - Ô quét/tìm (`ProductSearch`); `by-barcode` trả `unit` → dòng chọn sẵn đơn vị đó;
    404 → `ProductFormDialog` với mã điền sẵn, lưu xong thêm dòng.
  - Dòng: tên (+ nhãn "Ngừng bán" nếu có), ô chọn đơn vị (gốc + đơn vị quy đổi, đổi
    đơn vị thì giá nhập/giá bán điền lại theo đơn vị mới), số lượng, giá nhập/đơn vị
    (mặc định `costPrice × factor`), thành tiền, giá bán đơn vị đó (mặc định giá hiện
    tại) + chữ nhỏ "lãi x%" (âm → đỏ), xóa dòng. Cùng sản phẩm + cùng đơn vị quét lại
    → cộng số lượng. Chỉ gửi `sellPrice` khi khác giá hiện tại.
  - Chân trang: tổng tiền, "Đã trả" (mặc định = tổng; không NCC → khóa = tổng),
    "Ghi nợ: X", nút **Lưu phiếu (F9)**; lưu xong toast + về `/imports`.
  - Nháp lưu `localStorage` `tiny-pos.import-draft` (đọc/ghi bọc try/catch, hỏng →
    phiếu trống); lưu thành công thì xóa. Rời trang khi có dòng → vẫn giữ nháp.
  - Logic phiếu thuần (reducer thêm/gộp/sửa/xóa dòng, tổng, parse nháp) đặt ở
    `shared/src/import-draft.ts` để test bằng vitest.

### Nhà cung cấp (`/suppliers`)

Bảng tên, SĐT, nợ (đỏ nếu > 0), nút **Thêm**. Bấm dòng → dialog: sửa thông tin, sổ
nợ (ngày, nội dung + mã phiếu, ±, số dư), nút **Trả nợ** (dialog số tiền, mặc định
= nợ), *Xóa* (ẩn khi còn nợ).

### Kiểm kê (`/stocktake`)

- Không có phiên mở: nút lớn **Bắt đầu kiểm kê** (+ ô ghi chú tùy chọn) và lịch sử
  phiên (mã, ngày, số món, số món lệch, giá trị lệch; bấm → dialog chi tiết chỉ đọc).
- Có phiên mở: tiêu đề mã phiên; ô quét/tìm luôn focus; chọn món → dialog **Đếm**
  (tên, đơn vị, tồn máy hiện tại, ô "Số đếm được" – điền sẵn nếu đã đếm – Enter lưu,
  quay về ô quét); danh sách đã đếm (tên, tồn máy lúc đếm, số đếm, chênh lệch + xanh
  / − đỏ, nút sửa/bỏ) với công tắc "Chỉ món lệch"; nút **Chốt kiểm kê**
  (`ConfirmDialog` tóm tắt số món, số món lệch, giá trị lệch) và *Hủy phiên*.
- Mọi thao tác đếm gọi API ngay (nhiều máy cùng đếm một phiên được; đếm cùng món
  trên hai máy thì lần sau ghi đè).

### Lịch sử tồn

`ProductMenu` (trong `ProductTable.tsx`, dùng cả ở `ProductCardList`) thêm mục
*Lịch sử tồn* → `StockHistoryDialog`: bảng thời gian, loại (Bán / Trả / Nhập / Điều
chỉnh), `±` số lượng (đơn vị gốc), mã tham chiếu, ghi chú.

## 8. Xử lý lỗi

Theo quy ước giai đoạn 1–2 (`{ error }`, zod → 400 tiếng Việt, `BadRequestError`,
`ConflictError`, `NotFoundError`). Client: toast đỏ, giữ nguyên phiếu/nháp/dialog;
nút lưu khóa khi đang gửi.

## 9. Migration trên DB có sẵn

`imports.code` mới là `not null unique`; SQLite dựng lại bảng → dòng cũ (nếu có)
phải nhận mã duy nhất. Migration sinh xong được sửa tay (nếu cần) để `INSERT …
SELECT` dùng `'PN-OLD-' || id` cho `code`, chỉ chọn các cột đã tồn tại ở bảng cũ
(bài học migration `0001`). Test: dựng DB chỉ với `0000`+`0001`, chèn phiếu nhập cũ
+ đơn hàng, chạy migrate đầy đủ, dữ liệu còn nguyên, `foreign_key_check` rỗng.

## 10. Kiểm thử

- `shared`: `baseCost`, `marginPercent`, reducer nháp phiếu nhập (gộp dòng, đổi đơn
  vị, tổng, parse nháp hỏng), schema nhập/NCC/kiểm kê.
- `server` (DB `:memory:`):
  - nhập theo thùng: tồn `+qty×factor`, giá vốn gốc đúng, giá bán đúng đơn vị;
    hai dòng cùng sản phẩm → giá vốn theo dòng cuối; ngừng bán vẫn nhập;
  - nợ: `paid < total` có NCC → nợ + transaction; không NCC mà `paid < total` → 400;
    `paid > total` → 400; NCC đã xóa → 400;
  - mã phiếu tăng theo ngày địa phương;
  - hủy phiếu: trừ kho, trừ nợ, giá giữ nguyên, hủy lần hai 409;
  - NCC: trả vượt nợ 400; xóa khi còn nợ 409; số dư sổ nợ đúng;
  - kiểm kê: một phiên mở (409 lần hai); đếm → bán → chốt: tồn cuối = `counted −
    số bán sau lúc đếm`; đếm lại ghi đè `expected`; món không đếm giữ tồn; hủy phiên
    kho không đổi; đếm/chốt phiên đã đóng 409; tóm tắt `diffValue` đúng;
  - lịch sử tồn đủ loại, `refCode` đúng;
  - migration `0002` trên DB giai đoạn 2 có dữ liệu (mục 9);
  - route: gọi `fetch` tới app thật như `server/src/routes/orders-api.test.ts`.
- `npm run typecheck`, `npm run build`.
- README: mục "Kiểm thử thủ công Giai đoạn 3". Luồng UI chạy thử bằng Chromium
  headless (playwright-core trong scratchpad), chặn request ghi để không bẩn DB dev.
