---
description: Tạo migration mới sau khi đổi schema, soát SQL để chạy an toàn trên DB đang có dữ liệu
argument-hint: <mô tả thay đổi schema>
---

Thay đổi schema cần làm: $ARGUMENTS

Theo `.claude/rules/database.md`:

1. Sửa `server/src/db/schema.ts` (chỉ những dòng cần), rồi `npm run db:generate`.
2. Đọc file SQL mới trong `server/drizzle/`. Không sửa các migration cũ.
   - Có `ADD … NOT NULL` không default, đổi kiểu cột, hay drizzle dựng lại bảng? Thì kiểm tra có chạy được trên DB đang có dữ liệu không.
   - Bảng bị dựng lại có bảng con `ON DELETE CASCADE` không? Nếu có thì sao dữ liệu bảng con ra trước rồi chép lại sau (`PRAGMA foreign_keys=OFF` không có tác dụng trong migrator).
3. Nếu phải sửa tay SQL thì viết test migration kiểu `server/src/db/migration-0002.test.ts`: dữ liệu cũ còn nguyên, ràng buộc mới đúng.
4. Cập nhật type/schema trong `shared/` nếu API đổi, rồi chạy `npm run typecheck` và `npm test`.
5. Lưu ý: server dev (`tsx watch`) khởi động lại khi file đổi và sẽ **tự áp migration lên `data/grocery.db`** của người dùng. Nếu migration dựng lại bảng hoặc đụng dữ liệu, báo người dùng và sao lưu `data/grocery.db` (cả `-wal`) trước khi lưu file schema/migration.
