---
paths:
  - "server/src/db/**"
  - "server/drizzle/**"
---

# Schema và migration

- Sửa `server/src/db/schema.ts` → `npm run db:generate` → xem kỹ file SQL vừa sinh trong `server/drizzle/`. Migration chạy tự động lúc server khởi động (`createDb`) và trong mọi test (`createTestDb`).
- **Không sửa migration đã có** (`0000`–`0003`): DB dev của người dùng đã chạy chúng. Thay đổi mới luôn là migration mới (tiếp theo là `0004`).
- drizzle-kit với SQLite hay sinh câu không chạy được trên DB đã có dữ liệu, ví dụ `ALTER TABLE … ADD col NOT NULL` không có default. Khi đó sửa tay file SQL thành dựng lại bảng: tạo bảng mới, chép dữ liệu, xóa bảng cũ, đổi tên. Snapshot trong `meta/` vẫn giữ như drizzle sinh.
- **Bẫy cascade**: migrator chạy trong transaction nên `PRAGMA foreign_keys=OFF` không có tác dụng. Xóa/dựng lại bảng cha sẽ kích hoạt `ON DELETE CASCADE` của bảng con (ví dụ `import_items` theo `imports`). Phải sao dữ liệu bảng con ra bảng tạm trước rồi chép lại sau (xem `0002_spicy_serpent_society.sql`).
- Thêm test migration khi sửa tay: dựng DB ở migration trước, chèn dữ liệu, chạy migration mới, kiểm dữ liệu còn nguyên (mẫu: `src/db/migration-0002.test.ts`).
- Tên cột DB `snake_case`, trường TS/JSON `camelCase`. Tiền là `integer`, số lượng/tồn là `real`, thời gian là `text` ISO (`createdAt` mặc định giờ hiện tại).
- **Migration và khôi phục bản sao cũ**: `copyTables` trong `services/backups.ts` chỉ chép **giao các cột** giữa bản sao và schema hiện tại; cột mới nhận giá trị mặc định, nhưng migration **biến đổi/chuyển dữ liệu** giữa cột hay bảng sẽ không được áp lên bản sao từ phiên bản cũ. Viết migration kiểu đó thì phải cân nhắc bổ sung bước chuyển đổi trong `copyTables`.
