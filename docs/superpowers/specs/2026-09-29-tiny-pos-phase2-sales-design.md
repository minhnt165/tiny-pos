# Tiny POS – Giai đoạn 2 (Bán hàng và in hóa đơn)

Ngày: 2026-09-29

Nền tảng (stack, cấu trúc thư mục, quy tắc dữ liệu, quy ước API, xử lý lỗi) giữ
nguyên như `2026-09-29-tiny-pos-phase1-design.md`. Tài liệu này chỉ mô tả phần
thêm mới.

## 1. Mục tiêu

Người bán ở quầy quét mã (hoặc tìm tên) để đưa hàng vào giỏ, thu tiền mặt hoặc
chuyển khoản qua VietQR, hệ thống trừ kho và in hóa đơn nhiệt 80mm. Người bán xem
lại hóa đơn trong ngày, in lại, hủy đơn bấm nhầm (trả hàng về kho) và biết tổng
tiền mặt / chuyển khoản hôm nay.

Tiêu chí thành công:

- Một đơn thông thường (quét 3–5 món, tiền mặt) xong trong vài giây chỉ bằng máy
  quét và bàn phím: quét → F9 → Enter.
- Tồn kho luôn khớp `stock_movements`: bán ghi `sale`, hủy ghi `return`.
- Chạy không cần mạng, kể cả QR chuyển khoản.

## 2. Phạm vi

Trong phạm vi:

- Màn Bán hàng: quét/tìm, giỏ, sửa số lượng và đơn giá, hàng cân gõ kg, món
  ngoài (không có mã), giảm giá cả đơn, đơn chờ, tóm tắt hôm nay.
- Thanh toán tiền mặt (khách đưa, tiền thối) và chuyển khoản (VietQR).
- In hóa đơn 80mm bằng `window.print()`, in tạm tính kèm QR, in lại.
- Danh sách hóa đơn theo ngày, chi tiết, hủy đơn.
- Trang Cài đặt: thông tin cửa hàng, tài khoản ngân hàng, tự in.

Ngoài phạm vi: công nợ và khách hàng (`payment_method = 'debt'`), nhập hàng, kiểm
kê, báo cáo lãi lỗ, backup, tem cân điện tử, in qua ESC/POS.

## 3. Quyết định đã chốt

| Vấn đề | Chọn | Lý do |
|---|---|---|
| Món không có mã | `order_items.product_id` nullable, không ghi movement | Không làm bẩn danh sách sản phẩm và báo cáo sau này |
| Đơn chờ | `localStorage` của máy quầy | Một quầy; giỏ chưa thanh toán không phải dữ liệu kế toán |
| In | `window.print()` + CSS `@page`, Chrome `--kiosk-printing` | Không phụ thuộc driver/cổng, điện thoại cũng in được |
| QR chuyển khoản | Tự dựng chuỗi VietQR (EMVCo) trong `shared`, vẽ bằng `qrcode` | Chạy offline |
| Tồn không đủ | Cho bán, tồn được âm, giỏ chỉ cảnh báo | Khách đang cầm hàng; sửa số kho khi kiểm kê |
| Hàng cân | Gõ tay số kg hoặc thành tiền | Chưa nối cân điện tử |
| Giá bán | Lấy theo client gửi (sửa được trên dòng); giá vốn lấy từ DB | Người bán cần bớt giá lẻ; giá vốn không để client quyết |
| Ngày của đơn | Ngày giờ địa phương của máy server | `created_at` lưu UTC; bán 6 giờ sáng giờ VN vẫn là hôm trước theo UTC |

## 4. Dữ liệu

### Migration `0001` (sinh bằng `npm run db:generate`)

Sửa `server/src/db/schema.ts`:

- `orderItems.productId`: bỏ `.notNull()`.
- `orderItems.factor`: `real('factor').notNull().default(1)` – hệ số đơn vị lúc
  bán (thùng = 24). Hủy đơn cộng trả đúng `qty × factor` dù đơn vị đã bị sửa/xóa.
- `orderItems.amount`: `integer('amount').notNull()` – thành tiền dòng, lưu cứng.
- `orders.cancelledAt`: `text('cancelled_at')` nullable.

SQLite sẽ dựng lại bảng `order_items`; bảng chưa có dữ liệu nên an toàn.

### Quy ước tiền (`shared/src/order-math.ts`)

- `lineAmount({ qty, price, isWeighed })` = `qty × price`, làm tròn về đồng;
  hàng cân thì `round500`.
- `cartTotals(lines, discount)` → `{ total, discount, payable }` với
  `total = Σ amount`, `payable = total − discount`.
- `orders.total` = `total` (trước giảm giá). `orders.paid`:
  - tiền mặt: số khách đưa; tiền thối = `paid − payable`;
  - chuyển khoản: bằng `payable`.
- `suggestCash(payable)` → tối đa 4 mệnh giá gợi ý tăng dần, không trùng: đủ tiền,
  bội 10.000 gần nhất phía trên, bội 50.000/100.000 gần nhất phía trên, 200.000,
  500.000 (chỉ những số ≥ `payable`).

Client và server cùng dùng các hàm này nên số tiền luôn khớp.

### Mã hóa đơn

`HD-YYYYMMDD-NNNN`, ngày theo giờ địa phương, `NNNN` = số lớn nhất của các mã
cùng ngày + 1 (đọc trong cùng transaction), bắt đầu `0001` mỗi ngày.

### Cài đặt (bảng `settings`, key/value)

| Key | Kiểu | Mặc định |
|---|---|---|
| `storeName` | text ≤ 100 | `Tạp hóa` |
| `storeAddress` | text ≤ 200 | rỗng |
| `storePhone` | text ≤ 20 | rỗng |
| `receiptFooter` | text ≤ 200 | `Cảm ơn quý khách!` |
| `bankBin` | 6 chữ số hoặc rỗng | rỗng |
| `bankAccount` | chữ số, ≤ 19 | rỗng |
| `bankAccountName` | chữ in hoa không dấu, ≤ 50 | rỗng |
| `autoPrint` | `'1'` / `'0'` | `'1'` |

Zod `settingsInput` trong `shared/src/schemas/settings.ts`; `bankAccountName` được
chuẩn hóa (bỏ dấu, viết hoa) trong schema. Key lạ bị bỏ qua.

## 5. API

| Method | Path | Ghi chú |
|---|---|---|
| POST | `/api/orders` | Tạo đơn (chi tiết bên dưới); trả `OrderDetail` |
| GET | `/api/orders?date=YYYY-MM-DD` | Mặc định hôm nay. Trả `{ orders: OrderSummary[], summary: { count, total, cash, transfer } }`, mới nhất trước. Đơn hủy vẫn trong `orders`, không tính vào `summary` (`total` ở đây là tổng `payable`) |
| GET | `/api/orders/:id` | `OrderDetail` kèm `items[]` |
| POST | `/api/orders/:id/cancel` | Chỉ đơn `done`; mỗi dòng có `productId` ghi movement `return` `+qty×factor`, `refId = orderId`; đặt `status = 'cancelled'`, `cancelledAt`. Đơn đã hủy → 409 "Hóa đơn đã hủy" |
| GET | `/api/settings` | Toàn bộ key ở mục 4, điền mặc định cho key chưa có |
| PUT | `/api/settings` | Body `settingsInput`, upsert từng key; trả như GET |

### `POST /api/orders`

Body (`orderInput`, zod trong `shared/src/schemas/order.ts`):

```ts
{
  items: Array<
    | { productId: number; unitId?: number | null; qty: number; price: number }
    | { productId?: null; name?: string; qty: number; price: number } // món ngoài
  >;                       // ≥ 1 dòng
  discount: number;        // int ≥ 0, mặc định 0
  paymentMethod: 'cash' | 'transfer';
  paid: number;            // int ≥ 0
}
```

`qty` > 0, `price` int ≥ 0, `name` món ngoài 0–100 ký tự (rỗng → "Hàng khác").

Xử lý trong một transaction:

1. Với dòng có `productId`: đọc sản phẩm; không có hoặc `isActive = false` → 400
   "Sản phẩm … không còn bán". Có `unitId` thì đọc đơn vị (phải thuộc sản phẩm,
   không thì 400); `factor = unit.factor`, `unit = unit.name`; không thì
   `factor = 1`, `unit = product.unit`. Snapshot `productName`,
   `costPrice = round(product.costPrice × factor)`, `isWeighed` để tính `amount`.
2. Dòng món ngoài: `productId = null`, `unit = 'cái'`, `factor = 1`,
   `costPrice = 0`.
3. Tính `cartTotals`. `discount > total` → 400 "Giảm giá lớn hơn tổng tiền".
   Tiền mặt mà `paid < payable` → 400 "Tiền khách đưa chưa đủ". Chuyển khoản thì
   server ghi `paid = payable` bất kể client gửi gì.
4. Sinh mã, insert `orders` (`status = 'done'`), insert `order_items`.
5. Mỗi dòng có `productId`: `recordMovement` kiểu `sale`, `qty = −qty×factor`,
   `refId = orderId`. Không kiểm tra tồn (được âm).

### Types (`shared/src/types.ts`)

```ts
interface OrderItem { id; productId: number | null; productName; unit; qty; price;
  costPrice; factor; amount }
interface OrderSummary { id; code; total; discount; payable; paid;
  paymentMethod: 'cash' | 'transfer' | 'debt'; status: 'done' | 'cancelled';
  itemCount: number; createdAt; cancelledAt: string | null }
interface OrderDetail extends OrderSummary { items: OrderItem[] }
interface DaySummary { count; total; cash; transfer }
interface Settings { storeName; storeAddress; storePhone; receiptFooter; bankBin;
  bankAccount; bankAccountName; autoPrint: boolean }
```

`payable` là trường tính (`total − discount`), không lưu DB.

### Ranh giới ngày

Service nhận `date` dạng `YYYY-MM-DD` (giờ địa phương), đổi ra khoảng UTC
`[start, end)` bằng `Date` của Node rồi so sánh chuỗi ISO với `created_at`.
Hàm đổi ngày nhận thêm tham số múi giờ (offset phút) để test không phụ thuộc máy.

## 6. Giao diện

### Menu

`Bán hàng` (mở khóa, trang mặc định: `/` → `/sell`), `Hóa đơn` (`/orders`, mới),
`Sản phẩm`, `Danh mục`, `Nhập nhanh`, `Cài đặt` (mở khóa). Icon lucide:
`ShoppingCart`, `ReceiptText`.

### Bán hàng (`/sell`)

Thư mục `client/src/pages/sell/`: `SellPage`, `CartTable`, `CartLine`,
`ProductSearch`, `WeighDialog`, `CustomItemDialog`, `CheckoutPanel`,
`CheckoutDialog`, `HeldCarts`, `useCart.ts`, `useHeldCarts.ts`. Mỗi file ≤ 200
dòng.

Máy tính – hai cột:

- **Trái**: ô quét/tìm lớn luôn focus (`useScanInput`); chip đơn chờ; bảng giỏ.
  Mỗi dòng: tên kèm đơn vị ("Bia Tiger · Thùng"), nút −/+ và ô số lượng, đơn giá
  (bấm để sửa), thành tiền, nút xóa. Nếu `stock` của sản phẩm (tính theo đơn vị
  gốc) < tổng `qty×factor` của mọi dòng cùng sản phẩm trong giỏ → nhãn vàng
  "Tồn còn N", không chặn.
- **Phải**: tổng tiền chữ lớn, ô giảm giá (ô tiền tự chia dấu chấm), phải trả, nút
  lớn **Thanh toán (F9)**, nút *Cất đơn chờ*, *Món ngoài (F4)*, *Xóa giỏ* (có
  `ConfirmDialog`), dòng tóm tắt hôm nay (số đơn, tiền mặt, chuyển khoản).

Điện thoại: xếp chồng; tổng tiền và nút Thanh toán dính đáy màn hình.

Quét và tìm:

- Enter: nếu chuỗi không rỗng thì gọi `by-barcode`. Thấy → thêm 1 (cùng sản phẩm
  + cùng đơn vị đã có trong giỏ thì tăng số lượng); sản phẩm hàng cân → mở
  `WeighDialog`. Không thấy (404) → toast đỏ "Không có mã …", ô quét trống.
- Nếu đang có danh sách gợi ý và một mục được chọn bằng ↑↓, Enter thêm mục đó
  thay vì gọi `by-barcode`.
- Gõ chuỗi có chữ cái (không toàn chữ số): sau 200ms gọi
  `GET /api/products?q=` (chỉ hàng đang bán), hiện tối đa 8 gợi ý dưới ô quét.
- `WeighDialog`: hai ô "Số kg" và "Thành tiền" liên động (gõ ô nào tính ô kia theo
  `sellPrice`), Enter thêm. Bấm vào số lượng của dòng hàng cân trong giỏ → mở lại
  dialog để sửa.
- `CustomItemDialog` (F4): tên (không bắt buộc), giá, số lượng (mặc định 1).

Giỏ (`useCart`, `useReducer`): dòng giữ `{ key, productId, unitId, name,
unitName, factor, isWeighed, stock, qty, price }`; thành tiền và tổng dùng
`order-math` của `shared`. Giỏ hiện tại tự lưu `localStorage` (khóa
`tiny-pos.cart`), đọc lại khi mở trang; đọc/ghi bọc `try/catch`.

Đơn chờ (`useHeldCarts`, khóa `tiny-pos.held-carts`): tối đa 5; *Cất đơn chờ*
đẩy giỏ hiện tại (kèm giờ cất, tổng tiền) vào danh sách rồi mở giỏ trống; đã đủ 5
thì nút bị khóa kèm tooltip. Bấm chip → mở giỏ đó; giỏ đang dở có hàng thì được
cất vào chờ thay chỗ. Chip có nút × (xác nhận) để bỏ đơn chờ.

Phím tắt: F2 focus ô quét, F4 món ngoài, F9 thanh toán, Esc đóng dialog.

### Thanh toán (`CheckoutDialog`)

- Chỉ mở khi giỏ có hàng. Tab **Tiền mặt** (mặc định) / **Chuyển khoản**.
- Tiền mặt: ô "Khách đưa" mặc định = phải trả, nút gợi ý từ `suggestCash`, tiền
  thối chữ lớn (đỏ và khóa nút xác nhận nếu thiếu). Enter xác nhận.
- Chuyển khoản: QR lớn (`buildVietQr` với số tiền phải trả, nội dung
  "Thanh toan"), dưới là tên ngân hàng, số tài khoản, chủ tài khoản. Nút *In tạm
  tính kèm QR* in `Receipt` ở chế độ nháp ("TẠM TÍNH – chưa thanh toán", không có
  mã hóa đơn). Nút **Đã nhận tiền** tạo đơn. Chưa cài `bankBin`/`bankAccount` →
  không vẽ QR, hiện dòng nhắc kèm link `/settings`; vẫn bấm được Đã nhận tiền.
- Xác nhận: `POST /api/orders`. Thành công → xóa giỏ, đóng dialog, focus ô quét,
  hiện khung kết quả (mã đơn, tiền thối chữ lớn, nút *In lại*) cho tới lần thêm
  món kế tiếp; `autoPrint` bật thì in ngay. Lỗi → giữ giỏ và dialog, toast đỏ
  với thông điệp server. Nút xác nhận khóa trong lúc gửi để không tạo đơn đôi.
- Mutation thành công invalidate query `orders` và `products` (tồn đã đổi).

### In hóa đơn

- `client/src/components/receipt/Receipt.tsx` render vào `#print-root` (thêm vào
  `index.html`) qua portal. CSS in (`index.css`): `@media print` ẩn `#root`, chỉ
  hiện `#print-root`; `@page { size: 80mm auto; margin: 0 }`; nội dung rộng 72mm,
  chữ 12px, đen trắng.
- `usePrintReceipt()` trả `print(data)`: đặt dữ liệu vào state, sinh QR bằng
  `qrcode.toDataURL` nếu cần, chờ 2 `requestAnimationFrame` để DOM vẽ xong, gọi
  `window.print()`, rồi dọn state trong `afterprint`.
- Nội dung: tên, địa chỉ, số điện thoại cửa hàng; mã hóa đơn (hoặc "TẠM TÍNH"),
  ngày giờ địa phương; mỗi món một dòng tên, dòng dưới `SL × đơn giá` bên trái,
  thành tiền bên phải; tổng, giảm giá (nếu có), phải trả, khách đưa và tiền thối
  (tiền mặt), phương thức; QR (chỉ phiếu tạm tính); lời chào cuối.
- Số lượng hàng cân hiện 3 chữ số thập phân bỏ số 0 cuối, dấu phẩy ("0,35 kg").
- Thêm dependency client: `qrcode`, dev `@types/qrcode`.

### Hóa đơn (`/orders`)

Thư mục `client/src/pages/orders/`: `OrdersPage`, `OrderTable`,
`OrderDetailDialog`, `DayPicker`.

- Trên: ô ngày (mặc định hôm nay, nút ◀ ▶), `StatCard` số đơn / tổng / tiền mặt /
  chuyển khoản (không tính đơn hủy).
- Bảng: mã, giờ, số món, phải trả, phương thức, trạng thái; đơn hủy có badge xám,
  chữ gạch ngang. Không phân trang (một ngày).
- Bấm dòng → `OrderDetailDialog`: các dòng hàng, tiền, nút *In lại*, *Hủy đơn*
  (`ConfirmDialog` "Hủy HD-… và trả hàng về kho?"; ẩn với đơn đã hủy).

### Cài đặt (`/settings`)

`client/src/pages/settings/SettingsPage.tsx`, form ba nhóm dùng `TextField`,
`SelectField`, `Switch` của shadcn:

- *Cửa hàng*: tên, địa chỉ, số điện thoại, lời chào cuối hóa đơn.
- *Chuyển khoản*: ngân hàng (chọn từ `BANKS` trong `shared/src/banks.ts`, khoảng
  20 ngân hàng phổ biến `{ bin, shortName, name }`), số tài khoản, tên chủ tài
  khoản (hiện ngay dạng in hoa không dấu).
- *In*: công tắc tự in; nút *In thử* in một hóa đơn mẫu.
- Lưu → `PUT /api/settings`, toast xanh.

## 7. VietQR (`shared/src/vietqr.ts`)

`buildVietQr({ bin, account, amount, message }): string` ghép các trường TLV
(ID 2 số, độ dài 2 số, giá trị):

- `00` = `01`; `01` = `12` (QR động, có số tiền);
- `38` = `00:A000000727` + `01:(00:bin + 01:account)` + `02:QRIBFTTA`;
- `53` = `704`; `54` = số tiền (số nguyên); `58` = `VN`;
- `62` = `08:message` (ASCII, bỏ dấu, ≤ 25 ký tự);
- `63` = CRC16-CCITT (poly `0x1021`, init `0xFFFF`) của toàn chuỗi kể cả `6304`,
  4 ký tự hex in hoa.

Test: CRC của chuỗi `123456789` = `29B1`; chuỗi mẫu cố định khớp từng ký tự.

## 8. Xử lý lỗi

Theo quy ước giai đoạn 1 (`{ error }`, zod → 400 tiếng Việt, 404, 409). Bổ sung
`BadRequestError` (400, kế thừa `HttpError` trong `server/src/errors.ts`) cho lỗi
nghiệp vụ ở mục 5; hủy đơn đã hủy dùng `ConflictError` có sẵn. Client: toast đỏ,
giữ nguyên giỏ / form.

## 9. Kiểm thử

- `shared` (vitest): `lineAmount`, `cartTotals` (hàng cân làm tròn 500đ, giảm
  giá), `suggestCash`, `buildVietQr` + CRC, `settingsInput` (chuẩn hóa tên chủ
  tài khoản), `orderInput` (giỏ rỗng, qty ≤ 0).
- `server` (DB `:memory:`):
  - tạo đơn trừ đúng tồn, kể cả bán theo thùng (`qty×factor`) và khi tồn âm;
  - món ngoài không có movement;
  - snapshot tên/giá vốn giữ nguyên sau khi sửa sản phẩm;
  - mã tăng dần trong ngày, sang ngày mới về `0001`;
  - hủy đơn trả kho (movement `return`), hủy lần hai 409;
  - tóm tắt ngày bỏ đơn hủy, đúng ranh giới ngày địa phương;
  - 400: giảm giá vượt tổng, tiền mặt không đủ, sản phẩm ngừng bán, `unitId`
    không thuộc sản phẩm;
  - chuyển khoản ghi `paid = payable`;
  - settings: GET trả mặc định, PUT rồi GET đọc lại đúng;
  - route: `POST /api/orders`, `GET /api/orders`, `/cancel`, `/api/settings` gọi
    bằng `fetch` tới app thật như `server/src/routes/api.test.ts`.
- `npm run typecheck` cho cả 3 workspace.
- README: thêm mục "Kiểm thử thủ công Giai đoạn 2" và cách mở Chrome
  `--kiosk-printing` để in không hỏi.
