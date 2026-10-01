# Tiny POS – Giai đoạn 6: Trang Tổng quan và cảnh báo (0.10.0)

Ngày: 2026-10-01

Nền tảng giữ nguyên như `2026-09-29-tiny-pos-phase1-design.md`; nghiệp vụ bán hàng, nhập hàng,
kiểm kê, công nợ như spec giai đoạn 2–4; `PageTitle`, `ListPanel`, `StatStrip`, `NAV` như
`2026-09-30-tiny-pos-ui-refresh-design.md`; công thức lãi lỗ, quy tắc tồn thấp và `daySummary`
như `2026-10-01-tiny-pos-reports-design.md`; `BackupService.status()` như
`2026-10-01-tiny-pos-phase5-ops-design.md`. Tài liệu này chỉ mô tả phần thêm mới.

## 1. Mục tiêu

Chủ tiệm mở điện thoại (hoặc máy quầy) là thấy ngay tình hình hôm nay và việc cần làm, không phải
đi qua từng trang:

1. "Hôm nay bán được bao nhiêu, lời bao nhiêu, tiền đang ở dạng nào?" – số liệu hôm nay và 7 ngày gần
   đây, dùng đúng công thức báo cáo Lãi lỗ.
2. "Có gì cần lo không?" – hàng sắp hết, khách nợ lâu không trả, nợ nhà cung cấp, kiểm kê đang dở,
   sao lưu lỗi.
3. "Quầy đang bán gì?" – vài hóa đơn mới nhất.

Tiêu chí thành công:

- Trang *Tổng quan* tải xong bằng **một** request; số Doanh thu / Tiền mặt / CK / Ghi nợ / Thu nợ
  hôm nay **bằng đúng** trang *Hóa đơn* hôm nay và thẻ *Lãi lỗ* của *Báo cáo* với khoảng hôm nay.
- Số *Sắp hết* bấm sang Sản phẩm thấy đúng số dòng; danh sách khách nợ / NCC khớp trang Báo cáo.
- Mọi cảnh báo đều có nút sang trang xử lý. Không có gì cần lo thì trang nói rõ "ổn", không trống.
- Không thêm thư viện; không đổi schema, không migration.

## 2. Phạm vi

Trong phạm vi: service `overview.ts` + API `GET /api/overview`; trang `/overview` với các khối: hôm
nay, 7 ngày gần đây, hóa đơn gần nhất, hàng sắp hết, khách nợ (có cờ nợ lâu), nợ NCC, kiểm kê đang
dở, sao lưu; mục menu đầu nhóm *Bán hàng* và ô trên thanh dưới điện thoại; version 0.10.0; README;
CLAUDE.md.

Ngoài phạm vi: biểu đồ, chọn khoảng ngày trên Tổng quan (đã có ở Báo cáo), chỉnh ngưỡng nợ lâu /
tồn thấp trong Cài đặt, nhắc nợ qua SMS/Zalo, thông báo đẩy, xuất Excel từ Tổng quan, đổi đường dẫn
gốc, mục tiêu doanh thu, đăng nhập.

## 3. Quyết định đã chốt

| Vấn đề | Chọn | Lý do |
|---|---|---|
| Vị trí | Mục đầu nhóm *Bán hàng*; **đường dẫn gốc vẫn vào Bán hàng** | Biểu tượng Desktop mở đường dẫn gốc: máy quầy mở app là bán ngay như cũ; Tổng quan chủ yếu xem trên điện thoại |
| Thanh dưới điện thoại | *Tổng quan*, *Bán hàng*, *Hóa đơn*, *Sản phẩm*; *Kiểm kê* chuyển vào nút *Thêm* | Thanh chỉ có 4 ô; kiểm kê làm vài lần một tháng |
| Nguồn số liệu | Một API `GET /api/overview` gom hết, service dùng lại `profitReport`, `daySummary`, quy tắc tồn thấp, nợ | Một request trên điện thoại; mọi số cùng một thời điểm; test bằng `createTestDb` + `Clock`; "nợ lâu" cần cột ngày giao dịch gần nhất, client không tự tính được |
| Khoảng của khối 7 ngày | `last7` của `datePresetRange` (hôm nay và 6 ngày trước), gom theo ngày | Dùng lại `profitReport`; hôm nay là dòng đầu, hôm qua dòng thứ hai nên không cần API riêng cho "hôm nay" |
| Nợ lâu | Khách `debt > 0` và giao dịch sổ nợ gần nhất (`max(created_at)` của `debt_transactions`) cách hôm nay **≥ 30 ngày** (`DEBT_OVERDUE_DAYS`, hằng số ở shared); khách chưa có giao dịch nào mà vẫn nợ (không xảy ra vì nợ chỉ sinh qua bút toán) coi là lâu | Người dùng chọn ngưỡng cố định; "giao dịch gần nhất" đã có sẵn trong `listCustomers` (`lastActivityAt`), không cần phân biệt ghi nợ hay trả nợ |
| Số dòng mỗi khối | Hóa đơn 5, hàng sắp hết 10, khách nợ 5, NCC 5; mỗi khối ghi tổng số và nút "Xem tất cả" | Trang nhìn một màn điện thoại là hết; chi tiết ở trang riêng |
| Hóa đơn gần nhất | 5 đơn mới nhất **hôm nay**, kể cả đơn hủy (gạch ngang, nhãn *Đã hủy*) | Chủ tiệm cần thấy quầy vừa hủy đơn |
| Hàng sắp hết | `isActive` và `stock < minStock` (= `stock=low` của trang Sản phẩm); hết hàng `stock ≤ 0` đếm riêng; danh sách sắp theo `stock / minStock` tăng dần rồi tên | Cùng định nghĩa với Báo cáo 0.8.0 và bộ lọc 0.6.0 nên bấm sang là khớp số |
| Sao lưu | Route lấy từ `BackupService.status()`; không có service (test, `createApp` không truyền) thì `backup: null` và client ẩn khối | Service sao lưu là phụ thuộc tùy chọn của `apiRouter`; không ép service tổng quan biết thư mục sao lưu |
| Tự làm mới | `refetchInterval` 60 giây khi tab đang mở (TanStack mặc định không refetch khi ẩn), `placeholderData: prev` | Chủ tiệm để điện thoại mở bên cạnh; không cần WebSocket |
| Khóa query | `['reports', 'overview']` | Mọi mutation bán / hủy / nhập / thu nợ / kiểm kê đã invalidate `['reports']`, không phải sửa hook nào |

## 4. Màn hình

Route `/overview`, tiêu đề "Tổng quan" qua `PageTitle`, chip là ngày hôm nay dạng `formatDateVn`;
`actions` có một nút *Làm mới* (`RefreshCw`, gọi `refetch`; khi `isFetching` nhãn thành "Đang tải…" và khóa nút, vì `PageAction` không nhận class để xoay icon). Trên máy tính
nội dung xếp lưới 2 cột (`grid lg:grid-cols-2`), điện thoại một cột; thứ tự khối: (1) Hôm nay,
(2) Cần chú ý, (3) 7 ngày gần đây, (4) Hóa đơn gần nhất, (5) Hàng sắp hết, (6) Khách nợ, (7) Nợ nhà
cung cấp. Khối (1) và (2) chiếm cả hai cột. Đang tải lần đầu: `TableSkeleton` trong từng `ListPanel`
và `Stat` giá trị "—".

### 4.1 Hôm nay

`StatStrip` 4 cột: **Doanh thu** (hint "n đơn"), **Lãi gộp** (hint `x% doanh thu`, tone như Báo
cáo), **Tiền mặt** (hint "gồm trả trước của đơn ghi nợ"), **Chuyển khoản**. `StatStrip` thứ hai 4
cột: **Ghi nợ** (tone `danger` khi > 0), **Thu nợ** (hint `TM a · CK b`, tone `success` khi > 0),
**So với hôm qua** (chênh doanh thu, dấu ±, tone `success`/`danger`, hint "hôm qua x"), **Hết hàng**
(số mặt hàng, tone `danger` khi > 0, bấm → `/products?stock=out`). Chưa có đơn hôm nay thì mọi số 0
và ô Doanh thu có hint "Chưa có hóa đơn hôm nay".

### 4.2 Cần chú ý

Một `Card` liệt kê các dòng cảnh báo đang có, mỗi dòng: icon, câu ngắn, nút sang trang. Không có
dòng nào thì một dòng `success`: "Mọi thứ ổn: không có cảnh báo." Các dòng (theo thứ tự):

| Điều kiện | Câu | Tone | Nút |
|---|---|---|---|
| `backup.lastError` | "Sao lưu tự động gần nhất bị lỗi: {lỗi}" | `destructive` | Cài đặt → `/settings` |
| `backup.extraError` | "Không chép được bản sao sang thư mục thêm: {lỗi}" | `warning` | Cài đặt |
| `backup` có nhưng `lastBackupAt` null hoặc cách hôm nay > 2 ngày | "Chưa sao lưu từ {ngày}" / "Chưa có bản sao nào" | `warning` | Cài đặt |
| `stocktake` ≠ null | "Kiểm kê {code} đang dở, đã đếm n món" | `warning` | Tiếp tục → `/stocktake` |
| `lowStock.outCount > 0` | "n mặt hàng đã hết" | `destructive` | Xem → `/products?stock=out` |
| `lowStock.count > 0` | "n mặt hàng sắp hết" | `warning` | Xem → `/products?stock=low` |
| `customers.overdueCount > 0` | "n khách nợ quá 30 ngày chưa trả, tổng x" | `warning` | Xem → `/customers` |

Màu lấy từ token (`text-warning`, `text-destructive`, `text-success`), không viết mã màu.

### 4.3 7 ngày gần đây

`ListPanel` tiêu đề "7 ngày gần đây", bảng cột **Ngày** (`dd/mm`, hôm nay ghi "Hôm nay", hôm qua
"Hôm qua"), **Số đơn**, **Doanh thu**, **Lãi**; mới nhất trên; dòng cuối "Tổng" in đậm. Ngày không
bán vẫn có dòng 0. Nút header "Báo cáo" → `/reports` (mặc định tháng này).

### 4.4 Hóa đơn gần nhất

`ListPanel` "Hóa đơn hôm nay" (header ghi "n đơn" từ `week.rows[0].orders`). Mỗi dòng: giờ
`HH:mm`, mã, số món, hình thức (nhãn như trang Hóa đơn), **Phải trả**; đơn ghi nợ thêm tên khách;
đơn hủy gạch ngang + `Badge` *Đã hủy*. Bấm dòng → `/orders` (trang Hóa đơn đã mặc định hôm nay).
Không có đơn → `EmptyState` "Hôm nay chưa có hóa đơn". Nút header "Hóa đơn" → `/orders`.

### 4.5 Hàng sắp hết

`ListPanel` "Hàng sắp hết" (header "n mặt hàng"). Dòng: `ProductAvatar` + tên, **Tồn** (số lượng
theo `formatQty` đang dùng ở trang Sản phẩm, kèm đơn vị), **Tối thiểu**; tồn ≤ 0 tô `destructive`.
Tối đa 10 dòng, dưới là "và n mặt hàng nữa" khi `count > 10`. Nút header "Xem tất cả" →
`/products?stock=low`. Không có → `EmptyState` "Không có mặt hàng nào dưới mức tối thiểu".

### 4.6 Khách nợ · 4.7 Nợ nhà cung cấp

Hai `ListPanel` cùng khuôn: header ghi tổng nợ và "n người". Dòng: tên, SĐT nhỏ, **Đang nợ** /
**Còn nợ**. Khách có `overdue` thêm hint "Giao dịch gần nhất dd/mm" tone `warning`. Bấm dòng →
`/customers?q=<tên>` / `/suppliers?q=<tên>` như Báo cáo. Nút header → `/customers` / `/suppliers`.
Không ai nợ → `EmptyState` "Không ai đang nợ" / "Không nợ nhà cung cấp nào".

## 5. Công thức

- **Hôm nay / 7 ngày**: `profitReport(db, datePresetRange('last7', today), clock)`; `today =
  localDate(now, tz)`. `rows[0]` là hôm nay, `rows[1]` hôm qua (luôn đủ 7 dòng vì `profitReport`
  sinh kỳ trống). *So với hôm qua* = `rows[0].revenue − rows[1].revenue`, tính ở client.
- **Hóa đơn hôm nay**: `orders` có `createdAt` trong `localDayRange(today)`, mọi `status`, `desc(id)`,
  `limit 5`, map bằng `toSummary` hiện có của `services/orders.ts` (export thêm hàm này hoặc tách
  `recentOrders(db, start, end, limit)` trong `orders.ts` và `overview.ts` gọi).
- **Hàng sắp hết**: sản phẩm `isActive`; `count` = số `stock < minStock`; `outCount` = số
  `stock ≤ 0`; `items` = các dòng `stock < minStock` sắp theo tỉ lệ `stock / minStock` tăng dần
  (tồn âm với `minStock = 0` cũng thỏa `stock < minStock`; coi tỉ lệ là −∞ nên xếp đầu), hòa thì
  theo tên; cắt 10.
- **Khách nợ**: khách `isActive`, `debt > 0`; `total` = Σ `debt`; `count`; `lastActivityAt` =
  `max(created_at)` của `debt_transactions` theo khách (cùng subquery với `listCustomers`);
  `overdue` = `lastActivityAt` null hoặc `localDate(lastActivityAt) ≤ shiftDate(today, −30)`;
  `overdueCount`, `overdueTotal` = Σ `debt` của khách `overdue`; `top` 5 theo `debt` giảm dần rồi tên.
- **Nợ NCC**: NCC `isActive`, `debt > 0`; `total`, `count`, `top` 5 (như `debtReport`).
- **Kiểm kê**: phiếu `status = 'open'` (tối đa một) → `StocktakeSummary` (cùng cách tính
  `itemCount`/`diffCount`/`diffValue` với `listStocktakes`; tách hàm tóm tắt nếu đang nằm trong
  `getStocktake`), không kèm `items`.
- **Sao lưu**: `lastBackupAt` = `createdAt` của phần tử đầu `status().items` (mới nhất trước) hoặc
  null; `lastAutoAt`, `lastError`, `extraError` chép nguyên.

## 6. Shared

`shared/src/schemas/overview.ts` (chỉ hằng số, không có query):

```ts
export const DEBT_OVERDUE_DAYS = 30;
export const OVERVIEW_RECENT_ORDERS = 5;
export const OVERVIEW_LOW_STOCK_ROWS = 10;
export const OVERVIEW_TOP_PARTIES = 5;
export const BACKUP_STALE_DAYS = 2;
```

`shared/src/types.ts` thêm:

```ts
export interface LowStockRow { productId: number; name: string; unit: string; stock: number; minStock: number }
export interface OverdueCustomerRow extends DebtPartyRow { lastActivityAt: string | null; overdue: boolean }
export interface OverviewBackup { lastBackupAt: string | null; lastAutoAt: string | null; lastError: string | null; extraError: string | null }
export interface Overview {
  /** Ngày địa phương hôm nay theo đồng hồ server, "YYYY-MM-DD". */
  today: string;
  /** profitReport 7 ngày đến hôm nay, gom theo ngày, rows[0] = hôm nay. */
  week: ProfitReport;
  recentOrders: OrderSummary[];
  lowStock: { count: number; outCount: number; items: LowStockRow[] };
  customers: { total: number; count: number; overdueCount: number; overdueTotal: number; top: OverdueCustomerRow[] };
  suppliers: { total: number; count: number; top: DebtPartyRow[] };
  stocktake: StocktakeSummary | null;
  /** null khi server không cấu hình sao lưu (test). */
  backup: OverviewBackup | null;
}
```

## 7. Server

### `services/overview.ts`

`overview(db, clock?): Omit<Overview, 'backup'>` – thuần đọc, không transaction. Dùng
`resolveClock`, `localDate`, `localDayRange`, `datePresetRange('last7')`, `shiftDate`. Giới hạn dòng
nhận qua tham số tùy chọn để test (`limits = { orders, lowStock, parties }`), mặc định các hằng ở
shared.

### Route `routes/overview.ts`

| Route | Trả |
|---|---|
| `GET /api/overview` | `Overview` = `{ ...overview(db), backup: backups ? pick(status()) : null }` |

`overviewRouter(db, backups?: BackupService)`; mount `r.use('/overview', overviewRouter(db,
deps.backups))` trong `apiRouter`. Không query param; không cache header (đã là mặc định).

## 8. Client

- `api/overview.ts`: `useOverview()` với `queryKey: ['reports', 'overview']`, `refetchInterval:
  60_000`, `placeholderData: prev`.
- `pages/overview/OverviewPage.tsx` lắp các khối; mỗi khối một file nhỏ cùng thư mục:
  `TodayStats.tsx`, `AlertsCard.tsx`, `WeekTable.tsx`, `RecentOrders.tsx`, `LowStockList.tsx`,
  `DebtLists.tsx` (dùng chung cho khách và NCC qua props). Dùng `Stat`/`StatStrip`, `ListPanel`,
  `EmptyState`, `TableSkeleton`, `Badge`, `Button`, `Card` có sẵn; `ProductAvatar` cho hàng.
- `router.tsx`: `NAV` thêm `{ to: '/overview', label: 'Tổng quan', icon: LayoutDashboard, group:
  'sell', mobile: 1 }` ở đầu; đổi `mobile` của *Bán hàng* → 2, *Hóa đơn* → 3, *Sản phẩm* → 4; bỏ
  `mobile` của *Kiểm kê*. `Route path="/overview"`. `Route path="/"` vẫn `Navigate to="/sell"`.
- Không thêm thư viện. Icon `LayoutDashboard` và `RefreshCw` có sẵn trong lucide-react.

## 9. Lỗi

| Tình huống | Server | Người dùng thấy |
|---|---|---|
| API lỗi (server tắt, mạng) | – | Toast lỗi như các trang khác; số cũ giữ nguyên nếu đã có (`placeholderData`) |
| Không có dữ liệu gì (tiệm mới) | 200, mọi số 0, mảng rỗng, `rows` đủ 7 ngày | StatStrip số 0, các khối `EmptyState`, khối Cần chú ý báo "Mọi thứ ổn" (trừ khi chưa có bản sao nào → dòng cảnh báo sao lưu) |
| `backup: null` | – | Không có dòng cảnh báo sao lưu nào |

## 10. Kiểm thử

Vitest `server/src/services/overview.test.ts` (DB `:memory:`, `Clock` cố định tz +7):

- `today` đúng ngày địa phương; đơn 23:30 giờ VN hôm qua không vào hôm nay, đơn 00:30 hôm nay có.
- `week.rows` đủ 7 dòng mới nhất trước, `rows[0]` bằng `daySummary` hôm nay (count, total, cash,
  transfer, debt, debtCollected); `week.total` = Σ rows.
- `recentOrders`: 6 đơn hôm nay (1 hủy) → trả 5 mới nhất, có đơn hủy với `status = 'cancelled'`; đơn
  hôm qua không có.
- `lowStock`: hàng `stock < minStock` vào danh sách, hàng ngừng bán không vào, `outCount` đếm
  `stock ≤ 0`, sắp theo tỉ lệ tăng dần, cắt theo `limits.lowStock`; `count` đếm cả ngoài giới hạn;
  `count` = `filterProducts(listProducts(...), { stock: 'low' }).length` trên cùng dữ liệu.
- `customers`: khách trả nợ 31 ngày trước → `overdue = true`; 29 ngày → `false`; khách `debt ≤ 0`
  không tính; `overdueTotal` đúng; `top` cắt 5 theo nợ giảm dần; `total` = `listCustomers().totalDebt`.
- `suppliers`: như `debtReport`.
- `stocktake`: không có phiếu mở → null; mở phiếu, đếm 2 món → `itemCount = 2`, không có `items`.
- Tiệm mới (DB trống) → không ném lỗi, mọi số 0.

`server/src/routes/api.test.ts`: `GET /api/overview` trả đủ khóa, `backup: null` khi `createApp`
không có service sao lưu; `backups-api.test.ts` thêm một case: có service → `backup.lastBackupAt`
khớp bản sao vừa tạo.

Trình duyệt (skill `browser-verify`, chặn request ghi), cỡ máy tính và điện thoại: mở `/overview`
thấy đủ 7 khối, không cuộn ngang; thanh dưới điện thoại có 4 ô mới và *Kiểm kê* trong *Thêm*; bấm
*Sắp hết* sang Sản phẩm có bộ lọc đúng; bấm dòng khách sang Khách hàng; bấm *Làm mới* xoay icon; nút
*Tiếp tục* kiểm kê đúng khi có phiếu mở (dùng DB seed, không ghi); đường dẫn gốc vẫn vào Bán hàng.

## 11. Phiên bản và tài liệu

- `package.json` gốc: `0.10.0`.
- `README.md`: mô tả ngắn trang Tổng quan trong phần chạy thật ("Điện thoại mở `/overview`…") và mục
  "Kiểm thử thủ công – Tổng quan 0.10.0".
- `CLAUDE.md`: thêm 0.10.0 vào dòng "Đã xong" (`services/overview.ts`, một API gom, dùng lại
  `profitReport`/`daySummary`; ngưỡng nợ lâu `DEBT_OVERDUE_DAYS`); ghi chú thanh dưới điện thoại đổi.
