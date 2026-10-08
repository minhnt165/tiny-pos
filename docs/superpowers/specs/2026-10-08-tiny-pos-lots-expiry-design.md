# Tiny POS – Lô hàng, giá vốn FIFO và hạn sử dụng (0.17.0)

Ngày: 2026-10-08

Nền tảng giữ nguyên như `2026-09-29-tiny-pos-phase1-design.md`; nhập hàng, kiểm kê, lịch sử tồn như
`2026-09-29-tiny-pos-phase3-inventory-design.md`; trả hàng như `2026-10-01-tiny-pos-returns-design.md`;
trả NCC như `2026-10-01-tiny-pos-supplier-returns-labels-design.md`; Tổng quan như
`2026-10-01-tiny-pos-overview-design.md`. Tài liệu này chỉ mô tả phần thêm mới và phần thay đổi.

## 1. Mục tiêu

Hiện nay mỗi sản phẩm chỉ có **một** giá vốn = giá nhập lần gần nhất. Còn 10 lon tồn giá 8.000, nhập thêm
20 lon giá 9.000 thì cả 30 lon đều tính giá vốn 9.000; bán 10 lon cũ, báo cáo lãi thấp hơn thực tế. Ngược
lại giá giảm thì lãi bị thổi lên. Phần mềm cũng **không biết hạn sử dụng**, chủ tiệm phải tự nhớ hoặc
đi soi từng kệ.

Cách làm: **mỗi dòng phiếu nhập là một lô**, giữ số còn, giá vốn và hạn dùng riêng. Khi bán, phần mềm tự
trừ lô **hết hạn sớm nhất trước**, lô không hạn sau cùng, cùng hạn thì lô nhập trước trừ trước. Dòng hóa
đơn chụp giá vốn thật của các lô đã trừ. Tổng quan có thẻ *Sắp hết hạn*, trang *Lô hàng* liệt kê lô
còn hàng và cho bỏ hàng hết hạn.

Tiêu chí thành công:

- Bán hàng không có bước chọn lô; quầy không bao giờ bị chặn vì thiếu lô (vẫn cho bán âm như cũ).
- Sau mọi thao tác (bán, nhập, trả, trả NCC, kiểm kê, hủy bất kỳ chứng từ nào, bỏ hàng), với mỗi sản
  phẩm: **tổng số còn các lô = `products.stock`**.
- Hủy chứng từ cộng/trừ đúng lô mà chứng từ đó đã trừ/cộng.
- Báo cáo lãi lỗ phản ánh giá vốn từng lô; giá trị tồn kho = Σ số còn × giá vốn lô.
- Dữ liệu cũ nâng cấp êm: mỗi sản phẩm có tồn nhận một lô "tồn đầu" bằng tồn hiện tại và giá vốn
  hiện tại, không hạn.

## 2. Phạm vi

Trong phạm vi: bảng `lots`, `lot_movements`, cột `import_items.expires_on`,
`supplier_return_items.lot_id`, migration `0008` (kèm tạo lô tồn đầu); `shared/src/lot-math.ts` (phân bổ
thuần); `recordMovement` biết lô; sửa `imports`, `orders`, `returns`, `supplier-returns`, `stocktakes`,
`reports`, `overview`; `services/lots.ts` + route `/api/lots`; cài đặt `expiryWarnDays`; client: cột Hạn
dùng trên phiếu nhập, ô chọn lô khi trả NCC, trang `/lots`, bảng lô trong chi tiết sản phẩm, thẻ *Sắp hết
hạn* trên Tổng quan, ô ngưỡng ngày trong Cài đặt; README, CLAUDE.md, version 0.17.0.

Ngoài phạm vi: đếm kiểm kê theo từng lô, chọn lô khi bán, gộp lô, sửa hạn dùng của lô đã tạo, in hạn lên
tem, hạn dùng trong file nhập sản phẩm Excel/CSV, xuất Excel danh sách lô, hiển thị lô trên trang Xem từ xa
(`remote/` chỉ nhận thêm trường trong kiểu `Overview`), bình quân gia quyền.

## 3. Quyết định đã chốt

| Vấn đề | Chọn | Lý do |
|---|---|---|
| Đơn vị lô | Mỗi dòng phiếu nhập = 1 lô, không gộp | Truy ngược được về phiếu; dòng nhập đã có đủ giá vốn và hạn |
| Thứ tự trừ | Hạn gần nhất trước (FEFO), không hạn sau cùng, cùng hạn thì `id` lô nhỏ trước | Đúng cách xếp hàng lên kệ; hàng cận date giá rẻ không bị bỏ lại |
| Bán vượt lô | Vẫn bán; trừ âm vào lô cuối cùng theo thứ tự trên; chưa có lô thì tạo lô tồn đầu giá vốn hiện tại rồi trừ âm | Không chặn quầy; giá vốn phần vượt = giá nhập gần nhất, giống hành vi cũ |
| Bù lô âm | Mọi lượng **cộng vào** (nhập, kiểm kê thừa, cộng không có phân bổ gốc) bù lô âm về 0 trước, phần dư mới vào đích | Tồn âm tự lành khi nhập hàng tiếp; không cần lô "chưa rõ" riêng |
| Hạn dùng | Tùy chọn trên từng dòng nhập, ngày `YYYY-MM-DD`, không cờ trên sản phẩm | Gạo, xà phòng, hàng cân không có hạn; chủ tiệm không phải vào sửa từng sản phẩm |
| Nơi phân bổ | Trong `recordMovement`, qua hàm thuần ở `shared/lot-math.ts` | Một chỗ duy nhất biết lô; mọi luồng tự đúng; test không cần DB |
| Lưu phân bổ | Bảng `lot_movements` gắn `stock_movements` | Một dòng bán có thể gối hai lô; hủy đọc lại phân bổ cũ rồi đảo dấu |
| Hủy chứng từ cũ (trước 0.17.0) | Không có phân bổ gốc: đảo theo luật tự động (trừ FEFO / cộng bù âm rồi vào lô mới nhất) | Dữ liệu cũ không khôi phục được lô; sai số chỉ ở giá vốn, tồn vẫn đúng |
| Giá vốn dòng hóa đơn | `round(Σ qty_lô × cost_lô / qty_bán)` theo đơn vị bán, giữ cột `order_items.cost_price` | Báo cáo và trả hàng không đổi cách tính; sai số làm tròn ≤ 0,5 đồng/dòng |
| `products.cost_price` | Vẫn = giá nhập gần nhất (quy về đơn vị gốc) | Dùng hiện lãi % khi nhập, giá vốn lô tồn đầu; không còn dùng khi bán |
| Kiểm kê | Đếm tổng theo sản phẩm; thiếu trừ FEFO, thừa bù âm rồi cộng lô mới nhất | Không bắt chủ tiệm đếm từng lô |
| Trả NCC | Chọn lô tùy chọn, mặc định lô FEFO đầu tiên; trả quá số còn thì lô âm, giao diện cảnh báo | Trả đúng lô cận date; vẫn không chặn |
| Trả hàng khách nhập lại kho | Cộng ngược đúng tỷ lệ vào các lô dòng hóa đơn đã trừ | Hàng về đúng lô, giá vốn báo cáo khớp |
| Hủy phiếu nhập | Trừ đúng lô của phiếu; đã bán bớt thì lô âm | Không chặn hủy; lô âm tự bù khi nhập tiếp |
| Bỏ hàng | `POST /api/lots/:id/dispose`, movement `adjust` trừ hết số còn của lô, ghi chú "Bỏ hàng …" | Không phải mở kiểm kê để bỏ vài món hết hạn |
| Ngưỡng cảnh báo | `settings.expiryWarnDays`, mặc định 30, 1–365 | Khác tiệm khác chu kỳ nhập |
| Khôi phục bản sao | `copyTables` chép `lots`, `lot_movements` như bảng thường | Lô là dữ liệu nghiệp vụ, đi cùng chứng từ |

## 4. Dữ liệu

### 4.1 Bảng mới (migration `0008`)

```sql
CREATE TABLE lots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  import_item_id INTEGER REFERENCES import_items(id),  -- null = lô tồn đầu
  qty_in REAL NOT NULL,            -- số nhập, đơn vị gốc (lô tồn đầu = tồn lúc nâng cấp)
  remaining REAL NOT NULL,         -- số còn, đơn vị gốc, có thể âm
  cost_price INTEGER NOT NULL,     -- giá vốn 1 đơn vị gốc
  expires_on TEXT,                 -- 'YYYY-MM-DD', null = không hạn
  note TEXT,                       -- 'Tồn đầu' cho lô nâng cấp
  created_at TEXT NOT NULL DEFAULT (...)
);
CREATE INDEX lots_product_idx ON lots(product_id, expires_on, id);
CREATE INDEX lots_expires_idx ON lots(expires_on);

CREATE TABLE lot_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  movement_id INTEGER NOT NULL REFERENCES stock_movements(id) ON DELETE CASCADE,
  lot_id INTEGER NOT NULL REFERENCES lots(id),
  qty REAL NOT NULL                -- +/- đơn vị gốc, cùng dấu với movement
);
CREATE INDEX lot_movements_movement_idx ON lot_movements(movement_id);
CREATE INDEX lot_movements_lot_idx ON lot_movements(lot_id);

ALTER TABLE import_items ADD COLUMN expires_on TEXT;
ALTER TABLE supplier_return_items ADD COLUMN lot_id INTEGER REFERENCES lots(id);

INSERT INTO lots (product_id, import_item_id, qty_in, remaining, cost_price, expires_on, note, created_at)
SELECT id, NULL, stock, stock, cost_price, NULL, 'Tồn đầu', updated_at FROM products WHERE stock <> 0;
```

`stock_movements` giữ nguyên; `recordMovement` phải ghi `stock_movements` trước để có `movement_id`.
Movement của chứng từ cũ không có dòng `lot_movements` nào.

### 4.2 Kiểu dùng chung (`shared/src/types.ts`, schema zod `shared/src/schemas/lot.ts`)

```ts
export type LotState = 'ok' | 'expiring' | 'expired' | 'empty';

export interface LotRow {
  id: number;
  productId: number;
  productName: string;
  unit: string;
  image: string | null;
  importId: number | null;      // phiếu nhập; null = tồn đầu
  importCode: string | null;
  qtyIn: number;
  remaining: number;
  costPrice: number;
  expiresOn: string | null;
  /** Số ngày tới hạn theo ngày địa phương hôm nay; âm = đã quá hạn; null = không hạn. */
  daysLeft: number | null;
  state: LotState;
  createdAt: string;
}

export interface LotList {
  lots: LotRow[];
  total: number;
  page: number;
  pageSize: number;
  summary: { expiringCount: number; expiredCount: number; stockValue: number };
}

/** Lô còn hàng của một sản phẩm, FEFO, dùng cho chi tiết sản phẩm và ô chọn lô khi trả NCC. */
export interface ProductLot {
  id: number;
  importCode: string | null;
  remaining: number;
  costPrice: number;
  expiresOn: string | null;
  daysLeft: number | null;
}
```

Schema:

- `lotListQuerySchema`: `q` (tìm tên sản phẩm), `productId`, `state` (`ok | expiring | expired | empty`,
  nhiều giá trị), `page`, `pageSize` – theo khuôn `list-filters.ts`. Mặc định không có `state` = chỉ lô
  `remaining > 0` (tức `ok | expiring | expired`).
- `importItemInputSchema` thêm `expiresOn: localDate.nullable().default(null)` (regex `YYYY-MM-DD`,
  ngày hợp lệ theo lịch; không chặn ngày quá khứ vì nhập hàng cận date hay đã hết hạn là việc của chủ tiệm).
- `supplierReturnItemInputSchema` thêm `lotId: optionalId` (null = tự động).
- `settingsInputSchema` thêm `expiryWarnDays: z.number().int().min(1).max(365).default(30)`.
- `ImportItem` thêm `expiresOn: string | null`; `SupplierReturnItem` thêm `lotId: number | null`,
  `lotExpiresOn: string | null`.
- `Overview` thêm `expiring: { count: number; expiredCount: number; items: LotRow[] }` (`items` cắt theo
  `OVERVIEW_LOW_STOCK_ROWS`, quá hạn trước rồi tới hạn gần nhất). `remote/` chỉ cần compile.

### 4.3 Hàm thuần `shared/src/lot-math.ts`

```ts
export interface LotBalance { id: number; remaining: number; costPrice: number; expiresOn: string | null }

/** Thứ tự FEFO: expiresOn tăng dần, null cuối, cùng hạn thì id nhỏ trước. */
export function sortFefo(lots: LotBalance[]): LotBalance[];

/** Trừ `qty` (> 0) khỏi các lô: lần lượt theo FEFO, chỉ lấy phần dương; còn thiếu thì trừ hết vào lô cuối
 *  trong danh sách (cho âm). Danh sách rỗng → trả về [] (caller tạo lô tồn đầu rồi gọi lại). */
export function allocateOut(lots: LotBalance[], qty: number): { lotId: number; qty: number }[];

/** Cộng `qty` (> 0): bù các lô âm về 0 theo FEFO, phần dư vào `targetId` (lô mới / lô mới nhất). */
export function allocateIn(lots: LotBalance[], qty: number, targetId: number): { lotId: number; qty: number }[];

/** Giá vốn 1 đơn vị bán từ phân bổ: round(Σ |qty_i| × cost_i / qtyBase) × factor, không âm. */
export function lineCostPrice(alloc: { qty: number; costPrice: number }[], qtyBase: number, factor: number): number;

/** 'ok' | 'expiring' | 'expired' | 'empty' theo remaining, expiresOn, hôm nay và ngưỡng ngày. */
export function lotState(lot: { remaining: number; expiresOn: string | null }, today: string, warnDays: number): LotState;
export function daysLeft(expiresOn: string | null, today: string): number | null;
```

Số lượng là số thực (hàng cân); so sánh về 0 dùng ngưỡng `1e-9` như `adjustStockTo`, kết quả làm tròn
3 chữ số (`round3`) để tránh rác nhị phân.

## 5. Server

### 5.1 `services/stock.ts`

```ts
export interface MovementInput {
  productId: number; qty: number; type: MovementType; refId?: number | null; note?: string | null;
  /** Nhập: tạo lô mới rồi cộng vào (sau khi bù lô âm). */
  newLot?: { importItemId: number; costPrice: number; expiresOn: string | null };
  /** Trừ/cộng thẳng một lô (trả NCC chọn lô, bỏ hàng). */
  lotId?: number;
  /** Đảo một movement trước đó: ghi ngược dấu đúng các lô nó đã dùng; movement gốc không có phân bổ → luật tự động. */
  reverseOf?: number;
}

export interface MovementResult { movementId: number; alloc: { lotId: number; qty: number; costPrice: number }[] }

export function recordMovement(tx, m: MovementInput): MovementResult;
```

Thứ tự trong `recordMovement`: (1) insert `stock_movements`, (2) đọc lô của sản phẩm (`for update` không
cần: SQLite khóa cả DB trong transaction), (3) tính phân bổ, (4) ghi `lot_movements`, cập nhật
`lots.remaining` từng lô, (5) cộng `products.stock` như cũ. Quy tắc theo mục 3:

- `qty < 0`, không `lotId`/`reverseOf`: `allocateOut`; sản phẩm chưa có lô → tạo lô tồn đầu
  (`qty_in = 0`, `remaining = 0`, `cost_price = products.cost_price`, ghi chú "Tồn đầu") rồi trừ âm.
- `qty > 0`, có `newLot`: tạo lô (`qty_in = qty`, `remaining = 0`) rồi `allocateIn(..., targetId = lô mới)`.
  Vì vậy `remaining` lô mới có thể nhỏ hơn `qty_in` khi vừa bù lô âm.
- `qty > 0`, không có gì: `allocateIn(..., targetId = lô có id lớn nhất)`; chưa có lô → tạo lô tồn đầu
  rồi cộng vào.
- `lotId`: phân bổ một dòng duy nhất vào lô đó (kiểm lô thuộc đúng sản phẩm, không thì `BadRequestError`).
- `reverseOf`: đọc `lot_movements` của movement gốc; có dòng → ghi ngược dấu từng dòng (yêu cầu
  `|qty|` bằng tổng gốc, trả hàng một phần truyền `qty` nhỏ hơn thì chia theo tỷ lệ, làm tròn 3 chữ số, dồn
  sai số vào dòng cuối); không có dòng → rơi về luật tự động theo dấu `qty`.

`disposeLot(db, lotId, input, clock)` đặt ở `services/lots.ts` (cần trả về `LotRow`): lô `remaining ≤ 0` →
`ConflictError('Lô đã hết hàng')`; ngược lại `recordMovement({ type: 'adjust', qty: -remaining, lotId, note: 'Bỏ hàng <mã
phiếu nhập hoặc tồn đầu>: <note>' })`.

`adjustStockTo` giữ nguyên chữ ký, bên trong gọi `recordMovement` nên tự đúng.

### 5.2 Các service hiện có

- **`imports.ts`**: `ResolvedLine` thêm `expiresOn`; `createImport` chèn dòng trước rồi
  `recordMovement({ type: 'import', qty, newLot: { importItemId, costPrice, expiresOn } })`.
  `cancelImport` không gọi `adjust` thẳng nữa mà `reverseOf` movement `import` của từng dòng (tìm theo
  `type = 'import'` và `refId = importId`, ghép dòng theo `lot_movements.lot_id → lots.import_item_id`;
  phiếu cũ không có phân bổ thì luật tự động). `applyPrices` giữ nguyên.
- **`orders.ts`**: `createOrder` ghi movement **trước** khi chèn `order_items` để lấy
  `lineCostPrice(alloc, qty × factor, factor)` làm `cost_price`; món ngoài (`productId = null`) giữ
  `cost_price = 0`. `cancelOrder` dùng `reverseOf` movement `sale` của dòng (ghép theo `productId`, cùng
  `refId`; một đơn có hai dòng cùng sản phẩm thì ghép theo thứ tự `id`).
- **`returns.ts`**: dòng `restock` → `reverseOf` movement `sale` của dòng hóa đơn với `qty = qty_trả × factor`
  (chia tỷ lệ). `cancelReturn` → `reverseOf` movement `return` của phiếu trả. Cột `return_items.cost` vẫn
  `round(qty × order_items.cost_price)`.
- **`supplier-returns.ts`**: dòng có `lotId` → `recordMovement({ lotId })`, kiểm lô thuộc sản phẩm; không có
  → tự động. Lưu `lot_id` vào dòng. `cancelSupplierReturn` → `reverseOf`.
- **`stocktakes.ts`**: `finish` vẫn `recordMovement({ type: 'adjust', qty: diff })`, tự rơi vào luật
  trừ FEFO / cộng bù âm.
- **`reports.ts`**: `stockReport` tính `value` và `costValue` từ `Σ lots.remaining × lots.cost_price`
  (nhóm theo sản phẩm, chỉ lô `remaining > 0`; lô âm bỏ qua để không ra giá trị âm). Lãi lỗ không đổi.
- **`overview.ts`**: thêm `expiring` qua `lots.ts`, đọc `expiryWarnDays` từ `settings`.
- **`settings.ts`**: không đổi, key mới đi qua schema.
- **`backups.ts`**: không đổi (`KEEP_TABLES` chỉ `devices`); bản sao từ 0.17.0 có bảng mới, bản cũ hơn
  khôi phục vào DB mới: migration đã chạy nên bảng tồn tại nhưng rỗng → sau khôi phục chạy lại câu
  `INSERT … 'Tồn đầu'` cho sản phẩm chưa có lô (hàm `seedOpeningLots(tx)` dùng chung với migration, gọi
  cuối `restoreBackup`).

### 5.3 `services/lots.ts`

- `listLots(db, query, clock)`: join `lots × products × import_items × imports`, lọc `q`/`productId`,
  tính `daysLeft`/`state` trong SQL theo `today` và `warnDays` để lọc `state` và phân trang ở server;
  `summary` đếm trên toàn bộ kết quả khớp `q`/`productId` (không theo `state`); sắp xếp: quá hạn trước,
  rồi hạn gần nhất, rồi không hạn, rồi `id` giảm dần.
- `productLots(db, productId, clock)`: lô `remaining > 0` FEFO.
- `expiringOverview(db, limit, clock)`: `{ count, expiredCount, items }` cho Tổng quan.

### 5.4 Route

| Method | Path | Việc |
|---|---|---|
| GET | `/api/lots` | `lotListQuerySchema` → `LotList` |
| GET | `/api/products/:id/lots` | `ProductLot[]` |
| POST | `/api/lots/:id/dispose` | body `{ note?: string }` → `disposeLot`, trả `LotRow` |

Route chịu `deviceGate` như mọi `/api`.

## 6. Client

- **`api/lots.ts`** + hook TanStack Query; invalidate `lots`, `products`, `overview`, `movements` sau
  bỏ hàng.
- **Phiếu nhập** (`pages/imports`): `DraftLine` (`shared/import-draft.ts`) thêm `expiresOn: string | null`;
  `ImportLineRow` thêm ô Hạn dùng dùng `DateField` (xóa được); `ImportLinesTable` thêm cột; body gửi
  `expiresOn`. `ImportDetailDialog` hiện hạn từng dòng.
- **Trang `/lots` "Lô hàng"** (`pages/lots/LotsPage.tsx`), menu nhóm *Kho hàng* sau *Nhập hàng*, icon
  `Layers`: `PageTitle`; `StatStrip` (sắp hết hạn, đã hết hạn, giá trị tồn); `FilterBar` + `useUrlFilters`
  (`q`, `state` chip nhiều chọn, `productId` ẩn khi tới từ chi tiết sản phẩm); `ListPanel` cột: sản phẩm
  (`ProductAvatar` + tên), phiếu nhập (link mở chi tiết phiếu), hạn (`Badge` màu `warning` khi `expiring`,
  `destructive` khi `expired`, kèm "còn n ngày"/"quá n ngày"), còn, giá vốn, nút *Bỏ hàng* (hộp xác nhận
  `useConfirm` sẵn có, không có ô ghi chú; API vẫn nhận `note`). Điện thoại: cùng bảng, ẩn cột phiếu và giá vốn.
- **Sản phẩm**: không có trang chi tiết sản phẩm, nên menu ⋯ của dòng sản phẩm thêm mục *Lô hàng* mở
  `/lots?productId=…` (chip lọc hiện tên sản phẩm). `ProductLot[]` chỉ dùng cho ô chọn lô khi trả NCC.
- **Trả NCC** (`pages/supplier-returns`): dòng có `Select` lô, mặc định lô FEFO đầu; mỗi option
  "PN-… · HSD dd/mm/yyyy · còn n"; `qty > remaining` hiện chữ nhỏ `warning` "vượt số còn của lô".
- **Tổng quan**: thẻ *Sắp hết hạn* kiểu như *Tồn thấp*: số lô quá hạn (đỏ) và sắp hết hạn, vài dòng đầu,
  bấm sang `/lots?state=expired,expiring`.
- **Cài đặt**: thẻ Cửa hàng thêm ô số *Báo hết hạn trước (ngày)*.

## 7. Trường hợp đặc biệt và lỗi

- Dòng nhập không hạn và sản phẩm chưa từng có lô âm: lô mới `remaining = qty_in`, như kỳ vọng.
- Nhập 20 khi lô cũ âm −3: lô cũ về 0, lô mới `remaining = 17`, `qty_in = 20`; tổng vẫn = tồn.
- Bán 5 khi còn lô A 3 (hạn 10/10) và lô B 10 (không hạn): trừ A 3, B 2; giá vốn dòng =
  `round((3×costA + 2×costB)/5)`.
- Bán 5 khi mọi lô đều 0 hoặc âm: trừ hết 5 vào lô cuối theo FEFO (lô không hạn mới nhất), giá vốn = giá
  lô đó.
- Hủy hóa đơn trên: cộng lại A 3, B 2 dù A đã bị trừ tiếp bởi đơn khác; lô có thể dương lại.
- Hủy phiếu nhập đã bán hết lô: lô về `−qty_in`, tự bù khi nhập tiếp. Thông báo hủy ghi rõ.
- Trả NCC lô đã bán sạch (`remaining = 0`): ô chọn lô không liệt kê, chỉ chọn được lô còn hàng; trả
  không chọn lô vẫn được.
- `expiresOn` trong quá khứ khi nhập: cho phép, lô hiện `expired` ngay.
- Bỏ hàng lô âm/0: 409 "Lô đã hết hàng".
- Khôi phục bản sao cũ (trước 0.17.0): sau khi chép bảng, `seedOpeningLots` tạo lô tồn đầu cho sản phẩm
  chưa có lô; phiếu cũ không có phân bổ, hủy theo luật tự động.
- Sản phẩm không bao giờ bị xóa khỏi DB (chỉ ngừng bán qua `setProductActive`), nên `lots.product_id`
  không cần xử lý xóa; sản phẩm ngừng bán vẫn nhập, trả NCC, bỏ hàng và hiện trên trang Lô hàng.
- Tạo sản phẩm có tồn (`createProduct`) hay sửa tồn tay (`updateProduct`) đi qua `adjustStockTo` →
  `recordMovement`, nên tự tạo lô tồn đầu / bù lô như mọi movement khác, không cần code riêng.
- Xem từ xa: `Overview.expiring` đi kèm lên Firestore (tài liệu vẫn nhỏ, dưới 1 MB); trang remote chưa vẽ.

## 8. Kiểm thử

### 8.1 `shared/src/lot-math.test.ts`

- `sortFefo`: hạn tăng dần, null cuối, cùng hạn theo `id`.
- `allocateOut`: đủ hàng, gối hai lô, thiếu hàng trừ âm lô cuối, bỏ qua lô âm/0 khi còn lô dương, số thực
  (0.3 kg) làm tròn 3 chữ số.
- `allocateIn`: không lô âm → toàn bộ vào đích; có lô âm → bù về 0 rồi dư vào đích; nhiều lô âm bù theo
  FEFO; cộng ít hơn tổng âm → đích nhận 0.
- `lineCostPrice`: một lô, hai lô, làm tròn, `factor` thùng, qty 0 → 0.
- `lotState`/`daysLeft`: hôm nay, quá hạn, trong ngưỡng, ngoài ngưỡng, không hạn, `remaining ≤ 0` → `empty`.

### 8.2 `server/src/services/stock.test.ts` (mới, `createTestDb()`, `Clock` cố định)

- Sau mỗi loại movement bất biến Σ `remaining` = `stock` (hàm `assertLotInvariant(db, productId)` dùng
  lại ở các test khác).
- `newLot`, bù âm khi nhập, trừ FEFO, tạo lô tồn đầu khi chưa có lô, `lotId` sai sản phẩm → 400,
  `reverseOf` đủ/một phần/không có phân bổ gốc, `disposeLot`.

### 8.3 Cập nhật test hiện có

- `imports.test.ts`: dòng có `expiresOn` tạo lô; hủy phiếu trừ đúng lô; hủy sau khi bán một phần → lô âm.
- `orders.test.ts`: `cost_price` theo lô gối; bán âm vẫn được; hủy đơn cộng lại đúng lô.
- `returns.test.ts`, `supplier-returns.test.ts` (chọn lô, vượt số còn), `stocktakes.test.ts` (thiếu/thừa),
  `reports.test.ts` (giá trị tồn theo lô), `overview.test.ts` (`expiring`), `backups.test.ts` (khôi phục
  bản không có `lots` → có lô tồn đầu), schema test cho `lot`, `import`, `supplier-return`, `settings`.
- Migration: test chạy `0008` trên DB có sản phẩm tồn ≠ 0 → mỗi sản phẩm một lô tồn đầu, tồn 0 không có lô.

### 8.4 Trình duyệt (skill `browser-verify`, chặn request ghi)

- Phiếu nhập: cột Hạn dùng, chọn/xóa ngày, body gửi `expiresOn`.
- `/lots`: lọc trạng thái, màu badge, hộp xác nhận Bỏ hàng (không gửi).
- Menu sản phẩm có mục Lô hàng dẫn tới `/lots?productId=`; Trả NCC có ô chọn lô và cảnh báo vượt; Tổng quan có
  thẻ Sắp hết hạn; Cài đặt có ô ngưỡng. Kiểm ở cỡ điện thoại và máy tính.

## 9. Phiên bản và tài liệu

- `package.json` gốc → `0.17.0`.
- CLAUDE.md: thêm mục đã xong "Lô hàng & hạn sử dụng 0.17.0", bất biến mới: *Lô hàng chỉ đổi qua
  `recordMovement`; Σ `lots.remaining` = `products.stock`; giá vốn dòng hóa đơn lấy từ lô đã trừ; migration
  dev tới `0008`*.
- README: mục Lô hàng & hạn sử dụng cho chủ tiệm (nhập hạn ở đâu, xem ở đâu, bỏ hàng).
