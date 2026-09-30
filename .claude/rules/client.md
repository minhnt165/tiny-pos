---
paths:
  - "client/src/**"
---

# Quy ước client

- **Gọi API**: mỗi nhóm có file trong `src/api/` với hook TanStack Query (`useSuppliers`, `useSaveSupplier`…), gọi qua `api<T>(path, { method, json })` trong `api/client.ts`. Mutation xong thì `invalidateQueries` theo tiền tố key. Kiểu dữ liệu lấy từ `@tiny-pos/shared` (`XxxInputBody` cho body gửi lên).
- **Component**:
  - Dùng shadcn trong `components/ui`, alias `@/`, `cn` từ `@/lib/utils`, icon lucide-react.
  - Ô nhập của form dùng `TextField` và `SelectField`; ô số hoặc tiền chỉ ghi khi Enter hoặc blur thì dùng `CommitInput`.
  - Trạng thái rỗng dùng `EmptyState`, xác nhận dùng `ConfirmDialog`, tiêu đề trang dùng `PageHeader`.
- **Radix Select**: `SelectItem` không được có `value=''`, nên giá trị "không chọn" là `NONE` trong `SelectField`. Radix có thể tự bắn `onValueChange('')` khi `value` đổi lúc option chưa mount; `SelectField` đã bỏ qua trường hợp này. Đừng gỡ chỗ bỏ qua đó.
- **Quầy bán**:
  - Ô quét luôn giữ focus sau mỗi thao tác (`useScanInput`, `scan.focus()` cả khi lỗi).
  - Phím tắt F4/F9 phải bỏ qua khi đang mở `[role=dialog]`/`[role=alertdialog]`, và phải chốt giá trị đang gõ (blur) trước khi lưu.
  - Chống bấm hai lần: khóa theo `isPending`.
- **Điện thoại** (390px):
  - Nút và ô bấm cao ít nhất 44px (`h-11`).
  - Bảng ẩn cột phụ dưới `sm`; không được cuộn ngang cả trang.
  - Menu dưới đáy có mục *Thêm* (`MobileMoreMenu`).
- **Tiền**: hiển thị bằng `formatMoney` (shared), ô nhập tiền dùng `moneyChange`/`groupThousands` trong `lib/money-input.ts`; không tự `toLocaleString`.
- **Lưu tạm trên trình duyệt** (nháp giỏ hàng, phiếu nhập nháp) đi qua `lib/storage.ts` (có try/catch).
- **In**: hóa đơn 80mm nằm trong `components/receipt`, CSS `@page { size: 80mm auto }`. In xong mới mở lại giao diện (chờ `afterprint`).
- Client không có test tự động. Sau khi sửa phải `npm run typecheck -w client` và kiểm trên trình duyệt (skill `browser-verify`).
