# Cài Tiny POS chạy thật trên máy quầy

Hướng dẫn cho người cài phần mềm tại tiệm. Toàn bộ chạy trên một máy Windows, điện thoại trong nhà vào qua Wi‑Fi,
không cần Internet (trừ phần *Xem từ xa*, không bắt buộc).

## 1. Chuẩn bị máy quầy

- **Windows 10/11.** Cài **Node.js LTS** (20 trở lên) từ https://nodejs.org, giữ lựa chọn mặc định.
- **Git** (https://git-scm.com) nếu muốn cập nhật bằng `update.cmd` (script này chạy `git pull`). Chỉ chép thư mục thì không cần.
- **Chrome** (hoặc Edge có sẵn). Biểu tượng Tiny POS mở trình duyệt ở chế độ ứng dụng với `--kiosk-printing` (in không hỏi).
- **Máy in hóa đơn nhiệt 80mm**: cài driver, đặt làm **máy in mặc định** của Windows.
- **Máy in tem decal** (tùy chọn): chỉ cần cài driver, không đặt mặc định; lần in tem đầu chọn máy trong hộp thoại, Chrome tự nhớ.
- **Máy quét mã vạch USB**: cắm là dùng, để chế độ gõ mã rồi Enter (đa số máy mặc định vậy).

## 2. Đưa mã nguồn lên máy

```bat
cd C:\
git clone <địa chỉ repo> TinyPOS
```

- Đặt thư mục trên **ổ cứng trong máy** (ví dụ `C:\TinyPOS`). Không đặt trên USB hay ổ mạng: SQLite chế độ WAL không an toàn ở đó.
- **Không** chép thư mục `data\` của máy dev sang và **không** chạy `npm run seed`, kẻo dữ liệu mẫu lẫn vào dữ liệu thật.
  CSDL `data\grocery.db` tự tạo và tự chạy migration khi server khởi động.

## 3. Cài đặt

Nhấp đúp `scripts\install.cmd`. Script tự làm 6 bước:

1. Kiểm tra Node.js.
2. `npm install` + `npm run build` (vài phút).
3. Tạo biểu tượng **Tiny POS** trong thư mục Startup (bật máy là tự chạy) và trên Desktop.
4. Mở cổng **7869** trên tường lửa: Windows hỏi quyền quản trị một lần, bấm **Yes**.
5. Bật server và mở màn hình bán hàng.
6. In ra địa chỉ cho điện thoại: `http://<IP máy>:7869`.

Không cần quyền quản trị cho cả script, chỉ bước tường lửa hỏi UAC.

**Lỗi thường gặp**

| Hiện tượng | Cách xử lý |
|---|---|
| `Chua cai Node.js` / `qua cu` | Cài Node.js LTS rồi chạy lại `install.cmd` |
| `npm install` lỗi khi build `better-sqlite3` | Thường do Node quá mới chưa có bản dựng sẵn: cài lại Node bản **LTS**, xóa `node_modules`, chạy lại |
| Lỗi `self-signed certificate` (mạng công ty) | Đặt CA công ty vào `.certs\corp-root.pem`, script tự dùng |
| Biểu tượng báo *Khong bat duoc Tiny POS* | Xem `data\server.log` |
| Bỏ qua bước tường lửa | Chạy lại `install.cmd`, hoặc tự mở cổng TCP 7869 trong Windows Defender Firewall |

## 4. Thiết lập sau khi cài

1. **Giữ IP cố định cho máy quầy**: vào trang quản lý router, đặt DHCP reservation (IP tĩnh theo MAC).
   IP đổi thì điện thoại phải ghép lại và lối tắt đã lưu trên màn hình chính bị hỏng.
2. Trong **Cài đặt** của phần mềm:
   - Thông tin cửa hàng (in trên hóa đơn), tài khoản ngân hàng cho VietQR.
   - **Sao lưu dữ liệu → Thư mục chép thêm**: chọn USB (`E:\`) hoặc thư mục OneDrive/Google Drive trên máy.
     **Nên làm**: máy hỏng vẫn còn dữ liệu.
   - **Tem mã vạch**: chọn khổ tem (nếu dùng).
   - **Giao diện (trên máy này)**: bật *Mở phần mềm vào thẳng cửa sổ quầy* nếu muốn bật máy là vào màn bán hàng không menu.
3. **Ghép điện thoại**: trên máy quầy vào *Cài đặt → Thiết bị → Ghép điện thoại*, điện thoại (cùng Wi‑Fi) quét QR
   hoặc gõ mã 6 số (hết hạn sau 5 phút). Máy quầy luôn dùng được, không cần ghép.
   - iPhone: app đã *Thêm vào màn hình chính* có bộ nhớ riêng với Safari, phải ghép lại một lần trong app đó bằng mã 6 số.
4. **In thử một hóa đơn** để chắc máy in đúng khổ và in không hỏi. Nếu vẫn hiện hộp thoại in: Chrome đã mở sẵn
   trước khi bấm biểu tượng nên cờ `--kiosk-printing` không có tác dụng. Tắt hết Chrome rồi mở lại bằng biểu tượng **Tiny POS**.

## 5. Xem từ xa (tùy chọn)

Chủ tiệm xem Tổng quan từ ngoài tiệm qua Firebase của chính tiệm. Cần Internet trên máy quầy. Người triển khai làm một lần:

1. Vào https://console.firebase.google.com bằng tài khoản Google của chủ tiệm, tạo project (tắt Analytics).
2. *Firestore Database* → tạo, chế độ production, vùng `asia-southeast1`.
3. *Authentication* → *Sign-in method* → bật *Google*.
4. *Project settings* → *Service accounts* → *Generate new private key*; chép file thành
   `data\remote\service-account.json` trên máy quầy. Không cần khởi động lại.
5. Trên máy người triển khai (cũng chép file khóa vào `data\remote\service-account.json`): `npm install` rồi
   `npm run deploy -w remote`. Không cần `firebase login`.
6. Trên máy quầy: *Cài đặt → Xem từ xa* → thêm email Google của chủ tiệm → bật → *Gửi ngay*.
   Chủ tiệm quét QR trên thẻ, đăng nhập Google, *Thêm vào màn hình chính*.

Chi tiết và cách gỡ: mục *Xem từ xa* trong [README](../README.md#xem-từ-xa-0140).

## 6. Vận hành hằng ngày

| Việc | Cách làm |
|---|---|
| Mở phần mềm | Biểu tượng **Tiny POS** trên Desktop (bật máy là server tự chạy) |
| Điện thoại | `http://<IP máy>:7869` |
| Cập nhật phiên bản | Bán xong, lưu các phiếu nháp, rồi chạy `scripts\update.cmd` (dừng, `git pull`, build, chạy lại) |
| Dừng / chạy tay | `scripts\stop.cmd` / `scripts\start.cmd` |
| Xem lỗi | `data\server.log` (ghi đè mỗi lần server khởi động) |
| Sao lưu | Tự động khi khởi động và mỗi ngày một lần vào `data\backups` (giữ 30 bản); *Cài đặt → Sao lưu ngay* |
| Khôi phục | *Cài đặt → Sao lưu dữ liệu* → *Khôi phục* (tự tạo bản *Trước khôi phục* trước) |
| Gỡ cài đặt | `scripts\uninstall.cmd` (giữ nguyên `data\`) |

**Chuyển sang máy mới**: cài như trên → *Cài đặt → Sao lưu dữ liệu → Khôi phục từ file…* chọn file `.db` của máy cũ →
chép thư mục `data\images` của máy cũ (hoặc `images` trong thư mục chép thêm) vào `data\images` máy mới.
Bản sao từ phiên bản phần mềm mới hơn bị từ chối: cập nhật phần mềm trước.

## Lưu ý an toàn

- **Không mở cổng 7869 ra Internet** (không port forward trên router). Phần mềm chạy HTTP thường, chỉ dùng trong mạng nhà;
  máy lạ trong Wi‑Fi đã bị chặn nhờ ghép thiết bị.
- Không chép đè `data\grocery.db` khi server đang chạy; muốn khôi phục thì dùng chức năng trong Cài đặt.
- File khóa `data\remote\service-account.json` là bí mật: không gửi qua chat, không đưa lên git.
