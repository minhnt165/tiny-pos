# Tiny POS – Giai đoạn 9: Ảnh sản phẩm (0.13.0)

Ngày: 2026-10-01

Nền tảng giữ nguyên như `2026-09-29-tiny-pos-phase1-design.md`; sao lưu, *Thư mục chép thêm* như
`2026-10-01-tiny-pos-phase5-ops-design.md`; `ProductAvatar`, bảng/thẻ Sản phẩm như
`2026-09-30-tiny-pos-ui-refresh-design.md`; cách server nhận file thô (`express.raw`) như `/products/import` trong
`2026-09-30-tiny-pos-excel-design.md`. Tài liệu này chỉ mô tả phần thêm mới.

## 1. Mục tiêu

Mỗi sản phẩm có thể gắn **một ảnh** để nhận diện: chủ tiệm cầm điện thoại chụp gói hàng ngay tại kệ, ảnh hiện ở
mọi chỗ đang vẽ ô chữ cái (bảng và thẻ Sản phẩm, gợi ý tìm khi bán/nhập/kiểm kê, Thêm nhanh, Tồn thấp ở Tổng
quan). Hàng không mã vạch, tên na ná nhau ("Mì Hảo Hảo tôm chua cay" / "…sa tế hành") phân biệt bằng mắt được.

Tiêu chí thành công:

- Từ điện thoại: mở sản phẩm → *Chọn ảnh* → chụp → lưu, dưới 10 giây, không cần máy tính.
- Ảnh gửi lên nhỏ (≤ 512px cạnh dài, JPEG, thường 30–60 KB), server không cần thư viện xử lý ảnh.
- Mọi chỗ đang dùng `ProductAvatar` hiện ảnh nếu có, không có hoặc ảnh lỗi thì y như cũ.
- Sao lưu `.db` không phình; ảnh được chép thêm sang *Thư mục chép thêm* nếu có cấu hình.

## 2. Phạm vi

Trong phạm vi: cột `products.image` (migration `0006`); thư mục `data/images/`; service
`services/product-images.ts`; route `PUT`/`DELETE /api/products/:id/image`; phục vụ tĩnh `/images/*`; thu nhỏ ảnh
ở trình duyệt (`client/src/lib/image-resize.ts`); `ProductAvatar` có ảnh; khối *Ảnh* trong form sản phẩm; dialog
xem ảnh to từ bảng/thẻ Sản phẩm; chép `images/` sang thư mục chép thêm; version 0.13.0; README; CLAUDE.md.

Ngoài phạm vi: nhiều ảnh một sản phẩm, ảnh cho đơn vị quy đổi / danh mục / khách / NCC, lưới ảnh để chọn hàng ở
màn Bán hàng, in ảnh lên hóa đơn hay tem, ảnh trong xuất/nhập Excel, ảnh trong bản sao `.db` và khi khôi phục,
dọn file mồ côi, cắt/xoay/chỉnh ảnh, lấy ảnh từ URL, seed có ảnh, đăng nhập.

## 3. Quyết định đã chốt

| Vấn đề | Chọn | Lý do |
|---|---|---|
| Chỗ lưu | **File** trong `data/images/`, DB chỉ giữ tên file | Ảnh chỉ để nhận diện, mất thì chụp lại; `.db` và 30 bản sao tự động giữ nhẹ, `sqlite.backup` không chậm đi. BLOB trong SQLite nhất quán hơn khi khôi phục nhưng 500 món ≈ 25 MB nhân lên mỗi bản sao |
| Ai thu nhỏ | **Trình duyệt** (canvas), server chỉ kiểm tra và ghi | Không thêm thư viện native (`sharp`) khó cài trên máy quầy và qua mạng công ty; điện thoại chụp 3–5 MB nhưng gửi lên chỉ vài chục KB |
| Định dạng | Chỉ **JPEG**, cạnh dài ≤ 512px, chất lượng 0.82 | Một định dạng để server kiểm tra đơn giản (2 byte đầu `FF D8`); 512px đủ cho ô 40–112px và màn hình Retina, xem to vẫn rõ |
| Tên file | `p<id>-<Date.now()>.jpg` | Đổi ảnh là đổi URL → phục vụ với `Cache-Control: public, max-age=31536000, immutable` mà không lo trình duyệt giữ ảnh cũ; nhìn tên biết của sản phẩm nào |
| Giới hạn | Body ≤ 1 MB; quá thì 400 | Ảnh đúng quy trình chỉ vài chục KB; 1 MB là dư cho ảnh nhiều chi tiết, chặn gửi nhầm file gốc |
| Thêm mới chưa có id | Form giữ ảnh tạm, **tạo sản phẩm xong mới gửi ảnh** | Không cần endpoint tạo kèm ảnh (multipart); lỗi gửi ảnh thì sản phẩm vẫn đã tạo, toast riêng, mở sửa chọn lại |
| Sửa sản phẩm | Chọn ảnh là **gửi ngay**, không chờ *Lưu* | Giống đơn vị quy đổi trong cùng form (`ProductUnitsEditor` lưu ngay); bấm *Hủy* không làm mất ảnh vừa chụp |
| Sản phẩm ngừng bán | Giữ ảnh | Xóa mềm; khôi phục lại vẫn có ảnh |
| Đổi / xóa ảnh | Xóa file cũ ngay | Không có job dọn; lỗi xóa file (đang bị khóa) chỉ log, không chặn thao tác |
| Khôi phục bản sao | **Không** đụng `images/`; tên ảnh trong bản sao mà file không còn → `onError` rơi về ô chữ cái | Bản sao chỉ là `.db`; cột nullable nên `copyTables` chạy bình thường |
| Thư mục chép thêm | Mỗi lần sao lưu, chép những file `images/` **chưa có** ở `<extra>/images/`; không xóa, không đồng bộ ngược | Máy hỏng thì USB/OneDrive còn ảnh; chép thiếu là O(số ảnh) `existsSync`, rẻ |
| Xem to | Dialog ảnh 512px + tên, mở khi bấm ảnh ở bảng/thẻ Sản phẩm | Người dùng chọn phạm vi 1 ("nhận diện trong danh sách"); không đổi luồng bán hàng |
| Lịch sử Thêm nhanh | Vẫn ô chữ cái | Lưu trong `localStorage` chỉ mã + tên; không đáng mang thêm tên ảnh |

## 4. Dữ liệu

Migration `0006` (drizzle sinh, nullable nên không phải sửa tay):

```sql
ALTER TABLE `products` ADD `image` text;
```

- `products.image`: tên file trong `data/images/`, `null` khi chưa có. Không lưu đường dẫn tuyệt đối để đổi thư mục
  `data/` hay mang sang máy khác vẫn đúng.
- `shared/types.ts`: `Product.image: string | null`; `LowStockRow.image: string | null` (`services/overview.ts` map
  thêm trường). `productInputSchema` **không** nhận `image` (ảnh chỉ đổi qua endpoint riêng; `updateProduct` dùng
  `...rest` nên không ghi đè cột này).
- Đường dẫn thư mục: `index.ts` truyền `imagesDir = path.join(dataDir, 'images')` vào `createApp` và vào
  `apiRouter` qua `deps.images`, theo cách `backups`/`labels` đang làm. Thư mục tạo khi khởi động (`mkdirSync`
  `recursive`).

## 5. Server

### `services/product-images.ts`

```ts
export interface ImageDeps { dir: string }
export const NO_IMAGES: ImageDeps  // dir rỗng → mọi thao tác ném lỗi 503 "Chưa cấu hình thư mục ảnh" (test không cần ảnh)

export function saveProductImage(db: Db, deps: ImageDeps, id: number, body: Buffer): ProductWithUnits
export function deleteProductImage(db: Db, deps: ImageDeps, id: number): void
export function copyMissingImages(from: string, to: string): number  // dùng ở backups; trả số file đã chép
```

- `saveProductImage`: 404 nếu không có sản phẩm; 400 "Ảnh phải là JPEG" nếu không bắt đầu `FF D8`; 400 "Ảnh quá
  lớn (tối đa 1 MB)" nếu `body.length > 1_048_576` (route cũng đặt `limit: '1mb'` ở `express.raw`, nhưng kiểm lại
  trong service để test được không qua HTTP). Ghi `p<id>-<now>.jpg` vào `deps.dir` (`writeFileSync`), rồi trong
  transaction cập nhật `image`, `updatedAt`; cập nhật xong mới xóa file cũ (`rmSync force`), lỗi xóa chỉ
  `console.warn`. Ghi file **trước** khi cập nhật DB để DB không bao giờ trỏ tới file chưa có.
- `deleteProductImage`: 404 nếu không có sản phẩm; `image` đã `null` thì không làm gì; ngược lại `image = null`,
  `updatedAt`, rồi xóa file.
- `copyMissingImages(from, to)`: `from` không tồn tại → 0; `mkdirSync(to, recursive)`; với mỗi `*.jpg` trong `from`
  chưa có ở `to` thì `copyFileSync`. Lỗi ném ra để `copyExtra` ghi nhận như lỗi chép `.db`.

### `services/backups.ts`

- `createBackupService` nhận thêm `imagesDir?: string`. Trong `copyExtra`, sau khi chép `.db` và `pruneAuto`,
  nếu có `imagesDir` thì `copyMissingImages(imagesDir, path.join(extra, 'images'))`. Cùng `try`: lỗi nào cũng thành
  `extraError`, sao lưu chính không ảnh hưởng.

### Route (`routes/products.ts`)

```
PUT    /api/products/:id/image   body thô image/jpeg (express.raw type () => true, limit 1mb) → 200 ProductWithUnits
DELETE /api/products/:id/image   → 204
```

`productsRouter(db, deps.images ?? NO_IMAGES)`. Body vượt `limit` của `express.raw` đã được `errorHandler` trả
413 "Dữ liệu gửi lên quá lớn (tối đa 1 MB)" (giống `/products/import`); kiểm tra 1 MB trong service chỉ để bảo vệ
khi gọi không qua HTTP.

### Phục vụ tĩnh (`app.ts`)

`createApp` nhận `imagesDir`; nếu có: `app.use('/images', express.static(imagesDir, { immutable: true, maxAge:
'1y', index: false, fallthrough: true }))` đặt **trước** `/api` và SPA fallback. Không có file → rơi xuống SPA
fallback trả `index.html` như mọi GET lạ; client đặt `onError` nên không sao, nhưng để sạch thì chặn: route
`/images/*` không có file trả 404 rỗng thay vì `index.html`. Dev: `client/vite.config.ts` thêm `'/images':
'http://localhost:3000'` vào `proxy`.

## 6. Client

### `lib/image-resize.ts`

```ts
/** Thu nhỏ ảnh về JPEG cạnh dài ≤ max; giữ chiều xoay theo EXIF. Ném Error('Không đọc được ảnh') nếu file hỏng/không hỗ trợ. */
export async function resizeImage(file: Blob, max = 512, quality = 0.82): Promise<Blob>
```

`createImageBitmap(file, { imageOrientation: 'from-image' })` → canvas `width/height` theo tỉ lệ → `drawImage` →
`canvas.toBlob('image/jpeg', quality)`. Ảnh nhỏ hơn `max` vẫn vẽ lại (chuẩn hóa JPEG, bỏ EXIF/GPS). Trình duyệt
không hỗ trợ `imageOrientation` (Safari cũ) thì bỏ option và chấp nhận có thể xoay sai – không cần thư viện EXIF.

### `api/products.ts`

```ts
export function useSaveProductImage()    // ({ id, file: Blob }) → PUT /products/:id/image, body file; onSuccess invalidate products
export function useDeleteProductImage()  // ({ id }) → DELETE
export const productImageUrl = (image: string | null | undefined) => image ? `/images/${image}` : null
```

`api()` đã hỗ trợ `body: Blob` với `Content-Type: application/octet-stream`; server nhận mọi type nên không cần
đổi `client.ts`.

### `components/ProductAvatar.tsx`

Thêm prop `image?: string | null`. Có `image` → `<img src={productImageUrl(image)} alt="" loading="lazy"
className="size-full object-cover rounded-[inherit]">` trong cùng `div` (bỏ class màu nền chữ khi đang hiện ảnh);
`onError` đặt state `broken` → vẽ chữ cái như cũ. Reset `broken` khi `image` đổi. Giữ `aria-hidden` (tên đã ở
cạnh).

Truyền `image={p.image}` ở: `ProductTable`, `ProductCardList`, `ProductSearch` (gợi ý), `QuickAddPage` (thẻ hàng
tìm thấy), `LowStockList`. `CategoriesPage` và lịch sử Thêm nhanh giữ nguyên.

### Form sản phẩm (`ProductFormDialog`)

Khối **Ảnh** đứng đầu mục *Thông tin* (trên lưới 2 cột), gồm: ô vuông 112px (`ProductAvatar` cỡ lớn, bo `rounded-xl`,
hiện ảnh tạm qua `URL.createObjectURL` khi vừa chọn) + cột nút: *Chọn ảnh* (`Camera`, `variant="outline"`), *Xóa
ảnh* (`Trash2`, `variant="ghost"`, chỉ hiện khi có ảnh) + dòng hint "Chụp bằng điện thoại hoặc chọn file; ảnh được
thu nhỏ trước khi lưu". `<input type="file" accept="image/*" hidden>` kích bằng nút.

- Chọn file → `resizeImage` (hiện *Đang xử lý…* trên nút, lỗi → toast "Không đọc được ảnh"):
  - đang **sửa**: `useSaveProductImage` ngay, thành công toast "Đã lưu ảnh"; `onSaved` không gọi (form vẫn mở).
  - đang **thêm**: giữ `pendingImage: Blob | null` trong state form (không nằm trong `FormState`/`toInput`, vì
    không phải dữ liệu gửi cùng JSON); xem trước bằng object URL (thu hồi khi đổi/đóng). Sau `save.mutate` thành
    công: nếu có `pendingImage` thì gọi `saveProductImage`; lỗi → toast "Đã thêm sản phẩm nhưng chưa lưu được
    ảnh: …"; thành công hay không đều `onSaved(p)` với bản mới nhất.
- *Xóa ảnh*: đang sửa → `useDeleteProductImage`; đang thêm → bỏ `pendingImage`.
- `useProductForm` reset `pendingImage` cùng lúc reset form.

### Xem ảnh to

`components/ProductImageDialog.tsx`: `Dialog` size vừa, `DialogTitle` = tên sản phẩm, thân là `<img>` tối đa
`max-h-[70vh] object-contain`. `ProductTable`/`ProductCardList`: ô avatar có ảnh thành `<button>` mở dialog (dừng
lan sự kiện để không mở hàng); không ảnh thì vẫn là `div`.

### Cài đặt → Sao lưu

Thêm một dòng ghi chú trong thẻ: "Ảnh sản phẩm nằm ở thư mục `data\images`, không có trong file `.db`. Thư mục
chép thêm được chép cả ảnh."

## 7. Lỗi

| Tình huống | Server | Client |
|---|---|---|
| Không phải JPEG (client gửi sai, hoặc gọi API tay) | 400 "Ảnh phải là JPEG" | toast |
| > 1 MB | 413 từ `errorHandler` (qua HTTP) / 400 "Ảnh quá lớn (tối đa 1 MB)" (gọi service) | toast (thực tế không xảy ra sau `resizeImage`) |
| Sản phẩm không tồn tại | 404 "Không tìm thấy sản phẩm" | toast |
| Chưa cấu hình thư mục ảnh (`NO_IMAGES`) | 503 "Chưa cấu hình thư mục ảnh" | toast |
| Ghi file lỗi (ổ đầy, quyền) | 500, log | toast "Lỗi 500" |
| File ảnh không còn (khôi phục bản sao, xóa tay) | `/images/x.jpg` → 404 | `onError` → ô chữ cái |
| Trình duyệt không đọc được file (HEIC trên PC, file hỏng) | – | toast "Không đọc được ảnh", không gửi |
| Chép sang thư mục chép thêm lỗi | `extraError` như lỗi chép `.db` | thẻ Sao lưu đã hiện cảnh báo sẵn |

## 8. Kiểm thử

Server (vitest, `createTestDb()` + thư mục tạm `fs.mkdtempSync`):

- `product-images.test.ts`: lưu ảnh → file có trong thư mục, `image` đúng tên, `updatedAt` đổi; lưu lần hai → file
  cũ bị xóa, tên mới; xóa ảnh → `image = null`, file mất; xóa khi không có ảnh → không lỗi; không phải JPEG → 400;
  > 1 MB → 400; id lạ → 404; `updateProduct` không làm mất `image`; `NO_IMAGES` → 503.
  `copyMissingImages`: chép file thiếu, không chép lại file đã có, thư mục nguồn không có → 0.
- `api.test.ts` (hoặc file mới): `PUT /api/products/:id/image` với body `FF D8 …` → 200 có `image`; body chữ → 400;
  `DELETE` → 204; `GET /images/<tên>` → 200 `image/jpeg` với `Cache-Control` immutable; tên lạ → 404 không phải
  `index.html`.
- `backups.test.ts`: có `imagesDir` + `extraDir` → sau `create()` thư mục `<extra>/images` có đủ file; `imagesDir`
  không tồn tại → vẫn sao lưu bình thường.
- `overview.test.ts`: dòng tồn thấp có `image`.

Client: `browser-verify` ở 1366×768 và 390×844, chặn request ghi; chèn `image` giả vào response `/api/products` để
kiểm hiển thị ở bảng, thẻ, gợi ý tìm, form, dialog xem to, và ảnh hỏng rơi về chữ cái. Thử tay trên điện thoại
thật một lần: chụp bằng camera, ảnh dọc không bị xoay.

## 9. Phiên bản và tài liệu

- `package.json` gốc `0.13.0`.
- README: mục *Chạy thật* thêm gạch đầu dòng "Ảnh sản phẩm: mở sản phẩm → *Chọn ảnh*, trên điện thoại chụp trực
  tiếp; ảnh ở `data\images`, thư mục chép thêm của sao lưu chép cả ảnh"; lưu ý về `data/` đã bao hàm `images/`.
- CLAUDE.md: thêm 0.13.0 vào "Đã xong"; bất biến mới: "**Ảnh sản phẩm** chỉ đổi qua `services/product-images.ts`
  (file `data/images/`, DB giữ tên file); `productInputSchema` không nhận `image`".
