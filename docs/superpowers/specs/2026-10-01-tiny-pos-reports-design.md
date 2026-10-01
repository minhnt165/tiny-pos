# Tiny POS – Báo cáo (0.8.0)

Ngày: 2026-10-01

Nền tảng giữ nguyên như `2026-09-29-tiny-pos-phase1-design.md`; nghiệp vụ bán hàng, nhập hàng,
công nợ như spec giai đoạn 2–4; `PageTitle`, `ListPanel`, `StatStrip` như
`2026-09-30-tiny-pos-ui-refresh-design.md`; khoảng ngày trên URL (`rangeFields`, `resolveRange`,
`DateRangeFilter`) như `2026-09-30-tiny-pos-filters-design.md`; dựng file `.xlsx` (`addSheet`,
`XlsxColumn`, `sendXlsx`, `useExportAction`) như `2026-09-30-tiny-pos-excel-design.md`. Tài liệu này
chỉ mô tả phần thêm mới.

## 1. Mục tiêu

Chủ tiệm trả lời được ba câu hỏi mà không phải cộng tay từ danh sách hóa đơn:

1. "Tháng này lời bao nhiêu?" – doanh thu, giá vốn, lãi gộp theo ngày/tháng, tách tiền mặt, chuyển
   khoản, ghi nợ.
2. "Nên nhập gì, hàng nào ế?" – mặt hàng bán chạy, hàng không bán được, giá trị tồn kho.
3. "Tiền đang nằm ở đâu?" – tổng nợ khách, tổng nợ nhà cung cấp, ai nợ nhiều nhất.

Tiêu chí thành công:

- Trang *Báo cáo* mở ra là thấy số của **tháng này**; đổi khoảng ngày thì mọi thẻ đổi theo.
- Số Doanh thu / Tiền mặt / Chuyển khoản / Ghi nợ / Thu nợ trên thẻ *Lãi lỗ* **bằng đúng** số liệu
  trang *Hóa đơn* khi cùng khoảng ngày.
- Mỗi thẻ xuất được Excel đúng khoảng ngày đang xem, mở trong Excel cộng được.
- Không thêm thư viện ở client; không đổi schema.

## 2. Phạm vi

Trong phạm vi: trang `/reports` với bộ lọc khoảng ngày và ba thẻ *Lãi lỗ*, *Mặt hàng*, *Công nợ*;
ba API đọc; xuất Excel từng thẻ; mục menu; version 0.8.0.

Ngoài phạm vi: biểu đồ, chi phí ngoài giá vốn (điện, nước, thuê mặt bằng, lương), so sánh với kỳ
trước, báo cáo theo danh mục / theo giờ / theo khách, in báo cáo ra giấy, lưu báo cáo, thay đổi
schema/migration, trang Tổng quan thay trang chủ.

## 3. Quyết định đã chốt

| Vấn đề | Chọn | Lý do |
|---|---|---|
| Hình thức | Một trang *Báo cáo*, số liệu + bảng, không biểu đồ | Người dùng chọn; không thêm thư viện; dễ in/xuất; chủ tiệm đọc bảng quen hơn đọc đồ thị |
| Khoảng ngày mặc định | Tháng này (khác các trang chứng từ mặc định hôm nay) | Báo cáo nói về một kỳ; "hôm nay" đã có ở trang Hóa đơn |
| Hóa đơn đã hủy | Loại hẳn khỏi mọi con số | Hủy đơn đã ghi movement bù; đơn hủy không phải doanh thu |
| Giá vốn của đơn | Σ `qty × costPrice` của `order_items` (snapshot lúc bán) | Giá vốn hiện tại của sản phẩm có thể đã đổi; lãi phải theo lúc bán |
| Giảm giá | Trừ vào doanh thu của đơn (`total − discount`), không chia về từng dòng | Khớp "Phải trả" của hóa đơn; lãi từng mặt hàng chấp nhận chưa trừ giảm giá và ghi rõ |
| Tên gọi | "Lãi gộp", ghi chú "chưa trừ chi phí khác" | Không có chi phí ngoài giá vốn nên không gọi là lãi ròng |
| Gom theo ngày hay tháng | ≤ 31 ngày → theo ngày; dài hơn → theo tháng | Bảng 366 dòng không đọc được; chủ tiệm không cần chọn |
| Số liệu tồn kho và công nợ hiện tại | Tính tại thời điểm xem, không theo khoảng ngày | Không có snapshot tồn/nợ theo ngày; ghi rõ "hiện tại" trên UI |
| Nơi tính | Server, một API cho mỗi thẻ | Test được bằng vitest; client chỉ hiển thị; Excel dùng cùng số |
| Giới hạn bảng mặt hàng | 50 dòng trên màn hình; Excel đủ | Chủ tiệm chỉ cần top; file để soát kỹ |
| Vị trí menu | Nhóm *Bán hàng*, sau *Hóa đơn*; điện thoại vào qua *Thêm* | Gần Hóa đơn, thanh dưới đã đủ 4 mục |

## 4. Màn hình

Route `/reports`, tiêu đề "Báo cáo" qua `PageTitle`, nút "Xuất Excel" (`FileSpreadsheet`) trong
`actions` xuất **thẻ đang mở**; khi `pending` thì khóa, nhãn "Đang xuất…".

Dưới tiêu đề: `DateRangeFilter` (chọn mốc *Hôm nay / Hôm qua / 7 ngày / Tháng này / Tháng trước /
Tùy chọn…*) đặt trong `FilterBar`, chip khoảng ngày như trang Hóa đơn, không có ô tìm. URL:
`?from&to&tab&sort`. Thiếu `from`/`to` → tháng này (`datePresetRange('thisMonth', today)`); khoảng
sai → tháng này, không báo lỗi. `tab` ∈ `profit | products | debt`, mặc định `profit`.

Ba thẻ dùng `Tabs` của shadcn, nằm trên bảng, trên điện thoại kéo ngang được. Mỗi thẻ: `StatStrip`
rồi một hoặc hai `ListPanel`. Đang tải: `TableSkeleton`; không có dữ liệu: `EmptyState` "Chưa có
hóa đơn trong khoảng này".

### 4.1 Thẻ Lãi lỗ

`StatStrip` 4 cột: **Doanh thu**, **Giá vốn**, **Lãi gộp** (hint `x% doanh thu`, tone `success`
khi > 0, `danger` khi < 0), **Số đơn**. Dòng `StatStrip` thứ hai 4 cột: **Tiền mặt**, **Chuyển
khoản**, **Ghi nợ**, **Thu nợ** (hint `TM a · CK b`). Dưới dòng 2 một câu nhỏ: "Lãi gộp = doanh
thu − giá vốn lúc bán, chưa trừ chi phí khác."

Bảng theo kỳ (`ListPanel`): cột **Kỳ** (`dd/mm` hoặc `Tháng mm/yyyy`), **Số đơn**, **Doanh thu**,
**Giá vốn**, **Lãi**, **Tiền mặt**, **CK**, **Ghi nợ**. Kỳ không có đơn vẫn hiện một dòng số 0 (thấy
ngày nghỉ bán). Mới nhất ở trên. Dòng cuối "Tổng" in đậm. Trên điện thoại ẩn ba cột Tiền mặt / CK /
Ghi nợ (ba số đã có ở StatStrip).

### 4.2 Thẻ Mặt hàng

`StatStrip` 4 cột, nhãn có chữ "hiện tại": **Tồn kho theo giá vốn**, **Tồn kho theo giá bán**,
**Sắp hết** (số mặt hàng; bấm → `/products?stock=low`), **Hết hàng** (bấm → `/products?stock=out`).
Hai ô cuối là `Link` bọc `Stat`, tone `warning` / `danger` khi > 0.

`ListPanel` **Bán chạy** – toolbar có `ChoiceChips` "Xếp theo": *Doanh thu* (mặc định) / *Số
lượng* / *Lãi*, lưu `sort` trên URL. Cột: **Mặt hàng**, **Số lượng** (đơn vị gốc, kèm tên đơn vị),
**Doanh thu**, **Lãi**. Tối đa 50 dòng, có dòng tổng của **toàn bộ** (không chỉ 50 dòng). Chú thích
dưới bảng: "Lãi theo mặt hàng chưa trừ giảm giá của đơn."

`ListPanel` **Không bán được trong kỳ** – cột: **Mặt hàng**, **Tồn**, **Giá trị tồn** (giá vốn).
Tối đa 50 dòng, sắp theo giá trị tồn giảm dần; header ghi "(n mặt hàng)". Không có → "Mọi mặt hàng
còn tồn đều đã bán trong khoảng này".

### 4.3 Thẻ Công nợ

`StatStrip` 4 cột: **Khách đang nợ** (hint "n khách", hiện tại), **Mình nợ NCC** (hint "n nhà cung
cấp", hiện tại), **Ghi nợ trong kỳ**, **Thu nợ trong kỳ** (hint `TM a · CK b`).

Hai `ListPanel` cạnh nhau trên máy tính (grid 2 cột), xếp dọc trên điện thoại: **Khách nợ nhiều
nhất** (Tên, SĐT, Đang nợ) và **Mình nợ NCC nhiều nhất** (Tên, SĐT, Còn nợ), mỗi bảng 10 dòng,
bấm dòng → `/customers?q=<tên>` / `/suppliers?q=<tên>` (trang đó mở sẵn người đó). Không ai nợ →
`EmptyState` "Không ai đang nợ".

## 5. Công thức

Ký hiệu: *đơn* = hóa đơn `status = 'done'` có `createdAt` trong `[start, end)` của khoảng ngày
địa phương (`localDayRange`, như `orderFilter`).

### Lãi lỗ

| Số | Công thức |
|---|---|
| Doanh thu | Σ đơn (`total − discount`) |
| Giá vốn | Σ dòng của đơn (`qty × costPrice`) – `costPrice` của dòng đã quy theo đơn vị bán (xem `resolveLine`), **không** nhân `factor`; món ngoài có `costPrice = 0` |
| Lãi gộp | Doanh thu − Giá vốn |
| % lãi | Lãi gộp / Doanh thu × 100, làm tròn 1 chữ số; Doanh thu = 0 → không hiện |
| Số đơn | số đơn |
| Tiền mặt | Σ `payable` đơn `cash` + Σ `paid` đơn `debt` |
| Chuyển khoản | Σ `payable` đơn `transfer` |
| Ghi nợ | Σ (`payable − paid`) đơn `debt` |
| Thu nợ | −Σ `amount` của `debt_transactions` `kind = 'payment'` trong khoảng, tách theo `method` |

Bốn dòng cuối đúng bằng `summary` của `listOrders`: tách phần tính này trong `services/orders.ts`
thành hàm `daySummary(db, start, end)` dùng chung, `listOrders` gọi lại, hành vi không đổi.

Theo kỳ: mỗi đơn gán kỳ bằng `localDate(createdAt, tz)` (theo ngày) hoặc 7 ký tự đầu (theo
tháng); thu nợ gán kỳ cùng cách theo `createdAt` của bút toán. Danh sách kỳ sinh đủ từ `from` tới
`to` (ngày hoặc tháng) để kỳ trống vẫn có dòng. Theo ngày khi `spanDays(from, to) ≤ 31`.

Giá vốn tính bằng một câu SQL gom theo `order_id` (`sum(qty * cost_price)`) rồi ghép với đơn trong
JS; làm tròn `Math.round` từng đơn vì `qty` là số thực.

### Mặt hàng

- **Bán chạy**: gom dòng của đơn theo `productId` (null → một dòng "Món ngoài", `unit = 'cái'`).
  Số lượng = Σ `qty × factor` (đơn vị gốc). Doanh thu = Σ `amount`. Lãi = Σ (`amount − qty ×
  costPrice`). Tên lấy từ `products.name` hiện tại (đổi tên vẫn gom đúng), đơn vị từ `products.unit`.
  Sắp theo `sort`, giảm dần; hòa thì theo tên. `total` = Σ của mọi mặt hàng.
- **Không bán được**: `products.isActive = 1`, `stock > 0`, `id` không xuất hiện trong dòng của đơn
  trong khoảng. Giá trị tồn = `round(stock × costPrice)`.
- **Tồn kho hiện tại**: trên sản phẩm `isActive = 1` và `stock > 0`: theo giá vốn = Σ `round(stock ×
  costPrice)`, theo giá bán = Σ `round(stock × sellPrice)`. **Sắp hết** = `isActive` và `stock < minStock`;
  **Hết hàng** = `isActive` và `stock ≤ 0` – đúng định nghĩa `stock=low` / `stock=out` của `filterProducts`
  (trang Sản phẩm mặc định không hiện hàng ngừng bán), để bấm ô số sang trang Sản phẩm thấy đúng số dòng.

### Công nợ

- Khách đang nợ: Σ `max(0, debt)` của khách `isActive` (= `totalDebt` của `listCustomers`); n = số
  khách có `debt > 0`. NCC tương tự với `suppliers.debt`.
- Ghi nợ trong kỳ = Ghi nợ của Lãi lỗ; Thu nợ trong kỳ = Thu nợ của Lãi lỗ (cùng hàm `daySummary`).
- Top 10: khách/NCC `isActive`, `debt > 0`, sắp `debt` giảm dần rồi tên.

## 6. Shared

`shared/src/schemas/report.ts`:

```ts
export const REPORT_TABS = ['profit', 'products', 'debt'] as const;
export const PRODUCT_REPORT_SORTS = ['revenue', 'qty', 'profit'] as const;
export const reportRangeFields = { from: isoDate.optional(), to: isoDate.optional() };
export const reportQuerySchema = z.object(reportRangeFields).superRefine(rangeError…);
export const productReportQuerySchema = reportQuerySchema.extend({ sort: z.enum(PRODUCT_REPORT_SORTS).default('revenue') });
export const reportViewFields = { ...reportRangeFields, tab: z.enum(REPORT_TABS).default('profit'), sort: z.enum(PRODUCT_REPORT_SORTS).default('revenue') }; // URL trang
```

`rangeError` hiện là hàm nội bộ của `list-filters.ts` → export để dùng lại (`isoDate` đã export). Không có
`date` (chỉ `from`/`to`). Khoảng mặc định của báo cáo (**tháng này**) do server quyết định:
`resolveReportRange(q, today)` = `resolveRange(q, today)` nếu có `from` hoặc `to`, không thì
`datePresetRange('thisMonth', today)`; đặt trong `report.ts` để client dùng cùng một hàm.

`shared/src/types.ts` thêm:

```ts
export interface ReportRange { from: string; to: string; groupBy: 'day' | 'month' }
export interface ProfitRow { period: string; orders: number; revenue: number; cost: number; profit: number; cash: number; transfer: number; debt: number; debtCollected: { cash: number; transfer: number } }
export interface ProfitReport { range: ReportRange; total: ProfitRow; rows: ProfitRow[] } // rows mới nhất trước; total.period = ''
export interface ProductSalesRow { productId: number | null; name: string; unit: string; qty: number; revenue: number; profit: number }
export interface SlowProductRow { productId: number; name: string; unit: string; stock: number; value: number }
export interface ProductReport {
  range: ReportRange; sort: ProductReportSort;
  stock: { costValue: number; sellValue: number; lowCount: number; outCount: number };
  topSelling: ProductSalesRow[]; topSellingTotal: { qty: number; revenue: number; profit: number; count: number };
  slow: SlowProductRow[]; slowCount: number;
}
export interface DebtPartyRow { id: number; name: string; phone: string | null; debt: number }
export interface DebtReport {
  range: ReportRange;
  customers: { total: number; count: number; top: DebtPartyRow[] };
  suppliers: { total: number; count: number; top: DebtPartyRow[] };
  period: { debt: number; collected: { cash: number; transfer: number } };
}
```

`shared/src/local-date.ts` thêm `monthsBetween(from, to): string[]` ("YYYY-MM") và
`daysBetween(from, to): string[]` nếu chưa có; `formatMonthVn('2026-09') → 'Tháng 09/2026'`.

## 7. Server

### `services/reports.ts`

Ba hàm thuần đọc, nhận `db`, query đã validate, `clock?`:

- `profitReport(db, q: ReportQuery, clock?): ProfitReport`
- `productReport(db, q: ProductReportQuery, clock?): ProductReport` – `topSelling` cắt 50, `slow`
  cắt 50; hằng `REPORT_TOP_ROWS = 50` nội bộ, có tham số `limit` để test và để export lấy đủ.
- `debtReport(db, q: ReportQuery, clock?): DebtReport` – `REPORT_TOP_PARTIES = 10`.

Dùng chung `resolveClock`, `resolveReportRange`, `localDayRange`. `services/orders.ts` tách
`daySummary(db, start, end): DaySummary` (xem mục 5) và export để `reports.ts` dùng.

### `services/exports.ts`

Ba hàm mới, cùng `XlsxFile`; tên file `bao-cao-lai-lo-FROM-TO.xlsx`, `bao-cao-mat-hang-FROM-TO.xlsx`,
`bao-cao-cong-no-FROM-TO.xlsx` (dùng `rangeName`):

| File | Sheet | Cột |
|---|---|---|
| Lãi lỗ | Lãi lỗ | Kỳ (chữ `dd/mm/yyyy` hoặc `mm/yyyy`), Số đơn, Doanh thu, Giá vốn, Lãi gộp, Tiền mặt, Chuyển khoản, Ghi nợ, Thu nợ TM, Thu nợ CK; dòng cuối "Tổng" |
| Mặt hàng | Bán chạy | Mặt hàng, Đơn vị, Số lượng, Doanh thu, Lãi – **đủ** mặt hàng theo `sort` đang chọn |
| | Không bán được | Mặt hàng, Đơn vị, Tồn, Giá trị tồn – đủ |
| | Tồn kho | Chỉ tiêu, Giá trị (4 dòng: tồn theo giá vốn, theo giá bán, sắp hết, hết hàng) |
| Công nợ | Khách nợ | Tên, SĐT, Đang nợ – đủ khách `debt > 0`; dòng cuối "Tổng" |
| | Nợ NCC | Tên, SĐT, Còn nợ – đủ NCC `debt > 0`; dòng cuối "Tổng" |

Kỳ ghi chữ (không phải ô ngày) vì một ô có thể là tháng. Dòng "Tổng" là ngoại lệ so với quy ước
0.7.0 (file báo cáo không có chứng từ hủy nên tổng không gây hiểu nhầm).

### Route `routes/reports.ts`

| Route | Query | Trả |
|---|---|---|
| `GET /api/reports/profit` | `reportQuerySchema` | `ProfitReport` |
| `GET /api/reports/products` | `productReportQuerySchema` | `ProductReport` |
| `GET /api/reports/debt` | `reportQuerySchema` | `DebtReport` |
| `GET /api/reports/profit/export.xlsx` | `reportQuerySchema` | file |
| `GET /api/reports/products/export.xlsx` | `productReportQuerySchema` | file |
| `GET /api/reports/debt/export.xlsx` | `reportQuerySchema` | file |

Mount `r.use('/reports', reportsRouter(db))` trong `routes/index.ts`. Query sai → 400 thông báo
của schema (như các route danh sách). Khóa `tab` nếu client gửi kèm bị bỏ qua (schema `strip`).

## 8. Client

- `api/reports.ts`: `useProfitReport(range)`, `useProductReport(range, sort)`, `useDebtReport(range)`
  với `queryKey: ['reports', kind, params]`, `placeholderData: prev`. Các mutation bán/hủy/nhập/thu
  nợ hiện đang `invalidateQueries(['orders'])` … thêm `['reports']` vào `useInvalidateSales` và các
  hook invalidate của imports / customers / suppliers / stocktakes để số báo cáo tươi khi quay lại
  trang (tìm mọi chỗ gọi `invalidateQueries` liên quan chứng từ).
- `pages/reports/ReportsPage.tsx`: `useUrlFilters(reportViewFields)`; `range` qua
  `resolveReportRange` + `validRange`; `Tabs` đổi `tab` trên URL; `useExportAction(
  \`/reports/${tab}/export.xlsx\`)` – hook này nối `location.search` nên `from/to/sort` đi theo.
  Chỉ thẻ đang mở gọi API (3 component con mount theo `tab`).
- `pages/reports/ProfitTab.tsx`, `ProductsTab.tsx`, `DebtTab.tsx` như mục 4. Tiền qua `formatMoney`,
  số lượng qua hàm format số lượng đang dùng ở trang Sản phẩm.
- `router.tsx`: `NAV` thêm `{ to: '/reports', label: 'Báo cáo', icon: BarChart3, group: 'sell' }`
  sau *Hóa đơn*; `Route path="/reports"`.
- Không thêm thư viện.

## 9. Lỗi

| Tình huống | Server | Người dùng thấy |
|---|---|---|
| Khoảng ngày > 1 năm hoặc đảo (sửa URL tay) | 400 thông báo schema | Client đã tự về tháng này trước khi gọi, nên không xảy ra; nếu xảy ra → toast |
| `tab`/`sort` lạ trên URL | – | Client về mặc định |
| Không có hóa đơn trong khoảng | 200, số 0, `rows` đủ kỳ trống | StatStrip số 0, bảng kỳ toàn 0, bảng mặt hàng `EmptyState` |
| Xuất Excel lỗi mạng/400 | – | toast như 0.7.0 |

## 10. Kiểm thử

Vitest `server/src/services/reports.test.ts` (DB `:memory:`, `Clock` cố định, tz lệch UTC +7 để
bắt lỗi ngày):

- Lãi lỗ: 2 đơn `cash` (một có `discount`), 1 đơn `transfer`, 1 đơn `debt` trả trước một phần, 1 đơn
  hủy, 1 món ngoài, 1 dòng bán theo thùng (`factor` 24) → Doanh thu, Giá vốn, Lãi, Tiền mặt, CK, Ghi nợ
  đúng từng đồng; đơn hủy không tính; `summary` của `listOrders` cùng khoảng bằng các số tương ứng.
- Thu nợ trong kỳ tách TM/CK; bút toán ngoài khoảng không tính.
- Đơn lúc 23:30 giờ địa phương (= 16:30 UTC) rơi đúng ngày địa phương; đơn 00:30 ngày sau không lọt
  vào ngày trước.
- Khoảng 31 ngày → `groupBy = 'day'`, 31 dòng kể cả ngày trống; 32 ngày → `'month'`, đủ tháng kể cả
  tháng trống; `rows` mới nhất trước; `total` = Σ rows.
- Mặt hàng: bán 2 cái + 1 thùng 24 cùng sản phẩm → `qty = 26`; sắp theo `revenue`/`qty`/`profit` đúng;
  `topSellingTotal` gồm cả dòng ngoài `limit`; món ngoài gom một dòng `productId = null`; hàng ế loại
  hàng ngừng bán, hàng tồn 0, hàng đã bán trong khoảng; `stock.lowCount`/`outCount` khớp
  `filterProducts(..., { stock: 'low' | 'out' })` trên cùng dữ liệu.
- Công nợ: `customers.total` = `listCustomers().totalDebt`; khách `debt < 0` không tính và không vào
  top; khách đã xóa không tính; top sắp giảm dần, cắt 10; `period.debt`/`collected` bằng Lãi lỗ.
- Khoảng không có đơn → mọi số 0, không ném lỗi, `rows` vẫn đủ kỳ.

`server/src/services/exports.test.ts`: 3 file có đúng sheet/cột, dòng "Tổng" khớp report, sheet
Bán chạy nhiều hơn 50 dòng khi có > 50 mặt hàng.

`server/src/routes/api.test.ts`: 3 route JSON trả đúng hình; query sai → 400; 3 route export có
header `.xlsx`; thiếu `from`/`to` → `range` là tháng này theo `Clock`.

Trình duyệt (skill `browser-verify`, chặn request ghi), cỡ máy tính và điện thoại: mở `/reports` mặc
định tháng này; đổi mốc → số đổi; ba thẻ hiển thị, bảng không cuộn ngang trang; bấm ô *Sắp hết* sang
Sản phẩm với lọc đúng; bấm dòng khách nợ sang Khách hàng; nút Xuất Excel tải file từng thẻ; tải lại
trang giữ `tab`/`sort`/khoảng.

## 11. Phiên bản và tài liệu

- `package.json` gốc: `0.8.0`.
- `README.md`: thêm mục "Kiểm thử thủ công – Báo cáo 0.8.0" (các bước như phần trình duyệt ở trên).
- `CLAUDE.md`: thêm 0.8.0 vào dòng "Đã xong"; bất biến mới: *Báo cáo chỉ đọc, tính từ chứng từ
  `done` và snapshot giá vốn trên dòng hóa đơn; số tiền mặt / CK / ghi nợ / thu nợ dùng chung
  `daySummary` với trang Hóa đơn.*
