# Tiny POS – Giai đoạn 8: Trả hàng nhà cung cấp và in tem mã vạch (0.12.0)

Ngày: 2026-10-01

Nền tảng giữ nguyên như `2026-09-29-tiny-pos-phase1-design.md`; nhập hàng, nhà cung cấp, nợ NCC, lịch sử tồn như
`2026-09-29-tiny-pos-phase3-inventory-design.md`; `PageTitle`, `ListPanel`, `StatStrip`, `NAV` như
`2026-09-30-tiny-pos-ui-refresh-design.md`; `FilterBar`, `useUrlFilters`, `DateRangeFilter` như
`2026-09-30-tiny-pos-filters-design.md`; xuất `.xlsx` như `2026-09-30-tiny-pos-excel-design.md`; script cài và
`open.vbs` như `2026-10-01-tiny-pos-phase5-ops-design.md`; khuôn phiếu trả như `2026-10-01-tiny-pos-returns-design.md`.
Tài liệu này chỉ mô tả phần thêm mới.

## 1. Mục tiêu

Hai việc nhỏ cùng một đợt, đều quanh kho hàng:

1. **Trả hàng cho nhà cung cấp.** Hàng hết hạn, móp, lỗi trả lại cho NCC. Hiện không có chứng từ nào: chủ tiệm
   phải kiểm kê lệch rồi tự sửa nợ, nên tồn và nợ NCC sai mà không để lại dấu vết.
2. **In tem mã vạch.** Hàng tự đóng gói, hàng không có mã, đơn vị thùng/lốc không có mã riêng thì không quét được ở
   quầy. In tem ra máy in decal riêng (không phải máy in hóa đơn 80mm).

Tiêu chí thành công:

- Lập phiếu trả NCC trong một màn hình giống phiếu nhập; tồn trừ đúng theo đơn vị gốc, nợ NCC trừ trước, phần dư
  ghi là NCC trả tiền mặt; tồn và nợ chỉ đổi qua `recordMovement` / `recordSupplierTx`, cùng transaction với phiếu.
- Phiếu lập nhầm hủy được, tồn và nợ NCC trở lại như trước khi lập.
- Sản phẩm/đơn vị chưa có mã vạch được cấp mã nội bộ khi in tem; quét tem đó ở quầy bán được như hàng thường.
- Tem ra máy in tem; hóa đơn vẫn in thẳng ra máy hóa đơn không hỏi như hiện tại.

## 2. Phạm vi

Trong phạm vi: bảng `supplier_returns` + `supplier_return_items` (migration `0005`); `shared/supplier-return-math.ts`,
`shared/ean.ts`; service `services/supplier-returns.ts` (lập, xem, danh sách lọc, hủy, xuất `.xlsx`) và
`services/labels.ts` (cấp mã, mở cửa sổ in tem); route `/api/supplier-returns`, `/api/labels`; loại movement
`supplier_return`; cài đặt tem; trang `/supplier-returns`, `/supplier-returns/new`, `/labels`, `/labels/print`;
nút *Trả hàng* ở chi tiết NCC, *In tem* ở bảng Sản phẩm và chi tiết phiếu nhập; phiếu in 80mm; version 0.12.0;
README; CLAUDE.md.

Ngoài phạm vi: gắn phiếu trả vào phiếu nhập, chặn trả quá số đã nhập, NCC đổi hàng mới trong một bước (trả xong
thì lập phiếu nhập), NCC trả bằng chuyển khoản, trả cho NCC đã ngừng hoạt động, ảnh hưởng tới lãi lỗ, tem cân điện tử
(mã có nhúng khối lượng/giá), in tem bằng lệnh máy (TSPL/ZPL), tự thiết kế bố cục tem, in tem từ điện thoại ra máy
in của điện thoại, ô trên thanh dưới điện thoại.

## 3. Quyết định đã chốt

| Vấn đề | Chọn | Lý do |
|---|---|---|
| Gắn phiếu nhập | **Không** gắn; chọn NCC rồi thêm dòng sản phẩm như phiếu nhập | Hàng hết hạn lẫn nhiều lần nhập, chủ tiệm không nhớ thuộc phiếu nào; phiếu nhập không bị ràng buộc khi hủy |
| Giá trả | Mặc định `costPrice × factor` (giá nhập gần nhất theo đơn vị đã chọn), sửa được từng dòng | NCC có thể nhận lại giá thấp hơn; không có giá nhập theo từng lô để lấy |
| Giá vốn sau khi trả | **Không đổi** | Trả hàng không phải lần nhập; bất biến "giá vốn = giá nhập lần gần nhất" giữ nguyên |
| Cách NCC bù | Trừ nợ trước, tối đa bằng nợ hiện tại (nếu > 0); phần dư là NCC trả tiền mặt | Người dùng chọn; không thêm bước, giống trả hàng khách 0.11.0 |
| Trả quá tồn | Cảnh báo, **không chặn** | Tồn có thể đang sai; bán hàng cũng cho âm |
| NCC ngừng hoạt động | Không lập được ("Nhà cung cấp không còn hoạt động") | Giống phiếu nhập; bật lại NCC nếu cần |
| Tiền mặt NCC trả | Chỉ hiện ở phiếu và trang Trả NCC; **không** cộng vào tiền mặt ở trang Hóa đơn / Báo cáo | Tiền trả NCC khi nhập cũng không trừ ở đó; `daySummary` là số bán hàng |
| Lãi lỗ | Không đổi | Báo cáo tính từ hóa đơn bán và snapshot giá vốn trên dòng hóa đơn |
| Mã phiếu | `TN-YYYYMMDD-NNNN` | Theo khuôn `nextDailyCode`; `TH` đã là trả hàng khách |
| Hủy phiếu | Movement bù `adjust`, bút toán bù `+debtReduced`; phiếu giữ lại, *Đã hủy* | Bất biến "chứng từ không sửa, chỉ hủy" |
| Giấy tem | Máy in decal riêng; khổ chọn trong Cài đặt: `40×30` (mặc định), `50×30`, `35×22` 2 tem/hàng | Người dùng chọn |
| Đưa tem ra đúng máy | Server mở **cửa sổ trình duyệt thứ hai** với hồ sơ riêng `data/label-browser`, không `--kiosk-printing` | `open.vbs` mở app với `--kiosk-printing` nên mọi lệnh in đi thẳng máy mặc định (máy hóa đơn); hồ sơ riêng hiện hộp in và nhớ máy tem đã chọn |
| Mã cho hàng chưa có mã | Tự cấp EAN-13 `20` + 10 số thứ tự + số kiểm tra, **ghi vào** sản phẩm/đơn vị khi in | Dải `20–29` dành cho dùng nội bộ, không trùng mã nhà sản xuất; quét ở quầy không cần đổi gì |
| Vị trí trang | *Trả NCC* (`PackageMinus`) và *In tem* (`Tag`) trong nhóm *Kho*, sau *Nhập hàng* | Cùng chỗ với nhập hàng; thanh dưới chỉ 4 ô |

## 4. Dữ liệu

Migration `0005` chỉ **thêm bảng**, nên khôi phục bản sao trước 0.12.0 vẫn chạy (`copyTables` để trống bảng mới).

```ts
supplier_returns: {
  id, code (unique, 'TN-20261001-0001'),
  supplierId → suppliers.id (not null),
  supplierName text   // snapshot tên NCC lúc lập
  total integer       // Σ supplier_return_items.amount
  debtReduced integer // phần trừ vào nợ NCC (≥ 0)
  cashReceived integer // phần NCC trả tiền mặt = total − debtReduced
  note text null,
  status 'done' | 'cancelled' (default 'done'),
  createdAt, cancelledAt null,
}  index (created_at), index (supplier_id)

supplier_return_items: {
  id, returnId → supplier_returns.id (on delete cascade),
  productId → products.id (not null),
  productName text, unitName text,  // snapshot
  factor real          // hệ số đơn vị đã chọn
  qty real             // theo đơn vị đã chọn, > 0
  unitPrice integer    // giá trả 1 đơn vị đã chọn
  amount integer       // round(qty × unitPrice)
}  index (return_id)
```

- `stock_movements.type` thêm `'supplier_return'` (âm). Cột là `text` enum không có CHECK nên không cần migration
  cho cột này; `MovementType` ở `shared/types.ts` thêm giá trị mới.
- `supplier_transactions` không thêm cột: bút toán trả NCC có `importId = null`, note `Trả NCC TN-…`; bút toán bù khi
  hủy có note `Hủy phiếu trả NCC TN-…`.
- `nextDailyCode` nhận thêm bảng `'supplier_returns'`. `CODE_IN_NOTE` (`services/movements.ts`) thêm tiền tố `TN`.
- Cài đặt (`settings` key/value, không cần migration): `labelSize` `'40x30' | '50x30' | '35x22x2'` (mặc định
  `'40x30'`), `labelShowPrice` boolean (mặc định `true`). `getSettings` đổi chuỗi `'1'/'0'` sang boolean cho
  `labelShowPrice` như đang làm với `autoPrint`.

## 5. Hàm thuần ở `shared/`

- `supplier-return-math.ts`:
  - `lineAmount(qty, unitPrice)` = `round(qty × unitPrice)`.
  - `splitSupplierRefund(total, supplierDebt)`: `debtReduced = min(total, max(supplierDebt, 0))`,
    `cashReceived = total − debtReduced`.
- `ean.ts`:
  - `eanCheckDigit(digits12)`: số kiểm tra EAN-13 (trọng số 1/3 từ trái).
  - `isValidEan13(code)`, `isValidEan8(code)`.
  - `internalEan13(seq)`: `'20' + seq` đệm 10 chữ số + số kiểm tra; `seq` từ 1 tới 9 999 999 999.
  - `barcodeFormat(code)`: `'EAN13'` nếu `isValidEan13`, `'EAN8'` nếu `isValidEan8`, còn lại `'CODE128'`.

Server luôn tính lại tiền, không tin số client gửi; client dùng cùng hàm để hiện số trước khi lưu.

## 6. Server

### `services/supplier-returns.ts`

- `createSupplierReturn(db, input, clock)`, trong một transaction:
  1. NCC phải tồn tại và đang hoạt động (400 "Nhà cung cấp không còn hoạt động").
  2. Mỗi dòng `{ productId, unitId | null, qty, unitPrice }`: sản phẩm phải tồn tại (kể cả ngừng bán); `unitId` phải
     thuộc sản phẩm (400 "Đơn vị không hợp lệ"); lấy `unitName`, `factor` (đơn vị gốc: tên `products.unit`,
     `factor = 1`). `qty > 0`, `0 ≤ unitPrice ≤ MAX_MONEY` (zod). Không có dòng → 400 "Chưa chọn món nào để trả".
     Cùng sản phẩm + đơn vị nhiều dòng thì cho phép (như phiếu nhập).
  3. `total = Σ lineAmount`; `total > MAX_MONEY` → 400. Nợ NCC đọc trong transaction rồi `splitSupplierRefund`.
  4. `nextDailyCode(tx, 'supplier_returns', 'TN', ngày địa phương, 4)`, chèn phiếu + dòng.
  5. Mỗi dòng: `recordMovement({ qty: −qty × factor, type: 'supplier_return', refId: returnId, note: 'Trả NCC TN-…' })`.
     Không kiểm tra tồn.
  6. `debtReduced > 0`: `recordSupplierTx({ amount: −debtReduced, importId: null, note: 'Trả NCC TN-…' })`.
- `getSupplierReturn(db, id)`: phiếu + dòng + tên NCC hiện tại.
- `listSupplierReturns(db, query, clock)`: lọc khoảng ngày (mặc định hôm nay), `supplierId`, `status[]`, `q` (bỏ dấu,
  LIKE trên mã phiếu và tên món), phân trang; kèm `summary` `{ count, total, debt, cash }` của phiếu `done` trong khoảng
  ngày (không theo lọc khác, giống phiếu nhập).
- `cancelSupplierReturn(db, id, clock)`: đã hủy → 409 "Phiếu trả NCC đã hủy"; mỗi dòng movement `adjust`
  `+qty × factor`, note 'Hủy phiếu trả NCC TN-…'; `debtReduced > 0` → `recordSupplierTx({ amount: +debtReduced })`;
  cập nhật `status`, `cancelledAt`. NCC đã ngừng hoạt động vẫn hủy được.
- `exportSupplierReturnsXlsx(db, query, clock)`: sheet *Phiếu trả NCC* (mã, ngày, NCC, tổng, trừ nợ, NCC trả tiền mặt,
  trạng thái, ghi chú) và sheet *Dòng* (mã phiếu, tên, đơn vị, số lượng, giá trả, thành tiền), qua `exports.build`.

### `services/labels.ts`

- `assignBarcodes(tx, items)`: với mỗi `{ productId, unitId | null }` chưa có mã (sản phẩm: `products.barcode`; đơn vị:
  `product_units.barcode`), cấp `internalEan13(seq)` với `seq` = số thứ tự lớn nhất trong các mã khớp `^20\d{11}$` ở cả
  `products` và `product_units`, cộng 1, tăng dần trong lần gọi. Kiểm `assertBarcodeFree` trước khi ghi (mã đã bị chiếm
  thì tăng `seq` tiếp). Không bao giờ ghi đè mã đã có. Sản phẩm/đơn vị không tồn tại → 400 "Sản phẩm không hợp lệ".
- `printLabels(db, input, opener)`: trong transaction gọi `assignBarcodes`, rồi dựng
  `url = <gốc client>/labels/print?i=<productId>.<unitId|0>x<copies>,…`; gọi `opener(url)` ngoài transaction và
  trả `{ opened, url }`. Tổng số tem 1–500 mỗi lần (zod).
- `opener` truyền vào khi tạo app (`createApp(db, { openLabelWindow })`), để test không bật trình duyệt:
  - `index.ts` chỉ gắn opener thật khi `process.platform === 'win32'` **và** server chạy bản build (`server/dist`);
    `tsx watch` (dev) dùng opener trả `false`.
  - Opener thật tìm trình duyệt theo đúng thứ tự trong `open.vbs` (Chrome ở `%ProgramFiles%`, `%ProgramFiles(x86)%`,
    `%LocalAppData%`, rồi Edge); không có → `false`. Có thì `spawn(browser, ['--app=' + url,
    '--user-data-dir=' + <data>/label-browser, '--no-first-run'], { detached: true, stdio: 'ignore' }).unref()` →
    `true`.
  - Gốc client: `http://localhost:<PORT>`.

### Route

- `routes/supplier-returns.ts`: `POST /api/supplier-returns`, `GET /api/supplier-returns`,
  `GET /api/supplier-returns/export.xlsx`, `GET /api/supplier-returns/:id`, `POST /api/supplier-returns/:id/cancel`.
  Schema ở `shared/src/schemas/supplier-return.ts`.
- `routes/labels.ts`: `POST /api/labels/print` body `{ items: [{ productId, unitId | null, copies }] }`
  (schema `shared/src/schemas/label.ts`).
- Trang in tem đọc dữ liệu qua API sản phẩm có sẵn (`GET /api/products/:id` trả `ProductWithUnits`, mỗi sản phẩm khác
  nhau một lần gọi), không thêm route đọc.

## 7. Client

- **API** `api/supplier-returns.ts`: `useSupplierReturns`, `useSupplierReturn`, `useCreateSupplierReturn`,
  `useCancelSupplierReturn`; mutation invalidate `['supplier-returns']`, `['products']`, `['suppliers']`,
  `['reports']`, `['overview']`. `api/labels.ts`: `usePrintLabels` (invalidate `['products']` vì có thể vừa cấp mã).
- **NAV**: `{ to: '/supplier-returns', label: 'Trả NCC', icon: PackageMinus, group: 'stock' }` và
  `{ to: '/labels', label: 'In tem', icon: Tag, group: 'stock' }`, cả hai ngay sau *Nhập hàng*.
- **Lập phiếu trả NCC** (`pages/supplier-returns/SupplierReturnFormPage.tsx`, route `/supplier-returns/new`,
  `?supplierId=` chọn sẵn NCC):
  - Dùng lại `SupplierPicker`, ô quét/tìm sản phẩm, và phần khung bảng dòng của phiếu nhập (tách phần dùng chung từ
    `ImportLinesTable`/`ImportLineRow` ra component chung, chỉ đúng phần cần; màn nhập hàng giữ nguyên hành vi).
  - Cột: sản phẩm · đơn vị · số lượng · giá trả (mặc định `costPrice × factor`, đổi đơn vị thì tính lại) · thành tiền.
  - Số lượng vượt tồn (quy về đơn vị gốc) → dòng chữ màu `warning` "Tồn hiện có 5 lon"; vẫn lưu được.
  - Chân phiếu: *Tổng trả*, "Trừ nợ X · NCC trả tiền mặt Y" (tính bằng `splitSupplierRefund` với nợ NCC hiện tại), ô
    *Ghi chú*. Nút lưu khóa khi chưa chọn NCC hoặc chưa có dòng.
  - Nháp lưu trên máy (localStorage, try/catch) theo khuôn `useImportDraft`, xóa khi lưu xong.
  - Lưu xong: toast "Đã lập TN-…" kèm nút *In phiếu*, về trang danh sách.
- **Trang Trả NCC** (`pages/supplier-returns/SupplierReturnsPage.tsx`): `PageTitle` (số phiếu, *Lập phiếu trả*,
  *Xuất Excel*), `StatStrip` (Số phiếu · Tổng trả · Trừ nợ · NCC trả tiền mặt), `FilterBar` + `useUrlFilters` (khoảng
  ngày `DateRangeFilter` mặc định hôm nay, NCC, trạng thái, tìm), `ListPanel` + `Pager`. Bấm dòng mở
  `SupplierReturnDetailDialog`: các dòng, nút *In*, nút *Hủy phiếu* qua `ConfirmDialog` ("Tồn được cộng lại; nợ đã trừ
  của NCC được cộng lại").
- **Chi tiết NCC** (`SupplierDetailDialog`): nút **Trả hàng** (`PackageMinus`) mở `/supplier-returns/new?supplierId=`;
  ẩn khi NCC ngừng hoạt động.
- **Lịch sử tồn** (`StockHistoryDialog`): `TYPE_LABEL.supplier_return = 'Trả NCC'`.
- **In 80mm**: `PrintProvider` thêm `SupplierReturnReceipt`: tiêu đề "PHIẾU TRẢ HÀNG NHÀ CUNG CẤP", mã, ngày, tên NCC,
  dòng (tên, số lượng × giá, thành tiền), *Tổng*, *Trừ nợ*, *NCC trả tiền mặt*, ghi chú, hai chỗ ký "Bên giao" /
  "Bên nhận"; phiếu đã hủy in "ĐÃ HỦY".
- **Cài đặt**: thẻ *Tem mã vạch* (`SelectField` khổ tem, `Switch` *In giá trên tem*, nút *In thử 1 tem* in tem của sản
  phẩm đầu tiên có mã, không có sản phẩm nào thì nút khóa).
- **Trang In tem** (`pages/labels/LabelsPage.tsx`, route `/labels`): `PageTitle` (nút **In N tem**), ô quét/tìm sản
  phẩm thêm dòng; mỗi dòng: tên, chọn đơn vị (`SelectField`), mã hiện có hoặc nhãn "Sẽ cấp mã mới", ô số tem (1–500),
  nút xóa dòng. Thêm lại cùng sản phẩm + đơn vị thì cộng số tem. Danh sách giữ trong state của trang.
  - Vào từ chỗ khác qua `?add=<productId>.<unitId|0>x<copies>,…` (cùng định dạng với `i` của trang in).
  - Bấm in: `usePrintLabels`; `opened = true` → toast "Đã mở cửa sổ in tem trên máy quầy"; `opened = false` →
    `window.open(url)`.
- **Lối tắt**: bảng/thẻ Sản phẩm thêm thao tác *In tem* (`/labels?add=<id>.0x1`); chi tiết phiếu nhập
  (`ImportDetailDialog`) thêm nút *In tem* với mỗi dòng `productId.0x<round(qty × factor)>`, hàng cân thì 1 tem.
- **Trang in** (`pages/labels/LabelPrintPage.tsx`, route `/labels/print` ngoài `AppShell`):
  - Đọc `i`, lấy sản phẩm qua API, đọc cài đặt khổ tem và *In giá*.
  - Mỗi tem: tên hàng (tối đa 2 dòng, cắt bằng ellipsis), giá bán `formatMoney` + "/đơn vị" (hàng cân "/kg"; tắt
    *In giá* thì ẩn), mã vạch SVG bằng `jsbarcode` theo `barcodeFormat`, dãy số dưới mã.
  - CSS: `@page label { size: <rộng>mm <cao>mm; margin: 0 }`, phần tử tem `page: label`, mỗi tem (hoặc mỗi hàng 2 tem
    với `35x22x2`, khổ trang `72mm 22mm`) một trang; không đụng `@page` 80mm của hóa đơn.
  - Vẽ xong tự `window.print()`; `afterprint` → `window.close()`. Trên màn hình hiện xem trước và nút *In lại*.
- Thêm phụ thuộc `jsbarcode` cho `client` (bản có sẵn kiểu TypeScript hoặc `@types/jsbarcode`).

## 8. Lỗi

| Tình huống | Mã | Thông báo |
|---|---|---|
| Phiếu không tồn tại | 404 | "Không tìm thấy phiếu trả NCC" |
| NCC không tồn tại / ngừng hoạt động | 400 | "Nhà cung cấp không còn hoạt động" |
| Không có dòng | 400 | "Chưa chọn món nào để trả" |
| Sản phẩm / đơn vị lạ | 400 | "Sản phẩm không hợp lệ" / "Đơn vị không hợp lệ" |
| Tổng vượt `MAX_MONEY` | 400 | "Tổng tiền vượt giới hạn" |
| Hủy phiếu đã hủy | 409 | "Phiếu trả NCC đã hủy" |
| In tem: sản phẩm / đơn vị lạ | 400 | "Sản phẩm không hợp lệ" |
| In tem: hết dải mã nội bộ | 409 | "Đã hết mã nội bộ để cấp" |

Client hiện lỗi bằng `toast.error(e.message)`; màn lập phiếu giữ nguyên dữ liệu khi lỗi.

## 9. Kiểm thử

- `shared/ean.test.ts`: số kiểm tra với mã EAN-13 thật đã biết; `internalEan13(1)` = `2000000000015`… hợp lệ;
  `barcodeFormat` cho EAN-13, EAN-8, chuỗi chữ.
- `shared/supplier-return-math.test.ts`: `splitSupplierRefund` khi nợ lớn hơn / nhỏ hơn / bằng 0 / âm; hàng cân
  `lineAmount(0.35, 120000)`.
- `server/src/services/supplier-returns.test.ts` (`createTestDb` + `Clock`): mã `TN` theo ngày; movement `−qty × factor`
  loại `supplier_return` cho từng dòng, kể cả sản phẩm ngừng bán; trả quá tồn vẫn lưu (tồn âm); trừ nợ rồi phần dư tiền
  mặt; NCC nợ 0 → toàn bộ tiền mặt; giá vốn sản phẩm không đổi; NCC ngừng hoạt động bị từ chối; đơn vị không thuộc sản
  phẩm; hủy đưa tồn và nợ về như trước; hủy hai lần; `listSupplierReturns` lọc ngày / NCC / trạng thái / tìm; xuất
  `.xlsx` mở lại được; lịch sử tồn có `refCode` `TN-…`.
- `server/src/services/labels.test.ts`: cấp mã liên tiếp cho sản phẩm và đơn vị chưa có mã; bỏ qua mã đã có; nối tiếp
  sau mã `20…` lớn nhất đang có; bỏ qua mã `20…` không đủ 13 số; `findProductByBarcode` ra đúng sản phẩm/đơn vị vừa cấp;
  `printLabels` gọi opener với đúng `url` và trả `opened` theo opener.
- `server/src/db/migration-0005.test.ts`: DB ở `0004` có dữ liệu, chạy `0005`, dữ liệu cũ còn nguyên, bảng mới rỗng.
- Giao diện kiểm bằng skill `browser-verify` (chặn request ghi): màn lập phiếu ở cỡ máy tính và điện thoại, trang Trả
  NCC, phiếu in, trang In tem, trang in tem với từng khổ (chụp màn hình bản xem trước), thẻ Cài đặt.
- Kiểm bằng tay trên máy quầy (ghi vào README mục cài đặt máy tem): lần đầu chọn máy tem trong hộp in, lần sau hộp in
  nhớ máy tem; in hóa đơn vẫn ra máy hóa đơn không hỏi.

## 10. Phiên bản và tài liệu

`package.json` gốc lên `0.12.0`. README thêm mục *Trả hàng nhà cung cấp* và *In tem mã vạch* (chọn khổ, lần đầu chọn
máy tem). CLAUDE.md: thêm 0.12.0 vào "Đã xong"; bất biến thêm "Trả NCC chỉ qua `services/supplier-returns.ts`, không
gắn phiếu nhập, không đổi giá vốn" và "Mã nội bộ `20…` chỉ cấp qua `services/labels.ts`, không ghi đè mã đã có"; mã
chứng từ thêm `TN-YYYYMMDD-NNNN`; DB dev chạy tới `0005`.
