# Tiny POS – Làm mới giao diện, tùy chỉnh giao diện, version (0.5.0)

Ngày: 2026-09-30

Nền tảng giữ nguyên như `2026-09-29-tiny-pos-phase1-design.md`; nghiệp vụ các màn như
spec giai đoạn 2–4 cùng thư mục. Tài liệu này chỉ đổi phần giao diện client, không đổi
server, API hay dữ liệu.

Đây là đợt 1 trong 3 đợt tiếp theo: (1) làm mới giao diện + version, (2) bộ lọc nâng
cao cho các trang danh sách, (3) xuất/nhập Excel `.xlsx`. Đợt 2 và 3 có spec riêng.

## 1. Mục tiêu

Chủ tiệm thấy giao diện hiện tại chưa chuyên nghiệp ở ba điểm: khung trang (sidebar,
topbar, avatar giả, thẻ "Giai đoạn 3"), mật độ thông tin (chữ và khoảng trắng quá to,
thẻ số liệu bị cắt chữ) và thiếu đồng nhất giữa các trang (header, bảng, dialog, ô ngày
kiểu Mỹ `09/30/2026`). Mục tiêu: giao diện hiện đại, đơn giản, đồng nhất; mỗi máy tự
chỉnh được giao diện cho vừa mắt; biết đang chạy phiên bản nào.

Tiêu chí thành công:

- Mọi trang dùng chung một khung (`AppShell`) và một bộ component trang; không còn
  gradient, bóng màu, mã màu viết cứng trong trang.
- Ở 1366×768, màn Sản phẩm thấy được hàng số liệu và ít nhất 6 dòng bảng không cần cuộn;
  không số liệu nào bị cắt `…`.
- Mọi ô ngày hiển thị `dd/mm/yyyy`.
- Cài đặt có mục *Giao diện (trên máy này)* với 5 tùy chọn, chọn là thấy ngay, tải lại
  trang không bị nháy.
- Version hiện ở chân sidebar và trong Cài đặt.
- Quầy bán vẫn thao tác được hoàn toàn bằng bàn phím như trước (F2/F4/F9, focus ô quét).

## 2. Phạm vi

Trong phạm vi: khung trang mới (sidebar nhóm menu, topbar mang tiêu đề + nút hành động),
bảng màu trắng + xanh dương, 5 tùy chọn giao diện theo máy, version 0.5.0, chuyển 11
trang và toàn bộ dialog sang quy chuẩn chung, ô ngày kiểu Việt Nam, bố cục mới màn Bán
hàng.

Ngoài phạm vi: server/API/schema (không đổi dòng nào), hóa đơn in 80mm (giữ nguyên nội
dung và CSS in), bộ lọc nâng cao (đợt 2), xlsx (đợt 3), API version, thông báo có bản
mới, changelog, git tag.

## 3. Quyết định đã chốt

| Vấn đề | Chọn | Lý do |
|---|---|---|
| Hướng làm | Dựng bộ khung dùng chung rồi chuyển từng trang; giữ logic | Sửa được sự thiếu đồng nhất mà không đụng nghiệp vụ đã chạy |
| Sidebar | Luôn hiện chữ, ~224px, nền trắng, 3 nhóm menu; component `sidebar` của shadcn | Người không rành cần thấy chữ; shadcn có sẵn trạng thái, bàn phím, mobile |
| Bảng màu | Trắng + xanh dương `#2563eb`, trung tính slate, phẳng | Người dùng chọn phương án B |
| Tiêu đề trang | Nằm trên topbar cùng số đếm và nút hành động | Tiết kiệm ~100px chiều cao |
| Nhập nhanh | Bỏ khỏi menu, thành nút trên trang Sản phẩm; route `/quick-add` giữ | Menu gọn; tính năng vẫn còn |
| Tùy chỉnh giao diện | Chế độ, màu nhấn, cỡ chữ, mật độ, bo góc; lưu riêng từng máy | Máy quầy và điện thoại cần khác nhau |
| Áp dụng tùy chỉnh | Chọn là áp dụng, không có nút *Lưu*; có *Khôi phục mặc định* | Thấy ngay kết quả |
| Version | Một số duy nhất ở `package.json` gốc, `0.5.0`; Vite chèn lúc build | Giai đoạn 1–4 ứng với 0.1–0.4 |
| Ô ngày | Popover + `Calendar` shadcn, `dd/mm/yyyy`, tuần bắt đầu Thứ Hai | `<input type="date">` hiện theo locale hệ điều hành |

## 4. Version

- `package.json` gốc thêm `"version": "0.5.0"`. Ba workspace giữ nguyên `0.1.0` (chỉ là
  version gói nội bộ, không hiển thị).
- `client/vite.config.ts` đọc version từ `../package.json` và `define`:
  `__APP_VERSION__` (chuỗi version), `__BUILD_DATE__` (ISO lúc build hoặc lúc chạy dev).
  Khai báo kiểu trong `client/src/vite-env.d.ts` (tạo nếu chưa có).
- `client/src/lib/version.ts`: `APP_VERSION`, `BUILD_DATE` (định dạng `dd/mm/yyyy`).
- Hiện ở: chân sidebar `Phiên bản 0.5.0`; Cài đặt → thẻ *Thông tin phần mềm*: phiên bản,
  ngày build. Điện thoại chỉ có trong Cài đặt.
- Đợt sau tăng version bằng tay trong commit của đợt đó (đợt 2: `0.6.0`, …).

## 5. Tùy chỉnh giao diện

### Tùy chọn

| Khóa | Giá trị | Mặc định | Thuộc tính trên `<html>` |
|---|---|---|---|
| Chế độ | `light` / `dark` / `system` | `system` | class `dark` (next-themes) |
| Màu nhấn | `blue` / `green` / `violet` / `orange` / `rose` / `slate` | `blue` | `data-accent` |
| Cỡ chữ | `sm` 14px / `md` 16px / `lg` 18px / `xl` 20px | `md` | `data-font` |
| Mật độ | `compact` / `comfy` | `compact` | `data-density` |
| Bo góc | `none` / `md` / `lg` | `md` | `data-radius` |

### Lưu và áp dụng

- Lưu một khóa `localStorage` `tiny-pos:ui` (JSON `{ accent, font, density, radius }`) qua
  `lib/storage.ts`. Chế độ sáng/tối do `next-themes` tự lưu (khóa `theme`), đổi
  `defaultTheme` từ `light` sang `system` và bật `enableSystem`.
- Đọc hỏng / giá trị lạ → dùng mặc định từng khóa (không báo lỗi).
- `client/src/lib/ui-prefs.ts`: kiểu `UiPrefs`, `DEFAULT_UI_PREFS`, `readUiPrefs()`,
  `applyUiPrefs(p)` (gán `data-*` lên `document.documentElement`), hook `useUiPrefs()`
  trả `[prefs, update, reset]`.
- Chống nháy: `client/index.html` có một `<script>` inline nhỏ trong `<head>` đọc
  `tiny-pos:ui` và gán `data-*` trước khi vẽ (bọc try/catch). Chế độ sáng/tối next-themes
  đã tự chống nháy.

### Cài đặt bằng CSS (`client/src/index.css`)

- Màu nhấn: mỗi giá trị định nghĩa `--primary`, `--primary-foreground`, `--ring`,
  `--accent`, `--accent-foreground`, `--sidebar-primary`, `--sidebar-accent`,
  `--sidebar-accent-foreground` cho cả sáng (`[data-accent=x]`) và tối
  (`.dark[data-accent=x]`). `blue` là giá trị trong `:root`.
- Cỡ chữ: `html[data-font=sm] { font-size: 14px }` … `xl` 20px. Mọi kích thước dùng
  `rem` nên phóng theo.
- Bo góc: `--radius` = `0.25rem` / `0.5rem` / `0.75rem`.
- Mật độ: biến `--row-py` (đệm dọc ô bảng), `--panel-p` (đệm khung), `--gap` (khoảng giữa
  khối); `compact` nhỏ hơn `comfy` khoảng 1/3. Chỉ component khung và `ui/table` đọc các
  biến này.

### Màn Cài đặt

- Thẻ mới đầu trang: *Giao diện (trên máy này)*: mỗi tùy chọn là một nhóm nút chọn
  (segmented) có nhãn tiếng Việt; màu nhấn là các chấm màu có tên khi rê chuột. Nút
  *Khôi phục mặc định*. Ghi chú nhỏ: "Chỉ áp dụng cho máy/trình duyệt này".
- Thẻ cuối trang: *Thông tin phần mềm* (phiên bản, ngày build).
- Nút *Lưu* trên topbar chỉ lưu thông tin cửa hàng như hiện tại, không liên quan tới giao
  diện.

## 6. Bảng màu và phong cách

- `:root`: nền `#f8fafc`, thẻ `#ffffff`, chữ `#0f172a`, chữ phụ `#64748b`, viền `#e2e8f0`,
  màu nhấn `#2563eb` (chữ trên nhấn trắng), `--accent` `#eff6ff` / `#1d4ed8`. Sidebar nền
  trắng, mục đang chọn nền `--sidebar-accent` chữ màu nhấn đậm.
- `.dark`: nền slate đậm (`#0b1120` / thẻ `#111827`), viền trắng 10%, màu nhấn sáng hơn
  (`#3b82f6`).
- Bỏ khối `@layer components` tạo gradient nút và bóng thẻ. Thẻ chỉ có viền mảnh.
- Màu trạng thái dùng biến: `--destructive` (đỏ), thêm `--warning` (hổ phách),
  `--success` (xanh lá) cho badge/số liệu; trang không viết `text-red-600`,
  `bg-amber-100`… trực tiếp.
- Số tiền quan trọng in đậm màu chữ thường; màu nhấn chỉ cho nút, mục đang chọn, viền ô
  quét, liên kết.
- `index.html` `theme-color` và `vite.config.ts` manifest `theme_color` → `#2563eb`;
  `public/icon.svg` đổi nền `#2563eb`.
- Font Geist giữ nguyên.

## 7. Khung trang

### `AppShell` (`components/layout/AppShell.tsx`)

Máy tính (`md` trở lên):

- Sidebar (shadcn `sidebar`, cài bằng `npx shadcn@latest add sidebar`): đầu là logo
  (icon `Store` trong ô màu nhấn) + tên cửa hàng + địa chỉ rút gọn (lấy từ `useSettings`;
  chưa có thì "Tạp hóa"). Menu 3 nhóm:
  - *Bán hàng*: Bán hàng, Hóa đơn, Khách hàng.
  - *Kho hàng*: Sản phẩm, Nhập hàng, Kiểm kê, Danh mục.
  - *Khác*: Nhà cung cấp, Cài đặt.
  Chân: `Phiên bản x.y.z`. Không có nút thu gọn.
- Topbar cao 48px, dính trên cùng: tiêu đề trang, số đếm (chữ phụ), khoảng trống, ngày
  (`Thứ Tư, 30/09/2026`), nút sáng/tối, rồi các nút hành động của trang.
- Vùng nội dung: đệm theo `--panel-p`, rộng tối đa `max-w-7xl`; màn Bán hàng dùng hết
  chiều rộng và chiều cao còn lại.

Điện thoại:

- Header trên: tiêu đề trang (+ số đếm), bên phải tối đa 2 nút hành động dạng icon,
  còn lại gom vào menu `⋯` (`DropdownMenu`).
- Thanh dưới giữ nguyên hành vi: 4 mục + *Thêm* (`MobileMoreMenu`), cao cố định 68px +
  safe-area (thanh thanh toán màn Bán hàng vẫn bám ngay trên).

`router.tsx`: `NavItem` thêm `group: 'sell' | 'stock' | 'other'`; bỏ `quick-add` khỏi
`NAV` (route giữ). Bỏ trường `disabled` và nhánh "Sắp có" (không còn dùng).

### `PageTitle` (thay `PageHeader`)

```tsx
<PageTitle title="Sản phẩm" count="78 mặt hàng" actions={<>…</>} />
```

Trang gọi `PageTitle` ở đầu JSX; component đưa nội dung vào topbar qua context
`PageTitleContext` (do `AppShell` cung cấp) và không vẽ gì tại chỗ. Tiêu đề tab trình
duyệt đổi theo: `Sản phẩm · Tạp hóa Tâm Ly`. Trang con (ví dụ `/imports/new`) có
`back` (đường dẫn) để hiện nút ← trước tiêu đề. `PageHeader.tsx` bị xóa.

### Component trang dùng chung (`components/`)

- `StatStrip` + `Stat`: một hàng ô số liệu, mỗi ô: nhãn (chữ phụ), giá trị (đậm,
  `tabular-nums`), gợi ý tùy chọn; `tone` = `default | warning | danger | success` chỉ đổi
  màu giá trị. Không icon. Giá trị dài tự thu nhỏ chữ (`text-[clamp(...)]`) thay vì cắt.
  Điện thoại: lưới 2 cột. Thay `StatCard` (xóa file).
- `ListPanel`: khung viền gồm `toolbar` (slot), nội dung (bảng/thẻ) và `footer` (phân
  trang/tổng). Toolbar: ô tìm bên trái, bộ chọn bên phải, xuống dòng trên điện thoại.
  Đợt 2 gắn bộ lọc vào slot này.
- `DateField`: nút mở Popover chứa `Calendar` (shadcn, `npx shadcn@latest add calendar`,
  locale `vi` của `react-day-picker`, `weekStartsOn: 1`), hiển thị `dd/mm/yyyy`, giá trị
  vào/ra vẫn là chuỗi `YYYY-MM-DD` như hiện tại; hỗ trợ `max`. `DayPicker` dùng
  `DateField` thay `Input type="date"`.
- `EmptyState`: gọn lại (icon nhỏ, không ô nền to), có biến thể `inline` trong bảng.
- `TableSkeleton`: vài dòng `Skeleton` theo số cột, dùng khi đang tải.
- `ui/table`: ô dùng `--row-py`; hàng tiêu đề chữ nhỏ màu chữ phụ; hàng có hover.

### Dialog

- 3 cỡ qua prop/class thống nhất: `sm` (xác nhận), `md` (form, mặc định), `lg` (chi tiết
  chứng từ).
- Footer: *Hủy* (outline) bên trái, hành động chính bên phải; điện thoại hai nút giãn
  ngang, hành động chính ở trên.
- Tiêu đề + mô tả cùng kiểu cho mọi dialog; nội dung dài thì cuộn trong thân dialog.

## 8. Các màn

Giữ nguyên hook, API, phím tắt, luồng; chỉ đổi JSX/class và chuyển sang component chung.

| Màn | Thay đổi chính |
|---|---|
| Bán hàng | Xem mục 9 |
| Hóa đơn | `PageTitle` + `DayPicker` mới trên topbar; `StatStrip` 6 ô; bảng trong `ListPanel` |
| Nhập hàng (danh sách) | Như Hóa đơn; nút *Tạo phiếu* trên topbar |
| Tạo phiếu nhập | `back` về danh sách; ô NCC + ghi chú + ô quét một hàng; footer tổng/đã trả/lưu dính đáy |
| Kiểm kê | `PageTitle`; phiên đang mở và lịch sử trong `ListPanel` |
| Sản phẩm | `StatStrip` 4 ô; chip danh mục thành ô chọn *Danh mục*; nút *Nhập nhanh*, *Nhập / Xuất CSV*, *Thêm sản phẩm* trên topbar; thẻ trên điện thoại giữ |
| Danh mục, Nhà cung cấp, Khách hàng | `PageTitle` + `StatStrip` (nếu có tổng nợ) + `ListPanel` |
| Nhập nhanh | `PageTitle` có `back` về Sản phẩm |
| Cài đặt | Rộng như các trang khác; thêm thẻ *Giao diện* và *Thông tin phần mềm* |
| Không tìm thấy trang | `EmptyState` có nút về Bán hàng |

## 9. Màn Bán hàng

- Chiếm hết chiều cao dưới topbar (`h-[calc(100dvh-3rem)]` trên máy tính); lưới
  `1fr 20rem`. Giỏ hàng cuộn bên trong, cột phải cố định.
- Cột trái: ô quét (viền màu nhấn, `Kbd` F2) → hàng tab đơn → giỏ → dòng phím tắt
  (`F2 Quét · F4 Món ngoài · F9 Thanh toán · Esc Đóng hộp thoại`, ẩn trên điện thoại).
- Tab đơn (thay chip `HeldCarts`): tab *Đơn hiện tại · n món* luôn có; mỗi đơn chờ là tab
  `Chờ i · giờ · tiền` với nút × (vẫn hỏi `ConfirmDialog`). Bấm tab chờ = `openHeld` như
  hiện tại (đơn đang làm được cất vào chờ). Không có đơn chờ thì chỉ còn tab hiện tại.
- Giỏ: cột #, Sản phẩm (tên + đơn vị/diễn giải hàng cân), Đơn giá, Số lượng (nút −/+ hoặc
  `0,5 kg ✎` với hàng cân), Thành tiền, nút ×. Điện thoại giữ dạng dòng gọn như hiện tại.
- Cột phải: Tổng tiền (n món), Giảm giá, *Khách phải trả* (chữ lớn đậm màu chữ), nút
  *Thanh toán F9*, hàng 3 nút phụ (Cất chờ, Món ngoài, Xóa giỏ), tổng kết hôm nay ở đáy
  (số đơn · doanh thu; tiền mặt · CK · ghi nợ).
- Điện thoại: thanh *Phải trả + Thanh toán* bám trên thanh menu như hiện tại.
- Giữ: `useCart`, `useHeldCarts`, `useScanInput`, xử lý phím tắt, `CheckoutDialog`,
  `WeighDialog`, `CustomItemDialog`, `SaleResult`, tự in.

## 10. Tài liệu

- `CLAUDE.md`: mục Đã xong thêm "Làm mới giao diện (0.5.0)"; mục UI thêm: tiêu đề trang
  dùng `PageTitle`, danh sách dùng `ListPanel`, số liệu `StatStrip`, ngày `DateField`;
  màu lấy từ biến CSS, không viết mã màu trong trang; version ở `package.json` gốc.
- `.claude/rules/client.md`: thay dòng `PageHeader` bằng các component trên; thêm quy tắc
  tùy chỉnh giao diện (thuộc tính `data-*`, `ui-prefs.ts`) và không dùng
  `<input type="date">`.
- `README.md`: thêm mục *Kiểm thử thủ công – Giao diện 0.5.0* cuối file.
- `.gitignore`: thêm `.superpowers/`.

## 11. Xử lý lỗi

- `localStorage` hỏng/bị chặn: dùng mặc định, không lỗi (đã có `lib/storage.ts`).
- Chưa tải được cài đặt cửa hàng: sidebar hiện "Tạp hóa", không địa chỉ.
- Không có thay đổi nào ở lỗi API.

## 12. Kiểm thử

Client không có test tự động; không đổi server nên test server giữ nguyên và phải xanh.

- `npm run typecheck`, `npm test`, `npm run build`.
- Skill `browser-verify` (chặn request ghi):
  - Chụp 11 trang ở 1366×768 và 390×844, sáng và tối; đọc ảnh, so với tiêu chí mục 1.
  - Ở 390px với cỡ chữ `xl`: `scrollWidth <= 390` mọi trang, nút chính cao ≥ 44px.
  - Đổi từng tùy chọn trong Cài đặt: thấy `data-*` trên `<html>` đổi và giao diện đổi;
    tải lại trang vẫn giữ, không nháy (ảnh chụp ngay sau `domcontentloaded`).
  - Bán hàng: thêm món bằng stub GET, F2 focus ô quét, F4 mở món ngoài, F9 mở thanh toán;
    cất chờ → tab xuất hiện → bấm tab mở lại đúng giỏ.
  - Ô ngày Hóa đơn hiện `30/09/2026`, chọn ngày trong lịch đổi danh sách.
  - In thử (stub `window.print`): `#print-root` vẫn khổ 80mm, không nhận màu nhấn.
  - Không có `CONSOLE ERROR` / `PAGE ERROR`.
- `git diff --stat`: các file cấu hình chỉ đổi đúng dòng cần.
