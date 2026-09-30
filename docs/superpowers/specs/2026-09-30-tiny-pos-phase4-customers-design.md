# Tiny POS – Giai đoạn 4 (Khách hàng, công nợ khách)

Ngày: 2026-09-30

Nền tảng giữ nguyên như `2026-09-29-tiny-pos-phase1-design.md`; màn Bán hàng, hóa
đơn, in 80mm, VietQR như `2026-09-29-tiny-pos-phase2-sales-design.md`; sổ nợ nhà cung
cấp như `2026-09-29-tiny-pos-phase3-inventory-design.md`. Tài liệu này chỉ mô tả phần
thêm mới.

## 1. Mục tiêu

Thay cuốn sổ nợ giấy: chủ tiệm bán chịu cho khách quen ngay tại quầy, biết từng khách
đang nợ bao nhiêu, thu nợ khi khách trả và in giấy tờ đưa khách làm bằng.

Tiêu chí thành công:

- Ghi nợ một đơn (kể cả khách mới chưa có trong danh sách) mà không rời màn Bán hàng,
  vẫn thao tác được bằng bàn phím như thanh toán tiền mặt.
- Mọi thay đổi nợ khách đi qua `debt_transactions` trong cùng transaction với chứng
  từ; `customers.debt` luôn bằng tổng sổ.
- Hóa đơn ghi nợ in lại bất kỳ lúc nào vẫn đúng số *nợ cũ / tổng nợ* tại lúc bán.
- Tổng kết ngày đối soát được két: tiền mặt trong két = tiền mặt bán hàng + thu nợ
  tiền mặt.

## 2. Phạm vi

Trong phạm vi: khách hàng (CRUD mềm, nợ đầu kỳ), thanh toán *Ghi nợ* (trả trước một
phần, tạo khách nhanh), hủy đơn ghi nợ, sổ nợ khách, thu nợ (tiền mặt / chuyển khoản
có QR), ghi nợ tay, hóa đơn in thông tin nợ, biên nhận thu nợ 80mm, tổng kết ngày có
ghi nợ / thu nợ, menu *Khách hàng*.

Ngoài phạm vi: hạn mức nợ, nhắc nợ (SMS/Zalo), gắn khách vào đơn tiền mặt/chuyển
khoản, tích điểm, lãi chậm trả, hủy phiếu thu nợ, báo cáo nợ theo thời gian, backup.

## 3. Quyết định đã chốt

| Vấn đề | Chọn | Lý do |
|---|---|---|
| Kiểu đơn ghi nợ | `payment_method = 'debt'` + `customer_id`; `paid` = tiền mặt khách trả trước | Schema đã chuẩn bị sẵn; không đổi nghĩa cột cũ |
| Trả một phần | Cho: `0 ≤ paid < payable`, phần thiếu ghi nợ | Khách hay trả 50k nợ 30k |
| Phần trả trước | Luôn tính là tiền mặt | Hiếm khi chuyển khoản lẻ; giữ một hình thức cho đơn |
| Khách mới lúc bán | Tạo nhanh (chỉ tên) ngay trong hộp thanh toán | Không làm chậm quầy |
| Hạn mức nợ | Không có; chỉ hiện nợ cũ → tổng nợ sau đơn | Chủ tiệm tự quyết, không bị máy chặn |
| Nợ từ sổ giấy | Ô *Nợ đầu kỳ* khi tạo khách | Chuyển sổ một lần, có bút toán riêng |
| Sửa khi ghi nhầm | *Ghi nợ tay* (chỉ số dương, bắt buộc ghi chú); không sửa/xóa dòng sổ | Sổ chỉ ghi thêm, luôn truy được |
| Thu nợ | Dòng `payment` trong `debt_transactions`, có `method` TM/CK; không mã, không hủy | Giống trả nợ NCC; thu nhầm thì *Ghi nợ tay* bù |
| Nợ cũ trên hóa đơn in lại | Tính từ sổ (số dư tại dòng của đơn), không lưu snapshot | Không thêm cột; luôn khớp sổ |
| Tên khách trên hóa đơn | Lấy tên hiện tại (join), không snapshot | Đổi tên thường là sửa cho đúng |
| Hủy đơn khi khách đã trả bớt | Cho; nợ có thể âm ("Tiệm nợ khách") | Giống nợ NCC âm; không chặn nghiệp vụ hủy |

## 4. Dữ liệu

### Migration `0003` (sinh bằng `npm run db:generate`, đọc lại SQL trước khi commit)

Bảng `customers` (đã có `id`, `name`, `phone`, `debt`, `note`) thêm:

- `is_active integer not null default 1` – xóa mềm.

Bảng `debt_transactions` (đã có `id`, `customer_id`, `order_id`, `amount`, `note`,
`created_at`) thêm:

- `kind text not null default 'manual'` – enum `opening | order | order_cancel |
  payment | manual`;
- `method text` nullable – enum `cash | transfer`, chỉ dòng `payment` có.

Chỉ gồm `ALTER TABLE … ADD` với default hằng, chạy được trên DB đang có dữ liệu;
không dựng lại bảng. Không thêm `customers.created_at` (SQLite không cho `ADD COLUMN`
với default là biểu thức; giao diện không cần). Hai bảng hiện chưa có code nào ghi.

### Quy tắc

- Mọi thay đổi `customers.debt` = 1 dòng `debt_transactions` trong cùng transaction,
  qua hàm duy nhất `recordCustomerDebtTx(tx, { customerId, amount, kind, orderId?,
  method?, note?, createdAt? })` ở `server/src/services/customer-ledger.ts` (giống
  `recordSupplierTx`). Hàm trả `id` dòng vừa ghi.
- `amount`: `+` nợ thêm (`opening`, `order`, `manual`), `−` giảm nợ (`order_cancel`,
  `payment`).
- `customers.debt` âm = tiệm nợ lại khách.

## 5. Nghiệp vụ (server)

### Tạo đơn – `createOrder(db, input, clock?)`

`orderInputSchema`: `paymentMethod` thành `'cash' | 'transfer' | 'debt'`, thêm
`customerId` (`optionalId`). Trong transaction, sau khi tính `payable`:

- `debt`: `customerId` bắt buộc (thiếu → 400 "Chưa chọn khách"); khách phải tồn tại và
  đang hoạt động (không → 400 "Khách hàng không còn theo dõi"); `paid ≥ payable` → 400
  "Khách trả đủ thì chọn Tiền mặt". Lưu `paid` như nhập, `customer_id`.
- `cash` / `transfer`: như giai đoạn 2; `customerId` bị bỏ qua (lưu `null`).
- Lưu đơn, dòng, movement như cũ. Với `debt` thêm `recordCustomerDebtTx(+(payable −
  paid), kind 'order', orderId, note 'Bán HD-…')`.

### Hủy đơn – `cancelOrder(db, id, clock?)`

Như giai đoạn 2; đơn `debt` thêm `recordCustomerDebtTx(−(payable − paid), kind
'order_cancel', orderId, note 'Hủy HD-…')`. Khách đã ngừng theo dõi vẫn hủy được.

### Chi tiết đơn

- `OrderSummary` thêm `customerId: number | null`, `customerName: string | null`
  (join `customers`).
- `OrderDetail` thêm `debt: { amount, balanceAfter } | null`: với đơn `debt`, lấy dòng
  sổ `kind = 'order'` của đơn; `amount` = số nợ của đơn, `balanceAfter` = Σ `amount`
  các dòng của khách có `id ≤` dòng đó. Nợ cũ = `balanceAfter − amount`. Đơn đã hủy
  vẫn trả số tại lúc bán.

### Tổng kết ngày – `listOrders`

`DaySummary` (chỉ đơn `done`):

- `total` = Σ `payable` (không đổi);
- `cash` = Σ `payable` đơn `cash` + Σ `paid` đơn `debt`;
- `transfer` = Σ `payable` đơn `transfer`;
- `debt` = Σ (`payable − paid`) đơn `debt` → luôn có `total = cash + transfer + debt`;
- `debtCollected: { cash, transfer }` = Σ `−amount` các dòng `payment` trong ngày địa
  phương theo `method`.

### Khách hàng – `services/customers.ts`

- `listCustomers(q?)`: đang hoạt động; lọc bằng JS theo tên (không phân biệt hoa/thường)
  hoặc SĐT, như `listSuppliers`; sắp `debt` giảm dần rồi tên. Trả `{ customers,
  totalDebt }` với `totalDebt` = Σ `debt > 0` của mọi khách đang hoạt động (không phụ
  thuộc `q`).
- `createCustomer({ name, phone?, note?, openingDebt? })`: tên 1–100, SĐT ≤ 20, ghi chú
  ≤ 200, `openingDebt` nguyên 0–`MAX_MONEY` mặc định 0. Trong transaction: insert;
  `openingDebt > 0` → `recordCustomerDebtTx(+openingDebt, 'opening', note 'Nợ đầu
  kỳ')`. 201.
- `updateCustomer(id, { name, phone?, note? })`: không đổi nợ.
- `deleteCustomer(id)`: xóa mềm; `debt ≠ 0` → 409 "Còn nợ, không xóa được".
- `collectDebt(id, { amount, method, note? })`: khách đang hoạt động (không → 400);
  `amount` nguyên > 0, `≤ debt` (vượt → 400 "Thu nhiều hơn số đang nợ") →
  `recordCustomerDebtTx(−amount, 'payment', method, note || 'Thu nợ')`. Trả `{ customer,
  transaction }` (dòng vừa ghi, có `balanceAfter`) để in biên nhận.
- `addManualDebt(id, { amount, note })`: khách đang hoạt động; `amount` nguyên > 0;
  `note` bắt buộc 1–200 → `recordCustomerDebtTx(+amount, 'manual', note)`. Trả khách.
- `listCustomerTransactions(id)`: mới nhất trước; mỗi dòng `{ id, kind, amount,
  method, note, orderId, orderCode, createdAt, balanceAfter }` (số dư tính trong
  service như `listSupplierTransactions`).

## 6. API

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/api/customers?q=` | `{ customers, totalDebt }` |
| POST | `/api/customers` | `{ name, phone?, note?, openingDebt? }` → 201 |
| PUT | `/api/customers/:id` | `{ name, phone?, note? }` |
| DELETE | `/api/customers/:id` | xóa mềm; còn nợ → 409 |
| GET | `/api/customers/:id/transactions` | sổ nợ |
| POST | `/api/customers/:id/payments` | `{ amount, method: 'cash' \| 'transfer', note? }` → `{ customer, transaction }` |
| POST | `/api/customers/:id/adjustments` | `{ amount, note }` |
| POST | `/api/orders` | thêm `paymentMethod: 'debt'`, `customerId` |

Zod ở `shared/src/schemas/customer.ts` (`customerInputSchema`,
`customerCreateSchema` = input + `openingDebt`, `customerPaymentSchema`,
`customerAdjustmentSchema`). Nhãn thêm vào `FIELD_LABELS`: `customerId: 'Khách
hàng'`, `openingDebt: 'Nợ đầu kỳ'`, `method: 'Hình thức'`. Types `Customer`,
`CustomerList`, `CustomerTransaction`, `CustomerPaymentResult` ở `shared/src/types.ts`;
`PaymentMethod` thêm `'debt'`.

## 7. Giao diện

### Menu

Thêm mục **Khách hàng** (icon `Users`, `/customers`) sau *Nhà cung cấp* trong danh
sách nav ở `client/src/router.tsx`; điện thoại nằm trong nút *Thêm*.

### Thanh toán (`CheckoutDialog`)

- Tabs thêm **Ghi nợ** (icon `NotebookPen`) sau *Chuyển khoản*. Mở lại hộp luôn về
  *Tiền mặt*.
- Tab Ghi nợ:
  - Ô **Khách**: gõ tìm theo tên/SĐT (dùng `GET /api/customers?q=`), danh sách gợi ý
    hiện tên, SĐT, nợ hiện tại; mũi tên lên/xuống + Enter để chọn. Chữ gõ không khớp
    ai → dòng cuối **+ Thêm khách "…"**: tạo khách (chỉ tên) rồi chọn luôn. Đã chọn thì
    hiện thẻ khách có nút đổi.
  - Ô **Khách trả trước**: mặc định 0, định dạng nghìn như ô tiền khách đưa.
  - Khối số: *Nợ cũ*, *Ghi nợ đơn này* (`payable − trả trước`), **Tổng nợ sau đơn**.
  - Nút xác nhận khóa khi chưa chọn khách hoặc trả trước ≥ phải trả (kèm dòng nhắc);
    Enter trong ô trả trước xác nhận đơn; khóa khi đang gửi.
- Tạo xong đơn: như giai đoạn 2 (tự in nếu bật, `SaleResult`).

### Khách hàng (`/customers`)

Làm theo trang Nhà cung cấp:

- `PageHeader` + nút *Thêm khách*; `StatCard` **Tổng nợ phải thu**; ô tìm.
- Bảng (điện thoại: danh sách thẻ): tên, SĐT, nợ. Nợ > 0 tô cảnh báo; nợ âm hiện
  "Tiệm nợ khách …".
- `CustomerFormDialog`: tên, SĐT, ghi chú; ô **Nợ đầu kỳ** chỉ khi tạo mới.
- `CustomerDetailDialog`: thông tin khách, nút *Sửa*, *Xóa* (`ConfirmDialog`), sổ nợ
  (ngày giờ, nội dung theo `kind` + mã HD bấm được để mở chi tiết hóa đơn, ±, số dư),
  nút **Thu nợ** và **Ghi nợ tay**.
- `CollectDebtDialog`: số tiền (mặc định = số đang nợ), chọn TM/CK; CK hiện QR VietQR
  đúng số tiền (như hộp thanh toán, nhắc thiếu cài đặt ngân hàng). Lưu xong hiện kết
  quả kèm nút **In biên nhận** (tự in nếu bật tự in).
- `ManualDebtDialog`: số tiền, ghi chú bắt buộc.

### In

- `ReceiptData` thêm `customerName` và `debt: { amount, balanceAfter } | null`
  (`receiptFromOrder` lấy từ `OrderDetail`). Hóa đơn ghi nợ in: *Khách: …*, *Khách
  trả*, *Ghi nợ đơn này*, *Nợ cũ*, **Tổng nợ**; phương thức in "Ghi nợ".
- **Biên nhận thu nợ** (`DebtReceipt`, in qua `PrintProvider`, khổ 80mm như hóa đơn):
  tên/địa chỉ tiệm, "BIÊN NHẬN THU NỢ", thời gian, khách, số đã thu (TM/CK), còn nợ.

### Hóa đơn và tổng kết

- Danh sách hóa đơn: đơn ghi nợ có badge "Ghi nợ · <tên khách>"; chi tiết hiện khách
  và khối nợ.
- Trang Hóa đơn: thêm `StatCard` **Ghi nợ** và **Thu nợ** (dòng phụ TM/CK).
- *Hôm nay* ở màn Bán hàng thêm dòng Ghi nợ khi > 0.

## 8. Xử lý lỗi

Theo quy ước giai đoạn 1–3 (`{ error }`, zod → 400 tiếng Việt, `BadRequestError`,
`ConflictError`, `NotFoundError`). Client: toast đỏ, giữ nguyên hộp thoại và số đã
nhập; nút lưu khóa khi đang gửi. Tạo khách nhanh thành công nhưng tạo đơn lỗi: khách
vẫn còn (vô hại), hộp thanh toán giữ khách đã chọn.

## 9. Kiểm thử

- `shared`: schema khách hàng/thu nợ/ghi nợ tay; `orderInputSchema` nhận `debt`.
- `server` (DB `:memory:`):
  - đơn ghi nợ trả 0 và trả một phần: nợ khách + dòng sổ `order`; thiếu khách, khách
    đã xóa, `paid ≥ payable` → 400; đơn tiền mặt gửi kèm `customerId` → lưu `null`;
  - hủy đơn ghi nợ: dòng `order_cancel`, nợ về như cũ; thu bớt rồi hủy → nợ âm;
  - `OrderDetail.debt` đúng khi in lại sau nhiều giao dịch khác của cùng khách và sau
    khi hủy;
  - tổng kết ngày: `total = cash + transfer + debt`; `debtCollected` theo `method` và
    ngày địa phương;
  - khách: nợ đầu kỳ tạo dòng `opening`; thu vượt nợ 400; thu/ghi tay khách đã xóa 400;
    ghi tay thiếu ghi chú 400; xóa còn nợ 409; sổ nợ có `balanceAfter`, `orderCode`;
    `listCustomers` sắp theo nợ, `totalDebt` không phụ thuộc `q`;
  - bất biến: sau chuỗi thao tác, `customers.debt` = Σ `debt_transactions.amount`;
  - migration `0003` trên DB đã chạy tới `0002` có dữ liệu: dữ liệu còn nguyên,
    `foreign_key_check` rỗng;
  - route: gọi `fetch` tới app thật như `server/src/routes/orders-api.test.ts`.
- `npm run typecheck`, `npm test`, `npm run build`.
- Giao diện: skill `browser-verify` (chặn request ghi), cỡ máy tính và điện thoại:
  ghi nợ có tạo khách nhanh, xem trước hóa đơn nợ, sổ nợ, thu nợ + biên nhận, StatCard
  trang Hóa đơn.
