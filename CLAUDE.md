# tiny-pos

Phần mềm bán hàng cho tiệm tạp hóa nhỏ: chạy local trên 1 máy Windows, điện thoại trong nhà vào qua LAN, không cần Internet, chưa có đăng nhập. Người dùng là chủ tiệm (không rành máy tính) đứng quầy với máy quét mã vạch USB và máy in nhiệt 80mm.

## Lệnh

| Lệnh | Việc |
|---|---|
| `npm run dev` | shared (watch) + server `:3000` + client Vite `:5180` (proxy `/api` → 3000) |
| `npm run typecheck` | tsc cả 3 workspace (build `shared` trước) |
| `npm test` | vitest `shared` + `server` (client chưa có test) |
| `npm run build` | build production; server phục vụ luôn `client/dist` ở `:3000` |
| `npm run db:generate` | sinh migration sau khi sửa `server/src/db/schema.ts` |
| `npm run seed` | nạp dữ liệu mẫu vào `data/grocery.db`, chạy lại không tạo trùng |
| `scripts\install.cmd` | cài trên máy quầy (build, tự chạy cùng Windows, biểu tượng, tường lửa); `update.cmd`, `uninstall.cmd`, `start.cmd`, `stop.cmd` cùng thư mục |

Test một file: `cd server && npx vitest run src/services/imports.test.ts`.

Cổng 5173/5174 là của dự án khác trên máy này: không dùng, không kill tiến trình nào mình không tự bật.

## Kiến trúc

npm workspaces, TypeScript ESM:

- `shared/` – zod schema (`src/schemas/`), types (`types.ts`), logic thuần dùng chung cả 2 phía: tiền (`money.ts`), giỏ hàng (`cart.ts`, `order-math.ts`), phiếu nhập nháp (`import-draft.ts`, `inventory-math.ts`), ngày địa phương (`local-date.ts`), VietQR, CSV. Server và client import từ `dist/` qua `@tiny-pos/shared`, nên **sửa shared thì phải build lại** (`npm run dev` tự watch; chạy test/typecheck từ gốc repo cũng tự build).
- `server/` – Express 5 + drizzle-orm + better-sqlite3 (WAL, foreign keys bật). `routes/` mỏng: validate bằng schema shared rồi gọi `services/`. Service nhận `db` làm tham số, test bằng `createTestDb()` (SQLite `:memory:` chạy migration thật).
- `client/` – React 19 + Vite 7 + Tailwind v4 + TanStack Query 5 + react-router 7, PWA. UI bằng shadcn/ui (style `radix-nova`, gói `radix-ui`) + icon lucide-react. Version ở `package.json` gốc (Vite chèn `__APP_VERSION__`); tùy chọn giao diện theo máy ở `lib/ui-prefs.ts` (`data-*` trên `<html>`).
- `docs/superpowers/specs|plans/` – spec và kế hoạch từng giai đoạn. Đọc spec của giai đoạn liên quan trước khi sửa hành vi nghiệp vụ.

Đã xong: Giai đoạn 1 (sản phẩm, danh mục, đơn vị quy đổi, CSV), 2 (bán hàng, hóa đơn 80mm, VietQR, cài đặt), 3 (nhập hàng, nhà cung cấp + công nợ, kiểm kê, lịch sử tồn), 4 (khách hàng, công nợ khách), làm mới giao diện 0.5.0 (sidebar nhóm menu, tùy chỉnh giao diện theo máy, version), bộ lọc nâng cao 0.6.0 (khoảng ngày, lọc chứng từ ở server, lọc sản phẩm/khách/NCC ở trình duyệt, lưu trên URL), Excel 0.7.0 (xuất `.xlsx` 5 danh sách theo bộ lọc, nhập sản phẩm từ `.xlsx`/`.csv`, `exceljs` chỉ ở server), Báo cáo 0.8.0 (lãi lỗ / mặt hàng / công nợ theo khoảng ngày, xuất Excel; `services/reports.ts`, dùng chung `daySummary` với trang Hóa đơn), Sao lưu & cài đặt 0.9.0 (sao lưu tự động/thủ công, khôi phục qua ATTACH trong `services/backups.ts`, thẻ Sao lưu trong Cài đặt, `scripts/` cài trên Windows), Tổng quan 0.10.0 (trang `/overview`, một API `services/overview.ts` gom 7 ngày từ `profitReport`, hóa đơn hôm nay, tồn thấp, khách nợ lâu `DEBT_OVERDUE_DAYS` = 30, nợ NCC, kiểm kê dở, sao lưu; thanh dưới điện thoại: Tổng quan · Bán hàng · Hóa đơn · Sản phẩm, gốc vẫn vào Bán hàng), Trả hàng 0.11.0 (phiếu `TH` gắn hóa đơn `done`, `services/returns.ts` + `return-rows.ts`, tiền hoàn theo giá trị sau giảm giá ở `shared/return-math.ts`, đơn ghi nợ trừ nợ trước rồi trả tiền mặt, trang `/returns`), Trả NCC & in tem 0.12.0 (phiếu `TN` không gắn phiếu nhập trong `services/supplier-returns.ts`, trừ nợ NCC trước rồi NCC trả tiền mặt; in tem qua `services/labels.ts` cấp EAN-13 nội bộ `20…`, cửa sổ in tem riêng `label-window.ts` hồ sơ `data/label-browser` không `--kiosk-printing`, trang `/supplier-returns`, `/labels`, `/labels/print`).

## Bất biến nghiệp vụ (không được phá)

- **Tiền** là số nguyên đồng (không có phần lẻ), trần `MAX_MONEY` (1 tỷ). **Tồn kho** là số thực theo đơn vị gốc (hàng cân theo kg).
- **Mọi thay đổi tồn kho** đi qua `recordMovement` (`server/src/services/stock.ts`), trong cùng transaction với chứng từ. Không `update products set stock` trực tiếp.
- **Mọi thay đổi nợ nhà cung cấp** đi qua `recordSupplierTx` (`services/supplier-ledger.ts`), cùng transaction.
- **Mọi thay đổi nợ khách** đi qua `recordCustomerDebtTx` (`services/customer-ledger.ts`), cùng transaction. Hóa đơn ghi nợ: `paid` là tiền mặt trả trước, nợ = `payable − paid`.
- **Mã chứng từ** theo ngày địa phương qua `nextDailyCode`: `HD-YYYYMMDD-NNNN` (hóa đơn), `PN-YYYYMMDD-NNNN` (phiếu nhập), `KK-YYYYMMDD-NN` (kiểm kê), `TH-YYYYMMDD-NNNN` (phiếu trả), `TN-YYYYMMDD-NNNN` (phiếu trả NCC). Thời gian truyền qua `Clock` (`services/daily-code.ts`) để test không phụ thuộc máy.
- **Chứng từ không sửa, chỉ hủy**: hủy đơn/phiếu nhập ghi movement bù và bút toán nợ bù, không xóa dòng.
- **Trả hàng** chỉ qua `services/returns.ts`: gắn hóa đơn `done`, mỗi dòng ≤ số đã mua − số đã trả; tính vào ngày lập phiếu; hóa đơn còn phiếu trả chưa hủy thì không hủy được.
- **Trả NCC** chỉ qua `services/supplier-returns.ts`: không gắn phiếu nhập, không đổi giá vốn, không vào `daySummary`/lãi lỗ; trừ nợ NCC hiện tại trước, phần dư là NCC trả tiền mặt; NCC đã xóa thì không hủy được phiếu đã trừ nợ.
- **Mã vạch nội bộ** `20…` (EAN-13) chỉ cấp qua `assignBarcodes` (`services/labels.ts`), nối tiếp mã `20…` hợp lệ lớn nhất và mốc đã cấp (`settings.internalBarcodeSeq`, để mã của hàng đã xóa không bị cấp lại), không ghi đè mã đã có.
- **Giá vốn** = giá nhập lần gần nhất, quy về đơn vị gốc (giá thùng / factor).
- **Kiểm kê**: chênh lệch tính theo tồn tại lúc đếm; món không đếm thì bỏ qua; chốt ghi movement `adjust`.
- Sản phẩm ngừng bán: không bán được, nhưng vẫn nhập hàng và kiểm kê được.
- **Báo cáo chỉ đọc**: tính từ hóa đơn `done` và snapshot `cost_price` trên dòng hóa đơn (không nhân `factor`), trừ phiếu trả `done` theo ngày lập phiếu (giá vốn chỉ trừ phần nhập lại kho); số tiền mặt / CK / ghi nợ / thu nợ lấy từ `daySummary` (`services/orders.ts`) để luôn khớp trang Hóa đơn. Tồn kho và công nợ trong báo cáo là số **hiện tại**, không theo khoảng ngày.
- **Sao lưu/khôi phục** chỉ qua `services/backups.ts`: không chép đè `data/grocery.db` khi server đang chạy; khôi phục luôn tạo bản `before-restore` trước và chạy trong một transaction; bản sao từ phiên bản mới hơn bị từ chối.

## Quy ước làm việc

- **Ngôn ngữ**: text trên UI, thông báo lỗi API, comment trong code, commit message đều bằng tiếng Việt.
- **Không format lại file có sẵn**: diff chỉ chứa đúng dòng cần đổi, không thụt lề lại, không sắp xếp lại import của code không liên quan. Repo không có prettier/eslint; theo phong cách xung quanh (2 space, nháy đơn, có `;`, dòng dài tới ~130 ký tự). Trước khi commit xem `git diff --stat`; file cũ có số dòng đổi lớn bất thường thì kiểm tra lại.
- **Git**: làm trên một nhánh (`master`), không tạo nhánh mới cho từng việc. Không chia nhỏ commit: mỗi đợt việc/đợt sửa một commit. Commit theo dạng `feat(server): …`, `fix(client): …`, `docs: …`, `chore: …`.
- **UI**: dùng component shadcn có sẵn trong `client/src/components/ui` và component dùng chung trong `client/src/components`; thiếu thì `npx shadcn@latest add <tên>` trong `client/`. Không tự viết component thô. Tiêu đề + nút của trang dùng `PageTitle` (vẽ lên topbar), danh sách dùng `ListPanel`, số liệu `StatStrip`, bộ lọc `FilterBar` + `useUrlFilters`, chọn ngày `DateRangeFilter`/`DateField`; màu lấy từ token CSS (`primary`, `success`, `warning`, `destructive`), không viết mã màu trong trang.
- **Kiểm thử giao diện**: thay đổi ở client phải kiểm trên trình duyệt thật (xem skill `browser-verify`), vì client không có test tự động. Không ghi vào DB dev của người dùng khi kiểm.
- **Migration**: DB dev đã chạy tới `0005`. Đổi schema thì tạo migration mới, không sửa migration đã có (xem `.claude/rules/database.md`).

## Môi trường

- Mạng công ty chặn TLS bằng CA riêng: lỗi `self-signed certificate`/`UNABLE_TO_GET_ISSUER_CERT` khi `npm install`, `npx shadcn` … thì đặt `NODE_EXTRA_CA_CERTS=<repo>/.certs/corp-root.pem`. Không bao giờ tắt kiểm tra TLS (`NODE_TLS_REJECT_UNAUTHORIZED=0`, `strict-ssl=false`).
- `.npmrc`, `.certs/`, `data/` không đưa vào git.
- Windows: shell là PowerShell/Git Bash; máy không có Python, script phụ viết bằng Node.
