# Tiny POS – Quản lý tạp hóa

Phần mềm bán hàng cho tiệm tạp hóa nhỏ, chạy local trên 1 máy Windows, điện thoại trong nhà truy cập qua mạng LAN. Không cần Internet.

## Yêu cầu

- Node.js 20 trở lên (máy dev đang dùng 24).
- Máy quét mã vạch USB (gõ mã rồi Enter), máy in hóa đơn nhiệt 80mm đặt làm máy in mặc định của Windows. Máy in tem decal (tùy chọn) để in tem mã vạch.

## Cài đặt

```bash
npm install
```

Nếu mạng công ty chặn registry, tạo `.npmrc` trỏ `registry=https://registry.npmjs.org/` (file này không đưa vào git).

## Chạy khi phát triển

```bash
npm run dev
```

- Giao diện: `http://localhost:5180` (Vite, tự reload). Trên điện thoại: `http://<IP máy>:5180`.
- API: `http://localhost:3000/api`. Vite proxy `/api` sang cổng 3000.
- CSDL: `data/grocery.db` (tự tạo, chạy migration lúc khởi động).

## Chạy thật (production)

Trên máy quầy (Windows 10/11, đã cài Node.js 20+): nhấp đúp `scripts\install.cmd`. Script sẽ build, tạo biểu tượng **Tiny POS** trong thư mục Startup (bật máy là tự chạy) và trên Desktop (mở màn hình bán hàng), rồi hỏi quyền quản trị một lần để mở cổng 3000 cho điện thoại.

- Biểu tượng *Tiny POS*: bảo đảm server đang chạy rồi mở Chrome/Edge chế độ ứng dụng với `--kiosk-printing` (in không hỏi).
- Điện thoại cùng Wi-Fi: `http://<IP máy>:3000` (install in IP ra cuối).
- Trang *Tổng quan* (`http://<IP máy>:3000/overview`, mục đầu menu): số liệu hôm nay, 7 ngày, hàng sắp hết, khách nợ lâu, nợ NCC, kiểm kê dở, tình trạng sao lưu; tự làm mới mỗi phút. Máy quầy mở app vẫn vào thẳng Bán hàng.
- Khách trả hàng: *Hóa đơn* → bấm vào đơn → *Trả hàng*; danh sách phiếu ở *Trả hàng* (menu Bán hàng). Phiếu tính vào ngày trả, hủy được.
- Trả hàng cho nhà cung cấp: *Trả NCC* (menu Kho hàng) → *Lập phiếu trả*, hoặc *Nhà cung cấp* → mở NCC → *Trả hàng*. Trừ nợ NCC trước, phần dư ghi là NCC trả tiền mặt; hủy phiếu thì tồn và nợ về như cũ.
- In tem mã vạch: *In tem* (menu Kho hàng), hoặc ⋯ → *In tem* ở Sản phẩm, *In tem* trong phiếu nhập. Hàng chưa có mã được cấp mã nội bộ bắt đầu bằng `20`. Chọn khổ tem trong *Cài đặt → Tem mã vạch*. Tem mở trong một cửa sổ riêng có hộp chọn máy in: lần đầu chọn máy in tem, các lần sau Chrome tự nhớ; hóa đơn vẫn in thẳng ra máy hóa đơn.
- Log server: `data\server.log` (ghi đè mỗi lần chạy).
- Cập nhật phiên bản: `scripts\update.cmd` (dừng, `git pull`, build, chạy lại). Gỡ: `scripts\uninstall.cmd` (giữ `data\`).
- Chạy tay không cài: `npm run build` rồi `scripts\start.cmd` (hoặc `npm start`); dừng: `scripts\stop.cmd`.

Lưu ý:

- Chỉ dùng trong mạng nhà. Không mở cổng 3000 ra Internet vì chưa có đăng nhập.
- Đặt thư mục dự án (đặc biệt `data/`) trên ổ cứng của máy, không đặt trên USB hay ổ mạng: SQLite chế độ WAL không an toàn trên đó. (Bản sao lưu thì chép sang USB được, xem dưới.)
- Muốn xóa sạch dữ liệu thử nghiệm: dừng server rồi xóa thư mục `data/`.

## Sao lưu và khôi phục

- Server tự sao lưu `data/grocery.db` vào `data/backups/grocery-YYYYMMDD-HHMMSS-auto.db` khi khởi động và mỗi ngày một lần (chỉ khi có thay đổi); giữ 30 bản tự động gần nhất. *Cài đặt → Sao lưu dữ liệu* có nút *Sao lưu ngay*.
- **Nên** điền *Thư mục chép thêm* là USB (`E:\`) hoặc thư mục OneDrive/Google Drive đã cài trên máy: mỗi bản sao được chép thêm sang đó, máy hỏng vẫn còn dữ liệu. USB rút ra thì thẻ hiện cảnh báo, sao lưu chính vẫn chạy.
- Khôi phục: trong danh sách bản sao bấm *Khôi phục*; dữ liệu hiện tại được tự sao lưu thành bản *Trước khôi phục* rồi mới thay. Không cần dừng server.
- Mang sang máy mới: cài như trên, rồi *Khôi phục từ file…* chọn file `.db` chép từ máy cũ (hoặc *Tải về* ở máy cũ). Bản sao từ phiên bản phần mềm cũ hơn dùng được; từ phiên bản mới hơn phải cập nhật phần mềm trước.

## Lệnh khác

| Lệnh | Việc |
|---|---|
| `npm run typecheck` | Kiểm tra kiểu TypeScript cả 3 workspace |
| `npm test` | Chạy vitest (`shared`, `server`) |
| `npm run db:generate` | Sinh migration mới sau khi sửa `server/src/db/schema.ts` |
| `npm run seed` | Nạp dữ liệu mẫu (10 danh mục, ~80 mặt hàng, thùng/lốc, hàng cân, hàng sắp hết; 5 nhà cung cấp, 10 phiếu nhập 12 ngày gần đây có nợ/trả một phần/1 phiếu hủy) vào `data/grocery.db`; chạy lại không tạo trùng. Dữ liệu ở `server/src/seed/seed-data.ts` |
| `scripts\install.cmd` | Cài trên máy quầy: build, tự chạy cùng Windows, biểu tượng Desktop, mở cổng 3000 |
| `scripts\update.cmd` | Cập nhật máy quầy: dừng, `git pull`, build, chạy lại |

## Cấu trúc

- `shared/` – zod schema, types, tiện ích tiền/CSV dùng chung (build ra `dist/`).
- `server/` – Express 5 + Drizzle + better-sqlite3. Service nhận `db` làm tham số nên test được bằng DB `:memory:`.
- `client/` – React 19 + Vite + Tailwind v4 + TanStack Query, PWA. (Đề bài ghi React 18, nhưng shadcn/ui v4 viết cho React 19: component không dùng `forwardRef` nên với React 18 mọi chỗ `asChild` bị mất `ref`, ví dụ menu thao tác của bảng sản phẩm không định vị được.) Giao diện dùng [shadcn/ui](https://ui.shadcn.com) (thư mục `src/components/ui`, alias `@/`) và icon `lucide-react`; thêm component mới bằng `npx shadcn@latest add <tên>` trong thư mục `client/`. Font Geist tự host (gói `@fontsource-variable/geist`) nên chạy được offline.
- `docs/superpowers/` – spec và kế hoạch từng giai đoạn.

## Kiểm thử thủ công Giai đoạn 1

1. **Danh mục**: vào *Danh mục*, thêm "Đồ uống" và "Bánh kẹo"; bấm vào tên để đổi tên; dùng ↑↓ đổi thứ tự; F5 vẫn đúng thứ tự; xóa một danh mục có sản phẩm → sản phẩm về "Không danh mục".
2. **Sản phẩm**: bấm *+ Thêm sản phẩm*, nhập tên, giá bán, tồn đầu 10 → lưu. Bấm *Sửa*, đổi tồn thành 8 → lưu (server ghi movement adjust -2). Bấm *Ngừng bán*, bật "Hiện hàng ngừng bán", bấm *Bán lại*.
3. **Đơn vị quy đổi**: mở *Sửa* một sản phẩm, ở mục "Đơn vị quy đổi" thêm "Thùng", mã vạch riêng, = 24, giá bán (Enter trong các ô này chỉ thêm đơn vị, không lưu form). Thử thêm đơn vị có mã trùng mã sản phẩm → toast đỏ "Mã vạch đã tồn tại". Đơn vị chỉ có thêm/xóa, muốn sửa thì xóa rồi thêm lại.
4. **Nhập sai**: sửa giá bán thành chữ "abc" → toast đỏ có chữ "Giá bán".
5. **Nhập nhanh**: vào *Nhập nhanh*, gõ mã lạ + Enter → form mở với mã điền sẵn, con trỏ ở ô Tên; gõ tên, Enter → toast xanh, form đóng, ô quét lại có focus. Quét lại mã đó → thẻ thông tin. Quét mã thùng → ghi rõ "Mã của Thùng (= 24 …)". Khi form đang mở, gõ mã + Enter không mở tra cứu mới.
6. **Excel**: ở *Sản phẩm* bấm *Xuất Excel* → file `san-pham-YYYYMMDD.xlsx` mở bằng Excel thấy tiếng Việt, tiền dạng `15.000`, lọc được. Sửa giá, thêm 1 dòng mới, để trống Tên ở 1 dòng, lưu rồi *Nhập từ Excel* chọn file đó → báo số tạo / cập nhật / lỗi theo dòng; tồn của hàng cũ không đổi, hàng không mã vạch không bị tạo trùng. File `.csv` cũ vẫn nhập được. Chưa có hàng nào thì trong hộp thoại nhập bấm *Tải file mẫu* (`mau-san-pham.xlsx`, có sheet hướng dẫn), điền rồi nhập. Hóa đơn, Nhập hàng, Khách hàng, NCC cũng có *Xuất Excel* theo đúng bộ lọc đang bật.
7. **Điện thoại**: mở `http://<IP máy>:5180` (dev) hoặc `:3000` (prod), menu chuyển thành thanh dưới.

## Kiểm thử thủ công Giai đoạn 2

Chuẩn bị: `npm run seed`, rồi vào *Cài đặt* nhập tên cửa hàng, chọn ngân hàng, số tài khoản, tên chủ tài khoản → *Lưu* → *In thử* (hóa đơn rộng 80mm, chữ không bị cắt).

In không hỏi: tạo shortcut `chrome.exe --app=http://localhost:3000 --kiosk-printing` và đặt máy in nhiệt làm máy in mặc định; khi in, khổ giấy do CSS `@page { size: 80mm auto }` quyết định.

1. **Quét**: vào *Bán hàng*, quét một mã → món vào giỏ; quét lại → số lượng 2; quét mã thùng → dòng riêng "· Thùng". Quét mã lạ → toast đỏ "Không có mã …". Quét hàng đã ngừng bán → toast đỏ, không thêm.
2. **Tìm**: gõ "mì" → gợi ý; ↓ + Enter thêm món. Gõ mã số rồi Enter vẫn tra mã vạch.
3. **Hàng cân**: chọn hàng cân → gõ 0,35 kg thấy thành tiền; hoặc gõ 20.000đ thấy số kg. Bấm số kg trong giỏ để sửa.
4. **Sửa dòng**: đổi số lượng, sửa đơn giá, xóa dòng; vượt tồn → nhãn vàng "Tồn còn N" nhưng vẫn thanh toán được.
5. **Món ngoài (F4)**, **giảm giá** (lớn hơn tổng → chữ đỏ, nút Thanh toán khóa).
6. **Đơn chờ**: *Cất chờ* → giỏ trống, có chip "Chờ 1"; bán đơn khác; bấm chip → giỏ cũ quay lại. F5 → giỏ và đơn chờ vẫn còn.
7. **Tiền mặt (F9)**: bấm gợi ý 100.000 → tiền thối đúng; Enter → toast mã `HD-YYYYMMDD-0001`, in hóa đơn, khung "Tiền thối" chữ lớn. Nhấn Enter liên tục chỉ tạo 1 đơn.
8. **Chuyển khoản**: QR hiện đúng số tiền (quét thử bằng app ngân hàng); *In tạm tính kèm QR* in phiếu "TẠM TÍNH"; *Đã nhận tiền* tạo đơn.
9. **Hóa đơn**: vào *Hóa đơn* thấy các đơn hôm nay và tổng tiền mặt / chuyển khoản; mở một đơn → *In lại*; *Hủy đơn* → badge "Đã hủy", tổng giảm, tồn ở *Sản phẩm* được cộng lại.
10. **Điện thoại**: mở `http://<IP máy>:3000/sell` → thêm món được (không lỗi secure context), thanh "Phải trả / Thanh toán" dính đáy màn hình.

## Kiểm thử thủ công Giai đoạn 3

1. **Nhà cung cấp**: *Nhà cung cấp* → *Thêm nhà cung cấp* "Đại lý Hùng". Mở lại → nút *Trả nợ* bị khóa khi chưa nợ.
2. **Nhập theo thùng**: *Nhập hàng* → *Tạo phiếu nhập* → chọn "Đại lý Hùng" → quét mã thùng của một sản phẩm → dòng chọn sẵn "Thùng", giá nhập = giá vốn × 24. Sửa số lượng 2, giá nhập 240.000, giá bán thùng 290.000 (hiện "giá mới", % lãi). "Đã trả" 400.000 → "Ghi nợ: 80.000đ" → **Lưu phiếu (F9)**. Sản phẩm: tồn +48, giá vốn 10.000; thùng giá bán 290.000; NCC nợ 80.000.
3. **Mã lạ**: trong phiếu nhập quét mã chưa có → form thêm sản phẩm với mã điền sẵn → lưu → dòng tự vào phiếu.
4. **Không ghi NCC**: chọn "Không ghi nhà cung cấp" → ô "Đã trả" khóa bằng tổng.
5. **Nháp**: thêm vài dòng, F5 → phiếu vẫn còn.
6. **Trả nợ**: mở "Đại lý Hùng" → *Trả nợ* 30.000 → sổ nợ có dòng −30.000, còn 50.000. Thử trả 60.000 → báo lỗi.
7. **Hủy phiếu**: *Nhập hàng* → mở phiếu → *Hủy phiếu* → tồn −48, nợ NCC trừ lại, giá vốn giữ nguyên.
8. **Kiểm kê**: *Kiểm kê* → *Bắt đầu kiểm kê* → quét một món, nhập số đếm khác tồn → thấy chênh lệch. Sang máy khác (hoặc tab khác) bán 1 món đó → quay lại *Chốt kiểm kê* → tồn cuối = số đếm − 1.
9. **Kiểm kê từng phần / hủy**: mở phiên mới, đếm 1 món rồi *Hủy phiên* → tồn không đổi; lịch sử có phiên "Đã hủy".
10. **Lịch sử tồn**: *Sản phẩm* → ⋯ → *Lịch sử tồn* → thấy Nhập (PN-…), Bán (HD-…), Điều chỉnh (KK-… / Hủy PN-…).
11. **Điện thoại**: thanh dưới có Bán hàng, Hóa đơn, Kiểm kê, Sản phẩm, *Thêm*; *Thêm* mở menu các mục còn lại.

## Kiểm thử thủ công Giai đoạn 4

1. **Thêm khách có nợ cũ**: *Khách hàng* → *Thêm khách* "Chị Lan", nợ đầu kỳ 350.000 → danh sách hiện nợ 350.000, sổ nợ có dòng "Nợ đầu kỳ".
2. **Ghi nợ khi bán**: *Bán hàng* → thêm món 50.000 → *Thanh toán* → tab *Ghi nợ* → chọn "Chị Lan", khách trả trước 20.000 → thấy Nợ cũ 350.000, Ghi nợ đơn này 30.000, Tổng nợ 380.000 → Enter. Hóa đơn in có tên khách, Nợ cũ, Tổng nợ.
3. **Khách mới ngay tại quầy**: tab *Ghi nợ* → gõ tên chưa có → *+ Thêm khách "…"* → khách được chọn luôn.
4. **Trả đủ không cho ghi nợ**: gõ trả trước bằng số phải trả → nút khóa, nhắc chọn Tiền mặt.
5. **Thu nợ**: mở "Chị Lan" → *Thu nợ* 100.000, Chuyển khoản → hiện QR đúng số tiền → xác nhận → *In biên nhận*. Sổ nợ có dòng "Thu nợ (CK)", còn 280.000.
6. **Ghi nợ tay**: *Ghi nợ tay* 5.000, ghi chú "quên ghi" → nợ tăng 5.000.
7. **Hủy đơn ghi nợ**: *Hóa đơn* → mở đơn ghi nợ → *Hủy đơn* → nợ khách trừ lại 30.000; sổ có dòng "Hủy đơn".
8. **Tổng kết ngày**: trang *Hóa đơn* có thẻ Ghi nợ và Thu nợ (TM/CK); tiền mặt trong két = thẻ Tiền mặt + thu nợ tiền mặt.
9. **Xóa khách**: khách còn nợ thì không có nút *Xóa*; thu hết nợ → *Xóa* được.

## Kiểm thử thủ công – Giao diện 0.5.0

1. Mở máy tính: sidebar trắng có tên cửa hàng, 3 nhóm menu, chân ghi *Phiên bản 0.5.0*. Tiêu đề và nút của trang nằm trên thanh trên cùng.
2. *Cài đặt → Giao diện (trên máy này)*: đổi màu nhấn, cỡ chữ, mật độ, bo góc, chế độ sáng/tối → thấy đổi ngay; tải lại trang vẫn giữ, không nháy. *Khôi phục mặc định* về xanh dương, chữ Vừa.
3. *Hóa đơn* → *Bộ lọc* → *Tùy chọn…*: lịch tiếng Việt, tuần bắt đầu Thứ Hai; chip khoảng ngày hiện `dd/mm` (từ 0.6.0 ô ◀ ngày ▶ được thay bằng bộ lọc thời gian).
4. *Bán hàng*: quét 2 món, *Cất chờ* → có tab *Chờ 1*; bấm tab mở lại đúng giỏ. F2/F4/F9 như cũ. In thử hóa đơn vẫn khổ 80mm.
5. Điện thoại: thanh dưới 4 mục + *Thêm*; nút chính của trang là nút icon trên header, các nút khác trong ⋯; không trang nào cuộn ngang, kể cả cỡ chữ *Rất lớn*.

## Kiểm thử thủ công – Bộ lọc 0.6.0

1. *Hóa đơn* → *Bộ lọc* → *Tháng này* + *Ghi nợ*: chip hiện, số liệu là của cả tháng; tải lại trang vẫn giữ lọc. Bấm × ở chip *Ghi nợ* chỉ bỏ lọc đó.
2. Gõ "sua" vào ô tìm: ra các hóa đơn có hàng "Sữa…". Chọn *Tùy chọn…* rồi chọn khoảng ngày trên lịch.
3. *Nhập hàng* → *Không ghi NCC*, *Chỉ phiếu còn nợ*: danh sách đúng; *Xóa lọc* về hôm nay.
4. *Sản phẩm* → *Sắp hết*, *Giá bán* từ–đến, *Sắp xếp giá giảm dần*; từ *Danh mục* → *Xem sản phẩm* vẫn lọc đúng danh mục.
5. *Khách hàng*/*Nhà cung cấp* → *Chỉ người đang nợ*, *Hiện cả người đã xóa* (dòng mờ, nhãn "Đã xóa"), *Nợ nhiều nhất*.
6. Điện thoại: *Bộ lọc* mở bảng trượt từ dưới lên, nút *Xem n …* đóng bảng; không trang nào cuộn ngang.

## Kiểm thử thủ công – Báo cáo 0.8.0

1. *Báo cáo* mở ra là *Tháng này*, thẻ *Lãi lỗ*: Doanh thu, Giá vốn, Lãi gộp (% doanh thu), Số đơn; hàng dưới Tiền mặt / Chuyển khoản / Ghi nợ / Thu nợ bằng đúng trang *Hóa đơn* cùng khoảng. Bảng theo ngày có dòng Tổng; chọn khoảng dài hơn 31 ngày thì gom theo tháng.
2. Thẻ *Mặt hàng*: giá trị tồn theo giá vốn / giá bán, ô *Sắp hết* và *Hết hàng* bấm sang *Sản phẩm* với bộ lọc tương ứng; *Bán chạy* xếp theo Doanh thu / Số lượng / Lãi (lưu trên URL), có dòng tổng; *Không bán được trong kỳ* liệt kê hàng còn tồn mà không bán.
3. Thẻ *Công nợ*: nợ khách / nợ NCC hiện tại, ghi nợ và thu nợ trong kỳ; bấm một dòng *Khách nợ nhiều nhất* sang *Khách hàng* với tên điền sẵn.
4. *Xuất Excel* ở mỗi thẻ ra file `bao-cao-…-FROM-TO.xlsx` đúng khoảng đang xem, có dòng Tổng.
5. Điện thoại: *Thêm* → *Báo cáo*; không cuộn ngang; bảng Lãi lỗ ẩn cột Giá vốn và ba cột hình thức thanh toán, bảng Bán chạy chỉ hiện cột tiền đang xếp theo.

## Kiểm thử thủ công – Sao lưu & cài đặt 0.9.0

1. **Tự sao lưu**: khởi động server → console "Sao lưu tự động: grocery-…-auto.db", file có trong `data/backups`. Khởi động lại trong ngày → không thêm bản.
2. **Sao lưu ngay**: *Cài đặt → Sao lưu dữ liệu → Sao lưu ngay* → toast xanh, dòng mới "Thủ công" đầu danh sách; *Tải về* tải file đúng tên.
3. **Thư mục chép thêm**: điền thư mục có thật (ví dụ `D:\sao-luu`) → Lưu → *Sao lưu ngay* → file có ở cả hai nơi. Điền thư mục không có → toast đỏ "Thư mục không tồn tại". Đổi tên thư mục đã lưu rồi *Sao lưu ngay* → dòng vàng "Không chép được sang …", bản vẫn tạo.
4. **Khôi phục**: bán thêm một đơn sau khi sao lưu → *Khôi phục* bản đó → xác nhận → toast xanh, trang Hóa đơn không còn đơn vừa bán, danh sách có bản "Trước khôi phục"; khôi phục lại bản đó → đơn quay lại.
5. **Khôi phục từ file**: chọn file `.txt` đổi đuôi `.db` → toast đỏ "File không phải dữ liệu Tiny POS hoặc đã hỏng", dữ liệu không đổi. Chọn file `.db` tải về ở bước 2 → khôi phục được.
6. **Scripts** (dừng `npm run dev` trước): `scripts\install.cmd` → Startup và Desktop có "Tiny POS", app mở chế độ kiosk; đăng xuất/đăng nhập → server tự chạy; điện thoại mở `http://<IP>:3000`. `scripts\uninstall.cmd` → biểu tượng mất, `data\` còn.

## Kiểm thử thủ công – Tổng quan 0.10.0

1. *Tổng quan* (mục đầu menu; điện thoại ô đầu thanh dưới): hai hàng số hôm nay bằng đúng trang *Hóa đơn* hôm nay; *So với hôm qua* đổi dấu/màu; ô *Hết hàng* bấm sang *Sản phẩm* lọc hết hàng.
2. *Cần chú ý*: không có gì thì "Mọi thứ ổn"; có kiểm kê đang mở → dòng "Kiểm kê KK-… đang dở" bấm *Tiếp tục*; có hàng dưới mức tối thiểu → "n mặt hàng sắp hết" bấm *Xem*; khách còn nợ mà quá 30 ngày không có giao dịch → "n khách nợ quá 30 ngày…"; sao lưu lỗi hoặc quá 2 ngày không có bản sao → dòng sao lưu bấm *Cài đặt*.
3. *7 ngày gần đây* có "Hôm nay"/"Hôm qua", dòng Tổng; *Hóa đơn hôm nay* 5 đơn mới nhất, đơn hủy gạch ngang; *Hàng sắp hết* tối đa 10 dòng + "và n mặt hàng nữa"; *Khách nợ* / *Nợ nhà cung cấp* 5 người, khách nợ lâu có dòng vàng "Giao dịch gần nhất dd/mm", bấm dòng sang trang với tên điền sẵn.
4. Bán một đơn ở tab khác rồi quay lại → số đổi ngay (invalidate), hoặc chờ ≤ 1 phút. Dừng server rồi *Làm mới* → dòng đỏ "Không tải được số liệu mới", số cũ vẫn hiện; mở trang khi server tắt → màn "Không tải được tổng quan" có nút *Thử lại*.
5. Điện thoại: thanh dưới Tổng quan · Bán hàng · Hóa đơn · Sản phẩm · Thêm (Kiểm kê nằm trong Thêm); không cuộn ngang. Đường dẫn gốc vẫn vào Bán hàng.

## Kiểm thử thủ công – Trả hàng 0.11.0

1. *Hóa đơn* → mở đơn tiền mặt có giảm giá → *Trả hàng* → trả 1 món, giữ *Nhập lại kho* → toast "Đã lập TH-…", bấm *In phiếu* ra "PHIẾU TRẢ HÀNG"; tồn sản phẩm tăng đúng (thùng tăng 24 lon); chi tiết đơn có "Đã trả …" và khối *Phiếu trả*.
2. Trả tiếp đến hết đơn (có dòng bỏ *Nhập lại kho*) → tổng các phiếu bằng đúng *Phải trả* của đơn; món bỏ nhập kho không cộng tồn; nút *Trả hàng* biến mất.
3. Đơn ghi nợ: khách còn nợ ít hơn tiền hoàn → hộp hiện "Trừ nợ khách" bằng số nợ, phần dư "Trả tiền mặt"; sổ nợ của khách có dòng *Trả hàng*.
4. Đơn còn phiếu trả: nút *Hủy đơn* bị khóa. *Trả hàng* → mở phiếu → *Hủy phiếu* → tồn và nợ về như trước, sổ nợ có *Hủy phiếu trả*; lúc này hủy được hóa đơn.
5. Trả hàng hôm nay cho đơn hôm qua: *Hóa đơn* hôm nay *Doanh thu*/*Tiền mặt* đã trừ, hint "Bán … · Trả …"; *Báo cáo* hôm qua không đổi, hôm nay có cột *Trả hàng*; *Tổng quan* hôm nay khớp *Hóa đơn*.
6. *Trả hàng*: lọc ngày / trạng thái / tìm "tui da" ra phiếu có Túi đá; *Xuất Excel* ra 2 sheet *Phiếu trả*, *Chi tiết*.

## Kiểm thử thủ công – Trả NCC và in tem 0.12.0

1. *Nhà cung cấp* → NCC đang nợ → *Trả hàng* → thêm 1 thùng bia → giá trả = giá nhập thùng; lưu → toast "Đã lập TN-…", *In phiếu* ra "PHIẾU TRẢ HÀNG NHÀ CUNG CẤP" có chỗ ký; tồn bia giảm 24 lon; sổ nợ NCC có dòng "Trả NCC TN-…", nợ giảm đúng.
2. Trả nhiều hơn số nợ → phần dư hiện "NCC trả tiền mặt"; nợ NCC về 0, không âm. Lịch sử tồn của bia có dòng *Trả NCC* kèm mã `TN-…`.
3. *Trả NCC* → mở phiếu → *Hủy phiếu* → tồn và nợ về như trước, sổ nợ có "Hủy phiếu trả NCC …". Lọc theo NCC / trạng thái / tìm tên hàng; *Xuất Excel* ra 2 sheet *Phiếu trả NCC*, *Chi tiết*.
4. *Cài đặt → Tem mã vạch*: chọn khổ đúng cuộn decal, *Lưu*, *In thử 1 tem* → cửa sổ in tem mở, hộp in hiện: chọn máy in tem, in. Đóng rồi *In thử* lần nữa → hộp in đã chọn sẵn máy tem. Bán một đơn và in hóa đơn → vẫn ra máy hóa đơn, không hỏi.
5. *In tem* → thêm một hàng chưa có mã (bánh tự gói) 3 tem → in → tem có tên, giá, mã `20…`; quét tem ở *Bán hàng* ra đúng món. Thêm một thùng chưa có mã → tem thùng có giá thùng, quét ra đúng đơn vị thùng.
6. Phiếu nhập → *In tem* → trang In tem điền sẵn số tem theo số lon đã nhập; hàng cân chỉ 1 tem.
