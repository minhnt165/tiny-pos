# Tiny POS – Giai đoạn 7: Khách trả hàng (0.11.0)

Ngày: 2026-10-01

Nền tảng giữ nguyên như `2026-09-29-tiny-pos-phase1-design.md`; bán hàng, hủy hóa đơn, in 80mm như
`2026-09-29-tiny-pos-phase2-sales-design.md`; nợ khách như `2026-09-30-tiny-pos-phase4-customers-design.md`;
`PageTitle`, `ListPanel`, `StatStrip`, `NAV` như `2026-09-30-tiny-pos-ui-refresh-design.md`; `FilterBar`,
`useUrlFilters`, `DateRangeFilter` như `2026-09-30-tiny-pos-filters-design.md`; xuất `.xlsx` như
`2026-09-30-tiny-pos-excel-design.md`; công thức lãi lỗ và `daySummary` như `2026-10-01-tiny-pos-reports-design.md`.
Tài liệu này chỉ mô tả phần thêm mới.

## 1. Mục tiêu

Khách mang hàng lại (mua nhầm, hàng lỗi, mua dư), chủ tiệm trả lại một phần hoặc toàn bộ hóa đơn mà không
phải hủy cả đơn rồi bán lại. Hiện chỉ có *Hủy hóa đơn* (trả hết, mất số liệu ngày bán).

Tiêu chí thành công:

- Từ chi tiết hóa đơn lập được phiếu trả cho từng món, số lượng tùy ý trong phần còn lại; tiền hoàn tính
  sẵn, chủ tiệm không phải chọn hình thức hoàn.
- Trả hết mọi món của một đơn (một hay nhiều phiếu) thì tổng hoàn **bằng đúng** số phải trả của đơn.
- Tiền mặt hôm nay ở trang *Hóa đơn* = tiền thật trong két (đã trừ tiền mặt hoàn); trang *Hóa đơn*, *Báo cáo*
  và *Tổng quan* cùng một con số.
- Tồn, nợ khách chỉ đổi qua `recordMovement` / `recordCustomerDebtTx`, cùng transaction với phiếu.
- Phiếu lập nhầm hủy được, mọi số trở lại như trước khi lập.

## 2. Phạm vi

Trong phạm vi: bảng `returns` + `return_items` (migration `0004`); `shared/return-math.ts`; service
`services/returns.ts` (lập, xem, danh sách lọc, hủy, xuất `.xlsx`); route `/api/returns`; sửa `daySummary`,
`profitReport`, `productReport`, `debtReport`, mốc nợ lâu ở `overview.ts`, `getOrder`, `listOrders`, `cancelOrder`, xuất Excel hóa đơn và
lãi lỗ; nút *Trả hàng* và phần phiếu trả trong chi tiết hóa đơn; hộp lập phiếu; trang `/returns`; phiếu in
80mm; nhãn sổ nợ khách; version 0.11.0; README; CLAUDE.md.

Ngoài phạm vi: trả hàng không có hóa đơn, đổi hàng trong một bước (trả xong thì bán đơn mới), hoàn bằng
chuyển khoản, sửa tay tiền hoàn, trả hàng cho nhà cung cấp, trả từ màn hình Bán hàng bằng máy quét, ô trên
thanh dưới điện thoại, thống kê lý do trả.

## 3. Quyết định đã chốt

| Vấn đề | Chọn | Lý do |
|---|---|---|
| Gắn hóa đơn | **Bắt buộc** gắn một hóa đơn `done`; mỗi dòng phiếu trỏ về `order_item_id` | Giá bán, giá vốn, đơn vị, hệ số lấy đúng snapshot lúc bán nên lãi lỗ chính xác; chặn trả quá số đã mua |
| Lưu trữ | Bảng riêng `returns` + `return_items`, mã `TH-YYYYMMDD-NNNN` | Hóa đơn gốc không đổi ("chứng từ không sửa"); không lẫn vào mọi truy vấn `orders.status = 'done'` như cách hóa đơn âm; giữ được ngày trả và hủy được phiếu, điều cột `returned_qty` không làm được |
| Số lượng | Theo đơn vị lúc bán; mỗi dòng ≤ số đã mua − số đã trả ở phiếu `done` khác; hàng cân cho số lẻ (3 chữ số) | Chủ tiệm nhìn "đã mua 3 lốc" mà trả, không phải quy đổi |
| Tiền hoàn có giảm giá | Phân bổ giảm giá của đơn theo tỷ lệ thành tiền từng dòng; phần lẻ từng đồng cho dòng có phần thập phân lớn nhất (không dòng nào âm); hoàn theo lũy kế số đã trả (§5) | Trả hết thì đúng bằng `payable`; trả nhiều lần cộng lại không lệch đồng nào |
| Hình thức hoàn | Đơn ghi nợ: **trừ nợ trước**, tối đa bằng nợ hiện tại của khách (nếu > 0), phần dư trả tiền mặt; đơn tiền mặt / chuyển khoản: toàn bộ tiền mặt | Người dùng chọn "theo hóa đơn gốc": không thêm bước ở quầy; tiệm không hoàn chuyển khoản |
| Nhập lại kho | Mỗi dòng có checkbox *Nhập lại kho*, mặc định bật; món ngoài không có | Hàng hỏng / hết hạn vẫn hoàn tiền nhưng không cộng tồn; giá vốn của phần đó thành lỗ trong báo cáo |
| Ngày tính | Phiếu `done` tính vào **ngày lập phiếu**; số ngày bán không đổi | Két cuối ngày khớp tiền thật đã chi; số ngày cũ đã chốt không bị sửa |
| Hủy phiếu trả | Cho phép; ghi movement bù `adjust` và bút toán bù `return_cancel`; phiếu giữ lại, trạng thái *Đã hủy* | Bất biến "chứng từ không sửa, chỉ hủy" |
| Hủy hóa đơn có phiếu trả | **Chặn** khi còn phiếu trả `done`: "Hóa đơn đã có phiếu trả, hãy hủy phiếu trả trước" | Không cộng tồn hay bù nợ hai lần; không phải tính "phần còn lại" khi hủy đơn |
| Nợ lâu (Tổng quan) | Phiếu trả trừ nợ **không** tính là trả nợ (`kind = 'return'`, không phải `'payment'`); bút toán bù `return_cancel` (dương) **không** tính là ghi nợ mới khi tìm mốc nợ lâu | Trả hàng không phải khách trả tiền; hủy phiếu trả không được làm mới mốc của khoản nợ cũ |
| Khách ngừng theo dõi | Vẫn trừ nợ bình thường | Nợ thật vẫn còn; sổ nợ không phụ thuộc trạng thái theo dõi |
| Vị trí trang | `/returns` *Trả hàng* (icon `Undo2`) trong nhóm *Bán hàng*, ngay sau *Hóa đơn*; không có ô trên thanh dưới | Thanh dưới chỉ 4 ô; lập phiếu đi từ chi tiết hóa đơn |

## 4. Dữ liệu

Migration `0004` chỉ **thêm bảng** (không biến đổi dữ liệu cũ), nên khôi phục bản sao trước 0.11.0 vẫn chạy:
`copyTables` xóa mọi bảng rồi chép các bảng có trong bản sao, bảng mới để trống.

```ts
returns: {
  id, code (unique, 'TH-20261001-0001'),
  orderId → orders.id (not null),
  refund integer      // tổng hoàn = Σ return_items.amount
  debtReduced integer // phần trừ vào nợ khách (≥ 0)
  cashRefund integer  // phần trả tiền mặt = refund − debtReduced
  note text null,
  status 'done' | 'cancelled' (default 'done'),
  createdAt, cancelledAt null,
}  index (created_at), index (order_id)

return_items: {
  id, returnId → returns.id (on delete cascade),
  orderItemId → order_items.id (not null),
  qty real            // theo đơn vị lúc bán, > 0
  restock boolean     // có cộng lại tồn
  amount integer      // tiền hoàn của dòng (đã trừ phần giảm giá phân bổ)
  cost integer        // round(qty × order_items.cost_price), không nhân factor như báo cáo
}  index (return_id), index (order_item_id)
```

`debt_transactions.kind` thêm `'return'` (âm, trừ nợ) và `'return_cancel'` (dương, bù lại); cột là `text`
enum không có CHECK nên không cần migration cho cột này. `nextDailyCode` nhận thêm bảng `'returns'`.
`CODE_IN_NOTE` (`services/movements.ts`) thêm tiền tố `TH` để lịch sử tồn hiện mã phiếu trả.

## 5. Công thức (`shared/return-math.ts`)

Hàm thuần, client dùng để hiện số trước khi lưu, server dùng khi lưu (server luôn tính lại, không tin số
client gửi).

- `lineValues(items, discount)`: giá trị sau giảm giá của từng dòng.
  `exact_i = discount × amount_i / total`, `share_i = floor(exact_i)`; phần còn thiếu `discount − Σ share` (đồng) chia
  mỗi dòng 1 đồng theo phần thập phân của `exact_i` giảm dần (bằng nhau thì dòng trước); `value_i = amount_i − share_i ≥ 0`. `total = 0` thì mọi `value_i = 0`. Σ `value_i` = `payable`.
- `refundFor(value, qty, returnedBefore, returningNow)`:
  `round(value × (returnedBefore + returningNow) / qty) − round(value × returnedBefore / qty)`;
  khi `returnedBefore + returningNow` bằng `qty` (sai số `1e-9`) thì số hạng đầu là đúng `value`.
- `splitRefund(refund, paymentMethod, customerDebt)`: đơn `debt` → `debtReduced = min(refund, max(customerDebt, 0))`;
  đơn khác → `debtReduced = 0`; `cashRefund = refund − debtReduced`.
- `remainingQty(item, returnedQty)` = `max(qty − returnedQty, 0)`, làm tròn 3 chữ số để tránh `0.30000000000000004`.

## 6. Server

### `services/returns.ts`

- `createReturn(db, input, clock)`, trong một transaction:
  1. `getOrder`; không có → 404; `status !== 'done'` → 409 "Hóa đơn đã hủy, không trả hàng được".
  2. Mỗi dòng input `{ orderItemId, qty, restock }`: dòng phải thuộc đơn (400), `qty > 0` (zod), `qty ≤ remainingQty`
     (400 "Số lượng trả vượt số còn lại của <tên>"); trùng `orderItemId` trong input → 400. Không có dòng → 400.
  3. Tính `amount` từng dòng bằng `lineValues` + `refundFor`, `refund = Σ amount`; nợ khách đọc trong transaction
     rồi `splitRefund`.
  4. `nextDailyCode(tx, 'returns', 'TH', ngày địa phương, 4)`, chèn `returns` + `return_items`.
  5. Dòng `restock` và có `productId`: `recordMovement({ qty: +qty × factor, type: 'return', refId: returnId,
     note: 'Trả hàng TH-…' })`. Món ngoài luôn `restock = false`.
  6. `debtReduced > 0`: `recordCustomerDebtTx({ amount: −debtReduced, kind: 'return', orderId, note: 'Trả hàng TH-…' })`.
- `getReturn(db, id)`: phiếu + dòng (tên, đơn vị, giá lấy từ `order_items`) + mã hóa đơn gốc + tên khách hiện tại.
- `listReturns(db, query, clock)`: lọc khoảng ngày (bắt buộc, mặc định hôm nay như hóa đơn), `status[]`, `q`
  (bỏ dấu, LIKE trên mã phiếu, mã hóa đơn, tên món), phân trang; trả kèm `summary` = `returnSummary` của khoảng
  ngày (không theo lọc khác, giống `daySummary`).
- `returnSummary(db, start, end)`: `{ count, refund, cash, debt }` của phiếu `done` trong `[start, end)`. Hàm này cùng các truy vấn
  đọc dùng chung (dòng phiếu, số đã trả của dòng hóa đơn, Σ hoàn của đơn) đặt ở `services/return-rows.ts`, chỉ phụ thuộc schema,
  để `orders.ts` (getOrder, daySummary) và `returns.ts` không import vòng nhau.
- `cancelReturn(db, id, clock)`: đã hủy → 409; dòng `restock` có `productId` → movement `adjust` `−qty × factor`,
  note 'Hủy phiếu trả TH-…'; `debtReduced > 0` → `recordCustomerDebtTx({ amount: +debtReduced, kind: 'return_cancel' })`;
  cập nhật `status`, `cancelledAt`. Không kiểm tra tồn (cho âm như bán hàng).
- `exportReturnsXlsx(db, query, clock)`: sheet *Phiếu trả* (mã, ngày, hóa đơn, khách, tổng hoàn, trừ nợ, tiền mặt,
  trạng thái, ghi chú) và sheet *Dòng* (mã phiếu, tên, đơn vị, số lượng, tiền hoàn, nhập kho có/không).

### Sửa service có sẵn

- `getOrder`: mỗi `OrderItem` thêm `returnedQty` (Σ qty ở phiếu `done`); `OrderDetail` thêm `returns: ReturnSummaryRow[]`
  (mọi phiếu của đơn, kể cả đã hủy, mới nhất trước) và `customerDebt` (nợ **hiện tại** của khách, đơn không có khách thì `null`) để hộp lập phiếu tính phần trừ nợ.
- `listOrders` / `OrderSummary`: thêm `refunded` (Σ `refund` phiếu `done` của đơn). Xuất Excel hóa đơn thêm cột *Trả hàng* (cột *Đã trả* đã có, là tiền khách trả).
- `cancelOrder`: còn phiếu trả `done` → 409 như §3.
- `daySummary`: thêm `returns = returnSummary(start, end)`; các trường cũ giữ nguyên nghĩa (bán ra gộp).
- `profitReport`: thêm cột `returns` (tiền hoàn trong kỳ); `revenue`, `cost`, `cash`, `debt` thành số thuần (§7).
  Xuất Excel lãi lỗ thêm cột *Trả hàng* sau *Doanh thu*.
- `productReport`: bán chạy trừ phần trả trong kỳ theo `product_id`: `qty −= ri.qty × factor`,
  `revenue −= order_items.amount × ri.qty / order_items.qty` (cùng cơ sở trước giảm giá như cột hiện có),
  `cost −= ri.cost` chỉ khi `restock`. Món không có dòng bán trong kỳ thì không thêm vào bảng (chỉ trả mà không bán
  vẫn tính là ế như cũ).
- `debtReport`: `period` thêm `returnDebt` (Σ `debtReduced` phiếu `done` trong khoảng).

### Route `routes/returns.ts`

`POST /api/returns`, `GET /api/returns`, `GET /api/returns/export.xlsx`, `GET /api/returns/:id`,
`POST /api/returns/:id/cancel`. Validate bằng schema shared (`shared/src/schemas/return.ts`) rồi gọi service, như
`routes/orders.ts`.

## 7. Số thuần trong báo cáo

Với mỗi kỳ, gọi R là các phiếu trả `done` có `created_at` trong kỳ:

| Trường | Công thức |
|---|---|
| `returns` | Σ R.refund |
| `revenue` | Σ payable đơn `done` − Σ R.refund |
| `cost` | Σ qty × cost_price dòng bán − Σ R.items.cost có `restock` |
| `profit` | `revenue − cost` |
| `cash` | tiền mặt bán (như cũ) − Σ R.cashRefund |
| `transfer` | như cũ |
| `debt` | ghi nợ mới (như cũ) − Σ R.debtReduced |

Vẫn giữ `revenue = cash + transfer + debt`. Dòng tổng lấy từ `daySummary` (trừ `returns`) như hiện tại để khớp
trang Hóa đơn. Tổng quan dùng `profitReport` nên tự thành số thuần.

## 8. Client

- **API** `api/returns.ts`: `useReturns`, `useReturn`, `useCreateReturn`, `useCancelReturn`; mutation invalidate
  `['orders']`, `['returns']`, `['products']`, `['customers']`, `['reports']`.
- **Chi tiết hóa đơn** (`OrderDetailDialog`): dưới mỗi dòng có trả thì hiện "Đã trả 1 lốc"; khối *Phiếu trả* liệt kê
  phiếu của đơn (mã, ngày, tiền, nhãn *Đã hủy*), bấm mở `ReturnDetailDialog`. Nút **Trả hàng** (`Undo2`) chỉ hiện khi
  đơn `done` và còn món trả được. Còn phiếu `done` thì nút *Hủy hóa đơn* bị khóa, kèm dòng "Hủy các phiếu trả trước khi
  hủy hóa đơn".
- **ReturnDialog** (`pages/returns/ReturnDialog.tsx`): mỗi dòng có tên, "đã mua 3 · đã trả 1", ô số lượng (mặc định 0,
  tối đa phần còn lại, nhận số lẻ 3 chữ số cho hàng cân, nút +/− bước 1) và checkbox *Nhập lại kho* (ẩn với món ngoài); nút
  *Trả hết*; ô *Ghi chú*; cuối hộp *Tổng hoàn* và "Trừ nợ X · Trả tiền mặt Y" (tính bằng `return-math`, nợ khách lấy
  từ `OrderDetail.customerDebt`). Nút lưu khóa khi tổng số lượng bằng 0. Lưu xong toast "Đã lập TH-…" kèm nút *In phiếu*.
- **Trang Trả hàng** (`pages/returns/ReturnsPage.tsx`): `PageTitle` (số phiếu, nút *Xuất Excel*), `StatStrip` (Số phiếu ·
  Tổng hoàn · Hoàn tiền mặt · Trừ nợ), `FilterBar` + `useUrlFilters` (khoảng ngày `DateRangeFilter` mặc định hôm nay,
  tìm, trạng thái), `ListPanel` với bảng và `Pager`. Bấm dòng mở `ReturnDetailDialog`: dòng (ghi *không nhập kho* nếu có),
  hóa đơn gốc (bấm mở chi tiết hóa đơn), nút *In*, nút *Hủy phiếu* qua `ConfirmDialog` ("Tồn của món đã nhập kho bị
  trừ lại; nợ đã trừ của khách được cộng lại").
- **Trang Hóa đơn**: ô *Doanh thu* và *Tiền mặt* hiện `total − returns.refund` và `cash − returns.cash`; có trả hàng
  thì hint "Bán … · Trả …". Bảng hiện nhãn nhỏ *Có trả hàng* khi `refunded > 0`.
- **Báo cáo**: bảng lãi lỗ thêm cột *Trả hàng*; thẻ công nợ thêm dòng *Trừ nợ do trả hàng*.
- **In 80mm**: `PrintProvider` thêm loại `ReturnReceipt` như `DebtReceipt`: tiêu đề "PHIẾU TRẢ HÀNG", mã phiếu, ngày,
  "HĐ gốc HD-…", tên khách nếu có, các dòng (tên, số lượng × giá, tiền hoàn), *Tổng hoàn*, *Trừ nợ*, *Trả tiền mặt*;
  phiếu đã hủy in chữ "ĐÃ HỦY" như hóa đơn.
- **Sổ nợ khách** (`CustomerDetailDialog`): `return` → "Trả hàng", `return_cancel` → "Hủy phiếu trả".
- **NAV**: `{ to: '/returns', label: 'Trả hàng', icon: Undo2, group: 'sell' }` sau *Hóa đơn*.

## 9. Lỗi

| Tình huống | Mã | Thông báo |
|---|---|---|
| Hóa đơn / phiếu không tồn tại | 404 | "Không tìm thấy hóa đơn" / "Không tìm thấy phiếu trả" |
| Hóa đơn đã hủy | 409 | "Hóa đơn đã hủy, không trả hàng được" |
| Dòng không thuộc hóa đơn, trùng dòng, không có dòng | 400 | "Dòng trả hàng không hợp lệ" / "Chưa chọn món nào để trả" |
| Vượt số còn lại | 400 | "Số lượng trả vượt số còn lại của <tên món>" |
| Hủy phiếu đã hủy | 409 | "Phiếu trả đã hủy" |
| Hủy hóa đơn còn phiếu trả | 409 | "Hóa đơn đã có phiếu trả, hãy hủy phiếu trả trước" |

Client hiện lỗi bằng `toast.error(e.message)` như các hộp khác; hộp lập phiếu không đóng khi lỗi.

## 10. Kiểm thử

- `shared/return-math.test.ts`: phân bổ giảm giá (Σ = payable, dòng 0 đồng, `total = 0`); trả hai lần cộng lại = trả
  một lần; trả hết đúng `value`; hàng cân 0.3 + 0.2 kg; `splitRefund` khi nợ khách lớn hơn / nhỏ hơn / bằng 0 / âm.
- `server/src/services/returns.test.ts` (`createTestDb` + `Clock`): mã `TH` theo ngày; trả một phần và trả hết;
  vượt số còn lại, dòng lạ, trùng dòng; đơn đã hủy; movement chỉ cho dòng `restock` có sản phẩm, đúng `× factor`;
  đơn ghi nợ trừ nợ rồi phần dư tiền mặt; đơn tiền mặt / CK hoàn tiền mặt; hủy phiếu đưa tồn và nợ về như trước;
  hủy hai lần; `cancelOrder` bị chặn rồi hủy được sau khi hủy phiếu; `listReturns` lọc ngày / trạng thái / tìm;
  xuất `.xlsx` mở lại được.
- Sửa test có sẵn: `daySummary` có `returns`; `profitReport` số thuần và vẫn `revenue = cash + transfer + debt`, giá vốn
  chỉ trừ dòng nhập kho; `productReport` trừ phần trả; `debtReport.period.returnDebt`; phiếu trả hôm sau không đổi số
  hôm bán; nợ lâu không bị làm mới bởi phiếu trả.
- `server/src/db/migration-0004.test.ts`: DB ở `0003` có dữ liệu, chạy `0004`, dữ liệu cũ còn nguyên, bảng mới rỗng.
- Giao diện kiểm bằng skill `browser-verify` (chặn request ghi): hộp lập phiếu ở cỡ máy tính và điện thoại, trang
  Trả hàng, chi tiết hóa đơn có phiếu trả, phiếu in.

## 11. Phiên bản và tài liệu

`package.json` gốc lên `0.11.0`. README thêm mục *Trả hàng*. CLAUDE.md: thêm 0.11.0 vào "Đã xong"; bất biến thêm
"Trả hàng chỉ qua `services/returns.ts`, gắn hóa đơn `done`, tính vào ngày lập phiếu; hóa đơn còn phiếu trả không hủy
được"; mã chứng từ thêm `TH-YYYYMMDD-NNNN`; DB dev chạy tới `0004`.
