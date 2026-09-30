---
paths:
  - "server/src/**"
---

# Quy ước server

- **Route mỏng**: `validateBody(schema)` / `validateQuery(schema)` với schema từ `@tiny-pos/shared`, `intParam(req, 'id')` cho tham số số, rồi gọi service. Logic nghiệp vụ nằm trong `services/`, không nằm trong route. Mỗi router là hàm `xxxRouter(db)` gắn trong `routes/index.ts`.
- **Lỗi**: ném `BadRequestError` (400), `NotFoundError` (404), `ConflictError` (409) từ `errors.ts`, thông điệp tiếng Việt người bán đọc hiểu được ("Trả nhiều hơn số đang nợ"). `errorHandler` biến mọi lỗi thành `{ error }`; zod → 400 với nhãn trường từ `FIELD_LABELS` trong shared.
- **Transaction**: thao tác ghi nhiều bảng bọc trong `db.transaction((tx) => …)`. Hàm dùng được cả trong và ngoài transaction nhận `DbOrTx`. better-sqlite3 đồng bộ: không `await` trong transaction.
- **Tồn kho / công nợ**: chỉ qua `recordMovement` và `recordSupplierTx`, cùng transaction với chứng từ (xem CLAUDE.md).
- **Thời gian**: service tạo chứng từ nhận `clock?: Clock`; dùng `resolveClock(clock)` và `localDate(now, tz)`, không gọi `new Date()` rải rác.
- **Drizzle**:
  - Subquery viết bằng `sql` phải ghi tên bảng cứng (`import_items.import_id = imports.id`), vì drizzle bỏ tiền tố bảng khi nội suy cột vào subquery.
  - `LIKE` của SQLite không bỏ hoa/thường với chữ có dấu ("đại" ≠ "Đại"): tìm theo tên tiếng Việt thì lấy ra rồi lọc bằng JS `toLowerCase().includes()` (mẫu: `listSuppliers`).
  - Tìm không dấu ngay trong SQL (danh sách lớn, có phân trang): dùng hàm `vn_fold(cột)` (đăng ký trong `db/connection.ts`) với chuỗi tìm qua `likeTerm()` (`services/orders.ts`: bỏ dấu, escape `% _ \`, `LIKE … ESCAPE '\'`). Danh sách chứng từ phân trang `PAGE_SIZE`, `summary` tính theo khoảng ngày, không theo lọc khác.
- **Test** (vitest): mỗi test tạo `createTestDb()` riêng; test service gọi thẳng service, test API dùng app thật trong `*-api.test.ts`. Truyền `Clock` cố định khi test phụ thuộc ngày. Chạy một file: `npx vitest run src/services/<tên>.test.ts` trong `server/`.
- **Seed** (`src/seed/`): dữ liệu ở `seed-data.ts`, nạp qua service thật để tồn/giá vốn/công nợ khớp nhau, và phải chạy lại được không tạo trùng (khớp theo mã vạch, tên hoặc ghi chú).
