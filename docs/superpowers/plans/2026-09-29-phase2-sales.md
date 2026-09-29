# Giai đoạn 2 – Bán hàng và in hóa đơn: Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm màn Bán hàng (quét/tìm, giỏ, hàng cân, món ngoài, đơn chờ, giảm giá), thanh toán tiền mặt / chuyển khoản VietQR, in hóa đơn 80mm, danh sách hóa đơn theo ngày (in lại, hủy trả kho) và trang Cài đặt.

**Architecture:** Logic thuần (tiền, ngày địa phương, VietQR, giỏ hàng) đặt ở `shared` để client và server dùng chung và test bằng vitest. Server thêm service `orders` / `settings` nhận `db` làm tham số, mọi thay đổi tồn đi qua `recordMovement`. Client thêm trang `/sell`, `/orders`, `/settings`; in bằng `window.print()` với component `Receipt` render vào `#print-root`.

**Tech Stack:** Node 24, TypeScript 5.9 ESM, Express 5, better-sqlite3, drizzle-orm 0.45 + drizzle-kit 0.31, zod 4, vitest 3; React 19, Vite 7, Tailwind v4, shadcn/ui (radix-nova) + lucide-react, TanStack Query 5, react-router 7, sonner; mới: `qrcode` (+ `@types/qrcode`).

**Spec:** `docs/superpowers/specs/2026-09-29-tiny-pos-phase2-sales-design.md` (nền tảng: `docs/superpowers/specs/2026-09-29-tiny-pos-phase1-design.md`)

## Global Constraints

- Tiền là `integer` đồng; số lượng/tồn/factor là `real`.
- Mọi thay đổi `products.stock` phải kèm 1 dòng `stock_movements` trong cùng transaction (dùng `recordMovement` trong `server/src/services/stock.ts`).
- `order_items` lưu snapshot `product_name`, `unit`, `price`, `cost_price`, `factor`, `amount`.
- Cho bán khi tồn không đủ (tồn được âm); giỏ chỉ cảnh báo.
- Ngày của đơn / mã `HD-YYYYMMDD-NNNN` / tóm tắt ngày theo **giờ địa phương** của máy server; `created_at` vẫn lưu ISO UTC.
- API dưới `/api`, lỗi `{ error: string }`; body validate bằng zod trong `shared/`.
- UI tiếng Việt, tiền hiển thị `15.000đ`, nút cao ≥ 44px (`h-11`) ở các thao tác chính. Component ≤ 200 dòng.
- Giao diện dùng shadcn/ui (`client/src/components/ui`) + lucide-react; không tự viết component UI thô. Thêm component shadcn mới bằng `npx shadcn@latest add <tên>` trong `client/`.
- Thư viện mới duy nhất: `qrcode` (client) và dev `@types/qrcode`.
- Định danh trong code tiếng Anh; UI, comment, commit message tiếng Việt.
- **Không format lại file có sẵn**: dự án không có Prettier; khi sửa file cũ chỉ thêm/sửa đúng những dòng cần. Trước commit chạy `git diff --stat` kiểm tra.
- Làm trên nhánh hiện tại (`master`), không tạo nhánh mới.
- Không dùng `crypto.randomUUID` ở client (trang mở qua `http://<IP LAN>` không phải secure context).
- `localStorage` đọc/ghi luôn bọc `try/catch`.

## Review Focus

1. Mở trang qua `http://<IP LAN>:3000` trên điện thoại (không secure context): thêm món vào giỏ phải chạy, khóa dòng không được dựa vào `crypto.randomUUID` (Task 4: test `newLineKey` duy nhất, không dùng crypto).
2. Bán lúc 0h–7h sáng giờ Việt Nam: đơn phải mang mã và thuộc tổng của ngày địa phương hôm đó, không phải ngày UTC hôm trước (Task 6: test mã `HD-20260930-0001` lúc `2026-09-29T17:30Z`; test ranh giới `listOrders`).
3. Quét mã một sản phẩm đã ngừng bán ở màn Bán hàng: không được thêm vào giỏ (client toast), và server từ chối 400 nếu client cũ vẫn gửi lên (Task 6: test sản phẩm ngừng bán; Task 10: `addProduct` kiểm tra `isActive`).
4. Giỏ hàng lưu trong `localStorage` bị hỏng hoặc từ phiên bản cũ (JSON sai, thiếu trường): trang Bán hàng vẫn mở được với giỏ trống (Task 4: test `parseStoredCart` / `parseHeldCarts` với dữ liệu rác).
5. Hủy một đơn bán theo thùng sau khi đơn vị thùng đã bị sửa hệ số hoặc xóa: phải cộng trả đúng `qty × factor` lúc bán (Task 6: test hủy sau khi xóa đơn vị).

---

### Task 1: Tiện ích tiền đơn hàng, ngày địa phương, chữ không dấu (shared)

**Files:**
- Create: `shared/src/order-math.ts`, `shared/src/order-math.test.ts`
- Create: `shared/src/local-date.ts`, `shared/src/local-date.test.ts`
- Create: `shared/src/text.ts`, `shared/src/text.test.ts`
- Modify: `shared/src/index.ts` (thêm 3 dòng export)

**Interfaces:**
- Produces:
  - `interface LineLike { qty: number; price: number; isWeighed: boolean }`
  - `interface Totals { total: number; discount: number; payable: number }`
  - `lineAmount(l: LineLike): number`
  - `cartTotals(lines: LineLike[], discount: number): Totals`
  - `suggestCash(payable: number): number[]`
  - `formatQty(qty: number): string`
  - `localDate(at: Date, tzOffsetMin: number): string` (`YYYY-MM-DD`)
  - `localDayRange(date: string, tzOffsetMin: number): { start: string; end: string }`
  - `shiftDate(date: string, days: number): string`
  - `currentTzOffset(at?: Date): number` (VN = 420)
  - `stripDiacritics(s: string): string`, `toBankName(s: string): string`

- [ ] **Step 1: Viết test**

`shared/src/order-math.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { cartTotals, formatQty, lineAmount, suggestCash } from './order-math.js';

describe('lineAmount', () => {
  it('hàng thường: qty × giá, làm tròn về đồng', () => {
    expect(lineAmount({ qty: 2, price: 12000, isWeighed: false })).toBe(24000);
    expect(lineAmount({ qty: 0.333, price: 10000, isWeighed: false })).toBe(3330);
  });
  it('hàng cân: làm tròn 500đ', () => {
    expect(lineAmount({ qty: 0.35, price: 57000, isWeighed: true })).toBe(20000);
    expect(lineAmount({ qty: 1.2, price: 35000, isWeighed: true })).toBe(42000);
  });
});

describe('cartTotals', () => {
  it('tổng, giảm giá, phải trả', () => {
    const lines = [
      { qty: 2, price: 12000, isWeighed: false },
      { qty: 0.35, price: 57000, isWeighed: true },
    ];
    expect(cartTotals(lines, 4000)).toEqual({ total: 44000, discount: 4000, payable: 40000 });
    expect(cartTotals([], 0)).toEqual({ total: 0, discount: 0, payable: 0 });
  });
});

describe('suggestCash', () => {
  it('đủ tiền + các mệnh giá tròn phía trên, tối đa 4, tăng dần', () => {
    expect(suggestCash(87000)).toEqual([87000, 90000, 100000, 200000]);
    expect(suggestCash(100000)).toEqual([100000, 200000, 500000]);
    expect(suggestCash(620000)).toEqual([620000, 650000, 700000]);
    expect(suggestCash(0)).toEqual([0]);
  });
});

describe('formatQty', () => {
  it('dấu phẩy thập phân, tối đa 3 số lẻ, bỏ số 0 cuối', () => {
    expect(formatQty(0.35)).toBe('0,35');
    expect(formatQty(2)).toBe('2');
    expect(formatQty(0.3333)).toBe('0,333');
    expect(formatQty(1234.5)).toBe('1.234,5');
  });
});
```

`shared/src/local-date.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { localDate, localDayRange, shiftDate } from './local-date.js';

const VN = 420;

describe('localDate', () => {
  it('17:00 UTC là 0 giờ hôm sau ở VN', () => {
    expect(localDate(new Date('2026-09-28T17:00:00.000Z'), VN)).toBe('2026-09-29');
    expect(localDate(new Date('2026-09-28T16:59:59.999Z'), VN)).toBe('2026-09-28');
  });
});

describe('localDayRange', () => {
  it('khoảng UTC [start, end) của một ngày VN', () => {
    expect(localDayRange('2026-09-29', VN)).toEqual({
      start: '2026-09-28T17:00:00.000Z',
      end: '2026-09-29T17:00:00.000Z',
    });
  });
});

describe('shiftDate', () => {
  it('lùi/tiến qua tháng', () => {
    expect(shiftDate('2026-09-30', 1)).toBe('2026-10-01');
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28');
  });
});
```

`shared/src/text.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { stripDiacritics, toBankName } from './text.js';

describe('text', () => {
  it('bỏ dấu tiếng Việt, kể cả đ/Đ', () => {
    expect(stripDiacritics('Đường Nguyễn Huệ')).toBe('Duong Nguyen Hue');
  });
  it('tên chủ tài khoản: in hoa, không dấu, gộp khoảng trắng', () => {
    expect(toBankName('  nguyễn văn   an ')).toBe('NGUYEN VAN AN');
    expect(toBankName('Trần Thị B.')).toBe('TRAN THI B');
  });
});
```

- [ ] **Step 2: Chạy test, thấy FAIL**

Run: `npm test -w shared`
Expected: FAIL, không tìm thấy module `./order-math.js`, `./local-date.js`, `./text.js`.

- [ ] **Step 3: Viết code**

`shared/src/order-math.ts`:

```ts
import { round500 } from './money.js';

export interface LineLike {
  qty: number;
  price: number;
  isWeighed: boolean;
}

export interface Totals {
  total: number;
  discount: number;
  payable: number;
}

/** Thành tiền 1 dòng: hàng cân làm tròn 500đ, còn lại làm tròn về đồng. */
export function lineAmount(l: LineLike): number {
  const raw = l.qty * l.price;
  return l.isWeighed ? round500(raw) : Math.round(raw);
}

/** Tổng trước giảm giá, giảm giá và số phải trả; client và server cùng dùng để số tiền luôn khớp. */
export function cartTotals(lines: LineLike[], discount: number): Totals {
  const total = lines.reduce((sum, l) => sum + lineAmount(l), 0);
  return { total, discount, payable: total - discount };
}

/** Gợi ý tiền khách đưa: đủ tiền, bội 10k/50k/100k gần nhất phía trên, 200k, 500k (tối đa 4). */
export function suggestCash(payable: number): number[] {
  if (payable <= 0) return [0];
  const up = (step: number) => Math.ceil(payable / step) * step;
  const candidates = [payable, up(10_000), up(50_000), up(100_000), 200_000, 500_000].filter((v) => v >= payable);
  return [...new Set(candidates)].sort((a, b) => a - b).slice(0, 4);
}

const qtyFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 });

/** 0.35 → "0,35"; 2 → "2"; 1234.5 → "1.234,5". */
export function formatQty(qty: number): string {
  return qtyFormat.format(qty);
}
```

`shared/src/local-date.ts`:

```ts
const MINUTE = 60_000;
const DAY = 86_400_000;

/** Ngày địa phương "YYYY-MM-DD" của thời điểm `at`; `tzOffsetMin` là số phút lệch so với UTC (VN = 420). */
export function localDate(at: Date, tzOffsetMin: number): string {
  return new Date(at.getTime() + tzOffsetMin * MINUTE).toISOString().slice(0, 10);
}

/** Khoảng UTC [start, end) của một ngày địa phương, dạng ISO để so chuỗi với created_at. */
export function localDayRange(date: string, tzOffsetMin: number): { start: string; end: string } {
  const start = Date.parse(`${date}T00:00:00.000Z`) - tzOffsetMin * MINUTE;
  return { start: new Date(start).toISOString(), end: new Date(start + DAY).toISOString() };
}

/** Cộng/trừ số ngày trên chuỗi "YYYY-MM-DD". */
export function shiftDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * DAY).toISOString().slice(0, 10);
}

/** Độ lệch múi giờ của máy đang chạy, tính bằng phút (VN = 420). */
export function currentTzOffset(at: Date = new Date()): number {
  return -at.getTimezoneOffset();
}
```

`shared/src/text.ts`:

```ts
/** Bỏ dấu tiếng Việt: "Đường" → "Duong". */
export function stripDiacritics(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/** Tên chủ tài khoản theo kiểu ngân hàng: in hoa, không dấu, chỉ chữ/số/khoảng trắng. */
export function toBankName(s: string): string {
  return stripDiacritics(s)
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
```

Trong `shared/src/index.ts`, thêm sau dòng `export * from './csv.js';`:

```ts
export * from './order-math.js';
export * from './local-date.js';
export * from './text.js';
```

- [ ] **Step 4: Chạy test, thấy PASS**

Run: `npm test -w shared`
Expected: PASS toàn bộ (cả test cũ).

- [ ] **Step 5: Commit**

```bash
git add shared/src/order-math.ts shared/src/order-math.test.ts shared/src/local-date.ts shared/src/local-date.test.ts shared/src/text.ts shared/src/text.test.ts shared/src/index.ts
git commit -m "feat(shared): tính tiền đơn hàng, ngày địa phương, bỏ dấu"
```

---

### Task 2: VietQR và danh sách ngân hàng (shared)

**Files:**
- Create: `shared/src/vietqr.ts`, `shared/src/vietqr.test.ts`, `shared/src/banks.ts`
- Modify: `shared/src/index.ts` (thêm 2 dòng export)

**Interfaces:**
- Consumes: `stripDiacritics` (Task 1).
- Produces:
  - `crc16(s: string): string` (4 ký tự hex in hoa)
  - `interface VietQrInput { bin: string; account: string; amount: number; message?: string }`
  - `buildVietQr(input: VietQrInput): string`
  - `vietQrFromSettings(s: { bankBin: string; bankAccount: string }, amount: number): string | null`
  - `interface Bank { bin: string; shortName: string; name: string }`, `BANKS: Bank[]`

- [ ] **Step 1: Viết test**

`shared/src/vietqr.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { BANKS } from './banks.js';
import { buildVietQr, crc16, vietQrFromSettings } from './vietqr.js';

describe('crc16', () => {
  it('CRC-16/CCITT-FALSE của chuỗi chuẩn', () => {
    expect(crc16('123456789')).toBe('29B1');
  });
});

describe('buildVietQr', () => {
  it('ghép TLV đúng chuẩn EMVCo/NAPAS, CRC ở cuối', () => {
    const s = buildVietQr({ bin: '970436', account: '0011001234567', amount: 87000, message: 'Thanh toán' });
    expect(s.slice(0, -4)).toBe(
      '000201010212' +
        '38570010A00000072701270006970436011300110012345670208QRIBFTTA' +
        '5303704' +
        '540587000' +
        '5802VN' +
        '62140810Thanh toan' +
        '6304',
    );
    expect(s.slice(-4)).toBe(crc16(s.slice(0, -4)));
  });
  it('không có số tiền → QR tĩnh (11), không có tag 54', () => {
    const s = buildVietQr({ bin: '970436', account: '123', amount: 0 });
    expect(s.startsWith('000201010211')).toBe(true);
    expect(s).not.toContain('5405');
    expect(s).not.toContain('62');
  });
});

describe('vietQrFromSettings', () => {
  it('thiếu ngân hàng hoặc số tài khoản → null', () => {
    expect(vietQrFromSettings({ bankBin: '', bankAccount: '123' }, 1000)).toBeNull();
    expect(vietQrFromSettings({ bankBin: '970436', bankAccount: '' }, 1000)).toBeNull();
    expect(vietQrFromSettings({ bankBin: '970436', bankAccount: '123' }, 1000)).toContain('Thanh toan');
  });
});

describe('BANKS', () => {
  it('BIN 6 chữ số, không trùng', () => {
    expect(BANKS.length).toBeGreaterThanOrEqual(20);
    for (const b of BANKS) expect(b.bin).toMatch(/^\d{6}$/);
    expect(new Set(BANKS.map((b) => b.bin)).size).toBe(BANKS.length);
  });
});
```

- [ ] **Step 2: Chạy test, thấy FAIL**

Run: `npm test -w shared`
Expected: FAIL, không tìm thấy module `./vietqr.js`, `./banks.js`.

- [ ] **Step 3: Viết code**

`shared/src/vietqr.ts`:

```ts
import { stripDiacritics } from './text.js';

/** Một trường TLV: ID 2 số + độ dài 2 số + giá trị. */
const tlv = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`;

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), 4 ký tự hex in hoa. */
export function crc16(s: string): string {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export interface VietQrInput {
  bin: string;
  account: string;
  amount: number;
  message?: string;
}

/** Chuỗi VietQR (EMVCo) chuyển khoản tới tài khoản; dựng hoàn toàn offline. */
export function buildVietQr({ bin, account, amount, message = '' }: VietQrInput): string {
  const merchant = tlv('00', 'A000000727') + tlv('01', tlv('00', bin) + tlv('01', account)) + tlv('02', 'QRIBFTTA');
  const amt = Math.round(amount);
  const msg = stripDiacritics(message).replace(/[^A-Za-z0-9 ]/g, '').trim().slice(0, 25);
  const body =
    tlv('00', '01') +
    tlv('01', amt > 0 ? '12' : '11') +
    tlv('38', merchant) +
    tlv('53', '704') +
    (amt > 0 ? tlv('54', String(amt)) : '') +
    tlv('58', 'VN') +
    (msg ? tlv('62', tlv('08', msg)) : '') +
    '6304';
  return body + crc16(body);
}

/** QR theo cài đặt cửa hàng; chưa cài ngân hàng/số tài khoản thì null. */
export function vietQrFromSettings(s: { bankBin: string; bankAccount: string }, amount: number): string | null {
  if (!s.bankBin || !s.bankAccount) return null;
  return buildVietQr({ bin: s.bankBin, account: s.bankAccount, amount, message: 'Thanh toan' });
}
```

`shared/src/banks.ts` (BIN theo danh sách NAPAS; nếu có mạng, đối chiếu với `https://api.vietqr.io/v2/banks` trước khi commit):

```ts
export interface Bank {
  bin: string;
  shortName: string;
  name: string;
}

/** Ngân hàng phổ biến cho ô chọn ở trang Cài đặt (BIN NAPAS). */
export const BANKS: Bank[] = [
  { bin: '970436', shortName: 'Vietcombank', name: 'Ngân hàng TMCP Ngoại thương Việt Nam' },
  { bin: '970415', shortName: 'VietinBank', name: 'Ngân hàng TMCP Công thương Việt Nam' },
  { bin: '970418', shortName: 'BIDV', name: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam' },
  { bin: '970405', shortName: 'Agribank', name: 'Ngân hàng Nông nghiệp và Phát triển Nông thôn' },
  { bin: '970407', shortName: 'Techcombank', name: 'Ngân hàng TMCP Kỹ thương Việt Nam' },
  { bin: '970422', shortName: 'MB Bank', name: 'Ngân hàng TMCP Quân đội' },
  { bin: '970416', shortName: 'ACB', name: 'Ngân hàng TMCP Á Châu' },
  { bin: '970432', shortName: 'VPBank', name: 'Ngân hàng TMCP Việt Nam Thịnh Vượng' },
  { bin: '970423', shortName: 'TPBank', name: 'Ngân hàng TMCP Tiên Phong' },
  { bin: '970403', shortName: 'Sacombank', name: 'Ngân hàng TMCP Sài Gòn Thương Tín' },
  { bin: '970437', shortName: 'HDBank', name: 'Ngân hàng TMCP Phát triển TP.HCM' },
  { bin: '970441', shortName: 'VIB', name: 'Ngân hàng TMCP Quốc tế Việt Nam' },
  { bin: '970443', shortName: 'SHB', name: 'Ngân hàng TMCP Sài Gòn – Hà Nội' },
  { bin: '970431', shortName: 'Eximbank', name: 'Ngân hàng TMCP Xuất Nhập khẩu Việt Nam' },
  { bin: '970426', shortName: 'MSB', name: 'Ngân hàng TMCP Hàng Hải' },
  { bin: '970448', shortName: 'OCB', name: 'Ngân hàng TMCP Phương Đông' },
  { bin: '970440', shortName: 'SeABank', name: 'Ngân hàng TMCP Đông Nam Á' },
  { bin: '970449', shortName: 'LPBank', name: 'Ngân hàng TMCP Lộc Phát Việt Nam' },
  { bin: '970428', shortName: 'Nam A Bank', name: 'Ngân hàng TMCP Nam Á' },
  { bin: '970409', shortName: 'Bac A Bank', name: 'Ngân hàng TMCP Bắc Á' },
  { bin: '970452', shortName: 'KienlongBank', name: 'Ngân hàng TMCP Kiên Long' },
  { bin: '970454', shortName: 'Viet Capital Bank', name: 'Ngân hàng TMCP Bản Việt' },
];
```

Trong `shared/src/index.ts`, thêm sau dòng `export * from './text.js';`:

```ts
export * from './vietqr.js';
export * from './banks.js';
```

- [ ] **Step 4: Chạy test, thấy PASS**

Run: `npm test -w shared`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/src/vietqr.ts shared/src/vietqr.test.ts shared/src/banks.ts shared/src/index.ts
git commit -m "feat(shared): dựng mã VietQR offline, danh sách ngân hàng"
```

---

### Task 3: Schema đơn hàng, cài đặt và types (shared)

**Files:**
- Create: `shared/src/schemas/order.ts`, `shared/src/schemas/settings.ts`, `shared/src/schemas/order.test.ts`
- Modify: `shared/src/types.ts` (thêm cuối file), `shared/src/schemas/common.ts` (thêm nhãn vào `FIELD_LABELS`), `shared/src/index.ts`

**Interfaces:**
- Consumes: `toBankName` (Task 1).
- Produces:
  - `orderItemInputSchema`, `orderInputSchema`, `type OrderInput = z.output<…>`, `type OrderInputBody = z.input<…>`
  - `orderListQuerySchema`, `type OrderListQuery`
  - `settingsInputSchema`, `type Settings = z.output<…>`, `SETTINGS_DEFAULTS: Settings`
  - Types: `PaymentMethod`, `OrderItem`, `OrderSummary`, `OrderDetail`, `DaySummary`, `OrderList`
  - Sau parse, `OrderInput['items'][number]` = `{ productId: number | null; unitId: number | null; name: string; qty: number; price: number }`

- [ ] **Step 1: Viết test**

`shared/src/schemas/order.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { orderInputSchema, orderListQuerySchema } from './order.js';
import { SETTINGS_DEFAULTS, settingsInputSchema } from './settings.js';

describe('orderInputSchema', () => {
  it('chuẩn hóa dòng: productId/unitId thiếu → null, name thiếu → rỗng', () => {
    const r = orderInputSchema.parse({ items: [{ qty: 1, price: 5000 }], paymentMethod: 'cash', paid: 5000 });
    expect(r).toEqual({
      items: [{ productId: null, unitId: null, name: '', qty: 1, price: 5000 }],
      discount: 0,
      paymentMethod: 'cash',
      paid: 5000,
    });
  });
  it('từ chối giỏ rỗng, qty ≤ 0, giá lẻ, phương thức debt', () => {
    expect(orderInputSchema.safeParse({ items: [], paymentMethod: 'cash' }).success).toBe(false);
    expect(orderInputSchema.safeParse({ items: [{ qty: 0, price: 1 }], paymentMethod: 'cash' }).success).toBe(false);
    expect(orderInputSchema.safeParse({ items: [{ qty: 1, price: 1.5 }], paymentMethod: 'cash' }).success).toBe(false);
    expect(orderInputSchema.safeParse({ items: [{ qty: 1, price: 1 }], paymentMethod: 'debt' }).success).toBe(false);
  });
});

describe('orderListQuerySchema', () => {
  it('date dạng YYYY-MM-DD hoặc bỏ trống', () => {
    expect(orderListQuerySchema.parse({})).toEqual({});
    expect(orderListQuerySchema.parse({ date: '2026-09-29' })).toEqual({ date: '2026-09-29' });
    expect(orderListQuerySchema.safeParse({ date: '29/09/2026' }).success).toBe(false);
  });
});

describe('settingsInputSchema', () => {
  it('mặc định', () => {
    expect(SETTINGS_DEFAULTS).toEqual({
      storeName: 'Tạp hóa',
      storeAddress: '',
      storePhone: '',
      receiptFooter: 'Cảm ơn quý khách!',
      bankBin: '',
      bankAccount: '',
      bankAccountName: '',
      autoPrint: true,
    });
  });
  it('chuẩn hóa tên chủ tài khoản, kiểm tra BIN/số tài khoản', () => {
    expect(settingsInputSchema.parse({ bankAccountName: 'nguyễn văn an' }).bankAccountName).toBe('NGUYEN VAN AN');
    expect(settingsInputSchema.safeParse({ bankBin: '9704' }).success).toBe(false);
    expect(settingsInputSchema.safeParse({ bankAccount: '12a' }).success).toBe(false);
    expect(settingsInputSchema.safeParse({ storeName: '' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy test, thấy FAIL**

Run: `npm test -w shared`
Expected: FAIL, không tìm thấy `./order.js`, `./settings.js`.

- [ ] **Step 3: Viết code**

`shared/src/schemas/order.ts`:

```ts
import { z } from 'zod';

const optionalId = z
  .number()
  .int()
  .positive()
  .nullish()
  .transform((v) => v ?? null);

/** Một dòng giỏ: có productId là hàng trong kho, không có là món ngoài (chỉ tên + giá). */
export const orderItemInputSchema = z.object({
  productId: optionalId,
  unitId: optionalId,
  name: z.string().trim().max(100).default(''),
  qty: z.number().positive().max(100_000),
  price: z.number().int().min(0),
});

export const orderInputSchema = z.object({
  items: z.array(orderItemInputSchema).min(1, 'chưa có món nào'),
  discount: z.number().int().min(0).default(0),
  paymentMethod: z.enum(['cash', 'transfer']),
  paid: z.number().int().min(0).default(0),
});
export type OrderInput = z.output<typeof orderInputSchema>;
/** Kiểu body client gửi lên (trước khi zod điền mặc định). */
export type OrderInputBody = z.input<typeof orderInputSchema>;

export const orderListQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'phải có dạng YYYY-MM-DD')
    .optional(),
});
export type OrderListQuery = z.infer<typeof orderListQuerySchema>;
```

`shared/src/schemas/settings.ts`:

```ts
import { z } from 'zod';
import { toBankName } from '../text.js';

const text = (max: number, fallback = '') => z.string().trim().max(max).default(fallback);

/** Cài đặt cửa hàng; PUT gửi đủ object, trường thiếu nhận mặc định. */
export const settingsInputSchema = z.object({
  storeName: z.string().trim().min(1).max(100).default('Tạp hóa'),
  storeAddress: text(200),
  storePhone: text(20),
  receiptFooter: text(200, 'Cảm ơn quý khách!'),
  bankBin: z
    .string()
    .trim()
    .regex(/^(\d{6})?$/, 'gồm 6 chữ số')
    .default(''),
  bankAccount: z
    .string()
    .trim()
    .regex(/^\d{0,19}$/, 'chỉ gồm chữ số')
    .default(''),
  bankAccountName: z.string().max(50).transform(toBankName).default(''),
  autoPrint: z.boolean().default(true),
});
export type Settings = z.output<typeof settingsInputSchema>;

export const SETTINGS_DEFAULTS: Settings = settingsInputSchema.parse({});
```

Thêm vào cuối `shared/src/types.ts`:

```ts

export type PaymentMethod = 'cash' | 'transfer' | 'debt';

export interface OrderItem {
  id: number;
  productId: number | null;
  productName: string;
  unit: string;
  qty: number;
  price: number;
  costPrice: number;
  factor: number;
  amount: number;
}

export interface OrderSummary {
  id: number;
  code: string;
  total: number;
  discount: number;
  /** total − discount, không lưu DB. */
  payable: number;
  paid: number;
  paymentMethod: PaymentMethod;
  status: 'done' | 'cancelled';
  itemCount: number;
  createdAt: string;
  cancelledAt: string | null;
}

export interface OrderDetail extends OrderSummary {
  items: OrderItem[];
}

export interface DaySummary {
  count: number;
  total: number;
  cash: number;
  transfer: number;
}

export interface OrderList {
  orders: OrderSummary[];
  summary: DaySummary;
}
```

Trong `shared/src/schemas/common.ts`, thêm các dòng sau ngay sau dòng `  factor: 'Hệ số quy đổi',` (giữ nguyên các dòng khác):

```ts
  items: 'Giỏ hàng',
  qty: 'Số lượng',
  price: 'Đơn giá',
  discount: 'Giảm giá',
  paid: 'Tiền khách đưa',
  paymentMethod: 'Phương thức thanh toán',
  productId: 'Sản phẩm',
  unitId: 'Đơn vị',
  date: 'Ngày',
  storeName: 'Tên cửa hàng',
  storeAddress: 'Địa chỉ',
  storePhone: 'Số điện thoại',
  receiptFooter: 'Lời chào cuối hóa đơn',
  bankBin: 'Ngân hàng',
  bankAccount: 'Số tài khoản',
  bankAccountName: 'Tên chủ tài khoản',
  autoPrint: 'Tự in',
```

Trong `shared/src/index.ts`, thêm sau dòng `export * from './schemas/product-unit.js';`:

```ts
export * from './schemas/order.js';
export * from './schemas/settings.js';
```

- [ ] **Step 4: Chạy test, thấy PASS**

Run: `npm test -w shared`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/src/schemas/order.ts shared/src/schemas/settings.ts shared/src/schemas/order.test.ts shared/src/types.ts shared/src/schemas/common.ts shared/src/index.ts
git commit -m "feat(shared): schema đơn hàng, cài đặt và kiểu dữ liệu hóa đơn"
```

---

### Task 4: Logic giỏ hàng (shared)

**Files:**
- Create: `shared/src/cart.ts`, `shared/src/cart.test.ts`
- Modify: `shared/src/index.ts`

**Interfaces:**
- Consumes: `lineAmount` (Task 1), `OrderInputBody` (Task 3), `Product`, `ProductUnit` (`shared/src/types.ts`).
- Produces:
  - `type CartLine = { key: string; productId: number | null; unitId: number | null; name: string; unitName: string; factor: number; isWeighed: boolean; stock: number; qty: number; price: number }`
  - `type NewCartLine = Omit<CartLine, 'key'>`
  - `type Cart = { lines: CartLine[]; discount: number }`, `EMPTY_CART: Cart`
  - `type HeldCart = { id: string; at: string; cart: Cart }`, `MAX_HELD_CARTS = 5`
  - `type CartAction = { type: 'add'; line: NewCartLine } | { type: 'update'; key: string; patch: Partial<Pick<CartLine, 'qty' | 'price'>> } | { type: 'remove'; key: string } | { type: 'setDiscount'; discount: number } | { type: 'replace'; cart: Cart } | { type: 'clear' }`
  - `cartReducer(cart: Cart, a: CartAction): Cart`
  - `newLineKey(): string`
  - `lineFromProduct(p: Product, u: ProductUnit | null, qty?: number): NewCartLine`
  - `customLine(name: string, price: number, qty: number): NewCartLine`
  - `stockShortages(lines: CartLine[]): Map<number, number>` (productId → tồn hiện có, chỉ các sản phẩm thiếu)
  - `toOrderItems(lines: CartLine[]): OrderInputBody['items']`
  - `parseStoredCart(raw: string | null): Cart`, `parseHeldCarts(raw: string | null): HeldCart[]`

- [ ] **Step 1: Viết test**

`shared/src/cart.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  EMPTY_CART,
  cartReducer,
  customLine,
  lineFromProduct,
  newLineKey,
  parseHeldCarts,
  parseStoredCart,
  stockShortages,
  toOrderItems,
  type Cart,
} from './cart.js';
import type { Product, ProductUnit } from './types.js';

const product = (o: Partial<Product> = {}): Product => ({
  id: 1,
  barcode: '893',
  name: 'Bia Tiger',
  unit: 'lon',
  costPrice: 10000,
  sellPrice: 12000,
  stock: 30,
  isWeighed: false,
  categoryId: null,
  minStock: 0,
  isActive: true,
  createdAt: '',
  updatedAt: '',
  categoryName: null,
  ...o,
});
const crate: ProductUnit = { id: 7, productId: 1, name: 'Thùng', barcode: '894', factor: 24, sellPrice: 280000 };
const add = (cart: Cart, line = lineFromProduct(product(), null)) => cartReducer(cart, { type: 'add', line });

describe('cartReducer', () => {
  it('thêm cùng sản phẩm + cùng đơn vị → cộng số lượng; khác đơn vị → dòng mới', () => {
    let c = add(EMPTY_CART);
    c = add(c);
    c = add(c, lineFromProduct(product(), crate));
    expect(c.lines.map((l) => [l.unitName, l.qty, l.price, l.factor])).toEqual([
      ['lon', 2, 12000, 1],
      ['Thùng', 1, 280000, 24],
    ]);
  });
  it('hàng cân và món ngoài luôn là dòng mới', () => {
    const rice = lineFromProduct(product({ id: 2, name: 'Gạo', unit: 'kg', isWeighed: true }), null, 1.5);
    let c = add(add(EMPTY_CART, rice), rice);
    c = add(add(c, customLine('', 5000, 1)), customLine('', 5000, 1));
    expect(c.lines).toHaveLength(4);
    expect(c.lines[2]).toMatchObject({ productId: null, name: 'Hàng khác', unitName: 'cái' });
  });
  it('update qty ≤ 0 xóa dòng; update giá; setDiscount làm tròn, không âm', () => {
    let c = add(EMPTY_CART);
    const key = c.lines[0]!.key;
    c = cartReducer(c, { type: 'update', key, patch: { price: 11000 } });
    expect(c.lines[0]!.price).toBe(11000);
    c = cartReducer(c, { type: 'setDiscount', discount: -5 });
    expect(c.discount).toBe(0);
    c = cartReducer(c, { type: 'update', key, patch: { qty: 0 } });
    expect(c.lines).toEqual([]);
  });
  it('clear và replace', () => {
    const c = add(EMPTY_CART);
    expect(cartReducer(c, { type: 'clear' })).toEqual(EMPTY_CART);
    expect(cartReducer(EMPTY_CART, { type: 'replace', cart: c })).toBe(c);
  });
});

describe('newLineKey', () => {
  it('duy nhất khi gọi liên tục (không dùng crypto.randomUUID)', () => {
    const keys = new Set(Array.from({ length: 1000 }, newLineKey));
    expect(keys.size).toBe(1000);
  });
});

describe('stockShortages', () => {
  it('cộng dồn lẻ + thùng theo đơn vị gốc rồi so với tồn', () => {
    let c = add(EMPTY_CART, lineFromProduct(product({ stock: 30 }), crate));
    expect(stockShortages(c.lines).size).toBe(0);
    c = add(c, lineFromProduct(product({ stock: 30 }), null, 7));
    expect([...stockShortages(c.lines)]).toEqual([[1, 30]]);
  });
});

describe('toOrderItems', () => {
  it('hàng trong kho gửi productId/unitId, món ngoài gửi tên', () => {
    let c = add(EMPTY_CART, lineFromProduct(product(), crate));
    c = add(c, customLine('Đá', 3000, 2));
    expect(toOrderItems(c.lines)).toEqual([
      { productId: 1, unitId: 7, qty: 1, price: 280000 },
      { productId: null, name: 'Đá', qty: 2, price: 3000 },
    ]);
  });
});

describe('parseStoredCart / parseHeldCarts', () => {
  it('dữ liệu rác hoặc thiếu trường → giỏ trống / danh sách rỗng', () => {
    expect(parseStoredCart(null)).toEqual(EMPTY_CART);
    expect(parseStoredCart('{không phải json')).toEqual(EMPTY_CART);
    expect(parseStoredCart('{"lines":[{"name":"x"}],"discount":0}')).toEqual(EMPTY_CART);
    expect(parseHeldCarts('[1,2]')).toEqual([]);
  });
  it('đọc lại đúng giỏ đã lưu', () => {
    const c = add(EMPTY_CART);
    expect(parseStoredCart(JSON.stringify(c))).toEqual(c);
    const held = [{ id: 'a', at: '2026-09-29T03:00:00.000Z', cart: c }];
    expect(parseHeldCarts(JSON.stringify(held))).toEqual(held);
  });
});
```

- [ ] **Step 2: Chạy test, thấy FAIL**

Run: `npm test -w shared`
Expected: FAIL, không tìm thấy `./cart.js`.

- [ ] **Step 3: Viết code**

`shared/src/cart.ts`:

```ts
import { z } from 'zod';
import type { OrderInputBody } from './schemas/order.js';
import type { Product, ProductUnit } from './types.js';

const lineSchema = z.object({
  key: z.string(),
  productId: z.number().int().nullable(),
  unitId: z.number().int().nullable(),
  name: z.string(),
  unitName: z.string(),
  factor: z.number().positive(),
  isWeighed: z.boolean(),
  stock: z.number(),
  qty: z.number().positive(),
  price: z.number().int().min(0),
});
const cartSchema = z.object({ lines: z.array(lineSchema), discount: z.number().int().min(0) });
const heldSchema = z.array(z.object({ id: z.string(), at: z.string(), cart: cartSchema }));

export type CartLine = z.infer<typeof lineSchema>;
export type NewCartLine = Omit<CartLine, 'key'>;
export type Cart = z.infer<typeof cartSchema>;
export type HeldCart = z.infer<typeof heldSchema>[number];

export const EMPTY_CART: Cart = { lines: [], discount: 0 };
export const MAX_HELD_CARTS = 5;
export const CUSTOM_ITEM_NAME = 'Hàng khác';

export type CartAction =
  | { type: 'add'; line: NewCartLine }
  | { type: 'update'; key: string; patch: Partial<Pick<CartLine, 'qty' | 'price'>> }
  | { type: 'remove'; key: string }
  | { type: 'setDiscount'; discount: number }
  | { type: 'replace'; cart: Cart }
  | { type: 'clear' };

let seq = 0;
/** Khóa dòng giỏ. Không dùng crypto.randomUUID: trang mở qua http://IP-LAN không phải secure context. */
export function newLineKey(): string {
  seq = (seq + 1) % 1_000_000;
  return `${Date.now().toString(36)}-${seq.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function cartReducer(cart: Cart, a: CartAction): Cart {
  switch (a.type) {
    case 'add': {
      const l = a.line;
      // Hàng cân (mỗi túi một dòng) và món ngoài không gộp
      const same =
        l.productId !== null && !l.isWeighed
          ? cart.lines.find((x) => x.productId === l.productId && x.unitId === l.unitId)
          : undefined;
      if (same) return { ...cart, lines: cart.lines.map((x) => (x === same ? { ...x, qty: x.qty + l.qty } : x)) };
      return { ...cart, lines: [...cart.lines, { ...l, key: newLineKey() }] };
    }
    case 'update':
      if (a.patch.qty !== undefined && a.patch.qty <= 0) return cartReducer(cart, { type: 'remove', key: a.key });
      return { ...cart, lines: cart.lines.map((x) => (x.key === a.key ? { ...x, ...a.patch } : x)) };
    case 'remove':
      return { ...cart, lines: cart.lines.filter((x) => x.key !== a.key) };
    case 'setDiscount':
      return { ...cart, discount: Math.max(0, Math.round(a.discount)) };
    case 'replace':
      return a.cart;
    case 'clear':
      return EMPTY_CART;
  }
}

/** Dòng giỏ từ kết quả quét/tìm; có đơn vị quy đổi thì dùng tên, hệ số, giá của đơn vị. */
export function lineFromProduct(p: Product, u: ProductUnit | null, qty = 1): NewCartLine {
  return {
    productId: p.id,
    unitId: u?.id ?? null,
    name: p.name,
    unitName: u?.name ?? p.unit,
    factor: u?.factor ?? 1,
    isWeighed: p.isWeighed && !u,
    stock: p.stock,
    qty,
    price: u?.sellPrice ?? p.sellPrice,
  };
}

/** Món ngoài (không có mã): không trừ kho. */
export function customLine(name: string, price: number, qty: number): NewCartLine {
  const n = name.trim() || CUSTOM_ITEM_NAME;
  return { productId: null, unitId: null, name: n, unitName: 'cái', factor: 1, isWeighed: false, stock: 0, qty, price };
}

/** Sản phẩm mà tổng qty×factor trong giỏ vượt tồn: productId → tồn hiện có. */
export function stockShortages(lines: CartLine[]): Map<number, number> {
  const need = new Map<number, { need: number; stock: number }>();
  for (const l of lines) {
    if (l.productId === null) continue;
    const e = need.get(l.productId) ?? { need: 0, stock: l.stock };
    e.need += l.qty * l.factor;
    need.set(l.productId, e);
  }
  const out = new Map<number, number>();
  for (const [id, e] of need) if (e.need > e.stock + 1e-9) out.set(id, e.stock);
  return out;
}

export function toOrderItems(lines: CartLine[]): OrderInputBody['items'] {
  return lines.map((l) =>
    l.productId === null
      ? { productId: null, name: l.name, qty: l.qty, price: l.price }
      : { productId: l.productId, unitId: l.unitId, qty: l.qty, price: l.price },
  );
}

function parseJson(raw: string | null): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** Đọc giỏ từ localStorage; hỏng hoặc sai cấu trúc thì trả giỏ trống. */
export function parseStoredCart(raw: string | null): Cart {
  const r = cartSchema.safeParse(parseJson(raw));
  return r.success ? r.data : EMPTY_CART;
}

export function parseHeldCarts(raw: string | null): HeldCart[] {
  const r = heldSchema.safeParse(parseJson(raw));
  return r.success ? r.data.slice(0, MAX_HELD_CARTS) : [];
}
```

Trong `shared/src/index.ts`, thêm sau dòng `export * from './banks.js';`:

```ts
export * from './cart.js';
```

- [ ] **Step 4: Chạy test, thấy PASS**

Run: `npm test -w shared`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/src/cart.ts shared/src/cart.test.ts shared/src/index.ts
git commit -m "feat(shared): logic giỏ hàng, cảnh báo tồn, đọc giỏ đã lưu"
```

---

### Task 5: Migration đơn hàng và lỗi 400 nghiệp vụ (server)

**Files:**
- Modify: `server/src/db/schema.ts` (bảng `orders`, `orderItems`)
- Create: `server/drizzle/0001_*.sql` (drizzle-kit sinh), `server/drizzle/meta/*` (drizzle-kit cập nhật)
- Modify: `server/src/errors.ts` (thêm `BadRequestError`), `server/src/middleware/error.ts` (nhãn theo trường cuối)
- Test: `server/src/db/connection.test.ts` (thêm 1 test)

**Interfaces:**
- Produces: cột `order_items.product_id` nullable, `order_items.factor real not null default 1`, `order_items.amount integer not null default 0`, `orders.cancelled_at text`; `class BadRequestError extends HttpError` (status 400).

- [ ] **Step 1: Viết test**

Đọc `server/src/db/connection.test.ts` để giữ đúng import hiện có, rồi thêm test này vào cuối khối `describe` (nếu file chưa import `sql` thì thêm `import { sql } from 'drizzle-orm';`):

```ts
  it('order_items cho phép product_id null, có factor và amount; orders có cancelled_at', () => {
    const db = createTestDb();
    const cols = (t: string) => db.all<{ name: string; notnull: number }>(sql.raw(`PRAGMA table_info(${t})`));
    const items = cols('order_items');
    expect(items.find((c) => c.name === 'product_id')?.notnull).toBe(0);
    expect(items.map((c) => c.name)).toEqual(expect.arrayContaining(['factor', 'amount']));
    expect(cols('orders').map((c) => c.name)).toContain('cancelled_at');
  });
```

- [ ] **Step 2: Chạy test, thấy FAIL**

Run: `npm test -w server -- src/db/connection.test.ts`
Expected: FAIL, `product_id` có `notnull = 1`.

- [ ] **Step 3: Sửa schema và sinh migration**

Trong `server/src/db/schema.ts`, bảng `orders`: thêm dòng sau ngay dưới dòng `createdAt: createdAt(),`:

```ts
    cancelledAt: text('cancelled_at'),
```

Bảng `orderItems`: thay 3 dòng

```ts
    productId: integer('product_id')
      .notNull()
      .references(() => products.id),
```

bằng

```ts
    productId: integer('product_id').references(() => products.id), // null = món ngoài
```

và thêm 2 dòng ngay dưới dòng `costPrice: integer('cost_price').notNull(),` của `orderItems`:

```ts
    factor: real('factor').notNull().default(1), // hệ số đơn vị lúc bán, dùng khi hủy đơn
    amount: integer('amount').notNull().default(0), // thành tiền dòng lúc bán
```

Sinh migration:

Run: `npm run db:generate`
Expected: tạo `server/drizzle/0001_<tên>.sql` có `ALTER TABLE \`orders\` ADD \`cancelled_at\` text;` và đoạn dựng lại bảng `__new_order_items` (`INSERT INTO \`__new_order_items\` … SELECT … FROM \`order_items\``). Mở file kiểm tra; nếu drizzle-kit hỏi tương tác (rename) thì chọn "create column".

- [ ] **Step 4: Thêm `BadRequestError` và nhãn lỗi cho trường lồng**

Thêm vào cuối `server/src/errors.ts`:

```ts

export class BadRequestError extends HttpError {
  constructor(message: string) {
    super(400, message);
  }
}
```

Trong `server/src/middleware/error.ts`, hàm `formatZodError`, thay dòng

```ts
      const label = FIELD_LABELS[field] ?? field;
```

bằng

```ts
      // "items.0.qty" không có nhãn riêng → dùng nhãn của trường cuối ("Số lượng")
      const label = FIELD_LABELS[field] ?? FIELD_LABELS[String(i.path.at(-1) ?? '')] ?? field;
```

- [ ] **Step 5: Chạy test, thấy PASS**

Run: `npm test -w server`
Expected: PASS toàn bộ (test cũ của seed/products vẫn qua).

- [ ] **Step 6: Commit**

```bash
git add server/src/db/schema.ts server/drizzle server/src/errors.ts server/src/middleware/error.ts server/src/db/connection.test.ts
git commit -m "feat(server): migration đơn hàng (món ngoài, hệ số, thành tiền, giờ hủy)"
```

---

### Task 6: Service đơn hàng (server)

**Files:**
- Create: `server/src/services/orders.ts`, `server/src/services/orders.test.ts`

**Interfaces:**
- Consumes: `recordMovement` (`server/src/services/stock.ts`), `cartTotals`, `lineAmount`, `localDate`, `localDayRange`, `currentTzOffset`, `OrderInput`, `OrderDetail`, `OrderList`, `OrderSummary` (shared), `BadRequestError`, `ConflictError`, `NotFoundError`.
- Produces:
  - `interface Clock { now?: Date; tzOffsetMin?: number }`
  - `createOrder(db: Db, input: OrderInput, clock?: Clock): OrderDetail`
  - `getOrder(db: DbOrTx, id: number): OrderDetail`
  - `listOrders(db: Db, date: string, clock?: Clock): OrderList`
  - `cancelOrder(db: Db, id: number, clock?: Clock): OrderDetail`

- [ ] **Step 1: Viết test**

`server/src/services/orders.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { orderInputSchema, productInputSchema, productUnitInputSchema } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { stockMovements } from '../db/schema.js';
import { createTestDb } from '../db/test-db.js';
import { cancelOrder, createOrder, getOrder, listOrders } from './orders.js';
import { createUnit, deleteUnit } from './product-units.js';
import { createProduct, getProduct, setProductActive, updateProduct } from './products.js';

const VN = 420;
const at = (iso: string) => ({ now: new Date(iso), tzOffsetMin: VN });
const MORNING = at('2026-09-29T03:00:00.000Z'); // 10:00 ngày 29/9 giờ VN
const order = (o: Record<string, unknown>) =>
  orderInputSchema.parse({ paymentMethod: 'cash', paid: 10_000_000, ...o });

let db: Db;
beforeEach(() => {
  db = createTestDb();
});
const product = (o: Record<string, unknown>) => createProduct(db, productInputSchema.parse(o));
const crateOf = (productId: number) =>
  createUnit(db, productId, productUnitInputSchema.parse({ name: 'Thùng', factor: 24, sellPrice: 280000 }));
const movements = (type: 'sale' | 'return') =>
  db
    .select()
    .from(stockMovements)
    .where(eq(stockMovements.type, type))
    .all()
    .map((m) => [m.productId, m.qty, m.refId]);

describe('createOrder', () => {
  it('bán lẻ và theo thùng: trừ qty×factor, snapshot giá vốn theo thùng', () => {
    const p = product({ name: 'Bia', unit: 'lon', sellPrice: 12000, costPrice: 10000, stock: 30 });
    const crate = crateOf(p.id);
    const o = createOrder(
      db,
      order({
        items: [
          { productId: p.id, qty: 2, price: 12000 },
          { productId: p.id, unitId: crate.id, qty: 1, price: 280000 },
        ],
      }),
      MORNING,
    );
    expect(o).toMatchObject({ code: 'HD-20260929-0001', total: 304000, payable: 304000, status: 'done', itemCount: 2 });
    expect(o.createdAt).toBe('2026-09-29T03:00:00.000Z');
    expect(o.items).toMatchObject([
      { productName: 'Bia', unit: 'lon', qty: 2, factor: 1, costPrice: 10000, amount: 24000 },
      { productName: 'Bia', unit: 'Thùng', qty: 1, factor: 24, costPrice: 240000, amount: 280000 },
    ]);
    expect(getProduct(db, p.id).stock).toBe(4);
    expect(movements('sale')).toEqual([
      [p.id, -2, o.id],
      [p.id, -24, o.id],
    ]);
  });

  it('cho bán khi tồn không đủ (tồn âm)', () => {
    const p = product({ name: 'Mì', stock: 1 });
    createOrder(db, order({ items: [{ productId: p.id, qty: 3, price: 4000 }] }), MORNING);
    expect(getProduct(db, p.id).stock).toBe(-2);
  });

  it('hàng cân: thành tiền làm tròn 500đ, trừ kho số lẻ', () => {
    const p = product({ name: 'Thịt', unit: 'kg', sellPrice: 57000, isWeighed: true, stock: 5 });
    const o = createOrder(db, order({ items: [{ productId: p.id, qty: 0.35, price: 57000 }] }), MORNING);
    expect(o.items[0]).toMatchObject({ qty: 0.35, amount: 20000 });
    expect(o.total).toBe(20000);
    expect(getProduct(db, p.id).stock).toBeCloseTo(4.65);
  });

  it('món ngoài: tên mặc định "Hàng khác", không sinh movement', () => {
    const o = createOrder(db, order({ items: [{ name: '', qty: 2, price: 5000 }] }), MORNING);
    expect(o.items).toMatchObject([{ productId: null, productName: 'Hàng khác', unit: 'cái', costPrice: 0, amount: 10000 }]);
    expect(db.select().from(stockMovements).all()).toEqual([]);
  });

  it('snapshot giữ nguyên sau khi sửa sản phẩm', () => {
    const p = product({ name: 'Sữa', sellPrice: 15000, costPrice: 12000 });
    const o = createOrder(db, order({ items: [{ productId: p.id, qty: 1, price: 15000 }] }), MORNING);
    updateProduct(db, p.id, productInputSchema.parse({ name: 'Sữa mới', sellPrice: 16000, costPrice: 13000 }));
    expect(getOrder(db, o.id).items[0]).toMatchObject({ productName: 'Sữa', price: 15000, costPrice: 12000 });
  });

  it('mã tăng dần trong ngày, sang ngày VN mới về 0001 (kể cả khi UTC vẫn là hôm trước)', () => {
    const item = { items: [{ qty: 1, price: 1000 }] };
    expect(createOrder(db, order(item), MORNING).code).toBe('HD-20260929-0001');
    expect(createOrder(db, order(item), at('2026-09-29T10:00:00.000Z')).code).toBe('HD-20260929-0002');
    expect(createOrder(db, order(item), at('2026-09-29T17:30:00.000Z')).code).toBe('HD-20260930-0001');
  });

  it('chuyển khoản: paid luôn bằng số phải trả', () => {
    const o = createOrder(
      db,
      order({ items: [{ qty: 1, price: 50000 }], discount: 5000, paymentMethod: 'transfer', paid: 0 }),
      MORNING,
    );
    expect(o).toMatchObject({ total: 50000, discount: 5000, payable: 45000, paid: 45000, paymentMethod: 'transfer' });
  });

  it('400: giảm giá vượt tổng, tiền mặt không đủ, sản phẩm ngừng bán, đơn vị không thuộc sản phẩm', () => {
    const a = product({ name: 'A', barcode: '1' });
    const b = product({ name: 'B', barcode: '2' });
    const crateB = crateOf(b.id);
    expect(() => createOrder(db, order({ items: [{ qty: 1, price: 1000 }], discount: 2000 }))).toThrow(
      'Giảm giá lớn hơn tổng tiền',
    );
    expect(() => createOrder(db, order({ items: [{ qty: 1, price: 1000 }], paid: 500 }))).toThrow(
      'Tiền khách đưa chưa đủ',
    );
    expect(() => createOrder(db, order({ items: [{ productId: a.id, unitId: crateB.id, qty: 1, price: 1 }] }))).toThrow(
      'Đơn vị của "A" không hợp lệ',
    );
    setProductActive(db, a.id, false);
    expect(() => createOrder(db, order({ items: [{ productId: a.id, qty: 1, price: 1 }] }))).toThrow(
      'Sản phẩm "A" không còn bán',
    );
    expect(() => createOrder(db, order({ items: [{ productId: 999, qty: 1, price: 1 }] }))).toThrow(
      'Sản phẩm #999 không còn bán',
    );
  });
});

describe('cancelOrder', () => {
  it('trả kho bằng movement return theo factor lúc bán, kể cả khi đơn vị đã bị xóa; hủy lần hai 409', () => {
    const p = product({ name: 'Bia', stock: 48 });
    const crate = crateOf(p.id);
    const o = createOrder(
      db,
      order({ items: [{ productId: p.id, unitId: crate.id, qty: 1, price: 280000 }, { qty: 1, price: 3000 }] }),
      MORNING,
    );
    deleteUnit(db, p.id, crate.id);
    const c = cancelOrder(db, o.id, at('2026-09-29T04:00:00.000Z'));
    expect(c).toMatchObject({ status: 'cancelled', cancelledAt: '2026-09-29T04:00:00.000Z' });
    expect(getProduct(db, p.id).stock).toBe(48);
    expect(movements('return')).toEqual([[p.id, 24, o.id]]);
    expect(() => cancelOrder(db, o.id)).toThrow('Hóa đơn đã hủy');
  });

  it('không có hóa đơn → 404', () => {
    expect(() => cancelOrder(db, 42)).toThrow('Không tìm thấy hóa đơn');
  });
});

describe('listOrders', () => {
  it('lọc theo ngày VN, mới nhất trước; tóm tắt bỏ đơn hủy, tách tiền mặt / chuyển khoản', () => {
    const item = { items: [{ qty: 1, price: 10000 }] };
    createOrder(db, order(item), at('2026-09-28T16:59:59.000Z')); // 23:59 ngày 28 VN
    const a = createOrder(db, order(item), at('2026-09-28T17:00:00.000Z')); // 00:00 ngày 29 VN
    const b = createOrder(db, order({ ...item, paymentMethod: 'transfer' }), MORNING);
    const c = createOrder(db, order(item), MORNING);
    cancelOrder(db, c.id);
    const r = listOrders(db, '2026-09-29', { tzOffsetMin: VN });
    expect(r.orders.map((o) => o.id)).toEqual([c.id, b.id, a.id]);
    expect(r.orders[0]).toMatchObject({ status: 'cancelled', itemCount: 1 });
    expect(r.summary).toEqual({ count: 2, total: 20000, cash: 10000, transfer: 10000 });
  });
});
```

- [ ] **Step 2: Chạy test, thấy FAIL**

Run: `npm test -w server -- src/services/orders.test.ts`
Expected: FAIL, không tìm thấy `./orders.js`.

- [ ] **Step 3: Viết code**

`server/src/services/orders.ts`:

```ts
import { and, asc, desc, eq, gte, like, lt, sql } from 'drizzle-orm';
import {
  cartTotals,
  currentTzOffset,
  lineAmount,
  localDate,
  localDayRange,
  type OrderDetail,
  type OrderInput,
  type OrderList,
  type OrderSummary,
} from '@tiny-pos/shared';
import type { Db, DbOrTx } from '../db/connection.js';
import { orderItems, orders, productUnits, products } from '../db/schema.js';
import { BadRequestError, ConflictError, NotFoundError } from '../errors.js';
import { recordMovement } from './stock.js';

/** Giờ hiện tại và múi giờ; test truyền vào để không phụ thuộc máy chạy. */
export interface Clock {
  now?: Date;
  tzOffsetMin?: number;
}

function resolveClock(c: Clock = {}) {
  const now = c.now ?? new Date();
  return { now, tz: c.tzOffsetMin ?? currentTzOffset(now) };
}

const CUSTOM_NAME = 'Hàng khác';

interface ResolvedLine {
  productId: number | null;
  productName: string;
  unit: string;
  qty: number;
  price: number;
  costPrice: number;
  factor: number;
  isWeighed: boolean;
}

/** Đọc sản phẩm/đơn vị trong DB để lấy snapshot tên, đơn vị, giá vốn, hệ số. */
function resolveLine(tx: DbOrTx, it: OrderInput['items'][number]): ResolvedLine {
  if (it.productId === null) {
    const name = it.name || CUSTOM_NAME;
    return { productId: null, productName: name, unit: 'cái', qty: it.qty, price: it.price, costPrice: 0, factor: 1, isWeighed: false };
  }
  const p = tx.select().from(products).where(eq(products.id, it.productId)).get();
  if (!p || !p.isActive) throw new BadRequestError(`Sản phẩm ${p ? `"${p.name}"` : `#${it.productId}`} không còn bán`);
  let factor = 1;
  let unit = p.unit;
  if (it.unitId !== null) {
    const u = tx
      .select()
      .from(productUnits)
      .where(and(eq(productUnits.id, it.unitId), eq(productUnits.productId, p.id)))
      .get();
    if (!u) throw new BadRequestError(`Đơn vị của "${p.name}" không hợp lệ`);
    factor = u.factor;
    unit = u.name;
  }
  return {
    productId: p.id,
    productName: p.name,
    unit,
    qty: it.qty,
    price: it.price,
    costPrice: Math.round(p.costPrice * factor),
    factor,
    isWeighed: p.isWeighed && it.unitId === null,
  };
}

/** HD-YYYYMMDD-NNNN: số lớn nhất trong ngày + 1 (đọc trong cùng transaction). */
function nextCode(tx: DbOrTx, day: string): string {
  const prefix = `HD-${day.replaceAll('-', '')}-`;
  const last = tx
    .select({ code: orders.code })
    .from(orders)
    .where(like(orders.code, `${prefix}%`))
    .orderBy(desc(orders.code))
    .limit(1)
    .get();
  const seq = last ? Number(last.code.slice(prefix.length)) + 1 : 1;
  return prefix + String(seq).padStart(4, '0');
}

type OrderRow = typeof orders.$inferSelect;

function toSummary(o: OrderRow, itemCount: number): OrderSummary {
  return {
    id: o.id,
    code: o.code,
    total: o.total,
    discount: o.discount,
    payable: o.total - o.discount,
    paid: o.paid,
    paymentMethod: o.paymentMethod,
    status: o.status,
    itemCount,
    createdAt: o.createdAt,
    cancelledAt: o.cancelledAt,
  };
}

export function getOrder(db: DbOrTx, id: number): OrderDetail {
  const o = db.select().from(orders).where(eq(orders.id, id)).get();
  if (!o) throw new NotFoundError('Không tìm thấy hóa đơn');
  const items = db
    .select({
      id: orderItems.id,
      productId: orderItems.productId,
      productName: orderItems.productName,
      unit: orderItems.unit,
      qty: orderItems.qty,
      price: orderItems.price,
      costPrice: orderItems.costPrice,
      factor: orderItems.factor,
      amount: orderItems.amount,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, id))
    .orderBy(asc(orderItems.id))
    .all();
  return { ...toSummary(o, items.length), items };
}

export function createOrder(db: Db, input: OrderInput, clock?: Clock): OrderDetail {
  const { now, tz } = resolveClock(clock);
  return db.transaction((tx) => {
    const lines = input.items.map((it) => resolveLine(tx, it));
    const { total, payable } = cartTotals(lines, input.discount);
    if (input.discount > total) throw new BadRequestError('Giảm giá lớn hơn tổng tiền');
    if (input.paymentMethod === 'cash' && input.paid < payable) throw new BadRequestError('Tiền khách đưa chưa đủ');
    const paid = input.paymentMethod === 'cash' ? input.paid : payable;
    const { id } = tx
      .insert(orders)
      .values({
        code: nextCode(tx, localDate(now, tz)),
        total,
        discount: input.discount,
        paid,
        paymentMethod: input.paymentMethod,
        createdAt: now.toISOString(),
      })
      .returning({ id: orders.id })
      .get();
    for (const l of lines) {
      const { isWeighed: _w, ...snapshot } = l;
      tx.insert(orderItems)
        .values({ ...snapshot, orderId: id, amount: lineAmount(l) })
        .run();
      // Không kiểm tra tồn: cho bán âm, số kho sửa khi kiểm kê
      if (l.productId !== null) recordMovement(tx, { productId: l.productId, qty: -l.qty * l.factor, type: 'sale', refId: id });
    }
    return getOrder(tx, id);
  });
}

const itemCount = sql<number>`(select count(*) from ${orderItems} where ${orderItems.orderId} = ${orders.id})`;

export function listOrders(db: Db, date: string, clock?: Clock): OrderList {
  const { tz } = resolveClock(clock);
  const { start, end } = localDayRange(date, tz);
  const list = db
    .select({ order: orders, itemCount })
    .from(orders)
    .where(and(gte(orders.createdAt, start), lt(orders.createdAt, end)))
    .orderBy(desc(orders.id))
    .all()
    .map((r) => toSummary(r.order, Number(r.itemCount)));
  const done = list.filter((o) => o.status === 'done');
  const sum = (rows: OrderSummary[]) => rows.reduce((s, o) => s + o.payable, 0);
  return {
    orders: list,
    summary: {
      count: done.length,
      total: sum(done),
      cash: sum(done.filter((o) => o.paymentMethod === 'cash')),
      transfer: sum(done.filter((o) => o.paymentMethod === 'transfer')),
    },
  };
}

/** Hủy đơn: cộng trả kho đúng qty×factor lúc bán rồi đánh dấu cancelled. */
export function cancelOrder(db: Db, id: number, clock?: Clock): OrderDetail {
  const { now } = resolveClock(clock);
  return db.transaction((tx) => {
    const o = getOrder(tx, id);
    if (o.status === 'cancelled') throw new ConflictError('Hóa đơn đã hủy');
    for (const it of o.items) {
      if (it.productId === null) continue;
      recordMovement(tx, { productId: it.productId, qty: it.qty * it.factor, type: 'return', refId: id, note: 'Hủy hóa đơn' });
    }
    tx.update(orders).set({ status: 'cancelled', cancelledAt: now.toISOString() }).where(eq(orders.id, id)).run();
    return getOrder(tx, id);
  });
}
```

- [ ] **Step 4: Chạy test, thấy PASS**

Run: `npm test -w server -- src/services/orders.test.ts`
Expected: PASS. Nếu TypeScript báo `_w` không dùng, giữ nguyên (tiền tố `_` là quy ước bỏ qua) hoặc đổi sang ghi rõ từng trường vào `values`.

- [ ] **Step 5: Typecheck và commit**

Run: `npm run typecheck`
Expected: không lỗi.

```bash
git add server/src/services/orders.ts server/src/services/orders.test.ts
git commit -m "feat(server): service đơn hàng – tạo, xem, danh sách theo ngày, hủy trả kho"
```

---

### Task 7: Service cài đặt và API đơn hàng / cài đặt (server)

**Files:**
- Create: `server/src/services/settings.ts`, `server/src/services/settings.test.ts`
- Create: `server/src/routes/orders.ts`, `server/src/routes/settings.ts`, `server/src/routes/orders-api.test.ts`
- Modify: `server/src/routes/index.ts` (2 import + 2 dòng `r.use`)

**Interfaces:**
- Consumes: service Task 6; `orderInputSchema`, `orderListQuerySchema`, `settingsInputSchema`, `SETTINGS_DEFAULTS`, `Settings`, `localDate`, `currentTzOffset` (shared).
- Produces:
  - `getSettings(db: DbOrTx): Settings`, `saveSettings(db: Db, input: Settings): Settings`
  - `GET /api/orders?date=`, `GET /api/orders/:id`, `POST /api/orders` (201), `POST /api/orders/:id/cancel`, `GET /api/settings`, `PUT /api/settings`

- [ ] **Step 1: Viết test**

`server/src/services/settings.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SETTINGS_DEFAULTS, settingsInputSchema } from '@tiny-pos/shared';
import { settings } from '../db/schema.js';
import { createTestDb } from '../db/test-db.js';
import { getSettings, saveSettings } from './settings.js';

describe('settings', () => {
  it('chưa lưu gì → mặc định', () => {
    expect(getSettings(createTestDb())).toEqual(SETTINGS_DEFAULTS);
  });
  it('lưu rồi đọc lại; autoPrint lưu "0"/"1"; lưu lần hai ghi đè', () => {
    const db = createTestDb();
    const input = settingsInputSchema.parse({ storeName: 'Tạp hóa Cô Ba', bankBin: '970436', bankAccount: '0123', bankAccountName: 'lê thị ba', autoPrint: false });
    expect(saveSettings(db, input)).toMatchObject({ storeName: 'Tạp hóa Cô Ba', bankAccountName: 'LE THI BA', autoPrint: false });
    expect(db.select().from(settings).all()).toContainEqual({ key: 'autoPrint', value: '0' });
    saveSettings(db, { ...input, autoPrint: true });
    expect(getSettings(db).autoPrint).toBe(true);
  });
});
```

`server/src/routes/orders-api.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { createTestDb } from '../db/test-db.js';
import { createApp } from '../app.js';

let server: Server;
let base: string;
beforeAll(async () => {
  server = createApp(createTestDb()).listen(0);
  await new Promise((r) => server.once('listening', r));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});
afterAll(() => server.close());

const call = async (method: string, path: string, body?: unknown) => {
  const res = await fetch(base + path, {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : {},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
};

describe('API đơn hàng và cài đặt', () => {
  it('bán, xem trong ngày, xem chi tiết, hủy, hủy lần hai 409', async () => {
    const p = await call('POST', '/api/products', { name: 'Nước suối', sellPrice: 5000, stock: 10 });
    const created = await call('POST', '/api/orders', {
      items: [{ productId: p.json.id, qty: 2, price: 5000 }, { name: 'Đá', qty: 1, price: 2000 }],
      paymentMethod: 'cash',
      paid: 20000,
    });
    expect(created.status).toBe(201);
    expect(created.json).toMatchObject({ total: 12000, paid: 20000, itemCount: 2 });
    expect(created.json.code).toMatch(/^HD-\d{8}-0001$/);

    const today = await call('GET', '/api/orders');
    expect(today.json.orders.map((o: { id: number }) => o.id)).toEqual([created.json.id]);
    expect(today.json.summary).toEqual({ count: 1, total: 12000, cash: 12000, transfer: 0 });

    expect((await call('GET', `/api/orders/${created.json.id}`)).json.items).toHaveLength(2);
    expect((await call('GET', `/api/products/${p.json.id}`)).json.stock).toBe(8);

    const cancelled = await call('POST', `/api/orders/${created.json.id}/cancel`);
    expect(cancelled.json.status).toBe('cancelled');
    expect((await call('GET', `/api/products/${p.json.id}`)).json.stock).toBe(10);
    expect(await call('POST', `/api/orders/${created.json.id}/cancel`)).toEqual({ status: 409, json: { error: 'Hóa đơn đã hủy' } });
  });

  it('400 có nhãn tiếng Việt: giỏ rỗng, số lượng sai, ngày sai; 404 hóa đơn lạ', async () => {
    const empty = await call('POST', '/api/orders', { items: [], paymentMethod: 'cash' });
    expect(empty.status).toBe(400);
    expect(empty.json.error).toContain('Giỏ hàng');
    const badQty = await call('POST', '/api/orders', { items: [{ qty: -1, price: 1 }], paymentMethod: 'cash' });
    expect(badQty.json.error).toContain('Số lượng');
    expect((await call('GET', '/api/orders?date=29-09-2026')).status).toBe(400);
    expect((await call('GET', '/api/orders/9999')).status).toBe(404);
  });

  it('cài đặt: GET mặc định, PUT rồi GET', async () => {
    expect((await call('GET', '/api/settings')).json.storeName).toBe('Tạp hóa');
    const put = await call('PUT', '/api/settings', { storeName: 'Tạp hóa Út', bankAccountName: 'út em' });
    expect(put.json).toMatchObject({ storeName: 'Tạp hóa Út', bankAccountName: 'UT EM', autoPrint: true });
    expect((await call('GET', '/api/settings')).json.storeName).toBe('Tạp hóa Út');
    expect((await call('PUT', '/api/settings', { bankBin: '12' })).status).toBe(400);
  });
});
```

- [ ] **Step 2: Chạy test, thấy FAIL**

Run: `npm test -w server -- src/services/settings.test.ts src/routes/orders-api.test.ts`
Expected: FAIL, không tìm thấy `./settings.js`; API trả 404 cho `/api/orders`.

- [ ] **Step 3: Viết code**

`server/src/services/settings.ts`:

```ts
import { SETTINGS_DEFAULTS, settingsInputSchema, type Settings } from '@tiny-pos/shared';
import type { Db, DbOrTx } from '../db/connection.js';
import { settings } from '../db/schema.js';

/** Đọc bảng key/value; key chưa có nhận mặc định, key lạ bị bỏ qua. */
export function getSettings(db: DbOrTx): Settings {
  const raw: Record<string, unknown> = {};
  for (const row of db.select().from(settings).all()) raw[row.key] = row.value;
  if (typeof raw['autoPrint'] === 'string') raw['autoPrint'] = raw['autoPrint'] === '1';
  const r = settingsInputSchema.safeParse(raw);
  return r.success ? r.data : SETTINGS_DEFAULTS;
}

export function saveSettings(db: Db, input: Settings): Settings {
  db.transaction((tx) => {
    for (const [key, v] of Object.entries(input)) {
      const value = typeof v === 'boolean' ? (v ? '1' : '0') : String(v);
      tx.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } }).run();
    }
  });
  return getSettings(db);
}
```

`server/src/routes/orders.ts`:

```ts
import { Router } from 'express';
import { currentTzOffset, localDate, orderInputSchema, orderListQuerySchema, type OrderListQuery } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { intParam, validateBody, validateQuery } from '../middleware/validate.js';
import { cancelOrder, createOrder, getOrder, listOrders } from '../services/orders.js';

export function ordersRouter(db: Db): Router {
  const r = Router();
  r.get('/', validateQuery(orderListQuerySchema), (_req, res) => {
    const { date } = res.locals['query'] as OrderListQuery;
    res.json(listOrders(db, date ?? localDate(new Date(), currentTzOffset())));
  });
  r.get('/:id', (req, res) => res.json(getOrder(db, intParam(req, 'id'))));
  r.post('/', validateBody(orderInputSchema), (req, res) => res.status(201).json(createOrder(db, req.body)));
  r.post('/:id/cancel', (req, res) => res.json(cancelOrder(db, intParam(req, 'id'))));
  return r;
}
```

`server/src/routes/settings.ts`:

```ts
import { Router } from 'express';
import { settingsInputSchema } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { validateBody } from '../middleware/validate.js';
import { getSettings, saveSettings } from '../services/settings.js';

export function settingsRouter(db: Db): Router {
  const r = Router();
  r.get('/', (_req, res) => res.json(getSettings(db)));
  r.put('/', validateBody(settingsInputSchema), (req, res) => res.json(saveSettings(db, req.body)));
  return r;
}
```

Trong `server/src/routes/index.ts`, thêm 2 import sau dòng `import { productsRouter } from './products.js';`:

```ts
import { ordersRouter } from './orders.js';
import { settingsRouter } from './settings.js';
```

và 2 dòng sau `r.use('/products', productsRouter(db));`:

```ts
  r.use('/orders', ordersRouter(db));
  r.use('/settings', settingsRouter(db));
```

- [ ] **Step 4: Chạy test, thấy PASS**

Run: `npm test`
Expected: PASS toàn bộ shared + server.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/settings.ts server/src/services/settings.test.ts server/src/routes/orders.ts server/src/routes/settings.ts server/src/routes/orders-api.test.ts server/src/routes/index.ts
git commit -m "feat(server): API hóa đơn và cài đặt cửa hàng"
```

---

### Task 8: API client và in hóa đơn (client)

**Files:**
- Modify: `client/package.json` (qua `npm install`), `package-lock.json`
- Create: `client/src/api/orders.ts`, `client/src/api/settings.ts`, `client/src/lib/storage.ts`
- Create: `client/src/components/receipt/receipt-data.ts`, `client/src/components/receipt/Receipt.tsx`, `client/src/components/receipt/PrintProvider.tsx`
- Modify: `client/src/api/products.ts` (thêm `useProductSuggestions` cuối file), `client/index.html` (thêm `#print-root`), `client/src/index.css` (thêm khối in cuối file), `client/src/main.tsx` (bọc `PrintProvider`)

**Interfaces:**
- Consumes: types/schemas shared (Task 3, 4), `api` (`client/src/api/client.ts`).
- Produces:
  - `useOrders(date: string)`, `useOrder(id: number | null)`, `useCreateOrder()` (mutation nhận `OrderInputBody`, trả `OrderDetail`), `useCancelOrder()` (mutation nhận `id: number`)
  - `useSettings()`, `useSaveSettings()`
  - `useProductSuggestions(q: string)` → `Product[]`
  - `readStorage(key): string | null`, `writeStorage(key, value): void`
  - `interface ReceiptData`, `receiptFromOrder(o: OrderDetail)`, `draftReceipt(cart: Cart, qrPayload: string | null)`, `sampleReceipt()`
  - `PrintProvider`, `usePrint(): (data: ReceiptData) => Promise<void>`

- [ ] **Step 1: Cài thư viện QR**

Run: `npm install qrcode -w client` rồi `npm install -D @types/qrcode -w client`
Expected: `client/package.json` có `"qrcode"` trong `dependencies` và `"@types/qrcode"` trong `devDependencies`.

- [ ] **Step 2: API hooks và storage**

`client/src/api/orders.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OrderDetail, OrderInputBody, OrderList } from '@tiny-pos/shared';
import { api } from './client';

export const useOrders = (date: string) =>
  useQuery({ queryKey: ['orders', 'day', date], queryFn: () => api<OrderList>(`/orders?date=${date}`) });

export const useOrder = (id: number | null) =>
  useQuery({
    queryKey: ['orders', 'detail', id],
    queryFn: () => api<OrderDetail>(`/orders/${id}`),
    enabled: id !== null,
  });

/** Bán/hủy đổi tồn kho nên làm mới cả hóa đơn lẫn sản phẩm. */
function useInvalidateSales() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['orders'] });
    void qc.invalidateQueries({ queryKey: ['products'] });
  };
}

export function useCreateOrder() {
  const invalidate = useInvalidateSales();
  return useMutation({
    mutationFn: (input: OrderInputBody) => api<OrderDetail>('/orders', { json: input }),
    onSuccess: invalidate,
  });
}

export function useCancelOrder() {
  const invalidate = useInvalidateSales();
  return useMutation({
    mutationFn: (id: number) => api<OrderDetail>(`/orders/${id}/cancel`, { method: 'POST' }),
    onSuccess: invalidate,
  });
}
```

`client/src/api/settings.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Settings } from '@tiny-pos/shared';
import { api } from './client';

export const useSettings = () =>
  useQuery({ queryKey: ['settings'], queryFn: () => api<Settings>('/settings'), staleTime: 60_000 });

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: Settings) => api<Settings>('/settings', { method: 'PUT', json: s }),
    onSuccess: (s) => qc.setQueryData(['settings'], s),
  });
}
```

Thêm vào cuối `client/src/api/products.ts`:

```ts

/** Gợi ý ở màn Bán hàng: chỉ hàng đang bán, chỉ gọi khi có chữ để tìm. */
export const useProductSuggestions = (q: string) =>
  useQuery({ queryKey: ['products', { q }], queryFn: () => api<Product[]>(`/products${qs({ q })}`), enabled: q.length > 0 });
```

`client/src/lib/storage.ts`:

```ts
/** localStorage có thể ném lỗi (ẩn danh, bị chặn, đầy): đọc/ghi hỏng thì bỏ qua. */
export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* bỏ qua */
  }
}
```

- [ ] **Step 3: Dữ liệu và component hóa đơn**

`client/src/components/receipt/receipt-data.ts`:

```ts
import { cartTotals, lineAmount, type Cart, type OrderDetail, type PaymentMethod } from '@tiny-pos/shared';

export interface ReceiptItem {
  name: string;
  unit: string;
  qty: number;
  price: number;
  amount: number;
}

export interface ReceiptData {
  /** null = phiếu tạm tính (chưa thanh toán). */
  code: string | null;
  createdAt: string;
  items: ReceiptItem[];
  total: number;
  discount: number;
  payable: number;
  paid: number;
  paymentMethod: PaymentMethod;
  /** Chuỗi VietQR in kèm phiếu tạm tính. */
  qrPayload: string | null;
}

export function receiptFromOrder(o: OrderDetail): ReceiptData {
  return {
    code: o.code,
    createdAt: o.createdAt,
    items: o.items.map((i) => ({ name: i.productName, unit: i.unit, qty: i.qty, price: i.price, amount: i.amount })),
    total: o.total,
    discount: o.discount,
    payable: o.payable,
    paid: o.paid,
    paymentMethod: o.paymentMethod,
    qrPayload: null,
  };
}

export function draftReceipt(cart: Cart, qrPayload: string | null): ReceiptData {
  const t = cartTotals(cart.lines, cart.discount);
  return {
    code: null,
    createdAt: new Date().toISOString(),
    items: cart.lines.map((l) => ({ name: l.name, unit: l.unitName, qty: l.qty, price: l.price, amount: lineAmount(l) })),
    ...t,
    paid: 0,
    paymentMethod: 'transfer',
    qrPayload,
  };
}

/** Hóa đơn mẫu cho nút "In thử" ở Cài đặt. */
export function sampleReceipt(): ReceiptData {
  const items: ReceiptItem[] = [
    { name: 'Nước suối 500ml', unit: 'chai', qty: 2, price: 5000, amount: 10000 },
    { name: 'Thịt heo', unit: 'kg', qty: 0.35, price: 120000, amount: 42000 },
  ];
  return {
    code: 'HD-MAU-0001',
    createdAt: new Date().toISOString(),
    items,
    total: 52000,
    discount: 2000,
    payable: 50000,
    paid: 100000,
    paymentMethod: 'cash',
    qrPayload: null,
  };
}
```

`client/src/components/receipt/Receipt.tsx`:

```tsx
import type { CSSProperties, ReactNode } from 'react';
import { formatMoney, formatQty, type Settings } from '@tiny-pos/shared';
import type { ReceiptData } from './receipt-data';

const METHOD_LABEL = { cash: 'Tiền mặt', transfer: 'Chuyển khoản', debt: 'Ghi nợ' } as const;

// Dùng px/mm cố định: html đặt font-size 18px nên rem của Tailwind sẽ quá to trên giấy 80mm
const page: CSSProperties = {
  width: '72mm',
  margin: '0 auto',
  padding: '3mm 0 6mm',
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontSize: '12px',
  lineHeight: 1.35,
  color: '#000',
  background: '#fff',
};
const center: CSSProperties = { textAlign: 'center' };
const rule: CSSProperties = { borderTop: '1px dashed #000', margin: '4px 0' };

function Row({ label, value, strong }: { label: ReactNode; value: ReactNode; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontWeight: strong ? 700 : 400, fontSize: strong ? '14px' : undefined }}>
      <span>{label}</span>
      <span style={{ whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

/** Hóa đơn nhiệt 80mm (vùng in 72mm), đen trắng. */
export function Receipt({ data, settings, qrUrl }: { data: ReceiptData; settings: Settings; qrUrl: string | null }) {
  const paidOrder = data.code !== null;
  return (
    <div style={page}>
      <div style={{ ...center, fontSize: '16px', fontWeight: 700 }}>{settings.storeName}</div>
      {settings.storeAddress && <div style={center}>{settings.storeAddress}</div>}
      {settings.storePhone && <div style={center}>ĐT: {settings.storePhone}</div>}
      <div style={rule} />
      <div style={{ ...center, fontWeight: 700 }}>{paidOrder ? 'HÓA ĐƠN BÁN HÀNG' : 'TẠM TÍNH – chưa thanh toán'}</div>
      {paidOrder && <div style={center}>{data.code}</div>}
      <div style={center}>{timeLabel(data.createdAt)}</div>
      <div style={rule} />
      {data.items.map((it, i) => (
        <div key={i} style={{ marginBottom: '3px' }}>
          <div>{it.name}</div>
          <Row label={`${formatQty(it.qty)} ${it.unit} × ${formatMoney(it.price)}`} value={formatMoney(it.amount)} />
        </div>
      ))}
      <div style={rule} />
      <Row label="Tổng tiền" value={formatMoney(data.total)} />
      {data.discount > 0 && <Row label="Giảm giá" value={`-${formatMoney(data.discount)}`} />}
      <Row label="Phải trả" value={formatMoney(data.payable)} strong />
      {paidOrder && data.paymentMethod === 'cash' && (
        <>
          <Row label="Khách đưa" value={formatMoney(data.paid)} />
          <Row label="Tiền thối" value={formatMoney(data.paid - data.payable)} />
        </>
      )}
      {paidOrder && <Row label="Thanh toán" value={METHOD_LABEL[data.paymentMethod]} />}
      {qrUrl && (
        <div style={{ ...center, marginTop: '6px' }}>
          <img src={qrUrl} alt="" style={{ width: '42mm', height: '42mm' }} />
          <div>Quét mã để chuyển khoản</div>
        </div>
      )}
      <div style={rule} />
      {settings.receiptFooter && <div style={center}>{settings.receiptFooter}</div>}
    </div>
  );
}
```

`client/src/components/receipt/PrintProvider.tsx`:

```tsx
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { SETTINGS_DEFAULTS } from '@tiny-pos/shared';
import { useSettings } from '@/api/settings';
import { Receipt } from './Receipt';
import type { ReceiptData } from './receipt-data';

type PrintFn = (data: ReceiptData) => Promise<void>;
const Ctx = createContext<PrintFn>(() => Promise.resolve());

interface Job {
  data: ReceiptData;
  qrUrl: string | null;
}

/**
 * In hóa đơn: render Receipt vào #print-root rồi gọi window.print().
 * Chrome mở với --kiosk-printing sẽ in thẳng ra máy in mặc định, không hỏi.
 */
export function PrintProvider({ children }: { children: ReactNode }) {
  const { data: settings } = useSettings();
  const [job, setJob] = useState<Job | null>(null);
  const done = useRef<(() => void) | null>(null);

  const print = useCallback<PrintFn>(async (data) => {
    const qrUrl = data.qrPayload ? await QRCode.toDataURL(data.qrPayload, { margin: 1, width: 320 }) : null;
    await new Promise<void>((resolve) => {
      done.current = resolve;
      setJob({ data, qrUrl });
    });
  }, []);

  useEffect(() => {
    if (!job) return;
    let inner = 0;
    // Chờ 2 khung hình để DOM hóa đơn (và ảnh QR) vẽ xong rồi mới in
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        window.print();
        setJob(null);
        done.current?.();
        done.current = null;
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [job]);

  const root = document.getElementById('print-root');
  return (
    <Ctx.Provider value={print}>
      {children}
      {root && job && createPortal(<Receipt data={job.data} settings={settings ?? SETTINGS_DEFAULTS} qrUrl={job.qrUrl} />, root)}
    </Ctx.Provider>
  );
}

export const usePrint = () => useContext(Ctx);
```

- [ ] **Step 4: Nối vào trang**

Trong `client/index.html`, thêm dòng sau ngay dưới `<div id="root"></div>`:

```html
    <div id="print-root"></div>
```

Thêm vào cuối `client/src/index.css`:

```css

/* In hóa đơn nhiệt 80mm: chỉ hiện #print-root, ẩn app và mọi dialog/toast (portal nằm ngoài #root) */
@page {
  size: 80mm auto;
  margin: 0;
}
#print-root {
  display: none;
}
@media print {
  body > *:not(#print-root) {
    display: none !important;
  }
  #print-root {
    display: block;
  }
  html,
  body {
    background: #fff !important;
  }
}
```

Trong `client/src/main.tsx`: thêm import sau dòng `import { ConfirmProvider } from '@/components/ConfirmDialog';`:

```tsx
import { PrintProvider } from '@/components/receipt/PrintProvider';
```

và thay dòng `              <App />` bằng:

```tsx
              <PrintProvider>
                <App />
              </PrintProvider>
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: không lỗi. Nếu `import QRCode from 'qrcode'` báo không có default export, đổi thành `import * as QRCode from 'qrcode'`.

- [ ] **Step 6: Commit**

```bash
git add client/package.json package-lock.json client/src/api/orders.ts client/src/api/settings.ts client/src/api/products.ts client/src/lib/storage.ts client/src/components/receipt client/index.html client/src/index.css client/src/main.tsx
git commit -m "feat(client): API hóa đơn/cài đặt, in hóa đơn 80mm bằng window.print"
```

---

### Task 9: Giỏ hàng và tìm sản phẩm ở màn Bán hàng (client)

**Files:**
- Create: `client/src/pages/sell/useCart.ts`, `client/src/pages/sell/useHeldCarts.ts`
- Create: `client/src/pages/sell/ProductSearch.tsx`, `client/src/pages/sell/CartTable.tsx`, `client/src/pages/sell/CartLine.tsx`
- Create: `client/src/pages/sell/WeighDialog.tsx`, `client/src/pages/sell/CustomItemDialog.tsx`, `client/src/pages/sell/HeldCarts.tsx`

**Interfaces:**
- Consumes: `cartReducer`, `parseStoredCart`, `parseHeldCarts`, `stockShortages`, `cartTotals`, `lineAmount`, `customLine`, `newLineKey`, `MAX_HELD_CARTS`, `formatQty`, `formatMoney`, `parseVnNumber` (shared); `readStorage`/`writeStorage`, `useProductSuggestions` (Task 8); `groupThousands`, `moneyChange` (`client/src/lib/money-input.ts`).
- Produces:
  - `useCart(): { cart: Cart; dispatch: Dispatch<CartAction>; totals: Totals; shortages: Map<number, number> }`
  - `useHeldCarts(): { held: HeldCart[]; full: boolean; hold(cart: Cart): void; take(id: string): Cart | null; drop(id: string): void }`
  - `<ProductSearch inputRef onScan(code) onPick(product) />`
  - `<CartTable cart shortages dispatch onEditWeight(line: CartLine) onDone() />`
  - `interface WeighTarget { line: NewCartLine; lineKey?: string }`, `<WeighDialog target onClose onConfirm(qty: number) />`
  - `<CustomItemDialog open onClose onConfirm(line: NewCartLine) />`
  - `<HeldCarts held onOpen(id) onDrop(id) />`

- [ ] **Step 1: Hooks giỏ và đơn chờ**

`client/src/pages/sell/useCart.ts`:

```ts
import { useEffect, useMemo, useReducer } from 'react';
import { cartReducer, cartTotals, parseStoredCart, stockShortages } from '@tiny-pos/shared';
import { readStorage, writeStorage } from '@/lib/storage';

const KEY = 'tiny-pos.cart';

/** Giỏ đang bán; tự lưu localStorage để lỡ F5 không mất. */
export function useCart() {
  const [cart, dispatch] = useReducer(cartReducer, undefined, () => parseStoredCart(readStorage(KEY)));
  useEffect(() => writeStorage(KEY, JSON.stringify(cart)), [cart]);
  const totals = useMemo(() => cartTotals(cart.lines, cart.discount), [cart]);
  const shortages = useMemo(() => stockShortages(cart.lines), [cart.lines]);
  return { cart, dispatch, totals, shortages };
}
```

`client/src/pages/sell/useHeldCarts.ts`:

```ts
import { useEffect, useState } from 'react';
import { MAX_HELD_CARTS, newLineKey, parseHeldCarts, type Cart, type HeldCart } from '@tiny-pos/shared';
import { readStorage, writeStorage } from '@/lib/storage';

const KEY = 'tiny-pos.held-carts';

/** Đơn chờ (tối đa 5) lưu trên máy quầy. */
export function useHeldCarts() {
  const [held, setHeld] = useState<HeldCart[]>(() => parseHeldCarts(readStorage(KEY)));
  useEffect(() => writeStorage(KEY, JSON.stringify(held)), [held]);

  const hold = (cart: Cart) =>
    setHeld((h) => (h.length >= MAX_HELD_CARTS ? h : [...h, { id: newLineKey(), at: new Date().toISOString(), cart }]));
  const take = (id: string): Cart | null => {
    const found = held.find((h) => h.id === id);
    setHeld((h) => h.filter((x) => x.id !== id));
    return found?.cart ?? null;
  };
  const drop = (id: string) => setHeld((h) => h.filter((x) => x.id !== id));

  return { held, full: held.length >= MAX_HELD_CARTS, hold, take, drop };
}
```

- [ ] **Step 2: Ô quét/tìm có gợi ý**

`client/src/pages/sell/ProductSearch.tsx`:

```tsx
import { useEffect, useState, type KeyboardEvent, type RefObject } from 'react';
import { ScanBarcode } from 'lucide-react';
import { formatMoney, formatQty, type Product } from '@tiny-pos/shared';
import { useProductSuggestions } from '@/api/products';
import { ProductAvatar } from '@/components/ProductAvatar';
import { cn } from '@/lib/utils';

interface Props {
  inputRef: RefObject<HTMLInputElement | null>;
  onScan: (code: string) => void;
  onPick: (p: Product) => void;
}

/**
 * Ô quét mã luôn focus. Máy quét gõ nhanh rồi Enter (chưa kịp debounce) → tra mã vạch.
 * Gõ chữ → sau 200ms hiện tối đa 8 gợi ý; ↑↓ chọn, Enter thêm.
 */
export function ProductSearch({ inputRef, onScan, onPick }: Props) {
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 200);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setActive(-1), [term]);

  const searching = term.length >= 2 && /\D/.test(term);
  const { data = [] } = useProductSuggestions(searching ? term : '');
  const items = searching && q.trim() ? data.slice(0, 8) : [];

  const reset = () => {
    setQ('');
    setTerm('');
    setActive(-1);
  };
  const pick = (p: Product) => {
    reset();
    onPick(p);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && items.length) {
      e.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === 'ArrowUp' && items.length) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === 'Escape') {
      reset();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const picked = items[active];
      const code = q.trim();
      if (picked) return pick(picked);
      reset();
      if (code) onScan(code);
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-3 rounded-2xl border bg-card p-2 shadow-sm focus-within:ring-3 focus-within:ring-ring/40">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <ScanBarcode className="size-6" />
        </span>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Quét mã hoặc gõ tên sản phẩm… (F2)"
          className="min-h-11 w-full bg-transparent text-xl font-medium outline-none placeholder:text-muted-foreground/60"
          autoComplete="off"
          aria-label="Quét mã hoặc tìm sản phẩm"
        />
      </div>
      {items.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border bg-popover shadow-xl" role="listbox">
          {items.map((p, i) => (
            <li
              key={p.id}
              role="option"
              aria-selected={i === active}
              className={cn('flex cursor-pointer items-center gap-3 px-4 py-2.5', i === active ? 'bg-accent' : 'hover:bg-muted')}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(p)}
            >
              <ProductAvatar name={p.name} className="size-9 rounded-lg text-xs" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{p.name}</div>
                <div className="text-sm text-muted-foreground">
                  Tồn {formatQty(p.stock)} {p.unit}
                </div>
              </div>
              <div className="font-semibold tabular-nums">{formatMoney(p.sellPrice)}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Bảng giỏ**

`client/src/pages/sell/CartLine.tsx`:

```tsx
import { useEffect, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { formatMoney, formatQty, lineAmount, parseVnNumber, type CartLine as Line } from '@tiny-pos/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TableCell, TableRow } from '@/components/ui/table';
import { groupThousands, moneyChange } from '@/lib/money-input';

interface Props {
  line: Line;
  /** Tồn hiện có nếu giỏ đang vượt tồn. */
  shortStock?: number;
  onQty: (qty: number) => void;
  onPrice: (price: number) => void;
  onRemove: () => void;
  onEditWeight: () => void;
  /** Gọi sau Enter để đưa focus về ô quét. */
  onDone: () => void;
}

/** Bản nháp của ô sửa nhanh; đồng bộ lại khi giá trị thật đổi (ví dụ bấm +). */
function useDraft(value: string) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return [draft, setDraft] as const;
}

const selectAll = (e: FocusEvent<HTMLInputElement>) => e.target.select();

export function CartLine({ line, shortStock, onQty, onPrice, onRemove, onEditWeight, onDone }: Props) {
  const [qty, setQty] = useDraft(formatQty(line.qty));
  const [price, setPrice] = useDraft(groupThousands(String(line.price)));

  // Blur chỉ ghi giá trị; Enter ghi rồi trả focus về ô quét (blur không kéo focus để còn bấm sang ô khác)
  const commitQty = () => {
    const n = parseVnNumber(qty);
    if (Number.isFinite(n) && n >= 0) onQty(n);
    else setQty(formatQty(line.qty));
  };
  const commitPrice = () => {
    const n = parseVnNumber(price || '0');
    if (Number.isFinite(n) && n >= 0) onPrice(Math.round(n));
    else setPrice(groupThousands(String(line.price)));
  };
  const onEnter = (commit: () => void) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    commit();
    onDone();
  };

  return (
    <TableRow>
      <TableCell className="px-4 py-2 whitespace-normal">
        <div className="font-medium">{line.name}</div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {line.unitName}
          {line.factor !== 1 && ` (= ${formatQty(line.factor)})`}
          {shortStock !== undefined && (
            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
              Tồn còn {formatQty(shortStock)}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="px-2 py-2">
        {line.isWeighed ? (
          <Button variant="outline" className="h-10 min-w-28 tabular-nums" onClick={onEditWeight}>
            {formatQty(line.qty)} {line.unitName}
          </Button>
        ) : (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-lg" aria-label="Bớt 1" onClick={() => onQty(line.qty - 1)}>
              <Minus />
            </Button>
            <Input
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              onBlur={commitQty}
              onKeyDown={onEnter(commitQty)}
              onFocus={selectAll}
              inputMode="decimal"
              className="h-10 w-16 text-center text-base tabular-nums"
              aria-label="Số lượng"
            />
            <Button variant="outline" size="icon-lg" aria-label="Thêm 1" onClick={() => onQty(line.qty + 1)}>
              <Plus />
            </Button>
          </div>
        )}
      </TableCell>
      <TableCell className="px-2 py-2">
        <Input
          value={price}
          onChange={moneyChange(setPrice)}
          onBlur={commitPrice}
          onKeyDown={onEnter(commitPrice)}
          onFocus={selectAll}
          inputMode="numeric"
          className="h-10 w-28 text-right text-base tabular-nums"
          aria-label="Đơn giá"
        />
      </TableCell>
      <TableCell className="px-4 py-2 text-right text-base font-semibold tabular-nums">{formatMoney(lineAmount(line))}</TableCell>
      <TableCell className="py-2 pr-2">
        <Button variant="ghost" size="icon-lg" aria-label="Xóa dòng" onClick={onRemove}>
          <Trash2 />
        </Button>
      </TableCell>
    </TableRow>
  );
}
```

`client/src/pages/sell/CartTable.tsx`:

```tsx
import type { Dispatch } from 'react';
import { ShoppingCart } from 'lucide-react';
import type { Cart, CartAction, CartLine as Line } from '@tiny-pos/shared';
import { EmptyState } from '@/components/EmptyState';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CartLine } from './CartLine';

interface Props {
  cart: Cart;
  shortages: Map<number, number>;
  dispatch: Dispatch<CartAction>;
  onEditWeight: (line: Line) => void;
  onDone: () => void;
}

export function CartTable({ cart, shortages, dispatch, onEditWeight, onDone }: Props) {
  if (!cart.lines.length)
    return <EmptyState icon={ShoppingCart} title="Giỏ hàng trống" description="Quét mã vạch hoặc gõ tên sản phẩm để thêm." />;
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <TableHead className="px-4">Món</TableHead>
          <TableHead className="px-2">Số lượng</TableHead>
          <TableHead className="px-2">Đơn giá</TableHead>
          <TableHead className="px-4 text-right">Thành tiền</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {cart.lines.map((l) => (
          <CartLine
            key={l.key}
            line={l}
            shortStock={l.productId !== null ? shortages.get(l.productId) : undefined}
            onQty={(qty) => dispatch({ type: 'update', key: l.key, patch: { qty } })}
            onPrice={(price) => dispatch({ type: 'update', key: l.key, patch: { price } })}
            onRemove={() => dispatch({ type: 'remove', key: l.key })}
            onEditWeight={() => onEditWeight(l)}
            onDone={onDone}
          />
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 4: Dialog hàng cân, món ngoài và chip đơn chờ**

`client/src/pages/sell/WeighDialog.tsx`:

```tsx
import { useEffect, useState, type FormEvent } from 'react';
import { Check, Scale } from 'lucide-react';
import { formatMoney, formatQty, lineAmount, parseVnNumber, type NewCartLine } from '@tiny-pos/shared';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { groupThousands, moneyChange } from '@/lib/money-input';

export interface WeighTarget {
  line: NewCartLine;
  /** Có key = sửa khối lượng dòng đã có trong giỏ. */
  lineKey?: string;
}

interface Props {
  target: WeighTarget | null;
  onClose: () => void;
  onConfirm: (qty: number) => void;
}

/** Hàng cân: gõ số kg hoặc số tiền khách muốn mua, ô còn lại tự tính. */
export function WeighDialog({ target, onClose, onConfirm }: Props) {
  const [kg, setKg] = useState('');
  const [amount, setAmount] = useState('');
  const price = target?.line.price ?? 0;
  const amountOf = (qty: number) => groupThousands(String(lineAmount({ qty, price, isWeighed: true })));

  useEffect(() => {
    if (!target) return;
    const q = target.lineKey ? target.line.qty : 0;
    setKg(q ? formatQty(q) : '');
    setAmount(q ? amountOf(q) : '');
    // Chỉ khởi tạo khi mở dialog (target đổi), không chạy lại khi giá đổi
  }, [target]);

  const onKg = (v: string) => {
    setKg(v);
    const n = parseVnNumber(v);
    setAmount(Number.isFinite(n) && n > 0 ? amountOf(n) : '');
  };
  const onAmount = (v: string) => {
    setAmount(v);
    const n = parseVnNumber(v || '0');
    setKg(price > 0 && n > 0 ? formatQty(Math.round((n / price) * 1000) / 1000) : '');
  };

  const qty = parseVnNumber(kg);
  const valid = Number.isFinite(qty) && qty > 0;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (valid) onConfirm(qty);
  };

  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Scale className="size-5 text-primary" />
            {target?.line.name}
          </DialogTitle>
          <DialogDescription className="text-base">
            {formatMoney(price)} / {target?.line.unitName}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <TextField id="wd-kg" label="Khối lượng" suffix={target?.line.unitName} inputMode="decimal" autoFocus value={kg} onChange={(e) => onKg(e.target.value)} />
            <TextField id="wd-amount" label="Thành tiền" suffix="đ" inputMode="numeric" value={amount} onChange={moneyChange(onAmount)} />
          </div>
          <Button type="submit" className="h-11 w-full text-base" disabled={!valid}>
            <Check data-icon="inline-start" />
            {target?.lineKey ? 'Cập nhật' : 'Thêm vào giỏ'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

`client/src/pages/sell/CustomItemDialog.tsx`:

```tsx
import { useEffect, useState, type FormEvent } from 'react';
import { Check, PackagePlus } from 'lucide-react';
import { customLine, parseVnNumber, type NewCartLine } from '@tiny-pos/shared';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { moneyChange } from '@/lib/money-input';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (line: NewCartLine) => void;
}

/** Món ngoài (chưa khai báo, không có mã): chỉ tên + giá + số lượng, không trừ kho. */
export function CustomItemDialog({ open, onClose, onConfirm }: Props) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('1');

  useEffect(() => {
    if (!open) return;
    setName('');
    setPrice('');
    setQty('1');
  }, [open]);

  const p = parseVnNumber(price || 'x');
  const q = parseVnNumber(qty);
  const valid = Number.isFinite(p) && p >= 0 && Number.isFinite(q) && q > 0;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (valid) onConfirm(customLine(name, Math.round(p), q));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <PackagePlus className="size-5 text-primary" />
            Món ngoài
          </DialogTitle>
          <DialogDescription className="text-base">Món chưa có trong danh sách; không trừ tồn kho.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <TextField id="ci-name" label="Tên món" placeholder="Hàng khác" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <TextField id="ci-price" label="Giá" suffix="đ" inputMode="numeric" autoFocus value={price} onChange={moneyChange(setPrice)} />
            <TextField id="ci-qty" label="Số lượng" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <Button type="submit" className="h-11 w-full text-base" disabled={!valid}>
            <Check data-icon="inline-start" />
            Thêm vào giỏ
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

`client/src/pages/sell/HeldCarts.tsx`:

```tsx
import { PauseCircle, X } from 'lucide-react';
import { cartTotals, formatMoney, type HeldCart } from '@tiny-pos/shared';
import { Button } from '@/components/ui/button';

interface Props {
  held: HeldCart[];
  onOpen: (id: string) => void;
  onDrop: (id: string) => void;
}

const time = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

/** Chip các đơn đang chờ: bấm để mở lại, × để bỏ. */
export function HeldCarts({ held, onOpen, onDrop }: Props) {
  if (!held.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {held.map((h, i) => (
        <div key={h.id} className="flex items-center rounded-full border bg-card shadow-sm">
          <Button variant="ghost" className="h-10 rounded-full px-3 text-sm" onClick={() => onOpen(h.id)}>
            <PauseCircle data-icon="inline-start" className="text-amber-600" />
            Chờ {i + 1} · {time(h.at)} · {formatMoney(cartTotals(h.cart.lines, h.cart.discount).payable)}
          </Button>
          <Button variant="ghost" size="icon" className="mr-1 size-8 rounded-full" aria-label="Bỏ đơn chờ" onClick={() => onDrop(h.id)}>
            <X />
          </Button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: không lỗi. (Các component chưa được dùng ở đâu; màn hình được ghép ở Task 10.)

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/sell
git commit -m "feat(client): giỏ hàng, ô quét/tìm có gợi ý, hàng cân, món ngoài, đơn chờ"
```

---

### Task 10: Thanh toán và màn Bán hàng (client)

**Files:**
- Create (qua shadcn CLI): `client/src/components/ui/tabs.tsx`
- Create: `client/src/pages/sell/CheckoutDialog.tsx`, `client/src/pages/sell/CheckoutPanel.tsx`, `client/src/pages/sell/SaleResult.tsx`, `client/src/pages/sell/SellPage.tsx`
- Modify: `client/src/router.tsx` (NAV mục Bán hàng mở khóa, route `/sell`, `/` → `/sell`)

**Interfaces:**
- Consumes: Task 8 (`useCreateOrder`, `useOrders`, `useSettings`, `usePrint`, `draftReceipt`, `receiptFromOrder`), Task 9 (hooks + component), shared (`suggestCash`, `vietQrFromSettings`, `toOrderItems`, `lineFromProduct`, `BANKS`, `localDate`, `currentTzOffset`), `lookupBarcode`, `ApiError`, `useScanInput`, `useConfirm`.
- Produces: trang `/sell` (`SellPage`).

- [ ] **Step 1: Thêm Tabs của shadcn**

Run (trong `client/`): `npx shadcn@latest add tabs`
Expected: tạo `client/src/components/ui/tabs.tsx`, không sửa file khác (nếu CLI đòi ghi đè file có sẵn, trả lời **No**). Kiểm tra `git status` chỉ có file mới.

- [ ] **Step 2: Dialog thanh toán**

`client/src/pages/sell/CheckoutDialog.tsx`:

```tsx
import { useEffect, useState, type FormEvent } from 'react';
import QRCode from 'qrcode';
import { Banknote, Check, Landmark, Printer } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { BANKS, formatMoney, parseVnNumber, suggestCash, toOrderItems, vietQrFromSettings, type Cart, type OrderDetail } from '@tiny-pos/shared';
import { useCreateOrder } from '@/api/orders';
import { useSettings } from '@/api/settings';
import { usePrint } from '@/components/receipt/PrintProvider';
import { draftReceipt } from '@/components/receipt/receipt-data';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { groupThousands, moneyChange } from '@/lib/money-input';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  cart: Cart;
  payable: number;
  onClose: () => void;
  onDone: (order: OrderDetail) => void;
}
type Method = 'cash' | 'transfer';

export function CheckoutDialog({ open, cart, payable, onClose, onDone }: Props) {
  const [method, setMethod] = useState<Method>('cash');
  const [given, setGiven] = useState('');
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const { data: settings } = useSettings();
  const create = useCreateOrder();
  const print = usePrint();
  const qrPayload = settings ? vietQrFromSettings(settings, payable) : null;
  const bank = BANKS.find((b) => b.bin === settings?.bankBin);

  useEffect(() => {
    if (!open) return;
    setMethod('cash');
    setGiven(groupThousands(String(payable)));
  }, [open, payable]);
  useEffect(() => {
    if (!qrPayload) {
      setQrUrl(null);
      return;
    }
    let alive = true;
    void QRCode.toDataURL(qrPayload, { margin: 1, width: 320 }).then((u) => alive && setQrUrl(u));
    return () => {
      alive = false;
    };
  }, [qrPayload]);

  const paid = method === 'cash' ? parseVnNumber(given || '0') : payable;
  const change = paid - payable;
  const short = method === 'cash' && (!Number.isFinite(paid) || change < 0);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    // Khóa khi đang gửi để Enter/bấm hai lần không tạo hai đơn
    if (short || create.isPending) return;
    create.mutate(
      { items: toOrderItems(cart.lines), discount: cart.discount, paymentMethod: method, paid },
      { onSuccess: onDone, onError: (err) => toast.error(err.message) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !create.isPending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Thanh toán</DialogTitle>
          <DialogDescription className="text-base">
            Phải trả <span className="font-heading text-2xl font-semibold text-foreground tabular-nums">{formatMoney(payable)}</span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Tabs value={method} onValueChange={(v) => setMethod(v as Method)}>
            <TabsList className="grid h-11 w-full grid-cols-2">
              <TabsTrigger value="cash" className="text-base">
                <Banknote /> Tiền mặt
              </TabsTrigger>
              <TabsTrigger value="transfer" className="text-base">
                <Landmark /> Chuyển khoản
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {method === 'cash' ? (
            <div className="space-y-3">
              <label htmlFor="co-given" className="text-sm font-medium">
                Khách đưa
              </label>
              <Input
                id="co-given"
                autoFocus
                inputMode="numeric"
                value={given}
                onChange={moneyChange(setGiven)}
                onFocus={(e) => e.target.select()}
                className="h-14 text-right font-heading text-3xl! font-semibold tabular-nums"
              />
              <div className="grid grid-cols-4 gap-2">
                {suggestCash(payable).map((v) => (
                  <Button key={v} type="button" variant="outline" className="h-11 tabular-nums" onClick={() => setGiven(groupThousands(String(v)))}>
                    {v === payable ? 'Đủ tiền' : formatMoney(v)}
                  </Button>
                ))}
              </div>
              <div className={cn('flex items-baseline justify-between rounded-xl px-4 py-3', short ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary')}>
                <span className="font-medium">{short ? 'Còn thiếu' : 'Tiền thối'}</span>
                <span className="font-heading text-3xl font-semibold tabular-nums">{formatMoney(Math.abs(Number.isFinite(change) ? change : 0))}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-center">
              {qrUrl ? (
                <img src={qrUrl} alt="Mã VietQR" className="mx-auto size-64 rounded-xl border bg-white p-2" />
              ) : (
                <p className="rounded-xl bg-muted px-4 py-6 text-muted-foreground">
                  Chưa cài tài khoản ngân hàng.{' '}
                  <Link to="/settings" className="font-medium text-primary underline">
                    Mở Cài đặt
                  </Link>
                </p>
              )}
              {settings?.bankAccount && (
                <div className="text-sm">
                  <div className="font-medium">{bank?.shortName ?? settings.bankBin}</div>
                  <div className="font-mono text-base">{settings.bankAccount}</div>
                  <div className="text-muted-foreground">{settings.bankAccountName}</div>
                </div>
              )}
              {qrPayload && (
                <Button type="button" variant="outline" className="h-11 w-full text-base" onClick={() => void print(draftReceipt(cart, qrPayload))}>
                  <Printer data-icon="inline-start" />
                  In tạm tính kèm QR
                </Button>
              )}
            </div>
          )}

          <Button type="submit" className="h-12 w-full text-lg" disabled={short || create.isPending}>
            <Check data-icon="inline-start" />
            {method === 'cash' ? 'Xác nhận (Enter)' : 'Đã nhận tiền'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Cột thanh toán và khung kết quả**

`client/src/pages/sell/CheckoutPanel.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { CreditCard, PackagePlus, PauseCircle, Trash2 } from 'lucide-react';
import { currentTzOffset, formatMoney, localDate, parseVnNumber, type Totals } from '@tiny-pos/shared';
import { useOrders } from '@/api/orders';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Kbd } from '@/components/ui/kbd';
import { groupThousands, moneyChange } from '@/lib/money-input';

interface Props {
  totals: Totals;
  empty: boolean;
  canHold: boolean;
  onDiscount: (v: number) => void;
  onCheckout: () => void;
  onHold: () => void;
  onCustom: () => void;
  onClear: () => void;
}

function TodaySummary() {
  const { data } = useOrders(localDate(new Date(), currentTzOffset()));
  const s = data?.summary;
  if (!s) return null;
  return (
    <div className="rounded-xl bg-muted/60 px-4 py-3 text-sm">
      <div className="font-medium">Hôm nay: {s.count} đơn</div>
      <div className="text-muted-foreground">
        Tiền mặt {formatMoney(s.cash)} · Chuyển khoản {formatMoney(s.transfer)}
      </div>
    </div>
  );
}

/** Cột phải: tổng tiền, giảm giá, nút Thanh toán lớn và các thao tác phụ. */
export function CheckoutPanel({ totals, empty, canHold, onDiscount, onCheckout, onHold, onCustom, onClear }: Props) {
  const [discount, setDiscount] = useState('');
  useEffect(() => setDiscount(totals.discount ? groupThousands(String(totals.discount)) : ''), [totals.discount]);
  const bad = totals.payable < 0;

  return (
    <>
      <Card className="gap-0 py-0 lg:sticky lg:top-20">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-baseline justify-between text-muted-foreground">
            <span>Tổng tiền</span>
            <span className="text-lg tabular-nums">{formatMoney(totals.total)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="cp-discount" className="text-muted-foreground">
              Giảm giá
            </label>
            <Input
              id="cp-discount"
              inputMode="numeric"
              placeholder="0"
              value={discount}
              onChange={moneyChange((v) => {
                setDiscount(v);
                onDiscount(parseVnNumber(v || '0'));
              })}
              aria-invalid={bad}
              className="h-10 w-36 text-right text-base tabular-nums"
            />
          </div>
          {bad && <p className="text-sm text-destructive">Giảm giá lớn hơn tổng tiền</p>}
          <div className="border-t pt-4">
            <div className="text-sm text-muted-foreground">Phải trả</div>
            <div className="font-heading text-4xl font-semibold tracking-tight text-primary tabular-nums">{formatMoney(Math.max(0, totals.payable))}</div>
          </div>
          <Button className="h-14 w-full text-lg" disabled={empty || bad} onClick={onCheckout}>
            <CreditCard data-icon="inline-start" />
            Thanh toán <Kbd className="ml-1">F9</Kbd>
          </Button>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" className="h-11 flex-col gap-0 text-xs" disabled={empty || !canHold} title={canHold ? undefined : 'Đã đủ 5 đơn chờ'} onClick={onHold}>
              <PauseCircle /> Cất chờ
            </Button>
            <Button variant="outline" className="h-11 flex-col gap-0 text-xs" onClick={onCustom}>
              <PackagePlus /> Món ngoài (F4)
            </Button>
            <Button variant="outline" className="h-11 flex-col gap-0 text-xs text-destructive" disabled={empty} onClick={onClear}>
              <Trash2 /> Xóa giỏ
            </Button>
          </div>
          <TodaySummary />
        </CardContent>
      </Card>

      {/* Điện thoại: tổng tiền + nút Thanh toán dính trên thanh menu dưới */}
      <div className="fixed inset-x-0 bottom-16 z-30 flex items-center gap-3 border-t bg-card/95 px-4 py-2 backdrop-blur lg:hidden">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted-foreground">Phải trả</div>
          <div className="font-heading text-2xl font-semibold text-primary tabular-nums">{formatMoney(Math.max(0, totals.payable))}</div>
        </div>
        <Button className="h-12 px-6 text-base" disabled={empty || bad} onClick={onCheckout}>
          Thanh toán
        </Button>
      </div>
    </>
  );
}
```

`client/src/pages/sell/SaleResult.tsx`:

```tsx
import { CircleCheck, Printer } from 'lucide-react';
import { formatMoney, type OrderDetail } from '@tiny-pos/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/** Kết quả đơn vừa thanh toán: tiền thối chữ lớn; ẩn khi thêm món tiếp theo. */
export function SaleResult({ order, onReprint }: { order: OrderDetail; onReprint: () => void }) {
  const cash = order.paymentMethod === 'cash';
  return (
    <Card className="flex-row items-center gap-4 border-emerald-300 bg-emerald-50 px-5 py-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
      <CircleCheck className="size-8 shrink-0 text-emerald-600" />
      <div className="min-w-0 flex-1">
        <div className="font-medium">
          Đã thanh toán {order.code} · {formatMoney(order.payable)}
        </div>
        {cash ? (
          <div className="font-heading text-3xl font-semibold text-emerald-700 tabular-nums dark:text-emerald-300">
            Tiền thối: {formatMoney(order.paid - order.payable)}
          </div>
        ) : (
          <div className="text-muted-foreground">Chuyển khoản</div>
        )}
      </div>
      <Button variant="outline" className="h-11 text-base" onClick={onReprint}>
        <Printer data-icon="inline-start" />
        In lại
      </Button>
    </Card>
  );
}
```

- [ ] **Step 4: Ghép trang Bán hàng**

`client/src/pages/sell/SellPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { lineFromProduct, type CartLine, type NewCartLine, type OrderDetail, type Product, type ProductUnit } from '@tiny-pos/shared';
import { ApiError } from '@/api/client';
import { lookupBarcode } from '@/api/products';
import { useSettings } from '@/api/settings';
import { useConfirm } from '@/components/ConfirmDialog';
import { usePrint } from '@/components/receipt/PrintProvider';
import { receiptFromOrder } from '@/components/receipt/receipt-data';
import { Card } from '@/components/ui/card';
import { useScanInput } from '@/hooks/useScanInput';
import { CartTable } from './CartTable';
import { CheckoutDialog } from './CheckoutDialog';
import { CheckoutPanel } from './CheckoutPanel';
import { CustomItemDialog } from './CustomItemDialog';
import { HeldCarts } from './HeldCarts';
import { ProductSearch } from './ProductSearch';
import { SaleResult } from './SaleResult';
import { useCart } from './useCart';
import { useHeldCarts } from './useHeldCarts';
import { WeighDialog, type WeighTarget } from './WeighDialog';

const noop = () => {};

export function SellPage() {
  const { cart, dispatch, totals, shortages } = useCart();
  const heldCarts = useHeldCarts();
  const { data: settings } = useSettings();
  const print = usePrint();
  const confirm = useConfirm();
  const [weigh, setWeigh] = useState<WeighTarget | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [lastOrder, setLastOrder] = useState<OrderDetail | null>(null);
  const paused = weigh !== null || customOpen || checkoutOpen;
  // Chỉ dùng phần giữ focus của hook; phím Enter do ProductSearch xử lý (có gợi ý)
  const scan = useScanInput(noop, paused);

  const add = (line: NewCartLine) => {
    setLastOrder(null);
    dispatch({ type: 'add', line });
  };
  const addProduct = (p: Product, u: ProductUnit | null) => {
    if (!p.isActive) return void toast.error(`"${p.name}" đã ngừng bán`);
    const line = lineFromProduct(p, u);
    if (line.isWeighed) return setWeigh({ line });
    add(line);
  };
  const onScan = async (code: string) => {
    try {
      const r = await lookupBarcode(code);
      addProduct(r.product, r.unit);
    } catch (e) {
      toast.error(e instanceof ApiError && e.status === 404 ? `Không có mã ${code}` : (e as Error).message);
    }
  };

  const onWeighed = (qty: number) => {
    if (!weigh) return;
    if (weigh.lineKey) dispatch({ type: 'update', key: weigh.lineKey, patch: { qty } });
    else add({ ...weigh.line, qty });
    setWeigh(null);
  };
  const editWeight = ({ key, ...line }: CartLine) => setWeigh({ line, lineKey: key });

  const hold = () => {
    if (!cart.lines.length || heldCarts.full) return;
    heldCarts.hold(cart);
    dispatch({ type: 'clear' });
    toast.success('Đã cất đơn chờ');
  };
  const openHeld = (id: string) => {
    const c = heldCarts.take(id);
    if (!c) return;
    if (cart.lines.length) heldCarts.hold(cart);
    dispatch({ type: 'replace', cart: c });
  };
  const dropHeld = async (id: string) => {
    if (await confirm({ title: 'Bỏ đơn chờ này?', confirmText: 'Bỏ đơn', destructive: true })) heldCarts.drop(id);
  };
  const clearCart = async () => {
    if (await confirm({ title: 'Xóa toàn bộ giỏ hàng?', confirmText: 'Xóa giỏ', destructive: true })) dispatch({ type: 'clear' });
  };

  const onPaid = (order: OrderDetail) => {
    setCheckoutOpen(false);
    dispatch({ type: 'clear' });
    setLastOrder(order);
    toast.success(`Đã thanh toán ${order.code}`);
    if (settings?.autoPrint ?? true) void print(receiptFromOrder(order));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (paused) return;
      if (e.key === 'F2') {
        e.preventDefault();
        scan.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        setCustomOpen(true);
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (cart.lines.length && totals.payable >= 0) setCheckoutOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paused, cart.lines.length, totals.payable, scan.focus]);

  return (
    <div className="grid gap-5 pb-20 lg:grid-cols-[1fr_22rem] lg:pb-0">
      <div className="min-w-0 space-y-4">
        <ProductSearch inputRef={scan.ref} onScan={(c) => void onScan(c)} onPick={(p) => addProduct(p, null)} />
        <HeldCarts held={heldCarts.held} onOpen={openHeld} onDrop={(id) => void dropHeld(id)} />
        {lastOrder && <SaleResult order={lastOrder} onReprint={() => void print(receiptFromOrder(lastOrder))} />}
        <Card className="gap-0 overflow-hidden py-0">
          <CartTable cart={cart} shortages={shortages} dispatch={dispatch} onEditWeight={editWeight} onDone={scan.focus} />
        </Card>
      </div>
      <CheckoutPanel
        totals={totals}
        empty={!cart.lines.length}
        canHold={!heldCarts.full}
        onDiscount={(d) => dispatch({ type: 'setDiscount', discount: d })}
        onCheckout={() => setCheckoutOpen(true)}
        onHold={hold}
        onCustom={() => setCustomOpen(true)}
        onClear={() => void clearCart()}
      />
      <WeighDialog target={weigh} onClose={() => setWeigh(null)} onConfirm={onWeighed} />
      <CustomItemDialog
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        onConfirm={(line) => {
          add(line);
          setCustomOpen(false);
        }}
      />
      <CheckoutDialog open={checkoutOpen} cart={cart} payable={totals.payable} onClose={() => setCheckoutOpen(false)} onDone={onPaid} />
    </div>
  );
}
```

- [ ] **Step 5: Mở khóa menu và route**

Trong `client/src/router.tsx`:
- Thêm import sau dòng `import { QuickAddPage } from './pages/quick-add/QuickAddPage';`:

```tsx
import { SellPage } from './pages/sell/SellPage';
```

- Thay dòng `  { to: '/sell', label: 'Bán hàng', icon: ShoppingCart, disabled: true },` bằng:

```tsx
  { to: '/sell', label: 'Bán hàng', icon: ShoppingCart },
```

- Thay dòng `      <Route path="/" element={<Navigate to="/products" replace />} />` bằng 2 dòng:

```tsx
      <Route path="/" element={<Navigate to="/sell" replace />} />
      <Route path="/sell" element={<SellPage />} />
```

- [ ] **Step 6: Typecheck và chạy thử**

Run: `npm run typecheck`
Expected: không lỗi.

Run: `npm run seed` rồi `npm run dev` (chạy nền), mở `http://localhost:5173/sell`. Kiểm tra bằng Playwright MCP hoặc tay:
- Quét (gõ mã + Enter) một mã có trong seed thì món vào giỏ; quét lại thì số lượng lên 2; gõ "mì" thì hiện gợi ý, ↓ rồi Enter thêm được món.
- Chọn một hàng cân thì dialog mở; gõ 0,35 thì thành tiền tự tính.
- F4 thêm món ngoài; F9 mở dialog thanh toán; Enter tạo đơn, toast hiện mã `HD-…-0001`, khung "Tiền thối" hiện ra, hộp thoại in của trình duyệt mở.
- Tab Chuyển khoản khi chưa cài ngân hàng: hiện dòng nhắc mở Cài đặt.
- Cất chờ, mở lại; F5 giỏ vẫn còn.

- [ ] **Step 7: Commit**

```bash
git add client/src/components/ui/tabs.tsx client/src/pages/sell client/src/router.tsx
git commit -m "feat(client): màn Bán hàng – thanh toán tiền mặt/chuyển khoản, in hóa đơn"
```

---

### Task 11: Màn Hóa đơn (client)

**Files:**
- Create: `client/src/pages/orders/OrdersPage.tsx`, `client/src/pages/orders/OrderTable.tsx`, `client/src/pages/orders/OrderDetailDialog.tsx`, `client/src/pages/orders/DayPicker.tsx`
- Modify: `client/src/router.tsx` (NAV + route `/orders`)

**Interfaces:**
- Consumes: `useOrders`, `useOrder`, `useCancelOrder`, `usePrint`, `receiptFromOrder` (Task 8); `localDate`, `shiftDate`, `currentTzOffset`, `formatMoney`, `formatQty` (shared); `StatCard`, `PageHeader`, `EmptyState`, `useConfirm`.
- Produces: trang `/orders`.

- [ ] **Step 1: Viết component**

`client/src/pages/orders/DayPicker.tsx`:

```tsx
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { currentTzOffset, localDate, shiftDate } from '@tiny-pos/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const today = () => localDate(new Date(), currentTzOffset());

/** Chọn ngày: ◀ ô ngày ▶, và nút "Hôm nay" khi đang xem ngày khác. */
export function DayPicker({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const isToday = value === today();
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon-lg" aria-label="Ngày trước" onClick={() => onChange(shiftDate(value, -1))}>
        <ChevronLeft />
      </Button>
      <Input type="date" value={value} max={today()} onChange={(e) => e.target.value && onChange(e.target.value)} className="h-11 w-44 text-base" />
      <Button variant="outline" size="icon-lg" aria-label="Ngày sau" disabled={isToday} onClick={() => onChange(shiftDate(value, 1))}>
        <ChevronRight />
      </Button>
      {!isToday && (
        <Button variant="ghost" className="h-11" onClick={() => onChange(today())}>
          Hôm nay
        </Button>
      )}
    </div>
  );
}
```

`client/src/pages/orders/OrderTable.tsx`:

```tsx
import { formatMoney, type OrderSummary } from '@tiny-pos/shared';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export const METHOD_LABEL = { cash: 'Tiền mặt', transfer: 'Chuyển khoản', debt: 'Ghi nợ' } as const;
const time = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

/** Bảng hóa đơn trong ngày; bấm vào hàng để xem chi tiết. */
export function OrderTable({ orders, onOpen }: { orders: OrderSummary[]; onOpen: (id: number) => void }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <TableHead className="px-4">Mã</TableHead>
          <TableHead className="px-4">Giờ</TableHead>
          <TableHead className="px-4 text-right">Số món</TableHead>
          <TableHead className="px-4 text-right">Phải trả</TableHead>
          <TableHead className="px-4">Thanh toán</TableHead>
          <TableHead className="px-4">Trạng thái</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((o) => {
          const cancelled = o.status === 'cancelled';
          return (
            <TableRow key={o.id} className={cn('cursor-pointer', cancelled && 'text-muted-foreground')} onClick={() => onOpen(o.id)}>
              <TableCell className={cn('px-4 py-3 font-mono', cancelled && 'line-through')}>{o.code}</TableCell>
              <TableCell className="px-4 py-3 tabular-nums">{time(o.createdAt)}</TableCell>
              <TableCell className="px-4 py-3 text-right tabular-nums">{o.itemCount}</TableCell>
              <TableCell className={cn('px-4 py-3 text-right font-semibold tabular-nums', cancelled && 'line-through')}>{formatMoney(o.payable)}</TableCell>
              <TableCell className="px-4 py-3">{METHOD_LABEL[o.paymentMethod]}</TableCell>
              <TableCell className="px-4 py-3">{cancelled ? <Badge variant="secondary">Đã hủy</Badge> : <Badge>Hoàn tất</Badge>}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
```

`client/src/pages/orders/OrderDetailDialog.tsx`:

```tsx
import { Ban, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney, formatQty } from '@tiny-pos/shared';
import { useCancelOrder, useOrder } from '@/api/orders';
import { useConfirm } from '@/components/ConfirmDialog';
import { usePrint } from '@/components/receipt/PrintProvider';
import { receiptFromOrder } from '@/components/receipt/receipt-data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { METHOD_LABEL } from './OrderTable';

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? 'flex justify-between text-lg font-semibold' : 'flex justify-between text-muted-foreground'}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export function OrderDetailDialog({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data: o } = useOrder(id);
  const cancel = useCancelOrder();
  const confirm = useConfirm();
  const print = usePrint();

  const onCancel = async () => {
    if (!o) return;
    const ok = await confirm({
      title: `Hủy ${o.code} và trả hàng về kho?`,
      description: 'Hóa đơn vẫn được giữ lại với trạng thái Đã hủy và không tính vào doanh thu.',
      confirmText: 'Hủy hóa đơn',
      cancelText: 'Không',
      destructive: true,
    });
    if (!ok) return;
    cancel.mutate(o.id, { onSuccess: () => toast.success(`Đã hủy ${o.code}`), onError: (e) => toast.error(e.message) });
  };

  return (
    <Dialog open={id !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono text-xl">
            {o?.code ?? 'Hóa đơn'}
            {o?.status === 'cancelled' && <Badge variant="secondary">Đã hủy</Badge>}
          </DialogTitle>
          <DialogDescription className="text-base">
            {o && `${new Date(o.createdAt).toLocaleString('vi-VN')} · ${METHOD_LABEL[o.paymentMethod]}`}
          </DialogDescription>
        </DialogHeader>
        {o && (
          <div className="space-y-4">
            <ul className="divide-y rounded-xl border">
              {o.items.map((it) => (
                <li key={it.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="font-medium">{it.productName}</div>
                    <div className="text-sm text-muted-foreground tabular-nums">
                      {formatQty(it.qty)} {it.unit} × {formatMoney(it.price)}
                    </div>
                  </div>
                  <div className="font-semibold tabular-nums">{formatMoney(it.amount)}</div>
                </li>
              ))}
            </ul>
            <div className="space-y-1">
              <Line label="Tổng tiền" value={formatMoney(o.total)} />
              {o.discount > 0 && <Line label="Giảm giá" value={`-${formatMoney(o.discount)}`} />}
              <Line label="Phải trả" value={formatMoney(o.payable)} strong />
              {o.paymentMethod === 'cash' && (
                <>
                  <Line label="Khách đưa" value={formatMoney(o.paid)} />
                  <Line label="Tiền thối" value={formatMoney(o.paid - o.payable)} />
                </>
              )}
            </div>
          </div>
        )}
        <DialogFooter>
          {o?.status === 'done' && (
            <Button variant="outline" className="h-11 text-base text-destructive" disabled={cancel.isPending} onClick={() => void onCancel()}>
              <Ban data-icon="inline-start" />
              Hủy đơn
            </Button>
          )}
          <Button className="h-11 text-base" disabled={!o} onClick={() => o && void print(receiptFromOrder(o))}>
            <Printer data-icon="inline-start" />
            In lại
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

`client/src/pages/orders/OrdersPage.tsx`:

```tsx
import { useState } from 'react';
import { Banknote, Landmark, ReceiptText, Wallet } from 'lucide-react';
import { formatMoney } from '@tiny-pos/shared';
import { useOrders } from '@/api/orders';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DayPicker, today } from './DayPicker';
import { OrderDetailDialog } from './OrderDetailDialog';
import { OrderTable } from './OrderTable';

export function OrdersPage() {
  const [date, setDate] = useState(today);
  const [openId, setOpenId] = useState<number | null>(null);
  const { data, isLoading } = useOrders(date);
  const s = data?.summary;

  return (
    <>
      <PageHeader title="Hóa đơn" description="Xem, in lại và hủy hóa đơn theo ngày" icon={ReceiptText} actions={<DayPicker value={date} onChange={setDate} />} />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={ReceiptText} label="Số đơn" value={String(s?.count ?? 0)} hint="Không tính đơn đã hủy" />
        <StatCard icon={Wallet} label="Doanh thu" value={formatMoney(s?.total ?? 0)} tone="info" />
        <StatCard icon={Banknote} label="Tiền mặt" value={formatMoney(s?.cash ?? 0)} />
        <StatCard icon={Landmark} label="Chuyển khoản" value={formatMoney(s?.transfer ?? 0)} tone="warn" />
      </div>
      <Card className="gap-0 overflow-hidden py-0">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : data?.orders.length ? (
          <OrderTable orders={data.orders} onOpen={setOpenId} />
        ) : (
          <EmptyState icon={ReceiptText} title="Chưa có hóa đơn" description="Ngày này chưa bán đơn nào." />
        )}
      </Card>
      <OrderDetailDialog id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
```

- [ ] **Step 2: Menu và route**

Trong `client/src/router.tsx`:
- Import icon: thay dòng import lucide đầu file bằng

```tsx
import { FolderOpen, Package, ReceiptText, ScanBarcode, Settings, ShoppingCart, type LucideIcon } from 'lucide-react';
```

- Thêm import sau dòng `import { CategoriesPage } from './pages/categories/CategoriesPage';`:

```tsx
import { OrdersPage } from './pages/orders/OrdersPage';
```

- Thêm vào `NAV` ngay dưới dòng `{ to: '/sell', label: 'Bán hàng', icon: ShoppingCart },`:

```tsx
  { to: '/orders', label: 'Hóa đơn', icon: ReceiptText },
```

- Thêm route ngay dưới `<Route path="/sell" element={<SellPage />} />`:

```tsx
      <Route path="/orders" element={<OrdersPage />} />
```

- [ ] **Step 3: Typecheck và chạy thử**

Run: `npm run typecheck`
Expected: không lỗi.

Với `npm run dev` đang chạy, mở `/orders`: thấy đơn vừa bán ở Task 10; ◀ sang hôm qua thì bảng trống; mở chi tiết, *In lại* mở hộp thoại in; *Hủy đơn* rồi xác nhận thì badge "Đã hủy", thẻ tổng giảm, tồn sản phẩm (xem ở `/products`) được cộng lại.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/orders client/src/router.tsx
git commit -m "feat(client): màn Hóa đơn – xem theo ngày, in lại, hủy trả kho"
```

---

### Task 12: Màn Cài đặt (client)

**Files:**
- Create: `client/src/pages/settings/SettingsPage.tsx`
- Modify: `client/src/router.tsx` (mở khóa Cài đặt, route `/settings`), `client/src/App.tsx` (2 dòng chữ "Giai đoạn" ở sidebar)

**Interfaces:**
- Consumes: `useSettings`, `useSaveSettings`, `usePrint`, `sampleReceipt` (Task 8); `BANKS`, `SETTINGS_DEFAULTS`, `stripDiacritics`, `Settings` (shared); `TextField`, `SectionTitle`, `SelectField`, `PageHeader`, `Switch`, `Card`.
- Produces: trang `/settings`.

- [ ] **Step 1: Viết trang**

`client/src/pages/settings/SettingsPage.tsx`:

```tsx
import { useEffect, useState, type FormEvent } from 'react';
import { Check, Printer, Settings as SettingsIcon } from 'lucide-react';
import { toast } from 'sonner';
import { BANKS, SETTINGS_DEFAULTS, stripDiacritics, type Settings } from '@tiny-pos/shared';
import { useSaveSettings, useSettings } from '@/api/settings';
import { PageHeader } from '@/components/PageHeader';
import { usePrint } from '@/components/receipt/PrintProvider';
import { sampleReceipt } from '@/components/receipt/receipt-data';
import { SelectField } from '@/components/SelectField';
import { SectionTitle, TextField } from '@/components/TextField';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

type TextKey = 'storeName' | 'storeAddress' | 'storePhone' | 'receiptFooter';
const bankOptions = BANKS.map((b) => ({ value: b.bin, label: `${b.shortName} – ${b.name}` }));

export function SettingsPage() {
  const { data } = useSettings();
  const save = useSaveSettings();
  const print = usePrint();
  const [form, setForm] = useState<Settings>(SETTINGS_DEFAULTS);
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setForm((f) => ({ ...f, [k]: v }));
  const text = (k: TextKey, label: string, hint?: string) => (
    <TextField id={`st-${k}`} label={label} hint={hint} value={form[k]} onChange={(e) => set(k, e.target.value)} />
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(form, { onSuccess: () => toast.success('Đã lưu cài đặt'), onError: (err) => toast.error(err.message) });
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Cài đặt"
        description="Thông tin in trên hóa đơn và tài khoản nhận chuyển khoản"
        icon={SettingsIcon}
        actions={
          <Button type="submit" className="h-11 px-5 text-base" disabled={save.isPending}>
            <Check data-icon="inline-start" />
            Lưu
          </Button>
        }
      />
      <Card>
        <CardContent className="space-y-4">
          <SectionTitle>Cửa hàng</SectionTitle>
          {text('storeName', 'Tên cửa hàng')}
          {text('storeAddress', 'Địa chỉ')}
          {text('storePhone', 'Số điện thoại')}
          {text('receiptFooter', 'Lời chào cuối hóa đơn')}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-4">
          <SectionTitle>Chuyển khoản (VietQR)</SectionTitle>
          <SelectField id="st-bank" label="Ngân hàng" value={form.bankBin} onChange={(v) => set('bankBin', v)} options={bankOptions} emptyLabel="Chưa chọn" />
          <TextField
            id="st-account"
            label="Số tài khoản"
            inputMode="numeric"
            value={form.bankAccount}
            onChange={(e) => set('bankAccount', e.target.value.replace(/\D/g, ''))}
          />
          <TextField
            id="st-account-name"
            label="Tên chủ tài khoản"
            hint="Viết hoa, không dấu – giống trên thẻ ngân hàng"
            value={form.bankAccountName}
            onChange={(e) => set('bankAccountName', stripDiacritics(e.target.value).toUpperCase())}
          />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-4">
          <SectionTitle>In hóa đơn</SectionTitle>
          <label className="flex items-center justify-between gap-4">
            <span>
              <span className="block font-medium">Tự in sau khi thanh toán</span>
              <span className="text-sm text-muted-foreground">Tắt nếu chỉ muốn in khi bấm "In lại"</span>
            </span>
            <Switch checked={form.autoPrint} onCheckedChange={(v) => set('autoPrint', v)} />
          </label>
          <Button type="button" variant="outline" className="h-11 text-base" onClick={() => void print(sampleReceipt())}>
            <Printer data-icon="inline-start" />
            In thử
          </Button>
          <p className="text-sm text-muted-foreground">In thử dùng thông tin đã lưu. Máy quầy mở Chrome với --kiosk-printing để in không cần hỏi.</p>
        </CardContent>
      </Card>
    </form>
  );
}
```

- [ ] **Step 2: Menu, route, chữ sidebar**

Trong `client/src/router.tsx`:
- Thêm import sau dòng `import { QuickAddPage } from './pages/quick-add/QuickAddPage';`:

```tsx
import { SettingsPage } from './pages/settings/SettingsPage';
```

- Thay dòng `  { to: '/settings', label: 'Cài đặt', icon: Settings, disabled: true },` bằng:

```tsx
  { to: '/settings', label: 'Cài đặt', icon: Settings },
```

- Thêm route ngay dưới `<Route path="/quick-add" element={<QuickAddPage />} />`:

```tsx
      <Route path="/settings" element={<SettingsPage />} />
```

Trong `client/src/App.tsx`, thay 2 dòng

```tsx
          <div className="text-sm font-medium">Giai đoạn 1</div>
          <div className="text-xs text-emerald-100/60">Sản phẩm, danh mục, nhập nhanh, CSV</div>
```

bằng

```tsx
          <div className="text-sm font-medium">Giai đoạn 2</div>
          <div className="text-xs text-emerald-100/60">Bán hàng, hóa đơn, in, cài đặt</div>
```

- [ ] **Step 3: Typecheck và chạy thử**

Run: `npm run typecheck`
Expected: không lỗi.

Mở `/settings`: nhập tên cửa hàng, chọn Vietcombank, số tài khoản, gõ "nguyễn văn an" thì ô hiện "NGUYEN VAN AN"; Lưu thì toast xanh; F5 vẫn giữ nguyên. Nhập BIN sai không xảy ra được (ô chọn). *In thử* mở hộp thoại in với hóa đơn mẫu rộng 80mm. Sang `/sell`, thanh toán bằng Chuyển khoản thì QR hiện; quét bằng app ngân hàng thấy đúng số tiền và tên chủ tài khoản.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/settings client/src/router.tsx client/src/App.tsx
git commit -m "feat(client): trang Cài đặt – thông tin cửa hàng, tài khoản VietQR, tự in"
```

---

### Task 13: README và kiểm tra toàn bộ

**Files:**
- Modify: `README.md` (thêm mục kiểm thử thủ công Giai đoạn 2; sửa dòng yêu cầu máy in)

- [ ] **Step 1: Cập nhật README**

Trong `README.md`, thay dòng

```md
- Máy quét mã vạch USB (gõ mã rồi Enter), máy in hóa đơn nhiệt 80mm (giai đoạn 2).
```

bằng

```md
- Máy quét mã vạch USB (gõ mã rồi Enter), máy in hóa đơn nhiệt 80mm đặt làm máy in mặc định của Windows.
```

Thêm vào cuối file:

```md

## Kiểm thử thủ công Giai đoạn 2

Chuẩn bị: `npm run seed`, rồi vào *Cài đặt* nhập tên cửa hàng, chọn ngân hàng, số tài khoản, tên chủ tài khoản → *Lưu* → *In thử* (hóa đơn rộng 80mm, chữ không bị cắt).

In không hỏi: tạo shortcut `chrome.exe --app=http://localhost:3000 --kiosk-printing` và đặt máy in nhiệt làm máy in mặc định; khi in, khổ giấy do CSS `@page { size: 80mm auto }` quyết định.

1. **Quét**: vào *Bán hàng*, quét một mã → món vào giỏ; quét lại → số lượng 2; quét mã thùng → dòng riêng "· Thùng". Quét mã lạ → toast đỏ "Không có mã …". Quét hàng đã ngừng bán → toast đỏ, không thêm.
2. **Tìm**: gõ "mì" → gợi ý; ↓ + Enter thêm món. Gõ mã số rồi Enter vẫn tra mã vạch.
3. **Hàng cân**: chọn hàng cân → gõ 0,35 kg thấy thành tiền; hoặc gõ 20.000đ thấy số kg. Bấm số kg trong giỏ để sửa.
4. **Sửa dòng**: đổi số lượng, sửa đơn giá, xóa dòng; vượt tồn → nhãn vàng "Tồn còn N" nhưng vẫn thanh toán được.
5. **Món ngoài (F4)**, **giảm giá** (lớn hơn tổng → chữ đỏ, nút Thanh toán khóa).
6. **Đơn chờ**: *Cất chờ* → giỏ trống, có chip "Chờ 1"; bán đơn khác; bấm chip → giỏ cũ quay lại. F5 → giỏ và đơn chờ vẫn còn.
7. **Tiền mặt (F9)**: bấm gợi ý 100.000 → tiền thối đúng; Enter → toast mã `HD-YYYYMMDD-0001`, in hóa đơn, khung "Tiền thối" chữ lớn. Nhấn Enter liên tục chỉ tạo 1 đơn.
8. **Chuyển khoản**: QR hiện đúng số tiền (quét thử bằng app ngân hàng); *In tạm tính kèm QR* in phiếu "TẠM TÍNH"; *Đã nhận tiền* tạo đơn.
9. **Hóa đơn**: vào *Hóa đơn* thấy các đơn hôm nay và tổng tiền mặt / chuyển khoản; mở một đơn → *In lại*; *Hủy đơn* → badge "Đã hủy", tổng giảm, tồn ở *Sản phẩm* được cộng lại.
10. **Điện thoại**: mở `http://<IP máy>:3000/sell` → thêm món được (không lỗi secure context), thanh "Phải trả / Thanh toán" dính đáy màn hình.
```

- [ ] **Step 2: Chạy toàn bộ kiểm tra**

Run: `npm test`
Expected: PASS toàn bộ shared + server.

Run: `npm run typecheck`
Expected: không lỗi.

Run: `npm run build`
Expected: build xong cả 3 workspace, không lỗi.

- [ ] **Step 3: Kiểm tra diff không có nhiễu format**

Run: `git diff --stat 94ba552..HEAD -- . ':!package-lock.json' ':!server/drizzle'`
Expected: các file có sẵn (`router.tsx`, `App.tsx`, `main.tsx`, `index.css`, `index.html`, `api/products.ts`, `schema.ts`, `errors.ts`, `error.ts`, `common.ts`, `types.ts`, `index.ts`, `routes/index.ts`, `README.md`, `connection.test.ts`) chỉ thay đổi vài dòng đến vài chục dòng đúng như các task mô tả. Nếu một file cũ có thay đổi lớn bất thường, mở ra xem và hoàn tác các hunk chỉ là format.

- [ ] **Step 4: Chạy thử production và chạy lại kịch bản README**

Run: `npm run build && npm start` (chạy nền), mở `http://localhost:3000`, chạy lại nhanh các mục 1, 7, 9 của kịch bản README.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: hướng dẫn kiểm thử thủ công giai đoạn 2, in không hỏi bằng kiosk-printing"
```
