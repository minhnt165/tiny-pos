---
name: browser-verify
description: Kiểm tra giao diện tiny-pos trên Chrome headless bằng playwright-core, chặn mọi request ghi để không đụng DB dev của người dùng. Dùng sau khi sửa code trong client/src, khi tái hiện lỗi giao diện người dùng báo, hoặc khi cần chụp màn hình ở cỡ điện thoại/máy tính.
---

# Kiểm tra giao diện trên trình duyệt

Client không có test tự động, nên đây là cách chứng minh một thay đổi UI chạy đúng. Kết quả báo lại phải là thứ đã quan sát được (giá trị trên màn hình, body request, ảnh chụp), không phải suy đoán từ code.

## 1. Chuẩn bị

- Kiểm tra server dev đang chạy: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5180/` và `http://localhost:3000/api/settings` đều phải ra `200`.
  - Nếu chưa chạy thì bật `npm run dev` ở chế độ nền. Xong việc chỉ dừng đúng tiến trình mình đã bật.
  - **Không** dùng hay kill cổng 5173/5174: đó là dự án khác trên máy này.
- Cài `playwright-core` vào **thư mục tạm ngoài repo** (scratchpad của phiên), không cài vào repo:
  `npm init -y && npm i playwright-core`. Nếu gặp lỗi TLS thì đặt `NODE_EXTRA_CA_CERTS=<repo>/.certs/corp-root.pem`. Không tải trình duyệt của Playwright: dùng Chrome có sẵn ở `C:/Program Files/Google/Chrome/Application/chrome.exe`.
- Script `.mjs` để trong cùng thư mục tạm đó.

## 2. Luật an toàn

- **Chặn mọi request ghi** (`POST`/`PUT`/`DELETE`/`PATCH` tới `/api`): abort và log body để kiểm, trừ khi người dùng cho phép ghi. DB `data/grocery.db` là dữ liệu thật của họ.
- Cần dữ liệu không có sẵn (ví dụ một nhà cung cấp, một phiên kiểm kê) thì **stub response GET** bằng `route.fulfill`, không tạo thật.
- Stub `window.print` để không mở hộp thoại in.
- Lỡ tạo dữ liệu thật thì phải báo người dùng đã tạo gì, không âm thầm xóa.

## 3. Mẫu script

```js
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); // điện thoại: 390 x 844
const page = await ctx.newPage();
const writes = [];
await page.route('**/api/**', (route) => {
  const r = route.request();
  if (r.method() === 'GET') return route.continue();
  writes.push({ method: r.method(), url: r.url(), body: r.postData() });
  return route.abort();
});
await page.addInitScript(() => { window.print = () => console.log('PRINT'); });
page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE ERROR', m.text()));
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));

await page.goto('http://localhost:5180/imports/new');
// … thao tác: page.click, page.fill, page.keyboard.press('F9'), page.getByRole('option', { name: /ACB/ }).click()
console.log('WRITES', JSON.stringify(writes, null, 1));
await page.screenshot({ path: 'after.png', fullPage: true });
await browser.close();
```

## 4. Cần kiểm gì

- **Tái hiện lỗi**: chạy script trên code cũ, thấy lỗi xảy ra. Sửa xong chạy lại đúng script đó, thấy lỗi hết. Ghi rõ "trước: … / sau: …".
- **Luồng có lưu**: kiểm body request ghi đã chặn có đúng giá trị không (ví dụ `qty: 5`, `bankBin: "970441"`), vì đây là thứ server sẽ nhận.
- **Điều hướng SPA**: lỗi trạng thái hay xuất hiện khi rời trang rồi quay lại, lúc dữ liệu đã có trong cache của TanStack Query. Nên thử bấm link trong app, không chỉ `page.goto`.
- **Điện thoại**: viewport 390px, không cuộn ngang (`document.documentElement.scrollWidth <= 390`), nút cao ≥ 44px, xem thanh menu dưới đáy.
- **Không có lỗi console** (`CONSOLE ERROR`, `PAGE ERROR`).
- Đọc ảnh chụp để tự xem bố cục, rồi báo người dùng những gì đã thấy.
