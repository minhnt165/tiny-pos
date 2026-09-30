---
description: Kiểm tra trước khi commit – typecheck, test, build client, soát diff không format lại file cũ
---

Chạy lần lượt từ gốc repo, dừng và báo ngay khi một bước lỗi (kèm output lỗi):

1. `npm run typecheck`
2. `npm test`, rồi báo số test pass của `shared` và `server`
3. `npm run build -w client`
4. `git status --short` và `git diff --stat` (cả phần đã stage). Với mỗi file **đã có từ trước** mà số dòng đổi lớn bất thường so với thay đổi thật, mở `git diff -w` ra so. Nếu `git diff -w --stat` nhỏ hơn hẳn `git diff --stat` thì có hunk chỉ đổi khoảng trắng hoặc thụt lề: chỉ ra từng hunk đó để hoàn tác. Không tự chạy formatter.
5. Nếu diff có file trong `client/src`, nhắc rằng client không có test tự động và cần kiểm trên trình duyệt (skill `browser-verify`), trừ khi việc đó đã làm.

Cuối cùng báo gọn bằng tiếng Việt: bước nào qua, bước nào lỗi, file nào cần xem lại. Không commit.

$ARGUMENTS
