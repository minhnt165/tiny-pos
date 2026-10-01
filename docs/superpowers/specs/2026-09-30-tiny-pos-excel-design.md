# Tiny POS – Xuất/nhập Excel `.xlsx` (0.7.0)

Ngày: 2026-09-30

Nền tảng giữ nguyên như `2026-09-29-tiny-pos-phase1-design.md` (CSV sản phẩm ở mục nhập/xuất);
nghiệp vụ như spec giai đoạn 2–4; `PageTitle`, `ListPanel` như `2026-09-30-tiny-pos-ui-refresh-design.md`;
bộ lọc trên URL, `productViewFields`, `partyViewFields`, `orderListQuerySchema`, `importListQuerySchema`
như `2026-09-30-tiny-pos-filters-design.md`. Tài liệu này chỉ mô tả phần thêm mới.

Đây là đợt 3 trong 3 đợt: (1) làm mới giao diện 0.5.0 – đã xong, (2) bộ lọc nâng cao 0.6.0 – đã
xong, (3) xuất/nhập Excel – tài liệu này.

## 1. Mục tiêu

Chủ tiệm mở dữ liệu của tiệm bằng Excel mà không phải biết "CSV UTF-8" là gì: xuất danh sách đang
xem (đúng bộ lọc) ra `.xlsx` để đối soát, làm sổ sách; sửa sản phẩm hàng loạt trong Excel rồi nhập
lại.

Tiêu chí thành công:

- Hóa đơn, Nhập hàng, Sản phẩm, Khách hàng, Nhà cung cấp đều có nút "Xuất Excel"; file chứa đúng
  các dòng khớp bộ lọc đang bật, không bị cắt theo trang.
- Mở file bằng Excel thấy tiếng Việt đúng, tiền là số cộng được (hiện `15.000`), ngày giờ là ô ngày
  theo giờ địa phương, lọc được ngay (AutoFilter).
- Xuất sản phẩm → sửa trong Excel → nhập lại file đó chạy được luôn, không cần "Lưu thành CSV".
- File `.csv` cũ vẫn nhập được như trước.

## 2. Phạm vi

Trong phạm vi: xuất `.xlsx` cho 5 trang danh sách theo bộ lọc trên URL, hóa đơn/phiếu nhập có sheet
chi tiết từng món; nhập sản phẩm từ `.xlsx` hoặc `.csv`; bỏ xuất CSV; version 0.7.0.

Ngoài phạm vi: nhập phiếu nhập hàng từ file của nhà cung cấp, nhập khách/NCC từ file, file `.xls`
cũ, `.xlsm`/macro, cột lãi, dòng tổng trong sheet, báo cáo theo thời gian, thay đổi schema/migration.

## 3. Quyết định đã chốt

| Vấn đề | Chọn | Lý do |
|---|---|---|
| Phạm vi | Sản phẩm xuất + nhập; Hóa đơn, Nhập hàng, Khách, NCC chỉ xuất | Người dùng chọn; nhập phiếu từ file NCC để đợt khác (mỗi NCC một mẫu) |
| CSV cũ | Xuất chỉ còn `.xlsx`; nhập nhận cả `.xlsx` và `.csv` | Chủ tiệm không phải chọn định dạng; file CSV đang có vẫn dùng được |
| Hóa đơn/Phiếu nhập | 2 sheet: tổng + chi tiết từng món | Đối soát tiền ở sheet 1, lọc/pivot theo món ở sheet 2 |
| Nơi tạo/đọc file | Server | Logic có test vitest; client không nặng thêm; chứng từ đã lọc ở server |
| Thư viện | `exceljs` (MIT), chỉ ở `server` | Đọc + ghi, định dạng số, độ rộng cột, cố định dòng. SheetJS trên npm dừng ở 0.18.5 có lỗ hổng, bản mới chỉ có ở CDN riêng |
| Lọc Sản phẩm/Khách/NCC | Server chạy chính `filterProducts`/`sortProducts`/`filterParties`/`sortParties` của `shared` | File khớp đúng những gì trình duyệt đang hiện |
| Cách tải | `fetch` → Blob → `<a download>` tạm | Lỗi 400 hiện thành toast thay vì tải về file JSON |
| Cột lãi | Không có | Giảm giá tính cho cả đơn, lãi từng dòng không đúng |
| Dòng tổng | Không có | Chứng từ đã hủy nằm trong file; bôi đen cột, Excel tự hiện tổng |
| Giới hạn | 20.000 chứng từ mỗi file | Tránh treo máy khi lọc rộng; khoảng ngày đã ≤ 366 ngày |
| Hàng không mã vạch khi nhập | Khớp theo tên (chỉ trong số hàng không mã vạch) | Người dùng chọn; giữ 9 cột; xuất → nhập lại không tạo trùng |

## 4. Nội dung file

Quy ước chung cho mọi sheet:

- Dòng 1 là tiêu đề: in đậm, cố định khi cuộn (freeze), bật AutoFilter; độ rộng cột đặt sẵn theo nội
  dung.
- Tiền: ô số nguyên, định dạng `#,##0`. Số lượng/tồn: ô số, định dạng `#,##0.###`.
- Ngày giờ: ô ngày của Excel theo **giờ địa phương** (`Clock`), định dạng `dd/mm/yyyy hh:mm`. Ô trống
  khi không có giá trị (ví dụ "Hủy lúc" của chứng từ chưa hủy).
- Mã vạch: ô chữ (định dạng `@`) để giữ số 0 đầu và không bị hiện `8.93E+12`.
- Thứ tự dòng như trên màn hình: chứng từ mới nhất trước (`id` giảm dần); sản phẩm/khách/NCC theo
  kiểu sắp xếp đang chọn (`sort` trên URL).
- Chữ hiển thị: hình thức `Tiền mặt` / `Chuyển khoản` / `Ghi nợ`; trạng thái chứng từ `Hoàn tất` /
  `Đã hủy`; trạng thái khách/NCC `Đang theo dõi` / `Đã xóa`; hàng cân `Có` / trống.

Tên file theo ngày địa phương (`YYYYMMDD`), chỉ ký tự ASCII:

| File | Sheet | Cột |
|---|---|---|
| `san-pham-YYYYMMDD.xlsx` | Sản phẩm | Mã vạch, Tên, Đơn vị, Giá nhập, Giá bán, Tồn, Hàng cân, Danh mục, Tồn tối thiểu |
| `hoa-don-FROM-TO.xlsx` | Hóa đơn | Mã, Ngày giờ, Khách, Hình thức, Tiền hàng, Giảm giá, Phải trả, Đã trả, Còn nợ, Số món, Trạng thái, Hủy lúc |
| | Chi tiết | Mã hóa đơn, Ngày giờ, Trạng thái, Tên hàng, Đơn vị, SL, Đơn giá, Thành tiền, Giá vốn |
| `phieu-nhap-FROM-TO.xlsx` | Phiếu nhập | Mã, Ngày giờ, NCC, Tổng tiền, Đã trả, Còn nợ, Số món, Ghi chú, Trạng thái, Hủy lúc |
| | Chi tiết | Mã phiếu, Ngày giờ, Trạng thái, NCC, Tên hàng, Đơn vị nhập, Quy đổi, SL, Đơn giá, Thành tiền |
| `khach-hang-YYYYMMDD.xlsx` | Khách hàng | Tên, SĐT, Ghi chú, Đang nợ, Giao dịch gần nhất, Trạng thái |
| `nha-cung-cap-YYYYMMDD.xlsx` | Nhà cung cấp | Tên, SĐT, Ghi chú, Mình còn nợ, Giao dịch gần nhất, Trạng thái |

Chi tiết từng cột:

- Sản phẩm: đúng 9 cột của `PRODUCT_CSV_HEADERS`, cùng thứ tự, để file xuất nhập lại được.
- Hóa đơn: Tiền hàng = `total`, Giảm giá = `discount`, Phải trả = `payable`; Đã trả = `paid` với đơn
  `debt` (tiền trả trước), `payable` với đơn tiền mặt/chuyển khoản (`paid` của đơn tiền mặt là tiền
  khách đưa, gồm cả tiền thối lại); Còn nợ = `payable − paid` với đơn `debt`, trống với đơn khác. Khách = `customerName` (trống nếu
  không có).
- Chi tiết hóa đơn: SL = `qty` theo đơn vị bán (`unit`), Đơn giá = `price`, Thành tiền = `amount`,
  Giá vốn = `costPrice` của dòng (giá vốn 1 đơn vị bán, ghi lúc bán). Món ngoài danh mục có giá vốn 0.
- Phiếu nhập: Tổng tiền = `total`, Đã trả = `paid`, Còn nợ = `total − paid`.
- Chi tiết phiếu nhập: Đơn vị nhập = `unitName`, Quy đổi = `factor`, SL = `qty`, Đơn giá = `unitCost`,
  Thành tiền = `amount`.
- Khách/NCC: Đang nợ / Mình còn nợ = `debt` (có thể âm); Giao dịch gần nhất = `lastActivityAt`.
- Sheet chi tiết lặp Ngày giờ, Trạng thái (và NCC với phiếu nhập) để lọc trong sheet đó mà không
  phải tra sang sheet tổng.

## 5. Server

### Thư viện và helper

- Thêm `exceljs` vào `server/package.json` (dependencies).
- `server/src/xlsx/workbook.ts`: chỉ chuyển đổi dữ liệu ↔ file, không có nghiệp vụ.
  - `type XlsxColumn = { header: string; width: number; kind: 'text' | 'code' | 'money' | 'qty' | 'datetime' }`
    (`code` = ô chữ `@`, dùng cho mã vạch).
  - `addSheet(wb, name, columns, rows, tzOffsetMin)`: ghi tiêu đề + dòng, áp định dạng theo `kind`,
    freeze dòng 1, AutoFilter cả vùng. Cột `datetime` nhận chuỗi ISO UTC hoặc `null`; đổi sang giờ
    địa phương bằng cách cộng `tzOffsetMin` rồi ghi thành `Date` (exceljs ghi `Date` theo UTC).
  - `toBuffer(wb): Promise<Buffer>`.
  - `readFirstSheet(buf): Promise<XlsxCell[][]>` với `XlsxCell = string | number | boolean | null`:
    đọc sheet đầu tiên; `table[i]` là dòng Excel `i + 1` (dòng bị bỏ trong file thành mảng rỗng) để
    số dòng báo lỗi khớp Excel; ô công thức lấy `result`, rich text ghép các đoạn, hyperlink lấy
    `text`, ô ngày thành chuỗi ISO, ô lỗi giữ mã lỗi (`'#N/A'`), công thức chưa có kết quả thành `'#N/A'`
    (không phải ô trống: ô tiền trống sẽ thành 0). `parseProductTable` gặp mã lỗi Excel ở bất kỳ cột nào
    thì báo lỗi dòng `Ô Giá bán bị lỗi #N/A trong Excel`. File không đọc được →
    `HttpError(400, 'File Excel bị hỏng hoặc không đọc được')`.

### Lọc chứng từ không phân trang

- `services/orders.ts`: tách phần dựng `where` của `listOrders` thành hàm nội bộ
  `orderFilter(query, clock)` (trả `where` và khoảng ngày); `listOrders` dùng lại, hành vi không đổi.
  Thêm `listOrdersForExport(db, query, clock?, maxRows?): { from; to; orders: OrderDetail[] }`
  (`from`/`to` đã resolve, dùng đặt tên file): cùng `where`, `orderBy(desc(id))`,
  không `limit`; lấy món bằng **một** câu `select … from order_items where order_id in (…)` rồi ghép
  theo đơn. Phần `debt` của `OrderDetail` để `null` (file không dùng).
  Đếm trước: quá `maxRows` (tham số cuối, mặc định `MAX_EXPORT_ROWS` = 20.000, hằng số trong
  `shared/src/schemas/list-filters.ts`; test truyền số nhỏ) →
  `HttpError(400, 'Quá nhiều hóa đơn, hãy chọn khoảng ngày ngắn hơn')`.
- `services/imports.ts`: tương tự với `importFilter`, `listImportsForExport(db, query, clock?, maxRows?): { from; to; imports: ImportDetail[] }`,
  thông báo "Quá nhiều phiếu nhập, hãy chọn khoảng ngày ngắn hơn".
- SQLite giới hạn số tham số trong `in (…)`: lấy món theo từng lô 500 id.

### Dựng file – `services/exports.ts`

Mỗi hàm trả `Promise<{ filename: string; buffer: Buffer }>`:

- `exportProductsXlsx(db, view: ProductView, clock?)`: `listProducts(db, { includeInactive: true })`
  → `filterProducts(…, view)` → `sortProducts(…, view.sort)`.
- `exportOrdersXlsx(db, query: OrderListQuery, clock?)`: `listOrdersForExport`; tên file dùng
  `from`/`to` đã resolve (`resolveRange`).
- `exportImportsXlsx(db, query: ImportListQuery, clock?)`: `listImportsForExport`.
- `exportCustomersXlsx(db, view: PartyView, clock?)`: `listCustomers(db, undefined, true).customers`
  → `filterParties` → `sortParties`.
- `exportSuppliersXlsx(db, view: PartyView, clock?)`: `listSuppliers(db, undefined, true)` → như trên.

Nhãn cột và chữ hiển thị (mục 4) là hằng số trong file này.

### Route

Route tĩnh đặt trước `/:id`. Helper `sendXlsx(res, { filename, buffer })` đặt
`Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` và
`Content-Disposition: attachment; filename="<filename>"`.

| Route | Query (validate) |
|---|---|
| `GET /api/products/export.xlsx` | `z.object(productViewFields)` |
| `GET /api/orders/export.xlsx` | `orderListQuerySchema` |
| `GET /api/imports/export.xlsx` | `importListQuerySchema` |
| `GET /api/customers/export.xlsx` | `z.object(partyViewFields)` |
| `GET /api/suppliers/export.xlsx` | `z.object(partyViewFields)` |
| `POST /api/products/import` | thân là file thô: `express.raw({ type: () => true, limit: '10mb' })` |

`page` trong query được chấp nhận nhưng bỏ qua. Query sai → 400 với thông báo của schema như các
route danh sách. Bỏ `GET /api/products/csv` và `POST /api/products/csv`.

### Nhập sản phẩm

- `services/product-csv.ts`: `importProductsCsv(db, text)` thay bằng
  `importProductsFile(db, buf: Buffer): Promise<CsvImportResult>`:
  - `buf` bắt đầu `50 4B 03 04` (`PK`) → `readFirstSheet` → `parseProductTable`.
  - Bắt đầu `D0 CF 11 E0` (file `.xls` cũ) → `HttpError(400, 'File .xls cũ chưa hỗ trợ. Mở bằng Excel rồi lưu lại dạng .xlsx')`.
  - Còn lại → giải mã UTF-8, bỏ BOM → `parseProductCsv` (hành vi như hiện nay).
  - Ghi vào DB giữ nguyên: `upsertRow` trong một transaction, trùng mã vạch → cập nhật không đổi tồn,
    tạo mới → tồn đầu qua `adjustStockTo`.
  - **Dòng không có mã vạch khớp theo tên** (mới): tìm sản phẩm *không có mã vạch* (cả hàng ngừng
    bán) có tên trùng sau khi `trim()` + `toLocaleLowerCase('vi')` → cập nhật như trùng mã vạch.
    Không có → tạo mới (và từ đó các dòng sau cùng tên trong file cập nhật nó). Có từ 2 sản phẩm trở
    lên cùng tên → lỗi dòng `Có nhiều sản phẩm tên "X" không có mã vạch, hãy thêm mã vạch cho từng sản
    phẩm ở trang Sản phẩm`. Dòng có mã vạch khớp theo mã vạch trước; mã chưa có trong DB thì khớp theo
    tên như trên và **gán mã vạch đó** cho sản phẩm (chủ tiệm vừa điền mã cho hàng không mã; không làm
    vậy sẽ tạo bản trùng và cộng tồn hai lần). So tên bằng JS (bảng tên nạp một lần đầu transaction)
    vì `lower()` của SQLite không đổi chữ hoa có dấu. Lý do: không có quy tắc này thì mọi hàng không mã
    vạch (rau, hàng cân) bị tạo trùng mỗi lần xuất → sửa → nhập lại.
- `exportProductsCsv` bị bỏ (xuất sản phẩm dùng `exportProductsXlsx`). `productToCsvRow` giữ để
  `exports.ts` dùng chung thứ tự cột.
- Vượt 10 MB: body-parser ném lỗi `type = 'entity.too.large'` kèm `limit` (byte); `middleware/error.ts`
  thêm một nhánh trả 413 "Dữ liệu gửi lên quá lớn (tối đa 10 MB)" (số MB lấy từ `limit`, nên JSON quá
  1 MB cũng báo đúng; hiện đang rơi vào 500 "Lỗi hệ thống").
- Lỗi của một dòng khi ghi (`HttpError` 4xx: trùng mã vạch, tồn đầu âm) được đưa vào `errors` theo
  dòng; lỗi khác → rollback cả file như cũ.
- Movement tồn đầu ghi chú "Nhập Excel" (file `.xlsx`) hoặc "Nhập CSV" (file `.csv`).
- Route export/import là hàm `async`; Express 5 tự chuyển promise bị reject sang `errorHandler`.

## 6. Shared

- `shared/src/product-csv.ts`:
  - `parseProductTable(table: (string | number | boolean | null)[][])`: phần đọc theo tên cột và
    validate hiện có, chuyển từ `parseProductCsv` sang. Ô **số** dùng thẳng giá trị (không qua
    `parseVnNumber`: ô số `1.234` là 1,234 kg, không phải 1234); ô chữ đi qua `parseVnNumber` như cũ;
    ô `boolean` của cột Hàng cân dùng thẳng; `null` như chuỗi rỗng. Dòng mà mọi ô đều trống bị bỏ qua
    (không báo lỗi). Số dòng báo lỗi = chỉ số trong bảng + 1.
  - Ô **số** ở cột tiền (Giá nhập, Giá bán) được làm tròn tới đồng: giá tính bằng công thức Excel
    (`=A2*1,1`) hay ra `16500,000000002`. Ô chữ có phần lẻ vẫn báo "phải là số nguyên".
  - Cột Tồn được âm khi đọc file: hàng đang âm kho (cho bán âm) xuất ra rồi nhập lại phải cập nhật
    được, vì cập nhật không đổi tồn. Chỉ khi **tạo mới** với Tồn < 0 mới báo lỗi dòng
    "Tồn đầu không được âm" (kiểm ở `upsertRow`).
  - `parseProductCsv(text)` = `parseProductTable(parseCsv(text, detectDelimiter(text)))`; kết quả
    như hiện nay (trừ dòng trống giữa file giờ được bỏ qua).
  - Thông báo thiếu cột Tên đổi thành: `Không tìm thấy cột "Tên". Hãy giữ nguyên dòng tiêu đề như file xuất ra.`
- `MAX_EXPORT_ROWS = 20_000` trong `schemas/list-filters.ts`; cùng file thêm
  `productViewQuerySchema = z.object(productViewFields)` và `partyViewQuerySchema = z.object(partyViewFields)`
  cho route export.

## 7. Client

- `api/client.ts`:
  - `api()` thêm tùy chọn `body?: Blob` → header `Content-Type: application/octet-stream`.
  - `downloadFile(path): Promise<void>`: `fetch('/api' + path)`; lỗi → `ApiError` như `api()`; thành
    công → Blob → `URL.createObjectURL` → `<a download=…>` tạm, bấm, thu hồi URL. Tên file lấy từ
    `Content-Disposition`, không có thì `du-lieu.xlsx`.
- `hooks/useExportAction.ts`: `useExportAction(path): PageAction` – nút "Xuất Excel" gọi
  `downloadFile(path + location.search)`, lỗi → `toast.error(message)`.
- Nút "Xuất Excel" (icon `FileSpreadsheet`) qua `PageTitle.actions` ở `OrdersPage`, `ImportsPage`,
  `ProductListPage`, `CustomersPage`, `SuppliersPage`; khi `pending`: `disabled`, nhãn "Đang xuất…".
  Trên điện thoại nút vào menu ⋯ như các nút phụ khác.
- Trang Sản phẩm: nút "Nhập / Xuất CSV" thay bằng hai nút "Xuất Excel" và "Nhập từ Excel" (icon
  `Upload`).
- `pages/products/CsvDialog.tsx` đổi thành `ImportDialog.tsx`, chỉ còn phần nhập:
  - Tiêu đề "Nhập sản phẩm từ Excel"; mô tả cột như cũ; thêm "Muốn sửa hàng loạt: bấm *Xuất Excel*,
    sửa trong Excel rồi nhập lại file đó."
  - Ô chọn/kéo thả nhận `.xlsx,.csv`; gửi `File` (Blob) thay vì `file.text()`; nhãn "Chọn file Excel
    hoặc CSV…".
  - Hiển thị kết quả (tạo/cập nhật/lỗi theo dòng) như cũ.
- `api/products.ts`: `useImportCsv` → `useImportProducts` gọi `POST /products/import` với `body: file`;
  bỏ `CSV_EXPORT_URL`.

### File mẫu (bổ sung 2026-10-01)

Chủ tiệm nhập hàng lần đầu chưa có gì để "Xuất Excel" rồi sửa, nên hộp thoại nhập có nút **Tải file mẫu**:

- `GET /api/products/template.xlsx` (route tĩnh, trước `/:id`) → `exportProductTemplateXlsx()` trong
  `services/exports.ts`, file `mau-san-pham.xlsx`, không phụ thuộc DB.
- Sheet 1 `Sản phẩm`: đúng `PRODUCT_COLUMNS` (9 cột, định dạng cột như file xuất) và 2 dòng ví dụ: một hàng có
  mã vạch, một hàng cân không mã vạch. Nhập thẳng file mẫu phải chạy được không lỗi (có test).
- Sheet 2 `Hướng dẫn`: hai cột Cột / Cách điền, giải thích từng cột và dặn sửa hoặc xóa dòng ví dụ. Khi nhập chỉ
  đọc sheet đầu (`readFirstSheet`) nên sheet này không ảnh hưởng.
- Client: nút "Tải file mẫu" (icon `Download`) trong `ImportDialog`, gọi `downloadFile`; lỗi → toast.

## 8. Lỗi

| Tình huống | Server | Người dùng thấy |
|---|---|---|
| Query sai (khoảng ngày > 1 năm, ngày đảo…) | 400, thông báo của schema | toast |
| Quá 20.000 chứng từ | 400 "Quá nhiều hóa đơn/phiếu nhập, hãy chọn khoảng ngày ngắn hơn" | toast |
| File `.xls` cũ | 400 "File .xls cũ chưa hỗ trợ. Mở bằng Excel rồi lưu lại dạng .xlsx" | toast |
| File `.xlsx` hỏng | 400 "File Excel bị hỏng hoặc không đọc được" | toast |
| File > 10 MB | 413 "Dữ liệu gửi lên quá lớn (tối đa 10 MB)" | toast |
| Thiếu cột Tên / dòng sai | 200, `errors` theo dòng | danh sách lỗi trong hộp thoại |

## 9. Kiểm thử

Vitest (`shared`, `server`):

- `shared/src/product-csv.test.ts`: `parseProductTable` với ô số (`1.234` → 1.234), ô `boolean`, ô
  `null`, dòng trống bị bỏ, số dòng lỗi đúng; các test CSV hiện có vẫn qua.
- `server/src/xlsx/workbook.test.ts`: ghi rồi đọc lại (giá trị, định dạng `#,##0`, ngày giờ địa
  phương với `tzOffsetMin` cố định, mã vạch `0123` giữ số 0), ô công thức, rich text, dòng bị bỏ giữ
  đúng chỉ số, buffer rác → 400.
- `server/src/services/exports.test.ts`:
  - Hóa đơn: 2 sheet, số dòng khớp lọc `pay`/`status`/`q` theo tên món/`customerId`, có đơn đã hủy,
    hơn 50 đơn vẫn đủ, món ghép đúng đơn; vượt giới hạn → 400 (gọi `listOrdersForExport` với
    `maxRows` nhỏ).
  - Phiếu nhập: tương tự, gồm `unpaid=1` và `supplierId=none`.
  - Sản phẩm/Khách/NCC: dòng và thứ tự khớp `filterProducts`/`sortProducts`/`filterParties`/`sortParties`.
- `server/src/services/product-csv.test.ts`: file `.xlsx` do `exportProductsXlsx` tạo, nhập lại →
  0 tạo, n cập nhật, tồn không đổi; `.xlsx` có dòng mới → tạo kèm movement tồn đầu; CSV vẫn chạy;
  `.xls` và buffer hỏng → 400.
- `server/src/routes/api.test.ts`: header `Content-Type`/`Content-Disposition` của 5 route export;
  `POST /api/products/import` với CSV và `.xlsx`; query sai → 400; `/api/products/csv` không còn.

Trình duyệt (skill `browser-verify`, chặn request ghi): bấm "Xuất Excel" ở 5 trang cỡ máy tính và
điện thoại nhận được file; server trả 400 → toast; hộp thoại nhập hiển thị đúng.

## 10. Phiên bản và tài liệu

- `package.json` gốc: `0.7.0`.
- `README.md`: mục CSV đổi thành Excel (xuất `.xlsx`, sửa, nhập lại; `.csv` cũ vẫn nhập được).
- `CLAUDE.md`: thêm 0.7.0 vào dòng "Đã xong".
