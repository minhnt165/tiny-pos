# Tiny POS – Quản lý tạp hóa

Phần mềm bán hàng cho tiệm tạp hóa nhỏ, chạy local trên 1 máy Windows, điện thoại trong nhà truy cập qua mạng LAN. Không cần Internet.

## Yêu cầu

- Node.js 20 trở lên (máy dev đang dùng 24).
- Máy quét mã vạch USB (gõ mã rồi Enter), máy in hóa đơn nhiệt 80mm đặt làm máy in mặc định của Windows.

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

```bash
npm run build
npx pm2 start ecosystem.config.cjs
npx pm2 save
```

Mở `http://localhost:3000`. Điện thoại: `http://<IP máy>:3000`. Server phục vụ luôn giao diện đã build từ `client/dist`.

Lưu ý:

- Chỉ dùng trong mạng nhà. Không mở cổng 3000 ra Internet vì chưa có đăng nhập.
- Đặt thư mục dự án (đặc biệt `data/`) trên ổ cứng của máy, không đặt trên USB hay ổ mạng: SQLite chế độ WAL không an toàn trên đó.
- Muốn xóa sạch dữ liệu thử nghiệm: dừng server rồi xóa thư mục `data/`.

Tạo shortcut Chrome ở quầy (giai đoạn 5 sẽ có script): `chrome.exe --app=http://localhost:3000 --kiosk-printing`.

## Lệnh khác

| Lệnh | Việc |
|---|---|
| `npm run typecheck` | Kiểm tra kiểu TypeScript cả 3 workspace |
| `npm test` | Chạy vitest (`shared`, `server`) |
| `npm run db:generate` | Sinh migration mới sau khi sửa `server/src/db/schema.ts` |
| `npm run seed` | Nạp dữ liệu mẫu (10 danh mục, ~80 mặt hàng, thùng/lốc, hàng cân, hàng sắp hết; 5 nhà cung cấp, 10 phiếu nhập 12 ngày gần đây có nợ/trả một phần/1 phiếu hủy) vào `data/grocery.db`; chạy lại không tạo trùng. Dữ liệu ở `server/src/seed/seed-data.ts` |

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
6. **CSV**: *Nhập / Xuất CSV* → *Tải file CSV*, mở bằng Excel thấy tiếng Việt đúng. Sửa giá, thêm 1 dòng mới, để trống Tên ở 1 dòng, lưu CSV rồi nhập lại → báo số tạo / cập nhật / lỗi theo dòng; tồn của hàng cũ không đổi.
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
