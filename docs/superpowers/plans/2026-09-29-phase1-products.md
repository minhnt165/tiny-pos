# Giai đoạn 1 – Sản phẩm: Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng monorepo, schema SQLite đầy đủ, API + UI quản lý sản phẩm, danh mục, đơn vị quy đổi, màn Nhập nhanh và nhập/xuất CSV.

**Architecture:** npm workspaces `shared` (zod + tiện ích thuần, build ra `dist/`), `server` (Express 5 + Drizzle + better-sqlite3, service nhận `db` làm tham số để test bằng DB `:memory:`), `client` (Vite + React 18 + Tailwind v4 + TanStack Query, proxy `/api`). Mọi thay đổi tồn kho đi qua `recordMovement` trong `services/stock.ts`.

**Tech Stack:** Node 24, TypeScript 5.9 ESM/NodeNext, Express 5, better-sqlite3 12, drizzle-orm 0.44 + drizzle-kit 0.31, zod 4, vitest 3, tsx, concurrently, Vite 7, React 18.3, react-router 7, @tanstack/react-query 5, tailwindcss 4, vite-plugin-pwa 1.

**Spec:** `docs/superpowers/specs/2026-09-29-tiny-pos-phase1-design.md`

## Global Constraints

- Tiền là `integer` đồng; số lượng/tồn/factor là `real`.
- Mọi thay đổi `products.stock` phải kèm 1 dòng `stock_movements` trong cùng transaction.
- Sản phẩm xóa mềm (`isActive=false`), không `DELETE`.
- API dưới `/api`, lỗi `{ error: string }`; body validate bằng zod trong `shared/`.
- UI tiếng Việt, tiền hiển thị `15.000đ`. Component ≤ 200 dòng.
- Không thêm thư viện ngoài danh sách stack (dev-deps: concurrently, tsx, vitest, @types/*).
- Định danh trong code tiếng Anh; UI, comment, commit message tiếng Việt.
- Không format lại file có sẵn; chỉ format file mới tạo.

## Review Focus

1. Quét mã khi dialog tạo sản phẩm đang mở ở màn Nhập nhanh: mã phải đi vào ô đang focus trong dialog, không được kích hoạt tra cứu mới (Task 13: `useScanInput` bỏ qua khi `paused`).
2. CSV do Excel lưu thiếu cột `Tên` hoặc dùng dấu `;`: phải trả lỗi rõ "Không tìm thấy cột Tên" thay vì tạo hàng loạt sản phẩm rỗng (Task 4: test `parseProductCsv` thiếu cột).
3. Hai dòng trong cùng file CSV có cùng mã vạch mới: dòng 2 phải cập nhật dòng 1, không được ném lỗi unique làm rollback cả file (Task 9: test trùng mã trong file).
4. Mã vạch đơn vị quy đổi trùng mã vạch của sản phẩm khác (hoặc ngược lại): phải từ chối 409 vì `by-barcode` sẽ mơ hồ (Task 8: kiểm tra chéo hai bảng).
5. Client gửi số dưới dạng chuỗi (`"15000"`): server phải trả 400 có tên trường tiếng Việt, client phải chuyển sang số trước khi gửi (Task 10: test thông điệp lỗi; Task 12: form parse `Number()`).

---

### Task 1: Khung monorepo

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `shared/package.json`, `shared/tsconfig.json`, `shared/src/index.ts`, `server/package.json`, `server/tsconfig.json`, `server/src/index.ts`, `client/package.json`, `client/tsconfig.json`, `client/index.html`, `client/src/main.tsx`, `client/vite.config.ts`, `README.md`

**Interfaces:**
- Produces: package `@tiny-pos/shared` (exports `./dist/index.js`), scripts gốc `dev`, `build`, `typecheck`, `test`.

- [ ] **Step 1: Tạo `package.json` gốc**

```json
{
  "name": "tiny-pos",
  "private": true,
  "type": "module",
  "workspaces": ["shared", "server", "client"],
  "scripts": {
    "dev": "npm run build -w shared && concurrently -n shared,server,client -c blue,green,magenta \"npm run dev -w shared\" \"npm run dev -w server\" \"npm run dev -w client\"",
    "build": "npm run build -w shared && npm run build -w server && npm run build -w client",
    "typecheck": "npm run build -w shared && npm run typecheck --workspaces",
    "test": "npm run build -w shared && npm run test --workspaces --if-present",
    "start": "node server/dist/index.js",
    "db:generate": "npm run db:generate -w server"
  },
  "devDependencies": {
    "concurrently": "^9.2.0",
    "typescript": "^5.9.0",
    "vitest": "^3.2.0"
  }
}
```

- [ ] **Step 2: Tạo `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "noUncheckedIndexedAccess": true
  }
}
```

- [ ] **Step 3: Tạo workspace `shared`**

`shared/package.json`:
```json
{
  "name": "@tiny-pos/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsc -p tsconfig.json --watch --preserveWatchOutput",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "dependencies": { "zod": "^4.1.0" }
}
```
`shared/tsconfig.json`:
```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist", "declaration": true },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts"]
}
```
`shared/src/index.ts`: `export {};` (tạm).

- [ ] **Step 4: Tạo workspace `server`**

`server/package.json`:
```json
{
  "name": "@tiny-pos/server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "db:generate": "drizzle-kit generate"
  },
  "dependencies": {
    "@tiny-pos/shared": "*",
    "better-sqlite3": "^12.2.0",
    "drizzle-orm": "^0.44.0",
    "express": "^5.1.0",
    "zod": "^4.1.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.13",
    "@types/express": "^5.0.3",
    "@types/node": "^24.0.0",
    "drizzle-kit": "^0.31.0",
    "tsx": "^4.20.0"
  }
}
```
`server/tsconfig.json`:
```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist", "types": ["node"] },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts"]
}
```
`server/src/index.ts` tạm: `console.log('tiny-pos server');`

- [ ] **Step 5: Tạo workspace `client`**

`client/package.json`:
```json
{
  "name": "@tiny-pos/client",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host",
    "build": "tsc -p tsconfig.json --noEmit && vite build",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "preview": "vite preview --host"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.80.0",
    "@tiny-pos/shared": "*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router": "^7.6.0",
    "zod": "^4.1.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^5.0.0",
    "tailwindcss": "^4.1.0",
    "vite": "^7.0.0",
    "vite-plugin-pwa": "^1.0.0"
  }
}
```
`client/tsconfig.json`:
```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "noEmit": true,
    "types": ["vite/client"]
  },
  "include": ["src", "vite.config.ts"]
}
```
`client/index.html`:
```html
<!doctype html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tạp hóa</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```
`client/vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Tạp hóa',
        short_name: 'Tạp hóa',
        lang: 'vi',
        start_url: '/',
        display: 'standalone',
        theme_color: '#16a34a',
        background_color: '#ffffff',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
      workbox: { navigateFallbackDenylist: [/^\/api/, /^\/print/] },
    }),
  ],
  server: { host: true, port: 5173, proxy: { '/api': 'http://localhost:3000' } },
});
```
`client/src/main.tsx` tạm: `document.getElementById('root')!.textContent = 'Tạp hóa';`

- [ ] **Step 6: Cài đặt và kiểm tra**

Run: `npm install` rồi `npm run typecheck`
Expected: cài xong không lỗi native (better-sqlite3 có prebuilt cho Node 24); typecheck 3 workspace pass.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: khung monorepo shared/server/client"
```

---

### Task 2: `shared` – tiện ích tiền

**Files:**
- Create: `shared/src/money.ts`, `shared/src/money.test.ts`
- Modify: `shared/src/index.ts`

**Interfaces:**
- Produces: `formatMoney(amount: number): string`, `round500(amount: number): number`.

- [ ] **Step 1: Viết test**

`shared/src/money.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { formatMoney, round500 } from './money.js';

describe('formatMoney', () => {
  it('nhóm hàng nghìn bằng dấu chấm và thêm đ', () => {
    expect(formatMoney(0)).toBe('0đ');
    expect(formatMoney(500)).toBe('500đ');
    expect(formatMoney(15000)).toBe('15.000đ');
    expect(formatMoney(1234567)).toBe('1.234.567đ');
  });
  it('giữ dấu âm', () => {
    expect(formatMoney(-15000)).toBe('-15.000đ');
  });
  it('làm tròn số lẻ', () => {
    expect(formatMoney(999.6)).toBe('1.000đ');
  });
});

describe('round500', () => {
  it('làm tròn về bội 500 gần nhất', () => {
    expect(round500(1249)).toBe(1000);
    expect(round500(1250)).toBe(1500);
    expect(round500(12345)).toBe(12500);
    expect(round500(0)).toBe(0);
  });
});
```

- [ ] **Step 2: Chạy test, phải fail** — `npm test -w shared` → lỗi không tìm thấy module.

- [ ] **Step 3: Implement**

`shared/src/money.ts`:
```ts
/** Định dạng tiền VNĐ: 15000 → "15.000đ". */
export function formatMoney(amount: number): string {
  const rounded = Math.round(Math.abs(amount));
  const sign = amount < 0 && rounded !== 0 ? '-' : '';
  const grouped = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${grouped}đ`;
}

/** Làm tròn về bội số 500đ gần nhất (dùng cho hàng cân). */
export function round500(amount: number): number {
  return Math.round(amount / 500) * 500;
}
```
`shared/src/index.ts`: `export * from './money.js';`

- [ ] **Step 4: Chạy test, pass** — `npm test -w shared`

- [ ] **Step 5: Commit** — `git add shared && git commit -m "feat(shared): formatMoney, round500"`

---

### Task 3: `shared` – parser CSV

**Files:**
- Create: `shared/src/csv.ts`, `shared/src/csv.test.ts`
- Modify: `shared/src/index.ts`

**Interfaces:**
- Produces: `parseCsv(text: string): string[][]`, `toCsv(rows: CsvCell[][]): string` với `type CsvCell = string | number | boolean | null | undefined`.

- [ ] **Step 1: Viết test**

```ts
import { describe, expect, it } from 'vitest';
import { parseCsv, toCsv } from './csv.js';

describe('parseCsv', () => {
  it('tách dòng và cột đơn giản, bỏ dòng trống', () => {
    expect(parseCsv('a,b\n1,2\n\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('xử lý CRLF và BOM', () => {
    expect(parseCsv('﻿a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('xử lý ngoặc kép, dấu phẩy và xuống dòng trong ô', () => {
    expect(parseCsv('"Sữa ""Cô gái"", 1L","x\ny"')).toEqual([['Sữa "Cô gái", 1L', 'x\ny']]);
  });
  it('giữ ô trống cuối dòng', () => {
    expect(parseCsv('a,\n')).toEqual([['a', '']]);
  });
});

describe('toCsv', () => {
  it('bao ngoặc khi cần, boolean thành 1/0, null thành rỗng', () => {
    expect(toCsv([['a,b', 'c"d', 5, true, false, null]])).toBe('"a,b","c""d",5,1,0,\r\n');
  });
  it('đi vòng qua parseCsv không đổi dữ liệu', () => {
    const rows = [['Tên', 'Ghi chú'], ['Bánh "ngon", 2', 'dòng 1\ndòng 2']];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});
```

- [ ] **Step 2: Chạy test, fail.**

- [ ] **Step 3: Implement**

```ts
export type CsvCell = string | number | boolean | null | undefined;

/** Đọc CSV (RFC 4180): hỗ trợ ngoặc kép, dấu phẩy trong ô, CRLF/LF, BOM. Bỏ dòng trống. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  for (; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

function escapeCell(v: CsvCell): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'boolean' ? (v ? '1' : '0') : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Ghi CSV, mỗi dòng kết thúc CRLF. Không thêm BOM (caller tự thêm khi tải file). */
export function toCsv(rows: CsvCell[][]): string {
  return rows.map((r) => r.map(escapeCell).join(',')).join('\r\n') + '\r\n';
}
```
`index.ts` thêm `export * from './csv.js';`

- [ ] **Step 4: Test pass.** - [ ] **Step 5: Commit** `feat(shared): parseCsv/toCsv`

---

### Task 4: `shared` – zod schema, types, CSV sản phẩm

**Files:**
- Create: `shared/src/types.ts`, `shared/src/schemas/common.ts`, `shared/src/schemas/category.ts`, `shared/src/schemas/product.ts`, `shared/src/schemas/product-unit.ts`, `shared/src/product-csv.ts`, `shared/src/product-csv.test.ts`, `shared/src/schemas/product.test.ts`
- Modify: `shared/src/index.ts`

**Interfaces:**
- Produces: `categoryInputSchema`, `productInputSchema`, `productListQuerySchema`, `productUnitInputSchema` và các type `CategoryInput`, `ProductInput`, `ProductListQuery`, `ProductUnitInput`; types `Category`, `Product`, `ProductUnit`, `ProductWithUnits`, `BarcodeLookup`, `CsvImportResult`; `PRODUCT_CSV_HEADERS`, `parseProductCsv(text)`, `productToCsvRow(p, categoryName)`; `FIELD_LABELS` (map tên trường → nhãn tiếng Việt).

- [ ] **Step 1: Viết test schema**

`shared/src/schemas/product.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { productInputSchema, productListQuerySchema } from './product.js';

describe('productInputSchema', () => {
  it('điền mặc định và đổi barcode rỗng thành null', () => {
    const r = productInputSchema.parse({ name: '  Sữa  ', barcode: '  ' });
    expect(r).toMatchObject({ name: 'Sữa', barcode: null, unit: 'cái', costPrice: 0, sellPrice: 0, stock: 0, isWeighed: false, categoryId: null, minStock: 0 });
  });
  it('từ chối tên trống và giá âm', () => {
    expect(productInputSchema.safeParse({ name: '' }).success).toBe(false);
    expect(productInputSchema.safeParse({ name: 'x', sellPrice: -1 }).success).toBe(false);
  });
  it('từ chối số dạng chuỗi', () => {
    expect(productInputSchema.safeParse({ name: 'x', sellPrice: '15000' }).success).toBe(false);
  });
});

describe('productListQuerySchema', () => {
  it('ép kiểu query string', () => {
    expect(productListQuerySchema.parse({ q: ' a ', categoryId: '3', includeInactive: '1' })).toEqual({ q: 'a', categoryId: 3, includeInactive: true });
    expect(productListQuerySchema.parse({})).toEqual({ q: undefined, categoryId: undefined, includeInactive: false });
  });
});
```

`shared/src/product-csv.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { parseProductCsv, productToCsvRow, PRODUCT_CSV_HEADERS } from './product-csv.js';
import { toCsv } from './csv.js';

describe('parseProductCsv', () => {
  it('đọc theo tên cột, không phụ thuộc thứ tự, thiếu cột phụ vẫn được', () => {
    const text = 'Tên,Giá bán,Mã vạch,Hàng cân\nSữa,15000,893,0\nThịt heo,120000,,x\n';
    const r = parseProductCsv(text);
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([
      { line: 2, data: { barcode: '893', name: 'Sữa', unit: 'cái', costPrice: 0, sellPrice: 15000, stock: 0, isWeighed: false, categoryName: null, minStock: 0 } },
      { line: 3, data: { barcode: null, name: 'Thịt heo', unit: 'cái', costPrice: 0, sellPrice: 120000, stock: 0, isWeighed: true, categoryName: null, minStock: 0 } },
    ]);
  });
  it('báo lỗi theo dòng, các dòng khác vẫn đọc', () => {
    const r = parseProductCsv('Tên,Giá bán\n,10\nBánh,abc\nKẹo,5000\n');
    expect(r.rows.map((x) => x.data.name)).toEqual(['Kẹo']);
    expect(r.errors.map((e) => e.line)).toEqual([2, 3]);
    expect(r.errors[0]?.message).toContain('Tên');
    expect(r.errors[1]?.message).toContain('Giá bán');
  });
  it('thiếu cột Tên thì lỗi toàn file', () => {
    const r = parseProductCsv('Ten;Gia\nSữa;1\n');
    expect(r.rows).toEqual([]);
    expect(r.errors).toEqual([{ line: 1, message: 'Không tìm thấy cột "Tên"' }]);
  });
  it('đi vòng với productToCsvRow', () => {
    const p = { barcode: '1', name: 'Kẹo, dẻo', unit: 'gói', costPrice: 3000, sellPrice: 5000, stock: 2.5, isWeighed: false, minStock: 1 };
    const text = toCsv([[...PRODUCT_CSV_HEADERS], productToCsvRow(p, 'Bánh kẹo')]);
    expect(parseProductCsv(text).rows[0]?.data).toEqual({ ...p, categoryName: 'Bánh kẹo' });
  });
});
```

- [ ] **Step 2: Chạy test, fail.**

- [ ] **Step 3: Implement**

`shared/src/schemas/common.ts`:
```ts
import { z } from 'zod';

/** Chuỗi tùy chọn: trim, rỗng → null. */
export const nullableText = (max: number) =>
  z.string().trim().max(max).nullish().transform((v) => (v ? v : null));

export const idParam = z.coerce.number().int().positive();

/** Nhãn tiếng Việt cho thông báo lỗi validate. */
export const FIELD_LABELS: Record<string, string> = {
  name: 'Tên',
  barcode: 'Mã vạch',
  unit: 'Đơn vị',
  costPrice: 'Giá nhập',
  sellPrice: 'Giá bán',
  stock: 'Tồn',
  isWeighed: 'Hàng cân',
  categoryId: 'Danh mục',
  minStock: 'Tồn tối thiểu',
  sortOrder: 'Thứ tự',
  factor: 'Hệ số quy đổi',
};
```

`shared/src/schemas/category.ts`:
```ts
import { z } from 'zod';
export const categoryInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  sortOrder: z.number().int().min(0).default(0),
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;
```

`shared/src/schemas/product.ts`:
```ts
import { z } from 'zod';
import { nullableText } from './common.js';

export const productInputSchema = z.object({
  barcode: nullableText(50),
  name: z.string().trim().min(1).max(200),
  unit: z.string().trim().min(1).max(20).default('cái'),
  costPrice: z.number().int().min(0).default(0),
  sellPrice: z.number().int().min(0).default(0),
  stock: z.number().min(0).default(0),
  isWeighed: z.boolean().default(false),
  categoryId: z.number().int().positive().nullish().transform((v) => v ?? null),
  minStock: z.number().min(0).default(0),
});
export type ProductInput = z.infer<typeof productInputSchema>;

const flag = z.enum(['1', '0', 'true', 'false']).optional().transform((v) => v === '1' || v === 'true');

export const productListQuerySchema = z.object({
  q: z.string().trim().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  includeInactive: flag,
});
export type ProductListQuery = z.infer<typeof productListQuerySchema>;
```

`shared/src/schemas/product-unit.ts`:
```ts
import { z } from 'zod';
import { nullableText } from './common.js';
export const productUnitInputSchema = z.object({
  name: z.string().trim().min(1).max(20),
  barcode: nullableText(50),
  factor: z.number().positive(),
  sellPrice: z.number().int().min(0),
});
export type ProductUnitInput = z.infer<typeof productUnitInputSchema>;
```

`shared/src/types.ts`:
```ts
export interface Category { id: number; name: string; sortOrder: number; productCount: number }
export interface Product {
  id: number; barcode: string | null; name: string; unit: string;
  costPrice: number; sellPrice: number; stock: number; isWeighed: boolean;
  categoryId: number | null; minStock: number; isActive: boolean;
  createdAt: string; updatedAt: string; categoryName: string | null;
}
export interface ProductUnit { id: number; productId: number; name: string; barcode: string | null; factor: number; sellPrice: number }
export interface ProductWithUnits extends Product { units: ProductUnit[] }
export interface BarcodeLookup { product: Product; unit: ProductUnit | null }
export interface CsvRowError { line: number; message: string }
export interface CsvImportResult { created: number; updated: number; errors: CsvRowError[] }
```

`shared/src/product-csv.ts`:
```ts
import { z } from 'zod';
import { parseCsv } from './csv.js';
import type { CsvRowError } from './types.js';

export const PRODUCT_CSV_HEADERS = ['Mã vạch', 'Tên', 'Đơn vị', 'Giá nhập', 'Giá bán', 'Tồn', 'Hàng cân', 'Danh mục', 'Tồn tối thiểu'] as const;
type Header = (typeof PRODUCT_CSV_HEADERS)[number];

export interface ProductCsvRow {
  barcode: string | null; name: string; unit: string; costPrice: number; sellPrice: number;
  stock: number; isWeighed: boolean; categoryName: string | null; minStock: number;
}

const emptyToNull = (s: string) => (s.trim() === '' ? null : s.trim());
const num = (label: string) =>
  z.string().trim().transform((s, ctx) => {
    if (s === '') return 0;
    const n = Number(s.replace(/\./g, '').replace(',', '.'));
    if (Number.isNaN(n)) ctx.addIssue({ code: 'custom', message: `${label} không phải là số` });
    return n;
  });
const money = (label: string) => num(label).pipe(z.number().int({ message: `${label} phải là số nguyên` }).min(0, { message: `${label} không được âm` }));
const qty = (label: string) => num(label).pipe(z.number().min(0, { message: `${label} không được âm` }));

const rowSchema = z.object({
  barcode: z.string().transform(emptyToNull),
  name: z.string().trim().min(1, { message: 'Tên không được trống' }),
  unit: z.string().trim().transform((s) => s || 'cái'),
  costPrice: money('Giá nhập'),
  sellPrice: money('Giá bán'),
  stock: qty('Tồn'),
  isWeighed: z.string().transform((s) => ['1', 'x', 'có', 'co', 'true', 'yes'].includes(s.trim().toLowerCase())),
  categoryName: z.string().transform(emptyToNull),
  minStock: qty('Tồn tối thiểu'),
});

const FIELD_BY_HEADER: Record<Header, keyof ProductCsvRow> = {
  'Mã vạch': 'barcode', 'Tên': 'name', 'Đơn vị': 'unit', 'Giá nhập': 'costPrice', 'Giá bán': 'sellPrice',
  'Tồn': 'stock', 'Hàng cân': 'isWeighed', 'Danh mục': 'categoryName', 'Tồn tối thiểu': 'minStock',
};

export function parseProductCsv(text: string): { rows: { line: number; data: ProductCsvRow }[]; errors: CsvRowError[] } {
  const table = parseCsv(text);
  const header = (table[0] ?? []).map((h) => h.trim().toLowerCase());
  const indexOf = (h: Header) => header.indexOf(h.toLowerCase());
  if (indexOf('Tên') < 0) return { rows: [], errors: [{ line: 1, message: 'Không tìm thấy cột "Tên"' }] };
  const rows: { line: number; data: ProductCsvRow }[] = [];
  const errors: CsvRowError[] = [];
  table.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const raw: Record<string, string> = {};
    for (const h of PRODUCT_CSV_HEADERS) {
      const idx = indexOf(h);
      raw[FIELD_BY_HEADER[h]] = idx >= 0 ? (cells[idx] ?? '') : '';
    }
    const r = rowSchema.safeParse(raw);
    if (r.success) rows.push({ line, data: r.data });
    else errors.push({ line, message: r.error.issues.map((x) => x.message).join('; ') });
  });
  return { rows, errors };
}

export function productToCsvRow(
  p: Pick<ProductCsvRow, 'barcode' | 'name' | 'unit' | 'costPrice' | 'sellPrice' | 'stock' | 'isWeighed' | 'minStock'>,
  categoryName: string | null,
): (string | number | boolean | null)[] {
  return [p.barcode, p.name, p.unit, p.costPrice, p.sellPrice, p.stock, p.isWeighed, categoryName, p.minStock];
}
```
Lưu ý: `parseCsv` không tách được `;`, nên file dùng `;` sẽ có 1 cột "ten;gia" → không có cột Tên → lỗi toàn file (đúng Review Focus 2).

`shared/src/index.ts`:
```ts
export * from './money.js';
export * from './csv.js';
export * from './types.js';
export * from './schemas/common.js';
export * from './schemas/category.js';
export * from './schemas/product.js';
export * from './schemas/product-unit.js';
export * from './product-csv.js';
```

- [ ] **Step 4: Test pass** `npm test -w shared`; `npm run build -w shared`.
- [ ] **Step 5: Commit** `feat(shared): zod schema, types, CSV sản phẩm`

---

### Task 5: `server` – schema Drizzle, kết nối, migration

**Files:**
- Create: `server/drizzle.config.ts`, `server/src/db/schema.ts`, `server/src/db/connection.ts`, `server/src/db/test-db.ts`, `server/src/db/connection.test.ts`, `server/drizzle/*` (sinh bởi drizzle-kit)

**Interfaces:**
- Produces: `createDb(file: string): Db`, `type Db`, `type DbOrTx`, `createTestDb(): Db`, các bảng export từ `schema.ts`.

- [ ] **Step 1: Viết test**

`server/src/db/connection.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createTestDb } from './test-db.js';
import { sql } from 'drizzle-orm';

describe('migration', () => {
  it('tạo đủ 12 bảng và bật foreign_keys', () => {
    const db = createTestDb();
    const rows = db.all<{ name: string }>(sql`select name from sqlite_master where type='table' and name not like '\_\_%' escape '\' order by name`);
    expect(rows.map((r) => r.name)).toEqual([
      'categories', 'customers', 'debt_transactions', 'import_items', 'imports', 'order_items', 'orders',
      'product_units', 'products', 'settings', 'stock_movements',
    ]);
    expect(db.get<{ foreign_keys: number }>(sql`pragma foreign_keys`)?.foreign_keys).toBe(1);
  });
});
```
(11 bảng nghiệp vụ + `__drizzle_migrations` = 12 bảng trong file.)

- [ ] **Step 2: Viết schema** — `server/src/db/schema.ts` đúng như mục 5 của spec, với `const isoNow = sql\`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))\`` dùng cho mọi `created_at`/`updated_at` thay cho `CURRENT_TIMESTAMP`. Khai báo theo thứ tự: categories, products, productUnits, customers, orders, debtTransactions, orderItems, imports, importItems, stockMovements, settings.

- [ ] **Step 3: `server/drizzle.config.ts`**
```ts
import { defineConfig } from 'drizzle-kit';
export default defineConfig({ dialect: 'sqlite', schema: './src/db/schema.ts', out: './drizzle' });
```
Run: `npm run db:generate -w server` → sinh `server/drizzle/0000_*.sql` + `meta/`. Mở file SQL kiểm tra có 11 `CREATE TABLE` và các index.

- [ ] **Step 4: `connection.ts` và `test-db.ts`**
```ts
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from './schema.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(here, '../../drizzle');

export type Db = BetterSQLite3Database<typeof schema>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
export type DbOrTx = Db | Tx;

/** Mở (hoặc tạo) file SQLite, bật WAL + foreign keys, chạy migration còn thiếu. */
export function createDb(file: string): Db {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder });
  return db;
}
```
`test-db.ts`: `export function createTestDb(): Db { return createDb(':memory:'); }`

- [ ] **Step 5: Test pass** `npm test -w server`. - [ ] **Step 6: Commit** `feat(server): schema Drizzle và migration đầu tiên`

---

### Task 6: `server` – lỗi HTTP, movement tồn kho, service danh mục

**Files:**
- Create: `server/src/errors.ts`, `server/src/services/stock.ts`, `server/src/services/categories.ts`, `server/src/services/categories.test.ts`, `server/src/services/stock.test.ts`

**Interfaces:**
- Produces: `HttpError(status, message)`, `NotFoundError(message?)`, `ConflictError(message)`; `recordMovement(tx, { productId, qty, type, refId?, note? })`, `adjustStockTo(tx, productId, target, note)`; `listCategories(db)`, `createCategory(db, input)`, `updateCategory(db, id, input)`, `deleteCategory(db, id)`.

- [ ] **Step 1: Viết test**

`server/src/services/categories.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../db/test-db.js';
import type { Db } from '../db/connection.js';
import { createCategory, deleteCategory, listCategories, updateCategory } from './categories.js';
import { products } from '../db/schema.js';
import { eq } from 'drizzle-orm';

let db: Db;
beforeEach(() => { db = createTestDb(); });

describe('categories', () => {
  it('tạo, liệt kê theo sortOrder rồi tên, đếm sản phẩm đang bán', () => {
    const b = createCategory(db, { name: 'Bánh kẹo', sortOrder: 2 });
    const a = createCategory(db, { name: 'Đồ uống', sortOrder: 1 });
    db.insert(products).values([{ name: 'Coca', categoryId: a.id }, { name: 'Pepsi cũ', categoryId: a.id, isActive: false }]).run();
    expect(listCategories(db)).toEqual([
      { id: a.id, name: 'Đồ uống', sortOrder: 1, productCount: 1 },
      { id: b.id, name: 'Bánh kẹo', sortOrder: 2, productCount: 0 },
    ]);
  });
  it('sửa và báo 404 khi không có', () => {
    const c = createCategory(db, { name: 'A', sortOrder: 0 });
    expect(updateCategory(db, c.id, { name: 'B', sortOrder: 5 })).toMatchObject({ name: 'B', sortOrder: 5 });
    expect(() => updateCategory(db, 999, { name: 'B', sortOrder: 0 })).toThrow('Không tìm thấy danh mục');
  });
  it('xóa danh mục thì sản phẩm về không danh mục', () => {
    const c = createCategory(db, { name: 'A', sortOrder: 0 });
    const [p] = db.insert(products).values({ name: 'X', categoryId: c.id }).returning().all();
    deleteCategory(db, c.id);
    expect(db.select().from(products).where(eq(products.id, p!.id)).get()?.categoryId).toBeNull();
    expect(() => deleteCategory(db, c.id)).toThrow('Không tìm thấy danh mục');
  });
});
```

`server/src/services/stock.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../db/test-db.js';
import type { Db } from '../db/connection.js';
import { products, stockMovements } from '../db/schema.js';
import { adjustStockTo, recordMovement } from './stock.js';

let db: Db;
let pid: number;
beforeEach(() => {
  db = createTestDb();
  pid = db.insert(products).values({ name: 'X', stock: 10 }).returning().get()!.id;
});

describe('stock', () => {
  it('recordMovement cộng vào tồn và ghi dòng movement', () => {
    recordMovement(db, { productId: pid, qty: -3, type: 'sale', refId: 7 });
    expect(db.select().from(products).get()?.stock).toBe(7);
    expect(db.select().from(stockMovements).all()).toMatchObject([{ productId: pid, qty: -3, type: 'sale', refId: 7 }]);
  });
  it('adjustStockTo ghi chênh lệch, không ghi gì khi bằng nhau', () => {
    adjustStockTo(db, pid, 12.5, 'Sửa thủ công');
    adjustStockTo(db, pid, 12.5, 'Sửa thủ công');
    expect(db.select().from(products).get()?.stock).toBe(12.5);
    expect(db.select().from(stockMovements).all()).toMatchObject([{ qty: 2.5, type: 'adjust', note: 'Sửa thủ công' }]);
  });
});
```

- [ ] **Step 2: Chạy test, fail.**

- [ ] **Step 3: Implement**

`server/src/errors.ts`:
```ts
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export class NotFoundError extends HttpError {
  constructor(message = 'Không tìm thấy') { super(404, message); }
}
export class ConflictError extends HttpError {
  constructor(message: string) { super(409, message); }
}
```

`server/src/services/stock.ts`:
```ts
import { eq, sql } from 'drizzle-orm';
import type { DbOrTx } from '../db/connection.js';
import { products, stockMovements } from '../db/schema.js';
import { NotFoundError } from '../errors.js';

export type MovementType = 'sale' | 'import' | 'return' | 'adjust';

/** Cách DUY NHẤT để đổi tồn kho: ghi movement rồi cộng dồn vào products.stock. */
export function recordMovement(tx: DbOrTx, m: { productId: number; qty: number; type: MovementType; refId?: number | null; note?: string | null }): void {
  tx.insert(stockMovements).values({ productId: m.productId, qty: m.qty, type: m.type, refId: m.refId ?? null, note: m.note ?? null }).run();
  tx.update(products).set({ stock: sql`${products.stock} + ${m.qty}` }).where(eq(products.id, m.productId)).run();
}

/** Đưa tồn về đúng `target` bằng 1 movement adjust (kiểm kê, sửa tay). */
export function adjustStockTo(tx: DbOrTx, productId: number, target: number, note: string): void {
  const row = tx.select({ stock: products.stock }).from(products).where(eq(products.id, productId)).get();
  if (!row) throw new NotFoundError('Không tìm thấy sản phẩm');
  const diff = target - row.stock;
  if (Math.abs(diff) < 1e-9) return;
  recordMovement(tx, { productId, qty: diff, type: 'adjust', note });
}
```

`server/src/services/categories.ts`:
```ts
import { and, asc, eq, sql } from 'drizzle-orm';
import type { Category, CategoryInput } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { categories, products } from '../db/schema.js';
import { NotFoundError } from '../errors.js';

export function listCategories(db: Db): Category[] {
  return db
    .select({ id: categories.id, name: categories.name, sortOrder: categories.sortOrder, productCount: sql<number>`count(${products.id})` })
    .from(categories)
    .leftJoin(products, and(eq(products.categoryId, categories.id), eq(products.isActive, true)))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.name))
    .all();
}

export function createCategory(db: Db, input: CategoryInput): Category {
  const row = db.insert(categories).values(input).returning().get();
  return { ...row, productCount: 0 };
}

export function updateCategory(db: Db, id: number, input: CategoryInput): Category {
  const row = db.update(categories).set(input).where(eq(categories.id, id)).returning().get();
  if (!row) throw new NotFoundError('Không tìm thấy danh mục');
  return listCategories(db).find((c) => c.id === id) ?? { ...row, productCount: 0 };
}

export function deleteCategory(db: Db, id: number): void {
  const row = db.delete(categories).where(eq(categories.id, id)).returning().get();
  if (!row) throw new NotFoundError('Không tìm thấy danh mục');
}
```

- [ ] **Step 4: Test pass.** - [ ] **Step 5: Commit** `feat(server): service danh mục và movement tồn kho`

---

### Task 7: `server` – service sản phẩm

**Files:**
- Create: `server/src/services/products.ts`, `server/src/services/products.test.ts`

**Interfaces:**
- Produces: `listProducts(db, query: ProductListQuery): Product[]`, `getProduct(db, id): ProductWithUnits`, `createProduct(db, input: ProductInput): ProductWithUnits`, `updateProduct(db, id, input): ProductWithUnits`, `setProductActive(db, id, active): Product`, `findProductByBarcode(db, code): BarcodeLookup` (tìm cả unit — hoàn thiện ở Task 8).

- [ ] **Step 1: Viết test**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../db/test-db.js';
import type { Db } from '../db/connection.js';
import { stockMovements } from '../db/schema.js';
import { createCategory } from './categories.js';
import { createProduct, getProduct, listProducts, setProductActive, updateProduct } from './products.js';
import { productInputSchema } from '@tiny-pos/shared';

const input = (o: Record<string, unknown>) => productInputSchema.parse(o);
let db: Db;
beforeEach(() => { db = createTestDb(); });

describe('products', () => {
  it('tạo với tồn đầu → 1 movement adjust "Tồn đầu"', () => {
    const p = createProduct(db, input({ name: 'Sữa', barcode: '893', sellPrice: 15000, stock: 20 }));
    expect(p).toMatchObject({ name: 'Sữa', barcode: '893', stock: 20, units: [], categoryName: null });
    expect(db.select().from(stockMovements).all()).toMatchObject([{ productId: p.id, qty: 20, type: 'adjust', note: 'Tồn đầu' }]);
  });
  it('tạo với tồn 0 → không có movement', () => {
    createProduct(db, input({ name: 'A' }));
    expect(db.select().from(stockMovements).all()).toEqual([]);
  });
  it('sửa tồn → movement chênh lệch "Sửa thủ công"; sửa mà tồn không đổi → không thêm', () => {
    const p = createProduct(db, input({ name: 'A', stock: 5 }));
    updateProduct(db, p.id, input({ name: 'A', stock: 3 }));
    updateProduct(db, p.id, input({ name: 'B', stock: 3 }));
    expect(getProduct(db, p.id)).toMatchObject({ name: 'B', stock: 3 });
    expect(db.select().from(stockMovements).all().map((m) => [m.qty, m.note])).toEqual([[5, 'Tồn đầu'], [-2, 'Sửa thủ công']]);
  });
  it('trùng barcode → lỗi 409', () => {
    createProduct(db, input({ name: 'A', barcode: '1' }));
    expect(() => createProduct(db, input({ name: 'B', barcode: '1' }))).toThrow('Mã vạch đã tồn tại');
    const p2 = createProduct(db, input({ name: 'C', barcode: '2' }));
    expect(() => updateProduct(db, p2.id, input({ name: 'C', barcode: '1' }))).toThrow('Mã vạch đã tồn tại');
  });
  it('liệt kê: lọc q theo tên/mã, theo danh mục, ẩn ngừng bán, kèm tên danh mục', () => {
    const c = createCategory(db, { name: 'Đồ uống', sortOrder: 0 });
    createProduct(db, input({ name: 'Coca', barcode: '111', categoryId: c.id }));
    createProduct(db, input({ name: 'Pepsi', barcode: '222', categoryId: c.id }));
    const old = createProduct(db, input({ name: 'Bánh', barcode: '333' }));
    setProductActive(db, old.id, false);
    expect(listProducts(db, { includeInactive: false }).map((p) => p.name)).toEqual(['Coca', 'Pepsi']);
    expect(listProducts(db, { includeInactive: true }).map((p) => p.name)).toEqual(['Bánh', 'Coca', 'Pepsi']);
    expect(listProducts(db, { q: '22', includeInactive: false }).map((p) => p.name)).toEqual(['Pepsi']);
    expect(listProducts(db, { q: 'coc', includeInactive: false })[0]).toMatchObject({ name: 'Coca', categoryName: 'Đồ uống' });
    expect(listProducts(db, { categoryId: c.id, includeInactive: false })).toHaveLength(2);
  });
  it('getProduct 404', () => {
    expect(() => getProduct(db, 42)).toThrow('Không tìm thấy sản phẩm');
  });
});
```

- [ ] **Step 2: Chạy test, fail.**

- [ ] **Step 3: Implement**

```ts
import { and, asc, eq, getTableColumns, like, or, sql } from 'drizzle-orm';
import type { BarcodeLookup, Product, ProductInput, ProductListQuery, ProductWithUnits } from '@tiny-pos/shared';
import type { Db, DbOrTx } from '../db/connection.js';
import { categories, productUnits, products } from '../db/schema.js';
import { ConflictError, NotFoundError } from '../errors.js';
import { adjustStockTo } from './stock.js';

const productColumns = { ...getTableColumns(products), categoryName: categories.name };

function selectProducts(tx: DbOrTx) {
  return tx.select(productColumns).from(products).leftJoin(categories, eq(products.categoryId, categories.id));
}

export function listProducts(db: Db, query: ProductListQuery): Product[] {
  const q = query.q ? `%${query.q}%` : undefined;
  return selectProducts(db)
    .where(and(
      query.includeInactive ? undefined : eq(products.isActive, true),
      query.categoryId ? eq(products.categoryId, query.categoryId) : undefined,
      q ? or(like(products.name, q), like(products.barcode, q)) : undefined,
    ))
    .orderBy(asc(products.name))
    .all();
}

function getProductRow(tx: DbOrTx, id: number): Product {
  const row = selectProducts(tx).where(eq(products.id, id)).get();
  if (!row) throw new NotFoundError('Không tìm thấy sản phẩm');
  return row;
}

export function getProduct(db: DbOrTx, id: number): ProductWithUnits {
  const product = getProductRow(db, id);
  const units = db.select().from(productUnits).where(eq(productUnits.productId, id)).orderBy(asc(productUnits.factor)).all();
  return { ...product, units };
}

/** Mã vạch phải duy nhất trên cả products lẫn product_units. */
export function assertBarcodeFree(tx: DbOrTx, barcode: string | null, opts: { productId?: number; unitId?: number } = {}): void {
  if (!barcode) return;
  const p = tx.select({ id: products.id }).from(products).where(eq(products.barcode, barcode)).get();
  if (p && p.id !== opts.productId) throw new ConflictError('Mã vạch đã tồn tại');
  const u = tx.select({ id: productUnits.id }).from(productUnits).where(eq(productUnits.barcode, barcode)).get();
  if (u && u.id !== opts.unitId) throw new ConflictError('Mã vạch đã tồn tại');
}

export function createProduct(db: Db, input: ProductInput): ProductWithUnits {
  return db.transaction((tx) => {
    assertBarcodeFree(tx, input.barcode);
    const { stock, ...rest } = input;
    const row = tx.insert(products).values(rest).returning({ id: products.id }).get();
    if (stock > 0) adjustStockTo(tx, row.id, stock, 'Tồn đầu');
    return getProduct(tx, row.id);
  });
}

export function updateProduct(db: Db, id: number, input: ProductInput): ProductWithUnits {
  return db.transaction((tx) => {
    getProductRow(tx, id);
    assertBarcodeFree(tx, input.barcode, { productId: id });
    const { stock, ...rest } = input;
    tx.update(products).set({ ...rest, updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))` }).where(eq(products.id, id)).run();
    adjustStockTo(tx, id, stock, 'Sửa thủ công');
    return getProduct(tx, id);
  });
}

export function setProductActive(db: Db, id: number, active: boolean): Product {
  const row = db.update(products).set({ isActive: active }).where(eq(products.id, id)).returning({ id: products.id }).get();
  if (!row) throw new NotFoundError('Không tìm thấy sản phẩm');
  return getProductRow(db, id);
}

export function findProductByBarcode(db: Db, code: string): BarcodeLookup {
  const direct = selectProducts(db).where(eq(products.barcode, code)).get();
  if (direct) return { product: direct, unit: null };
  const unit = db.select().from(productUnits).where(eq(productUnits.barcode, code)).get();
  if (!unit) throw new NotFoundError('Không tìm thấy mã vạch');
  return { product: getProductRow(db, unit.productId), unit };
}
```

- [ ] **Step 4: Test pass.** - [ ] **Step 5: Commit** `feat(server): service sản phẩm`

---

### Task 8: `server` – service đơn vị quy đổi

**Files:**
- Create: `server/src/services/product-units.ts`, `server/src/services/product-units.test.ts`

**Interfaces:**
- Produces: `createUnit(db, productId, input: ProductUnitInput): ProductUnit`, `updateUnit(db, productId, unitId, input): ProductUnit`, `deleteUnit(db, productId, unitId): void`.

- [ ] **Step 1: Viết test**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../db/test-db.js';
import type { Db } from '../db/connection.js';
import { createProduct, findProductByBarcode, getProduct } from './products.js';
import { createUnit, deleteUnit, updateUnit } from './product-units.js';
import { productInputSchema } from '@tiny-pos/shared';

let db: Db;
let pid: number;
beforeEach(() => {
  db = createTestDb();
  pid = createProduct(db, productInputSchema.parse({ name: 'Coca lon', barcode: '100', sellPrice: 10000 })).id;
});

describe('product units', () => {
  it('thêm/sửa/xóa đơn vị và by-barcode nhận ra mã thùng', () => {
    const u = createUnit(db, pid, { name: 'Thùng', barcode: '100T', factor: 24, sellPrice: 230000 });
    expect(getProduct(db, pid).units).toEqual([u]);
    expect(findProductByBarcode(db, '100T')).toMatchObject({ product: { id: pid }, unit: { id: u.id, factor: 24 } });
    expect(findProductByBarcode(db, '100')).toMatchObject({ product: { id: pid }, unit: null });
    expect(updateUnit(db, pid, u.id, { name: 'Thùng', barcode: '100T', factor: 12, sellPrice: 115000 })).toMatchObject({ factor: 12 });
    deleteUnit(db, pid, u.id);
    expect(getProduct(db, pid).units).toEqual([]);
    expect(() => deleteUnit(db, pid, u.id)).toThrow('Không tìm thấy đơn vị');
  });
  it('mã đơn vị trùng mã sản phẩm khác hoặc ngược lại → 409', () => {
    expect(() => createUnit(db, pid, { name: 'Lốc', barcode: '100', factor: 6, sellPrice: 60000 })).toThrow('Mã vạch đã tồn tại');
    createUnit(db, pid, { name: 'Lốc', barcode: '100L', factor: 6, sellPrice: 60000 });
    expect(() => createProduct(db, productInputSchema.parse({ name: 'X', barcode: '100L' }))).toThrow('Mã vạch đã tồn tại');
  });
  it('sản phẩm không tồn tại → 404', () => {
    expect(() => createUnit(db, 999, { name: 'Lốc', barcode: null, factor: 6, sellPrice: 1 })).toThrow('Không tìm thấy sản phẩm');
  });
});
```

- [ ] **Step 2: Fail.** - [ ] **Step 3: Implement**

```ts
import { and, eq } from 'drizzle-orm';
import type { ProductUnit, ProductUnitInput } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { productUnits, products } from '../db/schema.js';
import { NotFoundError } from '../errors.js';
import { assertBarcodeFree } from './products.js';

function assertProduct(db: Db, productId: number): void {
  if (!db.select({ id: products.id }).from(products).where(eq(products.id, productId)).get()) throw new NotFoundError('Không tìm thấy sản phẩm');
}

export function createUnit(db: Db, productId: number, input: ProductUnitInput): ProductUnit {
  return db.transaction((tx) => {
    assertProduct(tx as unknown as Db, productId);
    assertBarcodeFree(tx, input.barcode);
    return tx.insert(productUnits).values({ ...input, productId }).returning().get();
  });
}

export function updateUnit(db: Db, productId: number, unitId: number, input: ProductUnitInput): ProductUnit {
  return db.transaction((tx) => {
    assertBarcodeFree(tx, input.barcode, { unitId });
    const row = tx.update(productUnits).set(input).where(and(eq(productUnits.id, unitId), eq(productUnits.productId, productId))).returning().get();
    if (!row) throw new NotFoundError('Không tìm thấy đơn vị');
    return row;
  });
}

export function deleteUnit(db: Db, productId: number, unitId: number): void {
  const row = db.delete(productUnits).where(and(eq(productUnits.id, unitId), eq(productUnits.productId, productId))).returning().get();
  if (!row) throw new NotFoundError('Không tìm thấy đơn vị');
}
```
(`assertProduct` nhận `DbOrTx` — sửa chữ ký thành `DbOrTx` thay vì ép kiểu.)

- [ ] **Step 4: Pass.** - [ ] **Step 5: Commit** `feat(server): đơn vị quy đổi`

---

### Task 9: `server` – nhập/xuất CSV

**Files:**
- Create: `server/src/services/product-csv.ts`, `server/src/services/product-csv.test.ts`

**Interfaces:**
- Produces: `exportProductsCsv(db): string` (có BOM), `importProductsCsv(db, text): CsvImportResult`.

- [ ] **Step 1: Viết test**

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../db/test-db.js';
import type { Db } from '../db/connection.js';
import { stockMovements } from '../db/schema.js';
import { createProduct, listProducts } from './products.js';
import { listCategories } from './categories.js';
import { exportProductsCsv, importProductsCsv } from './product-csv.js';
import { productInputSchema } from '@tiny-pos/shared';

let db: Db;
beforeEach(() => { db = createTestDb(); });
const H = 'Mã vạch,Tên,Đơn vị,Giá nhập,Giá bán,Tồn,Hàng cân,Danh mục,Tồn tối thiểu\n';

describe('importProductsCsv', () => {
  it('tạo mới kèm tồn, tự tạo danh mục theo tên (không phân biệt hoa thường)', () => {
    const r = importProductsCsv(db, H + '1,Sữa,hộp,10000,15000,20,0,Đồ Uống,5\n2,Thịt,kg,0,120000,0,1,đồ uống,0\n');
    expect(r).toEqual({ created: 2, updated: 0, errors: [] });
    expect(listCategories(db)).toMatchObject([{ name: 'Đồ Uống', productCount: 2 }]);
    expect(listProducts(db, { includeInactive: false })).toMatchObject([
      { name: 'Sữa', unit: 'hộp', stock: 20, categoryName: 'Đồ Uống', minStock: 5 },
      { name: 'Thịt', isWeighed: true, stock: 0 },
    ]);
    expect(db.select().from(stockMovements).all()).toMatchObject([{ qty: 20, type: 'adjust', note: 'Nhập CSV' }]);
  });
  it('trùng barcode → cập nhật, bỏ qua cột Tồn', () => {
    createProduct(db, productInputSchema.parse({ name: 'Cũ', barcode: '1', stock: 7 }));
    const r = importProductsCsv(db, H + '1,Mới,cái,1,2,99,0,,0\n');
    expect(r).toMatchObject({ created: 0, updated: 1 });
    expect(listProducts(db, { includeInactive: false })[0]).toMatchObject({ name: 'Mới', sellPrice: 2, stock: 7 });
    expect(db.select().from(stockMovements).all()).toHaveLength(1);
  });
  it('hai dòng cùng mã mới trong file: dòng sau cập nhật dòng trước', () => {
    const r = importProductsCsv(db, H + '9,A,cái,0,1,5,0,,0\n9,B,cái,0,2,50,0,,0\n');
    expect(r).toMatchObject({ created: 1, updated: 1 });
    expect(listProducts(db, { includeInactive: false })).toMatchObject([{ name: 'B', sellPrice: 2, stock: 5 }]);
  });
  it('dòng lỗi được báo, dòng khác vẫn nhập', () => {
    const r = importProductsCsv(db, H + ',Không tên,cái,0,1,0,0,,0\n3,OK,cái,0,1,0,0,,0\n');
    expect(r.created).toBe(1);
    expect(r.errors).toEqual([{ line: 2, message: 'Tên không được trống' }]);
  });
});

describe('exportProductsCsv', () => {
  it('có BOM, tiêu đề tiếng Việt, chỉ hàng đang bán, nhập lại được', () => {
    createProduct(db, productInputSchema.parse({ name: 'Kẹo, dẻo', barcode: '5', sellPrice: 5000, stock: 3 }));
    const text = exportProductsCsv(db);
    expect(text.startsWith('﻿Mã vạch,Tên,')).toBe(true);
    expect(text).toContain('5,"Kẹo, dẻo",cái,0,5000,3,0,,0');
    const db2 = createTestDb();
    expect(importProductsCsv(db2, text)).toEqual({ created: 1, updated: 0, errors: [] });
  });
});
```

- [ ] **Step 2: Fail.** - [ ] **Step 3: Implement**

```ts
import { eq, sql } from 'drizzle-orm';
import { PRODUCT_CSV_HEADERS, parseProductCsv, productToCsvRow, toCsv, type CsvImportResult, type ProductCsvRow } from '@tiny-pos/shared';
import type { Db, DbOrTx } from '../db/connection.js';
import { categories, products } from '../db/schema.js';
import { listProducts } from './products.js';
import { adjustStockTo } from './stock.js';

export function exportProductsCsv(db: Db): string {
  const rows = listProducts(db, { includeInactive: false }).map((p) => productToCsvRow(p, p.categoryName));
  return '﻿' + toCsv([[...PRODUCT_CSV_HEADERS], ...rows]);
}

function findOrCreateCategory(tx: DbOrTx, cache: Map<string, number>, name: string): number {
  const key = name.toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;
  const found = tx.select({ id: categories.id }).from(categories).where(sql`lower(${categories.name}) = ${key}`).get();
  const id = found?.id ?? tx.insert(categories).values({ name }).returning({ id: categories.id }).get().id;
  cache.set(key, id);
  return id;
}

function upsertRow(tx: DbOrTx, cache: Map<string, number>, row: ProductCsvRow): 'created' | 'updated' {
  const categoryId = row.categoryName ? findOrCreateCategory(tx, cache, row.categoryName) : null;
  const fields = { name: row.name, unit: row.unit, costPrice: row.costPrice, sellPrice: row.sellPrice, isWeighed: row.isWeighed, categoryId, minStock: row.minStock };
  const existing = row.barcode ? tx.select({ id: products.id }).from(products).where(eq(products.barcode, row.barcode)).get() : undefined;
  if (existing) {
    tx.update(products).set({ ...fields, updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))` }).where(eq(products.id, existing.id)).run();
    return 'updated';
  }
  const created = tx.insert(products).values({ ...fields, barcode: row.barcode }).returning({ id: products.id }).get();
  if (row.stock > 0) adjustStockTo(tx, created.id, row.stock, 'Nhập CSV');
  return 'created';
}

/** Nhập CSV trong 1 transaction. Lỗi từng dòng (parse) được trả về; lỗi hệ thống → rollback. */
export function importProductsCsv(db: Db, text: string): CsvImportResult {
  const { rows, errors } = parseProductCsv(text);
  return db.transaction((tx) => {
    const cache = new Map<string, number>();
    let created = 0;
    let updated = 0;
    for (const { data } of rows) {
      if (upsertRow(tx, cache, data) === 'created') created++;
      else updated++;
    }
    return { created, updated, errors };
  });
}
```

- [ ] **Step 4: Pass.** - [ ] **Step 5: Commit** `feat(server): nhập/xuất CSV sản phẩm`

---

### Task 10: `server` – Express app, middleware, routes

**Files:**
- Create: `server/src/middleware/validate.ts`, `server/src/middleware/error.ts`, `server/src/routes/categories.ts`, `server/src/routes/products.ts`, `server/src/routes/index.ts`, `server/src/app.ts`, `server/src/routes/api.test.ts`
- Modify: `server/src/index.ts`

**Interfaces:**
- Produces: `createApp(db, opts?: { clientDist?: string }): Express`; server lắng nghe `PORT` (mặc định 3000) trên `0.0.0.0`, DB tại `DB_FILE` hoặc `<repo>/data/grocery.db`.

- [ ] **Step 1: Viết test API**

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

const call = async (method: string, path: string, body?: unknown, contentType = 'application/json') => {
  const res = await fetch(base + path, { method, headers: body !== undefined ? { 'content-type': contentType } : {}, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null, headers: res.headers };
};

describe('API', () => {
  it('CRUD danh mục và sản phẩm, by-barcode, đơn vị, soft delete', async () => {
    const cat = await call('POST', '/api/categories', { name: 'Đồ uống' });
    expect(cat.status).toBe(201);
    const p = await call('POST', '/api/products', { name: 'Coca', barcode: '1', sellPrice: 10000, stock: 5, categoryId: cat.json.id });
    expect(p.status).toBe(201);
    expect(p.json).toMatchObject({ name: 'Coca', stock: 5, categoryName: 'Đồ uống', units: [] });
    const u = await call('POST', `/api/products/${p.json.id}/units`, { name: 'Thùng', barcode: '1T', factor: 24, sellPrice: 230000 });
    expect(u.status).toBe(201);
    expect((await call('GET', '/api/products/by-barcode/1T')).json).toMatchObject({ product: { id: p.json.id }, unit: { factor: 24 } });
    expect((await call('GET', '/api/products/by-barcode/zzz')).status).toBe(404);
    expect((await call('GET', '/api/products?q=coc')).json).toHaveLength(1);
    expect((await call('DELETE', `/api/products/${p.json.id}`)).status).toBe(204);
    expect((await call('GET', '/api/products')).json).toHaveLength(0);
    expect((await call('POST', `/api/products/${p.json.id}/restore`)).json.isActive).toBe(true);
    expect((await call('GET', '/api/categories')).json).toMatchObject([{ productCount: 1 }]);
  });
  it('lỗi validate 400 có nhãn tiếng Việt, 409 trùng mã, 404 route lạ', async () => {
    const bad = await call('POST', '/api/products', { name: 'X', sellPrice: '15000' });
    expect(bad.status).toBe(400);
    expect(bad.json.error).toContain('Giá bán');
    await call('POST', '/api/products', { name: 'A', barcode: 'dup' });
    expect(await call('POST', '/api/products', { name: 'B', barcode: 'dup' })).toMatchObject({ status: 409, json: { error: 'Mã vạch đã tồn tại' } });
    expect((await call('GET', '/api/nope')).status).toBe(404);
    expect((await call('GET', '/api/products/abc')).status).toBe(400);
  });
  it('xuất và nhập CSV', async () => {
    const exp = await call('GET', '/api/products/csv');
    expect(exp.headers.get('content-type')).toContain('text/csv');
    expect(exp.headers.get('content-disposition')).toContain('san-pham-');
    const imp = await call('POST', '/api/products/csv', 'Tên,Giá bán\nKẹo,5000\n', 'text/csv');
    expect(imp.json).toEqual({ created: 1, updated: 0, errors: [] });
  });
});
```

- [ ] **Step 2: Fail.** - [ ] **Step 3: Implement**

`server/src/middleware/validate.ts`:
```ts
import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { HttpError } from '../errors.js';
import { formatZodError } from './error.js';

/** Parse `req.body` bằng schema; thay body bằng dữ liệu đã chuẩn hóa. */
export function validateBody(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const r = schema.safeParse(req.body);
    if (!r.success) return next(new HttpError(400, formatZodError(r.error)));
    req.body = r.data;
    next();
  };
}

export function validateQuery(schema: ZodType): RequestHandler {
  return (req, res, next) => {
    const r = schema.safeParse(req.query);
    if (!r.success) return next(new HttpError(400, formatZodError(r.error)));
    res.locals['query'] = r.data;
    next();
  };
}

/** Đọc tham số :id dạng số nguyên dương, 400 nếu sai. */
export function intParam(req: { params: Record<string, string | undefined> }, name: string): number {
  const n = Number(req.params[name]);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `Tham số ${name} không hợp lệ`);
  return n;
}
```

`server/src/middleware/error.ts`:
```ts
import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { FIELD_LABELS } from '@tiny-pos/shared';
import { HttpError } from '../errors.js';

export function formatZodError(err: ZodError): string {
  return err.issues
    .map((i) => {
      const field = i.path.map(String).join('.');
      const label = FIELD_LABELS[field] ?? field;
      return label ? `${label}: ${i.message}` : i.message;
    })
    .join('; ');
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) return void res.status(err.status).json({ error: err.message });
  if (err instanceof ZodError) return void res.status(400).json({ error: formatZodError(err) });
  const code = (err as { code?: string })?.code;
  if (code === 'SQLITE_CONSTRAINT_UNIQUE') return void res.status(409).json({ error: 'Mã vạch đã tồn tại' });
  if (code === 'SQLITE_CONSTRAINT_FOREIGNKEY') return void res.status(409).json({ error: 'Dữ liệu đang được sử dụng, không thể xóa' });
  if (err instanceof SyntaxError && 'body' in err) return void res.status(400).json({ error: 'JSON không hợp lệ' });
  console.error(err);
  res.status(500).json({ error: 'Lỗi hệ thống' });
};
```

`server/src/routes/categories.ts`:
```ts
import { Router } from 'express';
import { categoryInputSchema } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { intParam, validateBody } from '../middleware/validate.js';
import { createCategory, deleteCategory, listCategories, updateCategory } from '../services/categories.js';

export function categoriesRouter(db: Db): Router {
  const r = Router();
  r.get('/', (_req, res) => res.json(listCategories(db)));
  r.post('/', validateBody(categoryInputSchema), (req, res) => res.status(201).json(createCategory(db, req.body)));
  r.put('/:id', validateBody(categoryInputSchema), (req, res) => res.json(updateCategory(db, intParam(req, 'id'), req.body)));
  r.delete('/:id', (req, res) => { deleteCategory(db, intParam(req, 'id')); res.status(204).end(); });
  return r;
}
```

`server/src/routes/products.ts`:
```ts
import express, { Router } from 'express';
import { productInputSchema, productListQuerySchema, productUnitInputSchema, type ProductListQuery } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { intParam, validateBody, validateQuery } from '../middleware/validate.js';
import { exportProductsCsv, importProductsCsv } from '../services/product-csv.js';
import { createUnit, deleteUnit, updateUnit } from '../services/product-units.js';
import { createProduct, findProductByBarcode, getProduct, listProducts, setProductActive, updateProduct } from '../services/products.js';

export function productsRouter(db: Db): Router {
  const r = Router();
  // Các route tĩnh phải đứng trước /:id
  r.get('/csv', (_req, res) => {
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="san-pham-${date}.csv"`);
    res.send(exportProductsCsv(db));
  });
  r.post('/csv', express.text({ type: ['text/csv', 'text/plain'], limit: '10mb' }), (req, res) => {
    res.json(importProductsCsv(db, typeof req.body === 'string' ? req.body : ''));
  });
  r.get('/by-barcode/:code', (req, res) => res.json(findProductByBarcode(db, String(req.params['code']))));
  r.get('/', validateQuery(productListQuerySchema), (_req, res) => res.json(listProducts(db, res.locals['query'] as ProductListQuery)));
  r.get('/:id', (req, res) => res.json(getProduct(db, intParam(req, 'id'))));
  r.post('/', validateBody(productInputSchema), (req, res) => res.status(201).json(createProduct(db, req.body)));
  r.put('/:id', validateBody(productInputSchema), (req, res) => res.json(updateProduct(db, intParam(req, 'id'), req.body)));
  r.delete('/:id', (req, res) => { setProductActive(db, intParam(req, 'id'), false); res.status(204).end(); });
  r.post('/:id/restore', (req, res) => res.json(setProductActive(db, intParam(req, 'id'), true)));
  r.post('/:id/units', validateBody(productUnitInputSchema), (req, res) => res.status(201).json(createUnit(db, intParam(req, 'id'), req.body)));
  r.put('/:id/units/:unitId', validateBody(productUnitInputSchema), (req, res) => res.json(updateUnit(db, intParam(req, 'id'), intParam(req, 'unitId'), req.body)));
  r.delete('/:id/units/:unitId', (req, res) => { deleteUnit(db, intParam(req, 'id'), intParam(req, 'unitId')); res.status(204).end(); });
  return r;
}
```

`server/src/routes/index.ts`:
```ts
import { Router } from 'express';
import type { Db } from '../db/connection.js';
import { categoriesRouter } from './categories.js';
import { productsRouter } from './products.js';

export function apiRouter(db: Db): Router {
  const r = Router();
  r.use('/categories', categoriesRouter(db));
  r.use('/products', productsRouter(db));
  r.use((_req, res) => res.status(404).json({ error: 'Không tìm thấy' }));
  return r;
}
```

`server/src/app.ts`:
```ts
import express, { type Express } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import type { Db } from './db/connection.js';
import { errorHandler } from './middleware/error.js';
import { apiRouter } from './routes/index.js';

export function createApp(db: Db, opts: { clientDist?: string } = {}): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', apiRouter(db));
  if (opts.clientDist && fs.existsSync(opts.clientDist)) {
    app.use(express.static(opts.clientDist));
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      res.sendFile(path.join(opts.clientDist!, 'index.html'));
    });
  }
  app.use(errorHandler);
  return app;
}
```

`server/src/index.ts`:
```ts
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { createDb } from './db/connection.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dbFile = process.env['DB_FILE'] ?? path.join(repoRoot, 'data', 'grocery.db');
const port = Number(process.env['PORT'] ?? 3000);

const db = createDb(dbFile);
const app = createApp(db, { clientDist: path.join(repoRoot, 'client', 'dist') });
app.listen(port, '0.0.0.0', () => {
  const lan = Object.values(os.networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal)?.address;
  console.log(`Tiny POS chạy tại http://localhost:${port}` + (lan ? ` (LAN: http://${lan}:${port})` : ''));
  console.log(`DB: ${dbFile}`);
});
```

- [ ] **Step 4: Pass** `npm test -w server`; `npm run typecheck`. Chạy `npm run dev -w server` thử `curl localhost:3000/api/categories` → `[]`.
- [ ] **Step 5: Commit** `feat(server): API sản phẩm, danh mục, CSV`

---

### Task 11: `client` – khung ứng dụng, API client, UI cơ bản

**Files:**
- Create: `client/public/icon.svg`, `client/src/index.css`, `client/src/main.tsx` (ghi đè), `client/src/App.tsx`, `client/src/router.tsx`, `client/src/api/client.ts`, `client/src/api/categories.ts`, `client/src/api/products.ts`, `client/src/components/ui/Button.tsx`, `client/src/components/ui/Field.tsx`, `client/src/components/ui/Dialog.tsx`, `client/src/components/ui/Toast.tsx`, `client/src/pages/PlaceholderPage.tsx`

**Interfaces:**
- Produces: `api<T>(path, { method?, json?, text? })`, `ApiError`; hooks `useCategories`, `useSaveCategory`, `useDeleteCategory`, `useProducts(query)`, `useProduct(id)`, `useSaveProduct`, `useSetProductActive`, `useSaveUnit`, `useDeleteUnit`, `useImportCsv`, `lookupBarcode(code)`; `Button`, `Field` (label + input/select), `Dialog`, `useToast()`.

- [ ] **Step 1: Icon + CSS**

`client/public/icon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#16a34a"/><path d="M14 22h36l-4 20H20z" fill="#fff"/><circle cx="24" cy="48" r="4" fill="#fff"/><circle cx="42" cy="48" r="4" fill="#fff"/></svg>
```
`client/src/index.css`:
```css
@import "tailwindcss";

html { font-size: 18px; }
body { @apply bg-gray-50 text-gray-900; }
input, select, textarea { @apply text-base; }
```

- [ ] **Step 2: main.tsx, App, router**

`main.tsx`:
```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { ToastProvider } from './components/ui/Toast';
import './index.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 5_000 } } });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
```
`router.tsx`:
```tsx
import { Navigate, Route, Routes } from 'react-router';
import { PlaceholderPage } from './pages/PlaceholderPage';

export const NAV = [
  { to: '/sell', label: 'Bán hàng', icon: '🛒', disabled: true },
  { to: '/products', label: 'Sản phẩm', icon: '📦' },
  { to: '/categories', label: 'Danh mục', icon: '🗂️' },
  { to: '/quick-add', label: 'Nhập nhanh', icon: '📷' },
  { to: '/settings', label: 'Cài đặt', icon: '⚙️', disabled: true },
];

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/products" replace />} />
      <Route path="/products" element={<PlaceholderPage title="Sản phẩm" />} />
      <Route path="/categories" element={<PlaceholderPage title="Danh mục" />} />
      <Route path="/quick-add" element={<PlaceholderPage title="Nhập nhanh" />} />
      <Route path="*" element={<PlaceholderPage title="Không tìm thấy trang" />} />
    </Routes>
  );
}
```
(Task 12–14 thay `PlaceholderPage` bằng trang thật.)

`App.tsx`:
```tsx
import { NavLink } from 'react-router';
import { AppRoutes, NAV } from './router';

export default function App() {
  const link = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-4 py-3 font-medium ${isActive ? 'bg-green-600 text-white' : 'hover:bg-gray-200'}`;
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <nav className="hidden w-56 shrink-0 flex-col gap-1 border-r bg-white p-3 md:flex">
        <div className="mb-3 px-2 text-2xl font-bold text-green-700">Tạp hóa</div>
        {NAV.map((n) =>
          n.disabled ? (
            <span key={n.to} className="flex items-center gap-3 px-4 py-3 text-gray-400">{n.icon} {n.label}</span>
          ) : (
            <NavLink key={n.to} to={n.to} className={link}>{n.icon} {n.label}</NavLink>
          ),
        )}
      </nav>
      <main className="min-w-0 flex-1 p-4 pb-24 md:pb-4">
        <AppRoutes />
      </main>
      <nav className="fixed inset-x-0 bottom-0 flex border-t bg-white md:hidden">
        {NAV.filter((n) => !n.disabled).map((n) => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => `flex flex-1 flex-col items-center py-2 text-sm ${isActive ? 'text-green-700 font-semibold' : 'text-gray-500'}`}>
            <span className="text-2xl">{n.icon}</span>{n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
```
`PlaceholderPage.tsx`: `export function PlaceholderPage({ title }: { title: string }) { return <h1 className="text-2xl font-bold">{title}</h1>; }`

- [ ] **Step 3: API client và hooks**

`api/client.ts`:
```ts
export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

interface Options { method?: string; json?: unknown; text?: string }

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = {};
  let body: string | undefined;
  if (opts.json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(opts.json); }
  if (opts.text !== undefined) { headers['Content-Type'] = 'text/csv'; body = opts.text; }
  const res = await fetch(`/api${path}`, { method: opts.method ?? (body === undefined ? 'GET' : 'POST'), headers, body });
  if (!res.ok) {
    let message = `Lỗi ${res.status}`;
    try { message = (await res.json()).error ?? message; } catch { /* không phải JSON */ }
    throw new ApiError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
```

`api/categories.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Category, CategoryInput } from '@tiny-pos/shared';
import { api } from './client';

export const useCategories = () => useQuery({ queryKey: ['categories'], queryFn: () => api<Category[]>('/categories') });

function useInvalidateAll() {
  const qc = useQueryClient();
  return () => { void qc.invalidateQueries({ queryKey: ['categories'] }); void qc.invalidateQueries({ queryKey: ['products'] }); };
}

export function useSaveCategory() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, ...input }: CategoryInput & { id?: number }) =>
      id ? api<Category>(`/categories/${id}`, { method: 'PUT', json: input }) : api<Category>('/categories', { json: input }),
    onSuccess: invalidate,
  });
}

export function useDeleteCategory() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: number) => api<void>(`/categories/${id}`, { method: 'DELETE' }), onSuccess: invalidate });
}
```

`api/products.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BarcodeLookup, CsvImportResult, Product, ProductInput, ProductUnit, ProductUnitInput, ProductWithUnits } from '@tiny-pos/shared';
import { api } from './client';

export interface ProductFilter { q?: string; categoryId?: number; includeInactive?: boolean }

function qs(f: ProductFilter): string {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.categoryId) p.set('categoryId', String(f.categoryId));
  if (f.includeInactive) p.set('includeInactive', '1');
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const useProducts = (f: ProductFilter) => useQuery({ queryKey: ['products', f], queryFn: () => api<Product[]>(`/products${qs(f)}`) });
export const useProduct = (id: number | null) =>
  useQuery({ queryKey: ['products', 'detail', id], queryFn: () => api<ProductWithUnits>(`/products/${id}`), enabled: id !== null });
export const lookupBarcode = (code: string) => api<BarcodeLookup>(`/products/by-barcode/${encodeURIComponent(code)}`);
export const CSV_EXPORT_URL = '/api/products/csv';

function useInvalidateProducts() {
  const qc = useQueryClient();
  return () => { void qc.invalidateQueries({ queryKey: ['products'] }); void qc.invalidateQueries({ queryKey: ['categories'] }); };
}

export function useSaveProduct() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: ({ id, ...input }: ProductInput & { id?: number }) =>
      id ? api<ProductWithUnits>(`/products/${id}`, { method: 'PUT', json: input }) : api<ProductWithUnits>('/products', { json: input }),
    onSuccess: invalidate,
  });
}

export function useSetProductActive() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      active ? api<Product>(`/products/${id}/restore`, { method: 'POST' }) : api<void>(`/products/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useSaveUnit() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: ({ productId, unitId, ...input }: ProductUnitInput & { productId: number; unitId?: number }) =>
      unitId ? api<ProductUnit>(`/products/${productId}/units/${unitId}`, { method: 'PUT', json: input }) : api<ProductUnit>(`/products/${productId}/units`, { json: input }),
    onSuccess: invalidate,
  });
}

export function useDeleteUnit() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: ({ productId, unitId }: { productId: number; unitId: number }) => api<void>(`/products/${productId}/units/${unitId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useImportCsv() {
  const invalidate = useInvalidateProducts();
  return useMutation({ mutationFn: (text: string) => api<CsvImportResult>('/products/csv', { text }), onSuccess: invalidate });
}
```

- [ ] **Step 4: UI components**

`components/ui/Button.tsx`:
```tsx
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
const styles: Record<Variant, string> = {
  primary: 'bg-green-600 text-white hover:bg-green-700',
  secondary: 'bg-white border border-gray-300 hover:bg-gray-100',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  ghost: 'hover:bg-gray-100',
};

export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={`min-h-11 rounded-lg px-4 font-medium disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
    />
  );
}
```

`components/ui/Field.tsx`:
```tsx
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

const base = 'min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-200';

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-gray-500">{hint}</span>}
    </label>
  );
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${base} ${className}`} />;
}

export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${base} ${className}`} />;
}

export function Checkbox({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex min-h-11 items-center gap-2">
      <input type="checkbox" {...props} className="h-5 w-5 accent-green-600" />
      <span>{label}</span>
    </label>
  );
}
```

`components/ui/Dialog.tsx`:
```tsx
import { useEffect, type ReactNode } from 'react';

interface Props { open: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean }

/** Hộp thoại đơn giản: overlay, Esc để đóng, không đóng khi click nền (tránh mất dữ liệu form). */
export function Dialog({ open, title, onClose, children, wide }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-2 md:items-center md:p-6">
      <div className={`w-full rounded-xl bg-white p-4 shadow-xl md:p-6 ${wide ? 'max-w-3xl' : 'max-w-xl'}`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="min-h-11 min-w-11 rounded-lg text-2xl hover:bg-gray-100" aria-label="Đóng">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
```

`components/ui/Toast.tsx`:
```tsx
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Kind = 'success' | 'error';
interface Toast { id: number; kind: Kind; message: string }
const Ctx = createContext<(message: string, kind?: Kind) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((message: string, kind: Kind = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 5000 : 2500);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={`rounded-lg px-4 py-3 text-white shadow-lg ${t.kind === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>{t.message}</div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
```

- [ ] **Step 5: Kiểm tra** `npm run typecheck -w client`; chạy `npm run dev`, mở `http://localhost:5173` thấy menu và tiêu đề trang.
- [ ] **Step 6: Commit** `feat(client): khung ứng dụng, API client, UI cơ bản`

---

### Task 12: `client` – trang Danh mục

**Files:**
- Create: `client/src/pages/categories/CategoriesPage.tsx`
- Modify: `client/src/router.tsx` (thay placeholder)

- [ ] **Step 1: Implement**

```tsx
import { useState } from 'react';
import type { Category } from '@tiny-pos/shared';
import { useCategories, useDeleteCategory, useSaveCategory } from '../../api/categories';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toast';

export function CategoriesPage() {
  const { data: categories = [], isLoading } = useCategories();
  const save = useSaveCategory();
  const remove = useDeleteCategory();
  const toast = useToast();
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);

  const onError = (e: Error) => toast(e.message, 'error');

  const add = () => {
    if (!newName.trim()) return;
    save.mutate({ name: newName, sortOrder: categories.length }, { onSuccess: () => setNewName(''), onError });
  };
  const rename = () => {
    if (!editing) return;
    const c = categories.find((x) => x.id === editing.id);
    if (c) save.mutate({ id: c.id, name: editing.name, sortOrder: c.sortOrder }, { onSuccess: () => setEditing(null), onError });
  };
  const move = (index: number, dir: -1 | 1) => {
    const next = [...categories];
    const [item] = next.splice(index, 1);
    next.splice(index + dir, 0, item!);
    next.forEach((c, i) => { if (c.sortOrder !== i) save.mutate({ id: c.id, name: c.name, sortOrder: i }, { onError }); });
  };
  const del = (c: Category) => {
    if (!confirm(`Xóa danh mục "${c.name}"? Sản phẩm trong danh mục sẽ chuyển sang "Không danh mục".`)) return;
    remove.mutate(c.id, { onError });
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold">Danh mục</h1>
      <div className="mb-4 flex gap-2">
        <Input placeholder="Tên danh mục mới" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <Button onClick={add} disabled={save.isPending}>Thêm</Button>
      </div>
      {isLoading && <p>Đang tải…</p>}
      <ul className="divide-y rounded-xl border bg-white">
        {categories.map((c, i) => (
          <li key={c.id} className="flex items-center gap-2 p-2">
            {editing?.id === c.id ? (
              <Input autoFocus value={editing.name} onChange={(e) => setEditing({ id: c.id, name: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') rename(); if (e.key === 'Escape') setEditing(null); }} onBlur={rename} />
            ) : (
              <button type="button" className="min-h-11 flex-1 text-left" onClick={() => setEditing({ id: c.id, name: c.name })}>
                {c.name} <span className="text-sm text-gray-500">({c.productCount} sản phẩm)</span>
              </button>
            )}
            <Button variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Lên">↑</Button>
            <Button variant="ghost" onClick={() => move(i, 1)} disabled={i === categories.length - 1} aria-label="Xuống">↓</Button>
            <Button variant="ghost" className="text-red-600" onClick={() => del(c)}>Xóa</Button>
          </li>
        ))}
        {!isLoading && categories.length === 0 && <li className="p-4 text-gray-500">Chưa có danh mục nào.</li>}
      </ul>
    </div>
  );
}
```
Trong `router.tsx`: `import { CategoriesPage } from './pages/categories/CategoriesPage';` và dùng `<CategoriesPage />` cho `/categories`.

- [ ] **Step 2: Kiểm tra tay** — thêm 2 danh mục, đổi tên bằng click, đổi thứ tự, xóa; reload vẫn đúng thứ tự.
- [ ] **Step 3: Commit** `feat(client): trang danh mục`

---

### Task 13: `client` – trang Sản phẩm, form, đơn vị quy đổi

**Files:**
- Create: `client/src/pages/products/ProductListPage.tsx`, `client/src/pages/products/ProductFormDialog.tsx`, `client/src/pages/products/ProductUnitsEditor.tsx`, `client/src/pages/products/useProductForm.ts`
- Modify: `client/src/router.tsx`

**Interfaces:**
- Produces: `ProductFormDialog({ open, product, initialBarcode, onClose, onSaved })` dùng lại ở Task 14.

- [ ] **Step 1: `useProductForm.ts`** — state form dạng chuỗi, chuyển sang số khi submit (Review Focus 5)

```ts
import { useEffect, useState } from 'react';
import type { ProductInput, ProductWithUnits } from '@tiny-pos/shared';

export interface FormState {
  barcode: string; name: string; unit: string; costPrice: string; sellPrice: string;
  stock: string; isWeighed: boolean; categoryId: string; minStock: string;
}

const empty = (barcode = ''): FormState => ({ barcode, name: '', unit: 'cái', costPrice: '0', sellPrice: '0', stock: '0', isWeighed: false, categoryId: '', minStock: '0' });

const fromProduct = (p: ProductWithUnits): FormState => ({
  barcode: p.barcode ?? '', name: p.name, unit: p.unit, costPrice: String(p.costPrice), sellPrice: String(p.sellPrice),
  stock: String(p.stock), isWeighed: p.isWeighed, categoryId: p.categoryId ? String(p.categoryId) : '', minStock: String(p.minStock),
});

const num = (s: string) => (s.trim() === '' ? 0 : Number(s.replace(/\./g, '').replace(',', '.')));

export function toInput(f: FormState): ProductInput {
  return {
    barcode: f.barcode.trim() || null, name: f.name, unit: f.unit || 'cái',
    costPrice: num(f.costPrice), sellPrice: num(f.sellPrice), stock: num(f.stock), isWeighed: f.isWeighed,
    categoryId: f.categoryId ? Number(f.categoryId) : null, minStock: num(f.minStock),
  };
}

/** Reset state mỗi khi mở dialog với sản phẩm khác / barcode khác. */
export function useProductForm(open: boolean, product: ProductWithUnits | null | undefined, initialBarcode?: string) {
  const [form, setForm] = useState<FormState>(empty());
  useEffect(() => {
    if (open) setForm(product ? fromProduct(product) : empty(initialBarcode));
  }, [open, product, initialBarcode]);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  return { form, set };
}
```

- [ ] **Step 2: `ProductFormDialog.tsx`**

```tsx
import { useRef, type FormEvent } from 'react';
import type { ProductWithUnits } from '@tiny-pos/shared';
import { useCategories } from '../../api/categories';
import { useSaveProduct } from '../../api/products';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Checkbox, Field, Input, Select } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toast';
import { ProductUnitsEditor } from './ProductUnitsEditor';
import { toInput, useProductForm } from './useProductForm';

interface Props { open: boolean; product?: ProductWithUnits | null; initialBarcode?: string; onClose: () => void; onSaved: (p: ProductWithUnits) => void }

export function ProductFormDialog({ open, product, initialBarcode, onClose, onSaved }: Props) {
  const { form, set } = useProductForm(open, product, initialBarcode);
  const { data: categories = [] } = useCategories();
  const save = useSaveProduct();
  const toast = useToast();
  const nameRef = useRef<HTMLInputElement>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate({ ...toInput(form), id: product?.id }, {
      onSuccess: (p) => { toast(product ? 'Đã lưu' : `Đã thêm "${p.name}"`); onSaved(p); },
      onError: (err) => toast(err.message, 'error'),
    });
  };

  return (
    <Dialog open={open} title={product ? 'Sửa sản phẩm' : 'Thêm sản phẩm'} onClose={onClose} wide>
      <form onSubmit={submit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Mã vạch" hint="Quét hoặc để trống nếu hàng không có mã">
          <Input value={form.barcode} onChange={(e) => set('barcode', e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); nameRef.current?.focus(); } }} />
        </Field>
        <Field label="Tên sản phẩm">
          <Input ref={nameRef} autoFocus={!initialBarcode} required value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Đơn vị"><Input value={form.unit} onChange={(e) => set('unit', e.target.value)} placeholder="cái, kg, lốc…" /></Field>
        <Field label="Danh mục">
          <Select value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
            <option value="">Không danh mục</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Giá nhập (đ)"><Input inputMode="numeric" value={form.costPrice} onChange={(e) => set('costPrice', e.target.value)} onFocus={(e) => e.target.select()} /></Field>
        <Field label="Giá bán (đ)"><Input inputMode="numeric" value={form.sellPrice} onChange={(e) => set('sellPrice', e.target.value)} onFocus={(e) => e.target.select()} /></Field>
        <Field label={product ? 'Tồn kho' : 'Tồn đầu'} hint={product ? 'Sửa sẽ ghi phiếu điều chỉnh' : undefined}>
          <Input inputMode="decimal" value={form.stock} onChange={(e) => set('stock', e.target.value)} onFocus={(e) => e.target.select()} />
        </Field>
        <Field label="Tồn tối thiểu (cảnh báo)"><Input inputMode="decimal" value={form.minStock} onChange={(e) => set('minStock', e.target.value)} onFocus={(e) => e.target.select()} /></Field>
        <div className="md:col-span-2"><Checkbox label="Hàng cân (bán theo kg)" checked={form.isWeighed} onChange={(e) => set('isWeighed', e.target.checked)} /></div>
        {product && <div className="md:col-span-2"><ProductUnitsEditor product={product} /></div>}
        <div className="flex justify-end gap-2 md:col-span-2">
          <Button variant="secondary" onClick={onClose}>Hủy</Button>
          <Button type="submit" disabled={save.isPending}>Lưu</Button>
        </div>
      </form>
    </Dialog>
  );
}
```
Lưu ý: `Input` cần `forwardRef` để nhận `ref` — sửa `Field.tsx`: `export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className = '', ...props }, ref) { return <input ref={ref} {...props} className={...} />; });`

- [ ] **Step 3: `ProductUnitsEditor.tsx`**

```tsx
import { useState } from 'react';
import { formatMoney, type ProductWithUnits } from '@tiny-pos/shared';
import { useDeleteUnit, useSaveUnit } from '../../api/products';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toast';

const blank = { name: '', barcode: '', factor: '', sellPrice: '' };

export function ProductUnitsEditor({ product }: { product: ProductWithUnits }) {
  const save = useSaveUnit();
  const remove = useDeleteUnit();
  const toast = useToast();
  const [draft, setDraft] = useState(blank);
  const onError = (e: Error) => toast(e.message, 'error');

  const add = () => {
    save.mutate(
      { productId: product.id, name: draft.name, barcode: draft.barcode || null, factor: Number(draft.factor), sellPrice: Number(draft.sellPrice) },
      { onSuccess: () => setDraft(blank), onError },
    );
  };

  return (
    <fieldset className="rounded-lg border p-3">
      <legend className="px-1 font-medium">Đơn vị quy đổi (thùng, lốc…)</legend>
      {product.units.length === 0 && <p className="mb-2 text-sm text-gray-500">Chưa có. Ví dụ: 1 thùng = 24 {product.unit}.</p>}
      <ul className="mb-2 divide-y">
        {product.units.map((u) => (
          <li key={u.id} className="flex items-center gap-2 py-1">
            <span className="flex-1">1 {u.name} = {u.factor} {product.unit} · {formatMoney(u.sellPrice)}{u.barcode && <span className="text-sm text-gray-500"> · {u.barcode}</span>}</span>
            <Button variant="ghost" className="text-red-600" onClick={() => remove.mutate({ productId: product.id, unitId: u.id }, { onError })}>Xóa</Button>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Input placeholder="Tên (thùng)" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <Input placeholder="Mã vạch" value={draft.barcode} onChange={(e) => setDraft({ ...draft, barcode: e.target.value })} />
        <Input placeholder={`= ? ${product.unit}`} inputMode="decimal" value={draft.factor} onChange={(e) => setDraft({ ...draft, factor: e.target.value })} />
        <Input placeholder="Giá bán" inputMode="numeric" value={draft.sellPrice} onChange={(e) => setDraft({ ...draft, sellPrice: e.target.value })} />
        <Button variant="secondary" onClick={add} disabled={!draft.name || !draft.factor || save.isPending}>Thêm</Button>
      </div>
    </fieldset>
  );
}
```
(Không có sửa inline đơn vị: xóa rồi thêm lại là đủ với vài đơn vị/sản phẩm; API PUT vẫn có sẵn.)

- [ ] **Step 4: `ProductListPage.tsx`**

```tsx
import { useState } from 'react';
import { formatMoney, type Product } from '@tiny-pos/shared';
import { useCategories } from '../../api/categories';
import { useProduct, useProducts, useSetProductActive } from '../../api/products';
import { Button } from '../../components/ui/Button';
import { Checkbox, Input, Select } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toast';
import { CsvDialog } from './CsvDialog';
import { ProductFormDialog } from './ProductFormDialog';

export function ProductListPage() {
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const { data: products = [], isLoading } = useProducts({ q, categoryId: categoryId ? Number(categoryId) : undefined, includeInactive });
  const { data: categories = [] } = useCategories();
  const { data: editing } = useProduct(editingId);
  const setActive = useSetProductActive();
  const toast = useToast();

  const toggle = (p: Product) => setActive.mutate({ id: p.id, active: !p.isActive }, { onError: (e) => toast(e.message, 'error') });
  const close = () => { setEditingId(null); setCreating(false); };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-bold">Sản phẩm</h1>
        <Button variant="secondary" onClick={() => setCsvOpen(true)}>Nhập / Xuất CSV</Button>
        <Button onClick={() => setCreating(true)}>+ Thêm sản phẩm</Button>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Tìm tên hoặc mã vạch" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select className="max-w-xs" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Tất cả danh mục</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Checkbox label="Hiện hàng ngừng bán" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left">
          <thead className="bg-gray-100 text-sm uppercase text-gray-600">
            <tr><th className="p-3">Mã vạch</th><th className="p-3">Tên</th><th className="p-3">ĐV</th><th className="p-3 text-right">Giá bán</th><th className="p-3 text-right">Tồn</th><th className="p-3">Danh mục</th><th className="p-3"></th></tr>
          </thead>
          <tbody className="divide-y">
            {products.map((p) => (
              <tr key={p.id} className={p.isActive ? '' : 'text-gray-400'}>
                <td className="p-3 font-mono text-sm">{p.barcode ?? '—'}</td>
                <td className="p-3 font-medium">{p.name}{!p.isActive && ' (ngừng bán)'}</td>
                <td className="p-3">{p.unit}</td>
                <td className="p-3 text-right">{formatMoney(p.sellPrice)}</td>
                <td className={`p-3 text-right ${p.stock < p.minStock ? 'font-bold text-red-600' : ''}`}>{p.stock}</td>
                <td className="p-3">{p.categoryName ?? ''}</td>
                <td className="p-3 whitespace-nowrap">
                  <Button variant="ghost" onClick={() => setEditingId(p.id)}>Sửa</Button>
                  <Button variant="ghost" className={p.isActive ? 'text-red-600' : 'text-green-700'} onClick={() => toggle(p)}>{p.isActive ? 'Ngừng bán' : 'Bán lại'}</Button>
                </td>
              </tr>
            ))}
            {!isLoading && products.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-gray-500">Không có sản phẩm.</td></tr>}
          </tbody>
        </table>
      </div>
      <ProductFormDialog open={creating || (editingId !== null && !!editing)} product={editing ?? null} onClose={close} onSaved={close} />
      <CsvDialog open={csvOpen} onClose={() => setCsvOpen(false)} />
    </div>
  );
}
```
`CsvDialog` được tạo ở Task 15; tạm thời Task 13 tạo file `CsvDialog.tsx` với nội dung tối thiểu:
```tsx
import { Dialog } from '../../components/ui/Dialog';
export function CsvDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return <Dialog open={open} title="Nhập / Xuất CSV" onClose={onClose}><p>Đang xây dựng.</p></Dialog>;
}
```
Trong `router.tsx` dùng `<ProductListPage />` cho `/products`.

- [ ] **Step 5: Kiểm tra tay** — thêm sản phẩm có tồn đầu 10, sửa tồn thành 8, ngừng bán, bật "Hiện hàng ngừng bán", bán lại; thêm đơn vị "Thùng = 24"; nhập giá bán chữ "abc" → toast đỏ có chữ "Giá bán".
- [ ] **Step 6: Commit** `feat(client): trang sản phẩm và form`

---

### Task 14: `client` – Nhập nhanh và `useScanInput`

**Files:**
- Create: `client/src/hooks/useScanInput.ts`, `client/src/pages/quick-add/QuickAddPage.tsx`
- Modify: `client/src/router.tsx`

- [ ] **Step 1: `useScanInput.ts`**

```ts
import { useCallback, useEffect, useRef, type KeyboardEvent } from 'react';

/**
 * Ô quét mã: luôn giữ focus (trừ khi `paused`, ví dụ dialog đang mở),
 * chỉ xử lý khi Enter (máy quét gõ mã rồi Enter), không bắt từng phím.
 */
export function useScanInput(onScan: (code: string) => void, paused = false) {
  const ref = useRef<HTMLInputElement>(null);
  const focus = useCallback(() => ref.current?.focus(), []);

  useEffect(() => {
    if (paused) return;
    focus();
    const onPointerUp = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, button, a, [role="dialog"]')) return;
      focus();
    };
    document.addEventListener('mouseup', onPointerUp);
    return () => document.removeEventListener('mouseup', onPointerUp);
  }, [paused, focus]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const code = e.currentTarget.value.trim();
    e.currentTarget.value = '';
    if (code) onScan(code);
  };

  return { ref, onKeyDown, focus };
}
```

- [ ] **Step 2: `QuickAddPage.tsx`**

```tsx
import { useState } from 'react';
import { formatMoney, type BarcodeLookup, type ProductWithUnits } from '@tiny-pos/shared';
import { ApiError } from '../../api/client';
import { lookupBarcode, useProduct } from '../../api/products';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { useScanInput } from '../../hooks/useScanInput';
import { ProductFormDialog } from '../products/ProductFormDialog';

type Result = { kind: 'found'; data: BarcodeLookup } | { kind: 'new'; code: string } | null;

export function QuickAddPage() {
  const [result, setResult] = useState<Result>(null);
  const [history, setHistory] = useState<{ code: string; name: string }[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newBarcode, setNewBarcode] = useState<string | null>(null);
  const { data: editing } = useProduct(editingId);
  const toast = useToast();
  const dialogOpen = newBarcode !== null || (editingId !== null && !!editing);

  const onScan = async (code: string) => {
    try {
      const data = await lookupBarcode(code);
      setResult({ kind: 'found', data });
      setHistory((h) => [{ code, name: data.product.name }, ...h].slice(0, 10));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) { setResult({ kind: 'new', code }); setNewBarcode(code); }
      else toast((e as Error).message, 'error');
    }
  };
  const scan = useScanInput(onScan, dialogOpen);

  const closeDialog = () => { setNewBarcode(null); setEditingId(null); scan.focus(); };
  const onSaved = (p: ProductWithUnits) => {
    setResult({ kind: 'found', data: { product: p, unit: null } });
    setHistory((h) => [{ code: p.barcode ?? '', name: p.name }, ...h].slice(0, 10));
    closeDialog();
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 text-2xl font-bold">Nhập nhanh</h1>
      <p className="mb-3 text-gray-600">Quét mã vạch. Có rồi thì hiện thông tin, chưa có thì mở form thêm mới.</p>
      <input
        ref={scan.ref}
        onKeyDown={scan.onKeyDown}
        placeholder="Quét mã vạch tại đây…"
        className="mb-4 min-h-14 w-full rounded-xl border-2 border-green-600 px-4 text-2xl focus:outline-none focus:ring-4 focus:ring-green-200"
        autoComplete="off"
      />
      {result?.kind === 'found' && (
        <div className="mb-4 rounded-xl border bg-white p-4">
          <div className="text-xl font-bold">{result.data.product.name}{!result.data.product.isActive && <span className="ml-2 text-base font-normal text-red-600">(ngừng bán)</span>}</div>
          {result.data.unit && <div className="text-green-700">Mã của {result.data.unit.name} (= {result.data.unit.factor} {result.data.product.unit}) · {formatMoney(result.data.unit.sellPrice)}</div>}
          <div className="mt-1 text-gray-700">Giá bán {formatMoney(result.data.product.sellPrice)} / {result.data.product.unit} · Tồn {result.data.product.stock} · {result.data.product.categoryName ?? 'Không danh mục'}</div>
          <Button variant="secondary" className="mt-3" onClick={() => setEditingId(result.data.product.id)}>Sửa</Button>
        </div>
      )}
      {history.length > 0 && (
        <div className="rounded-xl border bg-white">
          <div className="border-b px-4 py-2 font-medium text-gray-600">Vừa quét</div>
          <ul className="divide-y">{history.map((h, i) => <li key={i} className="flex justify-between px-4 py-2"><span>{h.name}</span><span className="font-mono text-sm text-gray-500">{h.code}</span></li>)}</ul>
        </div>
      )}
      <ProductFormDialog open={dialogOpen} product={editing ?? null} initialBarcode={newBarcode ?? undefined} onClose={closeDialog} onSaved={onSaved} />
    </div>
  );
}
```
`router.tsx`: dùng `<QuickAddPage />` cho `/quick-add`; xóa import `PlaceholderPage` nếu không còn dùng (giữ cho `*`).

- [ ] **Step 3: Kiểm tra tay** — gõ mã lạ + Enter → form mở với mã sẵn, focus ở Tên; gõ tên, Enter (submit) → toast, quay lại ô quét đã focus; quét lại mã đó → hiện thẻ. Khi form mở, gõ mã + Enter không tạo tra cứu mới (Review Focus 1).
- [ ] **Step 4: Commit** `feat(client): màn nhập nhanh`

---

### Task 15: `client` – Nhập/Xuất CSV

**Files:**
- Modify: `client/src/pages/products/CsvDialog.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useState } from 'react';
import type { CsvImportResult } from '@tiny-pos/shared';
import { CSV_EXPORT_URL, useImportCsv } from '../../api/products';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { useToast } from '../../components/ui/Toast';

export function CsvDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const importCsv = useImportCsv();
  const toast = useToast();
  const [result, setResult] = useState<CsvImportResult | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    importCsv.mutate(text, { onSuccess: setResult, onError: (e) => toast(e.message, 'error') });
  };

  return (
    <Dialog open={open} title="Nhập / Xuất CSV" onClose={() => { setResult(null); onClose(); }}>
      <section className="mb-4">
        <h3 className="font-semibold">Xuất</h3>
        <p className="mb-2 text-sm text-gray-600">Tải toàn bộ sản phẩm đang bán ra file CSV (mở được bằng Excel).</p>
        <a href={CSV_EXPORT_URL} download><Button variant="secondary">Tải file CSV</Button></a>
      </section>
      <section>
        <h3 className="font-semibold">Nhập</h3>
        <p className="mb-2 text-sm text-gray-600">Cột: Mã vạch, Tên, Đơn vị, Giá nhập, Giá bán, Tồn, Hàng cân, Danh mục, Tồn tối thiểu. Trùng mã vạch thì cập nhật (không đổi tồn), chưa có thì tạo mới.</p>
        <input type="file" accept=".csv,text/csv" className="block" disabled={importCsv.isPending} onChange={(e) => void onFile(e.target.files?.[0])} />
        {importCsv.isPending && <p className="mt-2">Đang nhập…</p>}
        {result && (
          <div className="mt-3 rounded-lg bg-gray-50 p-3">
            <p>Đã tạo <b>{result.created}</b>, cập nhật <b>{result.updated}</b>, lỗi <b>{result.errors.length}</b>.</p>
            {result.errors.length > 0 && (
              <ul className="mt-2 max-h-48 overflow-y-auto text-sm text-red-700">
                {result.errors.map((e) => <li key={e.line}>Dòng {e.line}: {e.message}</li>)}
              </ul>
            )}
          </div>
        )}
      </section>
    </Dialog>
  );
}
```

- [ ] **Step 2: Kiểm tra tay** — Xuất CSV, mở Excel thấy tiếng Việt đúng; sửa giá, thêm dòng mới, lưu CSV, nhập lại → số tạo/cập nhật đúng; dòng tên trống báo lỗi theo dòng.
- [ ] **Step 3: Commit** `feat(client): nhập/xuất CSV`

---

### Task 16: Vận hành và kiểm tra tổng

**Files:**
- Create: `ecosystem.config.cjs`, `README.md`

- [ ] **Step 1: `ecosystem.config.cjs`**
```js
module.exports = {
  apps: [{ name: 'tiny-pos', script: 'server/dist/index.js', cwd: __dirname, env: { NODE_ENV: 'production', PORT: 3000 } }],
};
```

- [ ] **Step 2: `README.md`** — mục: Yêu cầu (Node 20+), Cài (`npm install`), Dev (`npm run dev`, mở `http://localhost:5173`, điện thoại `http://<IP LAN>:5173`), Build + chạy production (`npm run build`, `npx pm2 start ecosystem.config.cjs`, mở `http://localhost:3000`), Lệnh (`typecheck`, `test`, `db:generate`), Kiểm thử thủ công Giai đoạn 1 (danh sách ở Task 12–15).

- [ ] **Step 3: Chạy toàn bộ** — `npm run typecheck`, `npm test`, `npm run build`, `npm start` rồi mở `http://localhost:3000` thấy UI phục vụ từ `client/dist`, F5 trên `/quick-add` không 404.

- [ ] **Step 4: Commit** `chore: pm2, README, hoàn tất Giai đoạn 1`
