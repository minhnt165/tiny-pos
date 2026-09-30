# Tiny POS – Bộ lọc nâng cao cho danh sách (0.6.0)

Ngày: 2026-09-30

Nền tảng giữ nguyên như `2026-09-29-tiny-pos-phase1-design.md`; nghiệp vụ như spec giai đoạn
2–4; khung giao diện, `ListPanel`, `StatStrip`, `DateField`, `PageTitle` như
`2026-09-30-tiny-pos-ui-refresh-design.md`. Tài liệu này chỉ mô tả phần thêm mới.

Đây là đợt 2 trong 3 đợt: (1) làm mới giao diện 0.5.0 – đã xong, (2) bộ lọc nâng cao – tài
liệu này, (3) xuất/nhập Excel `.xlsx`.

## 1. Mục tiêu

Chủ tiệm tìm được chứng từ và dữ liệu mà hiện chưa tìm được: hóa đơn/phiếu nhập trong một
khoảng ngày (tuần, tháng), theo hình thức thanh toán, khách, nhà cung cấp, đã hủy, còn nợ; hàng
sắp hết/hết/âm kho, hàng cân, khoảng giá, sắp xếp; khách/NCC đang nợ, sắp theo nợ hoặc lần giao
dịch gần nhất.

Tiêu chí thành công:

- Bốn nhóm trang (Hóa đơn, Nhập hàng, Sản phẩm, Khách hàng/NCC) dùng cùng một kiểu thanh lọc.
- Bộ lọc đang bật luôn nhìn thấy (chip), bỏ từng cái bằng một lần bấm.
- Tải lại trang hoặc bấm Back giữ nguyên bộ lọc (lưu trên URL).
- Hóa đơn/phiếu nhập của cả tháng mở được ngay (phân trang), bảng số liệu tính đúng khoảng ngày.
- Tìm tên hàng/khách không phân biệt dấu tiếng Việt ("sua" ra "Sữa").

## 2. Phạm vi

Trong phạm vi: thanh lọc dùng chung (ô tìm + nút "Bộ lọc · n" + chip), chọn khoảng thời gian có
mốc sẵn, lọc/phân trang ở server cho Hóa đơn và Nhập hàng, lọc/sắp xếp ở trình duyệt cho Sản
phẩm, Khách hàng, Nhà cung cấp, bộ lọc lưu trên URL, hàm SQLite `vn_fold`, version 0.6.0.

Ngoài phạm vi: lọc lịch sử kiểm kê, lọc lịch sử tồn của một sản phẩm, lưu bộ lọc hay dùng, xuất
kết quả lọc ra file (đợt 3), báo cáo theo thời gian, thay đổi schema/migration.

## 3. Quyết định đã chốt

| Vấn đề | Chọn | Lý do |
|---|---|---|
| Kiểu thanh lọc | Ô tìm + một nút "Bộ lọc · n" mở bảng lọc; chip đang bật bên dưới | Người dùng chọn phương án B; thanh gọn, chip cho biết đang lọc gì |
| Nơi lọc | Server: Hóa đơn, Nhập hàng. Trình duyệt: Sản phẩm, Khách, NCC | Chứng từ tăng theo năm; sản phẩm/khách/NCC ít và trang đã tải hết |
| Lưu bộ lọc | Query trên URL, kiểm tra bằng schema zod dùng chung | Tải lại/Back giữ lọc; trang khác mở sang lọc sẵn được |
| Thời gian | Mốc sẵn + Tùy chọn (khoảng ngày); bỏ `DayPicker` ◀ ▶ | "Hôm nay/Hôm qua" thay được ◀ ▶; khoảng ngày là nhu cầu chính |
| Số liệu Hóa đơn/Nhập hàng | Tính theo khoảng ngày, **không** theo lọc khác | Đối soát két theo ngày/tháng vẫn đúng khi lọc "Ghi nợ" |
| Số liệu Sản phẩm | Giữ như cũ: toàn bộ hàng đang bán | Không đổi hành vi đã quen |
| Tìm không dấu ở SQL | Hàm SQLite `vn_fold()` đăng ký lúc mở DB | `LIKE` của SQLite chỉ bỏ hoa/thường với ASCII; không cần cột/migration mới |
| Phân trang chứng từ | 50 dòng/trang, mới nhất lên đầu | Một tháng có thể vài nghìn hóa đơn |
| Khoảng ngày tối đa | 366 ngày | Tránh quét cả DB; đủ cho "cả năm" |

## 4. Server

### Hàm `vn_fold`

- `server/src/db/connection.ts`: sau khi mở `better-sqlite3`, đăng ký
  `sqlite.function('vn_fold', { deterministic: true }, (s) => s == null ? null : stripDiacritics(String(s)).toLowerCase())`.
- `db/test-db.ts` (`createTestDb`) đăng ký y hệt (dùng chung một hàm `registerFunctions(sqlite)`
  trong `connection.ts`).
- Chuỗi tìm cũng qua `stripDiacritics().toLowerCase()` ở JS trước khi so; ký tự `%` `_` trong ô tìm
  được escape (`LIKE … ESCAPE '\'`).

### Hóa đơn – `GET /api/orders`

Query (`orderListQuerySchema`, shared):

| Tham số | Kiểu | Mặc định | Ý nghĩa |
|---|---|---|---|
| `from`, `to` | `YYYY-MM-DD` (ngày có thật) | hôm nay | Khoảng ngày địa phương, gồm cả hai đầu |
| `date` | `YYYY-MM-DD` | – | Tương thích cũ: `from = to = date` (bỏ qua nếu có `from`/`to`) |
| `q` | chuỗi ≤ 100 ký tự, trim | – | Mã hóa đơn chứa `q`, **hoặc** có dòng hàng tên chứa `q` (không dấu) |
| `pay` | danh sách `cash,transfer,debt` | tất cả | Hình thức thanh toán |
| `status` | danh sách `done,cancelled` | tất cả | Trạng thái |
| `customerId` | số nguyên dương | – | Khách (chỉ đơn ghi nợ có khách) |
| `page` | số nguyên ≥ 1 | 1 | Trang, 50 dòng/trang |

Kiểm tra: `from ≤ to`, khoảng ≤ 366 ngày, giá trị danh sách phải thuộc tập cho phép; sai → 400
với thông báo tiếng Việt (ví dụ "Khoảng ngày tối đa 1 năm", "Ngày bắt đầu phải trước ngày kết thúc").

Kết quả (`OrderList`, mở rộng):

```ts
interface OrderList {
  orders: OrderSummary[];   // trang hiện tại, createdAt giảm dần
  summary: DaySummary;      // tính trên khoảng from–to, KHÔNG theo q/pay/status/customerId
  total: number;            // số đơn khớp mọi bộ lọc
  page: number;
  pageSize: number;         // 50
}
```

Service `listOrders(db, query: OrderListFilter, clock?)` thay chữ ký `listOrders(db, date, clock?)`;
khoảng UTC lấy bằng `localDayRange(from).start` và `localDayRange(to).end`. Các chỗ gọi cũ cập
nhật theo.

### Nhập hàng – `GET /api/imports`

Query (`importListQuerySchema`, shared): `from`, `to`, `date`, `q` (mã phiếu hoặc tên hàng trong
phiếu), `status`, `page` như Hóa đơn, cộng thêm:

| Tham số | Kiểu | Ý nghĩa |
|---|---|---|
| `supplierId` | số nguyên dương hoặc `none` | NCC; `none` = phiếu không ghi NCC |
| `unpaid` | `1` | Chỉ phiếu `paid < total` (và `status = done`) |

Kết quả `ImportList` thêm `total`, `page`, `pageSize`; `summary` tính trên khoảng ngày như Hóa đơn.

### Khách hàng, Nhà cung cấp

- `GET /api/customers?q&includeInactive=1`, `GET /api/suppliers?q&includeInactive=1`: có
  `includeInactive=1` thì trả cả dòng đã xóa (`isActive = false`). `totalDebt` của khách vẫn chỉ
  tính khách đang theo dõi.
- `Customer`, `Supplier` thêm `lastActivityAt: string | null` = `max(created_at)` của sổ nợ
  (`debt_transactions` / `supplier_transactions`) của người đó.

## 5. Shared (logic thuần, có test)

- `shared/src/schemas/list-filters.ts`: schema chung `dateRangeQuery` (from/to/date + kiểm tra),
  `csvEnum(values)` (chuỗi "a,b" → mảng giá trị hợp lệ), dùng trong `orderListQuerySchema`,
  `importListQuerySchema`.
- `shared/src/local-date.ts`: `datePresetRange(preset, today): { from; to }` với preset
  `today | yesterday | last7 | thisMonth | lastMonth`; `last7` = hôm nay và 6 ngày trước.
- `shared/src/list-filters.ts`:
  - `filterProducts(products, f)`: `q` (tên/mã vạch, không dấu), `categoryId`, `includeInactive`,
    `stock: 'low' | 'out' | 'negative'`, `weighed`, `noBarcode`, `priceMin`, `priceMax`.
    `low` = `stock < minStock`, `out` = `stock ≤ 0`, `negative` = `stock < 0`.
  - `sortProducts(products, sort)`: `name` (A–Z theo `localeCompare('vi')`), `price-asc`,
    `price-desc`, `stock-asc`, `stock-desc`, `value-desc` (stock × costPrice).
  - `filterParties(list, f)` và `sortParties(list, sort)` cho khách/NCC: `q` (tên không dấu hoặc
    SĐT), `debtOnly` (debt > 0), `sort: 'name' | 'debt-desc' | 'recent'` (`lastActivityAt` giảm
    dần, null xuống cuối).
- Hàm lọc sản phẩm ở server (`services/products.ts`) giữ nguyên; client không gọi API theo bộ lọc
  mới, chỉ tải toàn bộ (kèm hàng ngừng bán) một lần rồi lọc tại chỗ.

## 6. Client

### Thanh lọc dùng chung (`client/src/components/filters/`)

- `FilterBar({ search, activeCount, chips, onClearAll, children })`: nằm trong `toolbar` của
  `ListPanel`. Gồm `SearchInput`, nút "Bộ lọc" (có số khi `activeCount > 0`, dạng nút chính màu
  nhấn khi có lọc), và `children` là nội dung bảng lọc.
  - Máy tính (`md` trở lên): `Popover` (shadcn) rộng ~22rem, căn phải nút.
  - Điện thoại: `Sheet` từ dưới lên (shadcn `sheet` đã có), chân có *Xóa lọc* và *Xem kết quả*
    (đóng sheet; bộ lọc áp ngay khi chọn nên nút chỉ đóng).
- `FilterChips`: hàng chip dưới toolbar (không hiện khi không có lọc); mỗi chip `label` + nút ×
  (`aria-label="Bỏ lọc …"`), cuối hàng nút *Xóa lọc*.
- `FilterGroup({ label, children })`: tiêu đề nhỏ + nội dung.
- `ChoiceChips({ options, value, onChange, multiple })`: hàng nút chọn (một hoặc nhiều), cao 44px
  trên điện thoại.
- `DateRangeFilter({ value, onChange })`: mốc Hôm nay / Hôm qua / 7 ngày qua / Tháng này / Tháng
  trước / Tùy chọn; Tùy chọn mở `Calendar` `mode="range"` (không cho chọn quá 366 ngày, không quá
  hôm nay). Nhãn chip: tên mốc, hoặc `01/09 – 15/09` (khác năm thì kèm năm).
- `useUrlFilters(schema, defaults)`: đọc `useSearchParams`, `safeParse` từng khóa (khóa sai thì
  dùng mặc định, không báo lỗi), trả `[filters, setFilters, clear]`; `setFilters` ghi URL với
  `replace: true`, bỏ khóa bằng mặc định, về `page=1` khi đổi lọc khác trang.
- Ô tìm ghi URL sau khi ngừng gõ 300ms.

### Các trang

| Trang | Nội dung bảng lọc | Chip |
|---|---|---|
| Hóa đơn | Thời gian; Thanh toán (nhiều); Trạng thái (nhiều); Khách (`CustomerPicker`) | Mốc thời gian (không có × khi là Hôm nay – mặc định), từng lựa chọn |
| Nhập hàng | Thời gian; NCC (`SupplierPicker` + "Không ghi NCC"); Trạng thái; Chỉ phiếu còn nợ | Như trên |
| Sản phẩm | Danh mục; Tồn kho; Loại hàng (Hàng cân, Không mã vạch); Giá bán từ–đến; Hiện hàng ngừng bán; Sắp xếp | Mọi lọc khác mặc định; sắp xếp không thành chip |
| Khách hàng, NCC | Chỉ người đang nợ; Hiện cả người đã xóa; Sắp xếp | Như trên |

- Hóa đơn/Nhập hàng: bỏ `DayPicker` khỏi toolbar; thời gian nằm trong bảng lọc và luôn có chip
  (mặc định Hôm nay). `StatStrip` tính theo `summary` (khoảng ngày). `PageTitle` count =
  `total` ("128 đơn"). Chân `ListPanel` là `Pager` theo `total`/`pageSize`.
- Sản phẩm: thay `ToolbarSelect` danh mục và công tắc ngừng bán bằng bảng lọc; `?categoryId=` từ
  màn Danh mục vẫn chạy (cùng khóa URL).
- Khách/NCC: dòng đã xóa hiện mờ + badge "Đã xóa"; bấm vẫn mở chi tiết.
- Không có kết quả: `EmptyState` "Không có … khớp bộ lọc" + nút *Xóa lọc*.
- `DayPicker.tsx` xóa nếu không còn nơi dùng.

## 7. Xử lý lỗi

- API: query sai → 400 `{ error }` tiếng Việt (middleware `validateQuery` sẵn có).
- Client: khóa URL sai → mặc định, không toast. API lỗi → toast như các trang khác, giữ bộ lọc.
- `page` vượt số trang (sau khi lọc hẹp lại) → client kẹp về trang cuối có dữ liệu.

## 8. Kiểm thử

- Shared (vitest): schema query (from > to, > 366 ngày, ngày sai, `pay=cash,foo`, `page=0`,
  `date` cũ), `datePresetRange` (đầu tháng, đầu năm, tháng 2 năm nhuận), `filterProducts`,
  `sortProducts`, `filterParties`, `sortParties`.
- Server (vitest, `createTestDb`, `Clock` cố định):
  - `listOrders`: khoảng ngày theo giờ VN (đơn 23:30 ngày 29 thuộc ngày 29), từng `pay`/`status`,
    `customerId`, `q` theo mã, `q` theo tên hàng có dấu/không dấu, `%` trong ô tìm, phân trang
    (`total`, trang 2), `summary` không đổi khi thêm `pay`/`status`/`q`.
  - `listImports`: như trên + `supplierId=none`, `unpaid`.
  - `listCustomers`/`listSuppliers`: `includeInactive`, `lastActivityAt`.
  - API: 400 cho query sai, tham số `date` cũ vẫn chạy.
- Trình duyệt (`browser-verify`, chặn request ghi): mở bảng lọc, chọn → chip hiện, URL đổi; × bỏ
  đúng lọc; tải lại giữ lọc; điện thoại mở Sheet, không cuộn ngang ở cỡ chữ Rất lớn; Pager chạy khi
  chọn "Tháng này".
- `npm run typecheck`, `npm test`, `npm run build`.

## 9. Tài liệu và version

- `package.json` gốc: `0.6.0`.
- `CLAUDE.md`: mục Đã xong thêm "bộ lọc nâng cao 0.6.0"; `.claude/rules/client.md` thêm quy tắc
  thanh lọc (`FilterBar`, `useUrlFilters`, lọc ở trình duyệt hay server).
- `.claude/rules/server.md`: tìm không dấu trong SQL dùng `vn_fold`.
- `README.md`: mục *Kiểm thử thủ công – Bộ lọc 0.6.0*.
- Cả đợt một commit.
