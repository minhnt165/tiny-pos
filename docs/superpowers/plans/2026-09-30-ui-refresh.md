# Làm mới giao diện 0.5.0 – Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Giao diện client hiện đại, đơn giản, đồng nhất (sidebar trắng + xanh dương), 5 tùy chọn giao diện lưu theo máy, hiện version 0.5.0.

**Architecture:** Dựng khung dùng chung (`AppShell` + shadcn `sidebar`, `PageTitle` vẽ vào topbar bằng portal, `StatStrip`, `ListPanel`, `DateField`), bảng màu và tùy chọn giao diện bằng biến CSS + thuộc tính `data-*` trên `<html>`, rồi chuyển từng trang sang. Chỉ đổi JSX/class; hook, API, phím tắt, in giữ nguyên. Server không đổi.

**Tech Stack:** React 19, Vite 7, Tailwind v4, shadcn/ui (`radix-nova`, gói `radix-ui`), lucide-react, next-themes, react-day-picker (qua shadcn `calendar`), vitest (shared), playwright-core (kiểm tra ngoài repo).

**Spec:** `docs/superpowers/specs/2026-09-30-tiny-pos-ui-refresh-design.md`

## Global Constraints

- Text UI, comment, commit message: tiếng Việt. Code theo phong cách xung quanh: 2 space, nháy đơn, có `;`, dòng ≤ ~130 ký tự.
- **Không format lại file có sẵn**: không chạy prettier/eslint; diff chỉ chứa dòng cần đổi. File cấu hình (`package.json`, `vite.config.ts`, `index.html`, `main.tsx`, `.gitignore`) chỉ đổi đúng dòng cần.
- **Không commit từng task.** Người dùng muốn **một commit cho cả đợt** ở Task 8. Làm trên nhánh `master`, không tạo nhánh.
- Không sửa server, API, schema, migration. Không sửa nội dung/CSS in hóa đơn 80mm (`components/receipt/*`, khối `@page`/`@media print` trong `index.css`).
- Màu nhấn mặc định `#2563eb`; trung tính slate; không gradient, không bóng màu; trang không viết mã màu Tailwind cứng (`emerald-*`, `amber-*`, `red-*`, `sky-*`…) mà dùng token `primary`, `destructive`, `success`, `warning`, `muted-foreground`.
- Tùy chọn giao diện lưu khóa `localStorage` `tiny-pos:ui` qua `lib/storage.ts`; chế độ sáng/tối do next-themes lưu khóa `theme`, mặc định `system`.
- Version duy nhất ở `package.json` gốc: `"version": "0.5.0"`.
- Điện thoại 390px: nút/ô bấm cao ≥ 44px (`h-11`/`size-11`), không cuộn ngang trang.
- Quầy bán: ô quét giữ focus, F2/F4/F9 như cũ, phím tắt bỏ qua khi đang mở `[role=dialog]`.
- Cổng 5173/5174 là dự án khác: không dùng, không kill. Không tắt kiểm tra TLS; lỗi chứng chỉ thì đặt `NODE_EXTRA_CA_CERTS=<repo>/.certs/corp-root.pem`.
- Kiểm trên trình duyệt: chặn mọi request ghi (POST/PUT/DELETE/PATCH) – DB dev là dữ liệu thật.

## Review Focus

1. **Cỡ chữ `xl` (20px) ở 390px**: mọi trang không cuộn ngang, header điện thoại không tràn khi tiêu đề dài và có nút ⋯ – kiểm ở Task 8 (vòng lặp mọi trang).
2. **`localStorage` hỏng/giá trị lạ** (`{"accent":"purple"}`, `"5"`, JSON lỗi): app vẫn chạy với mặc định, không lỗi console – kiểm ở Task 1.
3. **Nút submit ở topbar nằm ngoài `<form>`** (Cài đặt → *Lưu*): bấm trên máy tính và chọn trong menu ⋯ trên điện thoại đều gửi đúng PUT `/api/settings` – kiểm ở Task 6.
4. **Chuyển trang SPA**: tiêu đề topbar/tab trình duyệt đổi đúng khi bấm menu, không còn nút của trang trước – kiểm ở Task 2 và Task 8.
5. **Phím tắt quầy sau khi đổi bố cục**: F2 focus ô quét, F9 không mở thanh toán khi giỏ trống, đổi tab đơn chờ vẫn đúng giỏ – kiểm ở Task 7.

## Công cụ kiểm tra (dùng cho mọi task)

Client không có test tự động; mỗi task kiểm bằng script playwright-core trong **thư mục tạm của phiên (scratchpad), ngoài repo** (skill `browser-verify`).

Chuẩn bị một lần:

```bash
# Dev server: phải ra 200 cả hai; chưa chạy thì bật `npm run dev` ở chế độ nền (tự dừng đúng tiến trình mình bật khi xong)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5180/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/settings
# Trong thư mục scratchpad
npm init -y && npm i playwright-core
```

Tạo `harness.mjs` trong scratchpad:

```js
import { chromium } from 'playwright-core';

export const BASE = 'http://localhost:5180';
export const PAGES = ['sell', 'orders', 'imports', 'imports/new', 'stocktake', 'products', 'categories', 'suppliers', 'customers', 'quick-add', 'settings'];

let failed = 0;
export const check = (name, ok, got) => {
  if (!ok) failed++;
  console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : JSON.stringify(got));
};

/** Mở Chrome headless, chặn request ghi, gieo localStorage một lần (không gieo lại khi reload). */
export async function withPage(fn, { width = 1366, height = 768, prefs, theme, raw } = {}) {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  const writes = [];
  const errors = [];
  await page.route('**/api/**', (route) => {
    const r = route.request();
    if (r.method() === 'GET') return route.continue();
    writes.push({ method: r.method(), url: r.url(), body: r.postData() });
    return route.abort();
  });
  await page.addInitScript(([p, t, rawValue]) => {
    window.print = () => console.log('PRINT');
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    if (rawValue !== null) localStorage.setItem('tiny-pos:ui', rawValue);
    else if (p) localStorage.setItem('tiny-pos:ui', JSON.stringify(p));
    if (t) localStorage.setItem('theme', t);
  }, [prefs ?? null, theme ?? null, raw ?? null]);
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await fn(page, writes);
  } finally {
    check('không có lỗi console/page', errors.length === 0, errors);
    console.log('WRITES', JSON.stringify(writes));
    await browser.close();
    console.log(failed ? `${failed} FAIL` : 'ALL PASS');
  }
}
```

Mỗi task có một script `tN.mjs` import từ `harness.mjs`, chạy `node tN.mjs`, kỳ vọng dòng cuối `ALL PASS`. Sau đó chụp ảnh (`page.screenshot`) và **đọc ảnh** để tự xem bố cục.

---

### Task 1: Nền tảng – version, bảng màu, tùy chọn giao diện

**Files:**
- Modify: `shared/src/local-date.ts` (thêm `formatDateVn`), `shared/src/local-date.test.ts`
- Modify: `package.json` (gốc, 1 dòng), `client/vite.config.ts`, `client/index.html`, `client/public/icon.svg`, `client/src/main.tsx`, `client/src/index.css`
- Create: `client/src/globals.d.ts`, `client/src/lib/version.ts`, `client/src/lib/ui-prefs.ts`
- Create (shadcn CLI): `client/src/components/ui/sidebar.tsx`, `client/src/components/ui/sheet.tsx`, `client/src/components/ui/calendar.tsx`, `client/src/hooks/use-mobile.ts` (tùy CLI sinh)

**Interfaces:**
- Produces: `formatDateVn(date: string): string` (shared); `APP_VERSION: string`, `BUILD_DATE: string` (`dd/mm/yyyy`) từ `@/lib/version`; từ `@/lib/ui-prefs`: `type UiPrefs = { accent: Accent; font: FontSize; density: Density; radius: Radius }`, `ACCENTS`, `FONT_SIZES`, `DENSITIES`, `RADII` (mảng `{ value, label }`, `ACCENTS` có thêm `swatch`), `DEFAULT_UI_PREFS`, `readUiPrefs(): UiPrefs`, `applyUiPrefs(p: UiPrefs): void`, `useUiPrefs(): { prefs: UiPrefs; update: (patch: Partial<UiPrefs>) => void; reset: () => void }`; token CSS `--success`, `--warning` (class `text-success`, `bg-warning/15`…), biến mật độ `--row-py`, `--page-p`, `--gap`; component shadcn `Sidebar*`, `Calendar`.

- [ ] **Step 1: Viết test hỏng cho `formatDateVn`**

Thêm vào cuối `shared/src/local-date.test.ts` và sửa dòng import đầu file thành `import { formatDateVn, localDate, localDayRange, shiftDate } from './local-date.js';`:

```ts
describe('formatDateVn', () => {
  it('YYYY-MM-DD thành dd/mm/yyyy', () => {
    expect(formatDateVn('2026-09-30')).toBe('30/09/2026');
    expect(formatDateVn('2026-01-05')).toBe('05/01/2026');
  });
  it('chuỗi khác dạng thì trả nguyên', () => {
    expect(formatDateVn('')).toBe('');
    expect(formatDateVn('30/09/2026')).toBe('30/09/2026');
  });
});
```

- [ ] **Step 2: Chạy test, thấy hỏng**

Run: `cd shared && npx vitest run src/local-date.test.ts`
Expected: FAIL – `formatDateVn` không được export.

- [ ] **Step 3: Viết `formatDateVn`**

Thêm vào cuối `shared/src/local-date.ts`:

```ts
/** "YYYY-MM-DD" → "dd/mm/yyyy" để hiển thị; chuỗi khác dạng trả nguyên. */
export function formatDateVn(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : date;
}
```

- [ ] **Step 4: Chạy test, thấy qua; build shared**

Run: `cd shared && npx vitest run src/local-date.test.ts && cd .. && npm run build -w shared`
Expected: PASS, build không lỗi.

- [ ] **Step 5: Cài component shadcn `sidebar` và `calendar`**

```bash
cd client && npx shadcn@latest add sidebar calendar
```

CLI hỏi ghi đè file có sẵn thì chọn **không** (không truyền `--overwrite`). Nếu CLI treo ở câu hỏi (shell không tương tác), dừng lệnh, chạy lại với `--overwrite`, rồi hoàn tác mọi file **đã có từ trước** bằng `git checkout -- <file>` (chỉ giữ file mới). Sau đó:

```bash
git status --short
git diff --stat
```

Chỉ được có file **mới** trong `src/components/ui/` và `src/hooks/`, cùng `client/package.json` + `package-lock.json` (thêm `react-day-picker`, có thể thêm `date-fns`). Nếu CLI sửa file có sẵn (`index.css`, `button.tsx`, `input.tsx`, `tooltip.tsx`, `separator.tsx`, `skeleton.tsx`…) thì hoàn tác file đó bằng `git checkout -- <file>` (index.css sẽ viết lại ở Step 9). Nếu `sidebar.tsx` import `@/hooks/use-mobile` mà file chưa sinh, chạy lại `npx shadcn@latest add sidebar` và kiểm tra lần nữa.

- [ ] **Step 6: Version**

`package.json` gốc – thêm đúng một dòng ngay sau `"name": "tiny-pos",`:

```json
  "version": "0.5.0",
```

`client/vite.config.ts` – thêm import sau dòng `import path from 'node:path';`:

```ts
import { readFileSync } from 'node:fs';
```

thêm sau các dòng import (trước `export default`):

```ts
// Version duy nhất của app nằm ở package.json gốc; chèn vào client lúc build
const { version } = JSON.parse(readFileSync(path.resolve(import.meta.dirname, '../package.json'), 'utf8')) as { version: string };
```

trong object `defineConfig({ ... })` thêm ngay trước `plugins: [`:

```ts
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
```

và đổi dòng `theme_color: '#16a34a',` thành `theme_color: '#2563eb',`.

Tạo `client/src/globals.d.ts`:

```ts
/** Vite chèn lúc build (vite.config.ts → define). */
declare const __APP_VERSION__: string;
declare const __BUILD_DATE__: string;
```

Tạo `client/src/lib/version.ts`:

```ts
import { currentTzOffset, formatDateVn, localDate } from '@tiny-pos/shared';

/** Version app (package.json gốc) và ngày build theo giờ máy, dạng dd/mm/yyyy. */
export const APP_VERSION = __APP_VERSION__;
export const BUILD_DATE = formatDateVn(localDate(new Date(__BUILD_DATE__), currentTzOffset()));
```

- [ ] **Step 7: `lib/ui-prefs.ts`**

Tạo `client/src/lib/ui-prefs.ts`:

```ts
import { useState } from 'react';
import { readStorage, writeStorage } from '@/lib/storage';

/** Tùy chọn giao diện theo máy (Cài đặt → Giao diện). Áp bằng data-* trên <html>, CSS ở index.css. */
export const ACCENTS = [
  { value: 'blue', label: 'Xanh dương', swatch: '#2563eb' },
  { value: 'green', label: 'Xanh lá', swatch: '#059669' },
  { value: 'violet', label: 'Tím', swatch: '#7c3aed' },
  { value: 'orange', label: 'Cam', swatch: '#ea580c' },
  { value: 'rose', label: 'Hồng', swatch: '#e11d48' },
  { value: 'slate', label: 'Xám', swatch: '#334155' },
] as const;
export const FONT_SIZES = [
  { value: 'sm', label: 'Nhỏ' },
  { value: 'md', label: 'Vừa' },
  { value: 'lg', label: 'Lớn' },
  { value: 'xl', label: 'Rất lớn' },
] as const;
export const DENSITIES = [
  { value: 'compact', label: 'Gọn' },
  { value: 'comfy', label: 'Thoáng' },
] as const;
export const RADII = [
  { value: 'none', label: 'Vuông' },
  { value: 'md', label: 'Vừa' },
  { value: 'lg', label: 'Tròn' },
] as const;

export type Accent = (typeof ACCENTS)[number]['value'];
export type FontSize = (typeof FONT_SIZES)[number]['value'];
export type Density = (typeof DENSITIES)[number]['value'];
export type Radius = (typeof RADII)[number]['value'];
export interface UiPrefs {
  accent: Accent;
  font: FontSize;
  density: Density;
  radius: Radius;
}

export const DEFAULT_UI_PREFS: UiPrefs = { accent: 'blue', font: 'md', density: 'compact', radius: 'md' };
const KEY = 'tiny-pos:ui';

/** Giá trị lạ (bản cũ, sửa tay) thì dùng mặc định của khóa đó. */
function pick<T extends string>(options: readonly { value: T }[], v: unknown, fallback: T): T {
  return options.some((o) => o.value === v) ? (v as T) : fallback;
}

export function readUiPrefs(): UiPrefs {
  let raw: unknown = null;
  try {
    raw = JSON.parse(readStorage(KEY) ?? 'null');
  } catch {
    /* JSON hỏng: dùng mặc định */
  }
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    accent: pick(ACCENTS, o.accent, DEFAULT_UI_PREFS.accent),
    font: pick(FONT_SIZES, o.font, DEFAULT_UI_PREFS.font),
    density: pick(DENSITIES, o.density, DEFAULT_UI_PREFS.density),
    radius: pick(RADII, o.radius, DEFAULT_UI_PREFS.radius),
  };
}

export function applyUiPrefs(p: UiPrefs): void {
  const d = document.documentElement.dataset;
  d.accent = p.accent;
  d.font = p.font;
  d.density = p.density;
  d.radius = p.radius;
}

/** Đọc/đổi tùy chọn: đổi là lưu và áp ngay, không cần nút Lưu. */
export function useUiPrefs() {
  const [prefs, setPrefs] = useState(readUiPrefs);
  const save = (next: UiPrefs) => {
    writeStorage(KEY, JSON.stringify(next));
    applyUiPrefs(next);
    setPrefs(next);
  };
  return {
    prefs,
    update: (patch: Partial<UiPrefs>) => save({ ...prefs, ...patch }),
    reset: () => save(DEFAULT_UI_PREFS),
  };
}
```

- [ ] **Step 8: Áp tùy chọn trước khi vẽ (`index.html`, `main.tsx`)**

`client/index.html` – đổi `<meta name="theme-color" content="#0b2f25" />` thành `<meta name="theme-color" content="#2563eb" />`, và thêm ngay sau dòng `<title>Tạp hóa</title>`:

```html
    <!-- Áp tùy chỉnh giao diện trước khi vẽ để không nháy (xem src/lib/ui-prefs.ts) -->
    <script>
      try {
        var p = JSON.parse(localStorage.getItem('tiny-pos:ui') || 'null');
        ['accent', 'font', 'density', 'radius'].forEach(function (k) {
          if (p && typeof p[k] === 'string') document.documentElement.dataset[k] = p[k];
        });
      } catch (e) {}
    </script>
```

`client/src/main.tsx`:
- thêm import sau dòng `import { TooltipProvider } from '@/components/ui/tooltip';`: `import { applyUiPrefs, readUiPrefs } from '@/lib/ui-prefs';`
- thêm trước dòng `const queryClient = …`:

```ts
// Chuẩn hóa data-* (script trong index.html chỉ chép thô từ localStorage)
applyUiPrefs(readUiPrefs());
```

- đổi `<ThemeProvider attribute="class" defaultTheme="light" disableTransitionOnChange>` thành `<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>`.

`client/public/icon.svg`: đổi `fill="#16a34a"` thành `fill="#2563eb"`.

- [ ] **Step 9: Bảng màu, mật độ, bo góc, cỡ chữ trong `index.css`**

Trong `client/src/index.css`:

(a) Trong khối `@theme inline { … }`, thêm hai dòng ngay sau dòng `--color-destructive: var(--destructive);`:

```css
  --color-success: var(--success);
  --color-warning: var(--warning);
```

(b) Thay **toàn bộ** từ dòng `/* Bảng màu: xanh lá emerald …` đến hết khối `.dark { … }` (kết thúc trước `@layer base {`) bằng:

```css
/* Màu nhấn: 5 sắc độ, token bên dưới đọc qua --a-*. Đổi bằng data-accent trên <html> (Cài đặt → Giao diện). */
:root {
  --a-50: #eff6ff;
  --a-300: #93c5fd;
  --a-500: #3b82f6;
  --a-600: #2563eb;
  --a-700: #1d4ed8;
}
[data-accent='green'] {
  --a-50: #ecfdf5;
  --a-300: #6ee7b7;
  --a-500: #10b981;
  --a-600: #059669;
  --a-700: #047857;
}
[data-accent='violet'] {
  --a-50: #f5f3ff;
  --a-300: #c4b5fd;
  --a-500: #8b5cf6;
  --a-600: #7c3aed;
  --a-700: #6d28d9;
}
[data-accent='orange'] {
  --a-50: #fff7ed;
  --a-300: #fdba74;
  --a-500: #f97316;
  --a-600: #ea580c;
  --a-700: #c2410c;
}
[data-accent='rose'] {
  --a-50: #fff1f2;
  --a-300: #fda4af;
  --a-500: #f43f5e;
  --a-600: #e11d48;
  --a-700: #be123c;
}
[data-accent='slate'] {
  --a-50: #f1f5f9;
  --a-300: #cbd5e1;
  --a-500: #64748b;
  --a-600: #334155;
  --a-700: #1e293b;
}

/* Bảng màu: nền trắng, trung tính slate, phẳng. Trang chỉ dùng token, không viết mã màu. */
:root {
  --background: #f8fafc;
  --foreground: #0f172a;
  --card: #ffffff;
  --card-foreground: #0f172a;
  --popover: #ffffff;
  --popover-foreground: #0f172a;
  --primary: var(--a-600);
  --primary-foreground: #ffffff;
  --secondary: #f1f5f9;
  --secondary-foreground: #1e293b;
  --muted: #f1f5f9;
  --muted-foreground: #64748b;
  --accent: var(--a-50);
  --accent-foreground: var(--a-700);
  --destructive: #dc2626;
  --success: #16a34a;
  --warning: #d97706;
  --border: #e2e8f0;
  --input: #cbd5e1;
  --ring: var(--a-500);
  --chart-1: #2563eb;
  --chart-2: #10b981;
  --chart-3: #f59e0b;
  --chart-4: #8b5cf6;
  --chart-5: #ef4444;
  --radius: 0.5rem;
  --sidebar: #ffffff;
  --sidebar-foreground: #334155;
  --sidebar-primary: var(--a-600);
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: var(--a-50);
  --sidebar-accent-foreground: var(--a-700);
  --sidebar-border: #e2e8f0;
  --sidebar-ring: var(--a-500);
  /* Mật độ (data-density): đệm dọc ô bảng, đệm trang, khoảng giữa các khối */
  --row-py: 0.5rem;
  --page-p: 1.25rem;
  --gap: 1rem;
}

.dark {
  --background: #0b1120;
  --foreground: #e2e8f0;
  --card: #111827;
  --card-foreground: #e2e8f0;
  --popover: #111827;
  --popover-foreground: #e2e8f0;
  --primary: var(--a-500);
  --primary-foreground: #ffffff;
  --secondary: #1e293b;
  --secondary-foreground: #e2e8f0;
  --muted: #1e293b;
  --muted-foreground: #94a3b8;
  --accent: color-mix(in oklab, var(--a-500) 18%, transparent);
  --accent-foreground: var(--a-300);
  --destructive: #f87171;
  --success: #4ade80;
  --warning: #fbbf24;
  --border: rgb(255 255 255 / 0.1);
  --input: rgb(255 255 255 / 0.15);
  --ring: var(--a-500);
  --sidebar: #0f172a;
  --sidebar-foreground: #cbd5e1;
  --sidebar-primary: var(--a-500);
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: color-mix(in oklab, var(--a-500) 18%, transparent);
  --sidebar-accent-foreground: var(--a-300);
  --sidebar-border: rgb(255 255 255 / 0.08);
  --sidebar-ring: var(--a-500);
}

[data-density='comfy'] {
  --row-py: 0.75rem;
  --page-p: 2rem;
  --gap: 1.5rem;
}
[data-radius='none'] {
  --radius: 0.25rem;
}
[data-radius='lg'] {
  --radius: 0.875rem;
}
```

(c) Trong `@layer base`, thay

```css
  html {
    /* Chữ to cho người lớn tuổi: mọi kích thước rem đều phóng theo */
    font-size: 18px;
    @apply font-sans;
  }
```

bằng

```css
  html {
    /* Cỡ chữ gốc theo data-font (Cài đặt → Giao diện): mọi kích thước rem phóng theo */
    font-size: 16px;
    @apply font-sans;
  }
  html[data-font='sm'] {
    font-size: 14px;
  }
  html[data-font='lg'] {
    font-size: 18px;
  }
  html[data-font='xl'] {
    font-size: 20px;
  }
```

(d) Xóa toàn bộ khối `@layer components { … }` (gradient nút + bóng thẻ, kể cả comment phía trên nó) và thay bằng:

```css
/* Mật độ bảng: để ngoài @layer để thắng class py-* đặt riêng ở từng ô */
[data-slot='table-cell'] {
  padding-block: var(--row-py);
}
```

Giữ nguyên khối scrollbar và toàn bộ phần in (`@page`, `#print-root`, `@media print`).

- [ ] **Step 10: Typecheck**

Run: `npm run typecheck`
Expected: không lỗi.

- [ ] **Step 11: Kiểm trên trình duyệt**

`t1.mjs`:

```js
import { BASE, check, withPage } from './harness.mjs';

const css = (page, name) => page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);
const fontPx = (page) => page.evaluate(() => getComputedStyle(document.documentElement).fontSize);

// Mặc định: xanh dương, 16px, nút chính phẳng
await withPage(async (page) => {
  await page.goto(`${BASE}/products`);
  await page.waitForLoadState('networkidle');
  check('mặc định accent blue', (await page.evaluate(() => document.documentElement.dataset.accent)) === 'blue');
  check('--primary = #2563eb', (await css(page, '--a-600')) === '#2563eb', await css(page, '--a-600'));
  check('cỡ chữ 16px', (await fontPx(page)) === '16px', await fontPx(page));
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector('[data-slot=button][data-variant=default]')).backgroundImage);
  check('nút chính không gradient', bg === 'none', bg);
});

// Tùy chọn đã lưu: áp trước khi vẽ và giữ sau reload
await withPage(
  async (page) => {
    await page.goto(`${BASE}/products`, { waitUntil: 'domcontentloaded' });
    check('data-accent green ngay lúc domcontentloaded', (await page.evaluate(() => document.documentElement.dataset.accent)) === 'green');
    check('cỡ chữ xl = 20px', (await fontPx(page)) === '20px', await fontPx(page));
    check('--radius lg', (await css(page, '--radius')) === '0.875rem', await css(page, '--radius'));
    await page.reload();
    check('reload vẫn green', (await page.evaluate(() => document.documentElement.dataset.accent)) === 'green');
  },
  { prefs: { accent: 'green', font: 'xl', density: 'comfy', radius: 'lg' } },
);

// localStorage hỏng: dùng mặc định, không lỗi
for (const raw of ['{"accent":"purple","font":42}', '5', '{hỏng']) {
  await withPage(
    async (page) => {
      await page.goto(`${BASE}/products`);
      await page.waitForLoadState('networkidle');
      check(`raw ${raw}: accent về blue`, (await page.evaluate(() => document.documentElement.dataset.accent)) === 'blue');
      check(`raw ${raw}: font về md`, (await page.evaluate(() => document.documentElement.dataset.font)) === 'md');
    },
    { raw },
  );
}

// Chế độ tối theo máy
await withPage(
  async (page) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(`${BASE}/products`);
    await page.waitForLoadState('networkidle');
    check('theo máy: tối', await page.evaluate(() => document.documentElement.classList.contains('dark')));
    await page.screenshot({ path: 't1-dark.png' });
  },
  { theme: 'system' },
);
```

Run: `node t1.mjs`
Expected: mọi dòng `PASS`, `WRITES []`, cuối `ALL PASS`. Đọc `t1-dark.png`: nền slate đậm, nút xanh dương.

---

### Task 2: Khung trang – AppShell, sidebar nhóm menu, PageTitle

**Files:**
- Create: `client/src/components/layout/AppShell.tsx`, `client/src/components/layout/AppSidebar.tsx`, `client/src/components/layout/PageTitle.tsx`
- Modify: `client/src/App.tsx` (viết lại), `client/src/router.tsx` (NAV), `client/src/components/ThemeToggle.tsx` (cỡ nút), `client/src/components/MobileMoreMenu.tsx` (không đổi hành vi, chỉ nhận `items` mới)
- Delete: `client/src/components/Topbar.tsx`

**Interfaces:**
- Consumes: `APP_VERSION` (`@/lib/version`), shadcn `Sidebar*`, `useSettings` (`@/api/settings`).
- Produces: `PageTitle` và `type PageAction` từ `@/components/layout/PageTitle`:

```ts
export interface PageAction {
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  to?: string;
  form?: string;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
}
// <PageTitle title: string; count?: string; back?: string; actions?: PageAction[] />
```

`NAV: NavItem[]` với `group: 'sell' | 'stock' | 'other'`, `NAV_GROUPS`. Trang chưa chuyển vẫn hiện `PageHeader` cũ trong thân trang; topbar hiện tên mục menu làm tiêu đề dự phòng.

- [ ] **Step 1: `router.tsx` – NAV theo nhóm, bỏ Nhập nhanh khỏi menu**

Trong `client/src/router.tsx`:
- dòng import lucide: bỏ `ScanBarcode` (không còn dùng).
- thay khối từ `export interface NavItem {` đến hết mảng `NAV` bằng:

```ts
export type NavGroup = 'sell' | 'stock' | 'other';

export const NAV_GROUPS: { key: NavGroup; label: string }[] = [
  { key: 'sell', label: 'Bán hàng' },
  { key: 'stock', label: 'Kho hàng' },
  { key: 'other', label: 'Khác' },
];

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  group: NavGroup;
  /** Hiện trên thanh dưới điện thoại (tối đa 4 mục, còn lại vào nút "Thêm"). */
  mobile?: boolean;
}

/** Nhập nhanh không có trong menu: mở từ nút trên trang Sản phẩm (route vẫn giữ). */
export const NAV: NavItem[] = [
  { to: '/sell', label: 'Bán hàng', icon: ShoppingCart, group: 'sell', mobile: true },
  { to: '/orders', label: 'Hóa đơn', icon: ReceiptText, group: 'sell', mobile: true },
  { to: '/customers', label: 'Khách hàng', icon: Users, group: 'sell' },
  { to: '/products', label: 'Sản phẩm', icon: Package, group: 'stock', mobile: true },
  { to: '/imports', label: 'Nhập hàng', icon: PackageOpen, group: 'stock' },
  { to: '/stocktake', label: 'Kiểm kê', icon: ClipboardList, group: 'stock', mobile: true },
  { to: '/categories', label: 'Danh mục', icon: FolderOpen, group: 'stock' },
  { to: '/suppliers', label: 'Nhà cung cấp', icon: Truck, group: 'other' },
  { to: '/settings', label: 'Cài đặt', icon: Settings, group: 'other' },
];

/** Mục menu đang mở; Nhập nhanh thuộc Sản phẩm. */
export function activeNav(pathname: string): NavItem | undefined {
  const path = pathname === '/quick-add' ? '/products' : pathname;
  return NAV.find((n) => path.startsWith(n.to));
}
```

Route `/quick-add` trong `AppRoutes` giữ nguyên.

- [ ] **Step 2: `PageTitle.tsx`**

Tạo `client/src/components/layout/PageTitle.tsx`:

```tsx
import { createContext, useContext, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Ellipsis, type LucideIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useSettings } from '@/api/settings';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface PageAction {
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  /** Đường dẫn: nút là link. */
  to?: string;
  /** Id của form: nút là nút submit của form đó (nút nằm trên topbar, ngoài form). */
  form?: string;
  /** Nút chính (tối đa 1): màu nhấn; trên điện thoại hiện thành nút icon. */
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
}

interface Props {
  title: string;
  /** Chữ phụ cạnh tiêu đề, ví dụ "78 mặt hàng". */
  count?: string;
  /** Trang con: đường dẫn của nút ← quay lại. */
  back?: string;
  actions?: PageAction[];
}

/** Ô tiêu đề trên topbar do AppShell tạo; PageTitle vẽ vào đó bằng portal. */
export const TitleSlotContext = createContext<HTMLElement | null>(null);

function DesktopAction({ a }: { a: PageAction }) {
  const Icon = a.icon;
  const variant = a.primary ? 'default' : 'outline';
  const className = cn('h-9 px-3', a.danger && !a.primary && 'text-destructive');
  const inner = (
    <>
      <Icon data-icon="inline-start" />
      {a.label}
    </>
  );
  if (a.to)
    return (
      <Button variant={variant} className={className} asChild>
        <Link to={a.to}>{inner}</Link>
      </Button>
    );
  return (
    <Button type={a.form ? 'submit' : 'button'} form={a.form} variant={variant} className={className} disabled={a.disabled} onClick={a.onClick}>
      {inner}
    </Button>
  );
}

/** Điện thoại: nút chính thành nút icon, các nút còn lại vào menu ⋯. */
function MobileActions({ actions }: { actions: PageAction[] }) {
  const navigate = useNavigate();
  const primary = actions.find((a) => a.primary);
  const rest = actions.filter((a) => a !== primary);
  const run = (a: PageAction) => {
    if (a.to) navigate(a.to);
    else if (a.form) (document.getElementById(a.form) as HTMLFormElement | null)?.requestSubmit();
    else a.onClick?.();
  };
  const PrimaryIcon = primary?.icon;
  return (
    <div className="flex items-center gap-1">
      {primary && PrimaryIcon && (
        <Button size="icon-lg" className="size-11" aria-label={primary.label} title={primary.label} disabled={primary.disabled} onClick={() => run(primary)}>
          <PrimaryIcon />
        </Button>
      )}
      {rest.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-lg" className="size-11" aria-label="Thao tác khác">
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            {rest.map((a) => (
              <DropdownMenuItem
                key={a.label}
                className="h-11 text-base"
                variant={a.danger ? 'destructive' : 'default'}
                disabled={a.disabled}
                onSelect={() => run(a)}
              >
                <a.icon />
                {a.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

/** Tiêu đề trang + nút hành động trên topbar; tại chỗ không vẽ gì. */
export function PageTitle({ title, count, back, actions = [] }: Props) {
  const slot = useContext(TitleSlotContext);
  const { data: settings } = useSettings();
  const store = settings?.storeName || 'Tạp hóa';
  useEffect(() => {
    document.title = `${title} · ${store}`;
  }, [title, store]);
  if (!slot) return null;
  return createPortal(
    <>
      {back && (
        <Button variant="ghost" size="icon-lg" className="-ml-2 size-11 md:size-9" aria-label="Quay lại" title="Quay lại" asChild>
          <Link to={back}>
            <ArrowLeft />
          </Link>
        </Button>
      )}
      <div className="flex min-w-0 items-baseline gap-2">
        <h1 className="truncate font-heading text-lg font-semibold">{title}</h1>
        {count && <span className="hidden shrink-0 text-sm text-muted-foreground tabular-nums sm:inline">{count}</span>}
      </div>
      {actions.length > 0 && (
        <>
          <div className="ml-auto hidden items-center gap-2 md:flex">
            {actions.map((a) => (
              <DesktopAction key={a.label} a={a} />
            ))}
          </div>
          <div className="ml-auto md:hidden">
            <MobileActions actions={actions} />
          </div>
        </>
      )}
    </>,
    slot,
  );
}
```

- [ ] **Step 3: `AppSidebar.tsx`**

Tạo `client/src/components/layout/AppSidebar.tsx`:

```tsx
import { Store } from 'lucide-react';
import { NavLink, useLocation } from 'react-router';
import { useSettings } from '@/api/settings';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { APP_VERSION } from '@/lib/version';
import { activeNav, NAV, NAV_GROUPS } from '@/router';

/** Sidebar máy tính: tên cửa hàng, menu theo nhóm, version ở chân. Điện thoại dùng thanh dưới (AppShell). */
export function AppSidebar() {
  const { data: settings } = useSettings();
  const { pathname } = useLocation();
  const current = activeNav(pathname);
  return (
    <Sidebar collapsible="none" className="sticky top-0 hidden h-svh border-r md:flex">
      <SidebarHeader className="border-b px-3 py-3">
        <div className="flex items-center gap-2.5">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Store className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate font-heading font-semibold text-foreground">{settings?.storeName || 'Tạp hóa'}</div>
            {settings?.storeAddress && <div className="truncate text-xs text-muted-foreground">{settings.storeAddress}</div>}
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {NAV_GROUPS.map((g) => (
          <SidebarGroup key={g.key}>
            <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV.filter((n) => n.group === g.key).map(({ to, label, icon: Icon }) => (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton asChild isActive={current?.to === to} className="h-9 text-sm">
                      <NavLink to={to}>
                        <Icon />
                        {label}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t px-4 py-3 text-xs text-muted-foreground">Phiên bản {APP_VERSION}</SidebarFooter>
    </Sidebar>
  );
}
```

- [ ] **Step 4: `AppShell.tsx`**

Tạo `client/src/components/layout/AppShell.tsx` (thanh dưới điện thoại chép từ `App.tsx` cũ, giữ nguyên chiều cao 68px vì thanh Thanh toán bám ngay trên):

```tsx
import { useState, type CSSProperties, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router';
import { MobileMoreMenu } from '@/components/MobileMoreMenu';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SidebarProvider } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { activeNav, NAV } from '@/router';
import { AppSidebar } from './AppSidebar';
import { TitleSlotContext } from './PageTitle';

function todayLabel(): string {
  const s = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Khung app: sidebar + topbar trên máy tính, header + thanh dưới trên điện thoại. Trang đưa tiêu đề/nút lên topbar bằng PageTitle. */
export function AppShell({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const { pathname } = useLocation();
  // Màn Bán hàng dùng hết chiều rộng và chiều cao còn lại
  const fullBleed = pathname === '/sell';

  return (
    <SidebarProvider style={{ '--sidebar-width': '14rem' } as CSSProperties}>
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur md:h-12 md:px-(--page-p)">
          <div ref={setSlot} className="flex min-w-0 flex-1 items-center gap-2">
            {/* Tiêu đề dự phòng khi trang chưa có PageTitle: ẩn ngay khi portal vẽ nội dung vào ô */}
            <span className="hidden truncate font-heading text-lg font-semibold only:block">{activeNav(pathname)?.label ?? 'Tạp hóa'}</span>
          </div>
          <span className="hidden text-sm text-muted-foreground lg:inline">{todayLabel()}</span>
          <div className="hidden md:block">
            <ThemeToggle />
          </div>
        </header>
        <TitleSlotContext.Provider value={slot}>
          {/* Mỗi nhánh đủ bộ padding riêng: cn của dự án không gộp class trùng */}
          <main className={cn('flex-1', fullBleed ? 'px-3 pt-3 pb-28 md:p-4' : 'px-4 pt-(--page-p) pb-28 md:px-(--page-p) md:pb-(--page-p)')}>
            {fullBleed ? children : <div className="mx-auto max-w-7xl">{children}</div>}
          </main>
        </TitleSlotContext.Provider>
      </div>

      {/* Cao cố định 68px (+ safe-area) vì thanh Thanh toán ở màn Bán hàng bám ngay trên nó */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(68px+env(safe-area-inset-bottom))] border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {NAV.filter((n) => n.mobile).map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] leading-4 font-medium whitespace-nowrap', isActive ? 'text-primary' : 'text-muted-foreground')
            }
          >
            {({ isActive }) => (
              <>
                <span className={cn('grid h-8 w-14 place-items-center rounded-full transition-colors', isActive && 'bg-accent')}>
                  <Icon className="size-5" />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
        <MobileMoreMenu items={NAV.filter((n) => !n.mobile)} />
      </nav>
    </SidebarProvider>
  );
}
```

- [ ] **Step 5: `App.tsx`, `ThemeToggle.tsx`, xóa `Topbar.tsx`**

Thay toàn bộ `client/src/App.tsx` bằng:

```tsx
import { AppShell } from '@/components/layout/AppShell';
import { AppRoutes } from './router';

export default function App() {
  return (
    <AppShell>
      <AppRoutes />
    </AppShell>
  );
}
```

`client/src/components/ThemeToggle.tsx`: đổi `size="icon-lg"` thành `size="icon"` (topbar 48px).

```bash
git rm client/src/components/Topbar.tsx
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: không lỗi (không còn import `Topbar`, không còn `disabled` trong `NavItem`).

- [ ] **Step 7: Kiểm trên trình duyệt**

`t2.mjs`:

```js
import { BASE, check, withPage } from './harness.mjs';

await withPage(async (page) => {
  await page.goto(`${BASE}/products`);
  await page.waitForLoadState('networkidle');
  const labels = await page.locator('[data-sidebar=group-label]').allInnerTexts();
  check('3 nhóm menu', JSON.stringify(labels.map((s) => s.trim().toLowerCase())) === JSON.stringify(['bán hàng', 'kho hàng', 'khác']), labels);
  check('9 mục menu', (await page.locator('[data-sidebar=menu-button]').count()) === 9);
  check('không còn Nhập nhanh trong menu', (await page.locator('[data-sidebar=menu-button]', { hasText: 'Nhập nhanh' }).count()) === 0);
  check('chân sidebar có version', (await page.getByText('Phiên bản 0.5.0').count()) === 1);
  check('không còn thẻ Giai đoạn 3', (await page.getByText('Giai đoạn 3').count()) === 0);
  check('không còn avatar TH', (await page.locator('header').getByText('TH', { exact: true }).count()) === 0);
  check('mục Sản phẩm đang chọn', (await page.locator('[data-sidebar=menu-button][data-active=true]').innerText()).includes('Sản phẩm'));
  await page.locator('[data-sidebar=menu-button]', { hasText: 'Khách hàng' }).click();
  await page.waitForURL('**/customers');
  check('bấm menu chuyển trang', (await page.locator('[data-sidebar=menu-button][data-active=true]').innerText()).includes('Khách hàng'));
  await page.screenshot({ path: 't2-desk.png' });
});

await withPage(
  async (page) => {
    await page.goto(`${BASE}/products`);
    await page.waitForLoadState('networkidle');
    check('điện thoại ẩn sidebar', !(await page.locator('[data-slot=sidebar]').first().isVisible()));
    check('thanh dưới 4 mục + Thêm', (await page.locator('nav.fixed a').count()) === 4);
    check('không cuộn ngang', (await page.evaluate(() => document.documentElement.scrollWidth)) <= 390);
    await page.screenshot({ path: 't2-mob.png', fullPage: true });
  },
  { width: 390, height: 844 },
);
```

Run: `node t2.mjs` → `ALL PASS`. Đọc hai ảnh: sidebar trắng, nhóm menu, mục đang chọn nền xanh nhạt; topbar hiện tiêu đề dự phòng "Sản phẩm" (trang vẫn còn `PageHeader` cũ trong thân – sẽ chuyển ở Task 4).

Nếu thuộc tính `data-sidebar`/`data-active` của bản shadcn đang cài khác tên, mở `components/ui/sidebar.tsx`, đọc tên thật và sửa selector trong script (không sửa component cho khớp script).

---

### Task 3: Component dùng chung – StatStrip, ListPanel, DateField, bảng, dialog

**Files:**
- Create: `client/src/components/StatStrip.tsx`, `client/src/components/ListPanel.tsx`, `client/src/components/SearchInput.tsx`, `client/src/components/DateField.tsx`, `client/src/components/TableSkeleton.tsx`
- Modify: `client/src/components/DayPicker.tsx`, `client/src/components/EmptyState.tsx`, `client/src/components/ProductAvatar.tsx`, `client/src/components/SelectField.tsx` (thêm `ToolbarSelect`), `client/src/components/ui/dialog.tsx`, `client/src/components/ui/table.tsx`
- Modify (chỉ className của `DialogContent`): 18 file dialog liệt kê ở Step 8

**Interfaces:**
- Consumes: `formatDateVn` (shared), `Calendar` (`@/components/ui/calendar`), token `text-success`/`text-warning`.
- Produces:
  - `Stat({ label: string; value: string; hint?: string; tone?: 'default' | 'success' | 'warning' | 'danger' })`, `StatStrip({ cols?: 3 | 4 | 6; children })`
  - `ListPanel({ toolbar?: ReactNode; footer?: ReactNode; children; className? })`
  - `SearchInput({ id?: string; value: string; onChange: (v: string) => void; placeholder: string; hotkey?: string; className? })`
  - `DateField({ value: string; onChange: (v: string) => void; max?: string; id?: string; className?: string; 'aria-label'?: string })` – giá trị `YYYY-MM-DD`
  - `TableSkeleton({ rows?: number })`
  - `ToolbarSelect({ value: string; onChange: (v: string) => void; options: SelectOption[]; emptyLabel: string; 'aria-label': string; className? })` – `''` = không lọc
  - `DialogContent` nhận thêm `size?: 'sm' | 'md' | 'lg' | 'xl'` (mặc định `md`)

- [ ] **Step 1: `StatStrip.tsx`**

```tsx
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'default' | 'success' | 'warning' | 'danger';
const tones: Record<Tone, string> = { default: '', success: 'text-success', warning: 'text-warning', danger: 'text-destructive' };

export interface StatProps {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
}

/** Một ô số liệu: nhãn, giá trị đậm, gợi ý. Giá trị không bị cắt "…" (xuống dòng nếu quá dài). */
export function Stat({ label, value, hint, tone = 'default' }: StatProps) {
  return (
    <div className="min-w-0 rounded-lg border bg-card px-4 py-3">
      <div className="truncate text-sm text-muted-foreground">{label}</div>
      <div className={cn('font-heading text-xl leading-tight font-semibold tracking-tight wrap-break-word tabular-nums xl:text-2xl', tones[tone])}>
        {value}
      </div>
      {hint && (
        <div className="truncate text-xs text-muted-foreground" title={hint}>
          {hint}
        </div>
      )}
    </div>
  );
}

const colClass = { 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 6: 'lg:grid-cols-3 2xl:grid-cols-6' } as const;

/** Hàng số liệu đầu trang: 2 cột trên điện thoại, `cols` cột trên máy tính. */
export function StatStrip({ cols = 4, children }: { cols?: keyof typeof colClass; children: ReactNode }) {
  return <div className={cn('mb-(--gap) grid grid-cols-2 gap-3', colClass[cols])}>{children}</div>;
}
```

- [ ] **Step 2: `ListPanel.tsx`, `SearchInput.tsx`, `TableSkeleton.tsx`**

`client/src/components/ListPanel.tsx`:

```tsx
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Khung danh sách: thanh công cụ (tìm, lọc), nội dung (bảng/thẻ), chân (phân trang, tổng). */
export function ListPanel({ toolbar, footer, children, className }: { toolbar?: ReactNode; footer?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('overflow-hidden rounded-lg border bg-card', className)}>
      {toolbar && <div className="flex flex-wrap items-center gap-2 border-b p-3">{toolbar}</div>}
      {children}
      {footer}
    </section>
  );
}
```

`client/src/components/SearchInput.tsx`:

```tsx
import { Search } from 'lucide-react';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Kbd } from '@/components/ui/kbd';
import { cn } from '@/lib/utils';

interface Props {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  /** Phím tắt hiện ở cuối ô (máy tính), ví dụ "/". */
  hotkey?: string;
  className?: string;
}

/** Ô tìm trong thanh công cụ danh sách: cao 44px trên điện thoại, 40px trên máy tính. */
export function SearchInput({ id, value, onChange, placeholder, hotkey, className }: Props) {
  return (
    <InputGroup className={cn('h-11 min-w-0 flex-1 basis-60 md:h-10', className)}>
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput id={id} type="search" className="text-base" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      {hotkey && (
        <InputGroupAddon align="inline-end" className="hidden md:flex">
          <Kbd>{hotkey}</Kbd>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}
```

`client/src/components/TableSkeleton.tsx`:

```tsx
import { Skeleton } from '@/components/ui/skeleton';

/** Khung xám giữ chỗ khi bảng đang tải. */
export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-3" aria-busy="true" aria-label="Đang tải">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: `ToolbarSelect` trong `SelectField.tsx`**

Thêm vào cuối `client/src/components/SelectField.tsx` (dùng lại `NONE` và cách bỏ qua `''` của Radix đã có trong file):

```tsx
interface ToolbarSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Nhãn khi không lọc (value = ''), ví dụ "Tất cả danh mục". */
  emptyLabel: string;
  'aria-label': string;
  className?: string;
}

/** Ô chọn gọn trong thanh công cụ danh sách (không có nhãn phía trên). */
export function ToolbarSelect({ value, onChange, options, emptyLabel, className, 'aria-label': ariaLabel }: ToolbarSelectProps) {
  return (
    <Select value={value || NONE} onValueChange={(v) => v !== '' && onChange(v === NONE ? '' : v)}>
      <SelectTrigger aria-label={ariaLabel} className={cn('h-11 min-w-44 bg-card text-base data-[size=default]:h-11 md:h-10 md:data-[size=default]:h-10', className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" sideOffset={4}>
        <SelectItem value={NONE} className="py-2 text-base">
          {emptyLabel}
        </SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="py-2 text-base">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

và thêm `import { cn } from '@/lib/utils';` vào đầu file.

- [ ] **Step 4: `DateField.tsx` và `DayPicker.tsx`**

`client/src/components/DateField.tsx`:

```tsx
import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { vi } from 'react-day-picker/locale';
import { formatDateVn } from '@tiny-pos/shared';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface Props {
  /** "YYYY-MM-DD" */
  value: string;
  onChange: (value: string) => void;
  /** Ngày muộn nhất được chọn, "YYYY-MM-DD". */
  max?: string;
  id?: string;
  className?: string;
  'aria-label'?: string;
}

const toDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
};
const toYmd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Ô ngày kiểu Việt Nam (dd/mm/yyyy, tuần bắt đầu Thứ Hai) thay cho <input type="date"> hiện theo locale máy. */
export function DateField({ value, onChange, max, id, className, 'aria-label': ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const selected = toDate(value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} variant="outline" aria-label={ariaLabel} className={cn('h-11 justify-start gap-2 px-3 text-base tabular-nums md:h-10', className)}>
          <CalendarDays data-icon="inline-start" />
          {formatDateVn(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={vi}
          weekStartsOn={1}
          selected={selected}
          defaultMonth={selected}
          disabled={max ? { after: toDate(max) } : undefined}
          onSelect={(d) => {
            if (!d) return;
            onChange(toYmd(d));
            setOpen(false);
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
```

`client/src/components/DayPicker.tsx` – thay phần thân `DayPicker` (giữ `today`), bỏ import `Input`, thêm `import { DateField } from '@/components/DateField';`:

```tsx
/** Chọn ngày: ◀ ô ngày ▶, và nút "Hôm nay" khi đang xem ngày khác. */
export function DayPicker({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const isToday = value === today();
  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="icon-lg" className="size-11 md:size-10" aria-label="Ngày trước" onClick={() => onChange(shiftDate(value, -1))}>
        <ChevronLeft />
      </Button>
      <DateField value={value} max={today()} onChange={onChange} aria-label="Chọn ngày" className="w-40" />
      <Button variant="outline" size="icon-lg" className="size-11 md:size-10" aria-label="Ngày sau" disabled={isToday} onClick={() => onChange(shiftDate(value, 1))}>
        <ChevronRight />
      </Button>
      {!isToday && (
        <Button variant="ghost" className="h-11 md:h-10" onClick={() => onChange(today())}>
          Hôm nay
        </Button>
      )}
    </div>
  );
}
```

Nếu `react-day-picker/locale` không có sẵn (bản react-day-picker < 9), kiểm tra `client/package.json`; shadcn `calendar` hiện dùng v9 có export này.

- [ ] **Step 5: `EmptyState.tsx`, `ProductAvatar.tsx`**

`EmptyState.tsx` – thay thân component:

```tsx
/** Trạng thái rỗng gọn: icon nhỏ, tiêu đề, hướng dẫn, nút tùy chọn. */
export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <Empty className="py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="size-10 rounded-lg bg-muted text-muted-foreground [&_svg]:size-5">
          <Icon />
        </EmptyMedia>
        <EmptyTitle className="text-base">{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}
```

`ProductAvatar.tsx` – ô chữ cái phẳng (nền nhạt, chữ đậm) thay gradient:
- đổi `export const GRADIENTS = [ … ];` thành

```ts
export const TINTS = [
  'bg-blue-500/12 text-blue-700 dark:text-blue-300',
  'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
  'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  'bg-violet-500/12 text-violet-700 dark:text-violet-300',
  'bg-rose-500/12 text-rose-700 dark:text-rose-300',
  'bg-cyan-500/12 text-cyan-700 dark:text-cyan-300',
];
```

- đổi `gradientFor` thành `tintFor` (thân giữ nguyên, trả `TINTS[h % TINTS.length]!`), comment đầu component thành `/** Ô chữ cái đầu nền nhạt thay cho ảnh sản phẩm (chưa có chụp ảnh). */`
- className của `div`: `'grid size-10 shrink-0 place-items-center rounded-lg text-sm font-semibold'`, `tintFor(name)`, `className`.

(Ngoại lệ có chủ đích với quy tắc "không mã màu cứng": đây là bảng màu phân biệt tên, không phải màu trạng thái.) Kiểm `grep -rn "gradientFor\|GRADIENTS" client/src` không còn chỗ nào.

- [ ] **Step 6: `ui/table.tsx` – tiêu đề cột gọn**

Trong `TableHead`, đổi chuỗi class `"h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0"` thành `"h-9 px-2 text-left align-middle text-xs font-medium whitespace-nowrap text-muted-foreground [&:has([role=checkbox])]:pr-0"`.

- [ ] **Step 7: `ui/dialog.tsx` – prop `size`**

Trong `DialogContent`:
- thêm trước hàm: 

```tsx
const dialogSizes = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-3xl' } as const
```

- chữ ký: thêm `size = "md",` sau `showCloseButton = true,` và kiểu `& { showCloseButton?: boolean; size?: keyof typeof dialogSizes }`
- trong chuỗi class, thay `sm:max-w-sm` bằng `max-h-[90dvh] overflow-y-auto`, và đổi `className` thành `cn("…chuỗi cũ đã sửa…", dialogSizes[size], className)`.

- [ ] **Step 8: Chuyển 18 dialog sang `size`**

Mỗi dòng: đổi `className` của `DialogContent` như bảng (bỏ `max-h-[95vh]`, `overflow-y-auto`, `sm:max-w-*` vì đã có trong `size`):

| File | Cũ | Mới |
|---|---|---|
| `pages/categories/CategoryFormDialog.tsx` | `className="gap-0 p-0 sm:max-w-md"` | `size="sm" className="gap-0 p-0"` |
| `pages/customers/CollectDebtDialog.tsx` | `className="max-h-[95vh] overflow-y-auto sm:max-w-md"` | `size="sm"` |
| `pages/customers/CustomerDetailDialog.tsx` | `className="max-h-[95vh] overflow-y-auto sm:max-w-lg"` | (bỏ className) |
| `pages/customers/CustomerFormDialog.tsx` | `className="sm:max-w-md"` | `size="sm"` |
| `pages/customers/ManualDebtDialog.tsx` | `className="sm:max-w-md"` | `size="sm"` |
| `pages/imports/ImportDetailDialog.tsx` | `className="max-h-[95vh] overflow-y-auto sm:max-w-lg"` | (bỏ className) |
| `pages/orders/OrderDetailDialog.tsx` | `className="max-h-[95vh] overflow-y-auto sm:max-w-lg"` | (bỏ className) |
| `pages/products/CsvDialog.tsx` | `className="gap-0 p-0 sm:max-w-xl"` | `size="lg" className="gap-0 p-0"` |
| `pages/products/ProductFormDialog.tsx` | `className="max-h-[95vh] gap-0 overflow-y-auto p-0 sm:max-w-3xl"` | `size="xl" className="gap-0 p-0"` |
| `pages/products/StockHistoryDialog.tsx` | `className="max-h-[95vh] overflow-y-auto sm:max-w-2xl"` | `size="lg"` |
| `pages/sell/CheckoutDialog.tsx` | `className="sm:max-w-lg"` | (bỏ className) |
| `pages/sell/CustomItemDialog.tsx` | `className="sm:max-w-md"` | `size="sm"` |
| `pages/sell/WeighDialog.tsx` | `className="sm:max-w-md"` | `size="sm"` |
| `pages/stocktake/CountDialog.tsx` | `className="sm:max-w-md"` | `size="sm"` |
| `pages/stocktake/StocktakeDetailDialog.tsx` | `className="max-h-[95vh] overflow-y-auto sm:max-w-2xl"` | `size="lg"` |
| `pages/suppliers/PaymentDialog.tsx` | `className="sm:max-w-md"` | `size="sm"` |
| `pages/suppliers/SupplierDetailDialog.tsx` | `className="max-h-[95vh] overflow-y-auto sm:max-w-lg"` | (bỏ className) |
| `pages/suppliers/SupplierFormDialog.tsx` | `className="sm:max-w-md"` | `size="sm"` |

Rồi soát thứ tự nút trong mọi `DialogFooter`: `grep -rn -A12 "<DialogFooter" client/src/pages`. Quy ước: nút *Hủy*/*Đóng* (outline/ghost) đứng **trước**, nút hành động chính (default/destructive) đứng **cuối** – `DialogFooter` của shadcn tự xếp: máy tính nằm ngang căn phải, điện thoại dọc với nút cuối lên trên. Footer nào đặt nút chính trước thì đổi chỗ hai phần tử JSX (không đổi logic).

- [ ] **Step 9: Typecheck**

Run: `npm run typecheck`
Expected: không lỗi.

- [ ] **Step 10: Kiểm trên trình duyệt**

`t3.mjs`:

```js
import { BASE, check, withPage } from './harness.mjs';

await withPage(async (page) => {
  await page.goto(`${BASE}/orders`);
  await page.waitForLoadState('networkidle');
  const btn = page.getByRole('button', { name: 'Chọn ngày' });
  const today = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
  check('ô ngày dd/mm/yyyy', (await btn.innerText()).trim() === today, await btn.innerText());
  check('không còn input type=date', (await page.locator('input[type=date]').count()) === 0);
  await btn.click();
  check('lịch tiếng Việt (có "Th" hoặc "T2")', /T2|Th 2|thứ hai/i.test(await page.locator('[data-slot=popover-content]').innerText()));
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Ngày trước' }).click();
  check('lùi một ngày thì hiện nút Hôm nay', await page.getByRole('button', { name: 'Hôm nay' }).isVisible());
  await page.getByRole('button', { name: 'Hôm nay' }).click();
  // Dialog cỡ md: mở hóa đơn đầu tiên nếu có
  const row = page.locator('tbody tr').first();
  if (await row.count()) {
    await row.click();
    const w = await page.locator('[data-slot=dialog-content]').evaluate((el) => el.getBoundingClientRect().width);
    check('dialog md rộng ≤ 512px', w <= 512 + 1, w);
  }
  await page.screenshot({ path: 't3-orders.png' });
});
```

Run: `node t3.mjs` → `ALL PASS`. Đọc ảnh: ô ngày `30/09/2026` (ngày hôm nay), dialog không bị cắt.

---

### Task 4: Trang Sản phẩm, Danh mục, Nhập nhanh

**Files:**
- Modify: `client/src/pages/products/ProductListPage.tsx`, `ProductToolbar.tsx`, `ProductStats.tsx`, `ProductTable.tsx` (1 dòng badge), `StockHistoryDialog.tsx` (1 dòng màu), `CsvDialog.tsx` (1 dòng màu)
- Modify: `client/src/pages/categories/CategoriesPage.tsx`, `client/src/pages/quick-add/QuickAddPage.tsx`

**Interfaces:**
- Consumes: `PageTitle`, `PageAction` (Task 2); `Stat`, `StatStrip`, `ListPanel`, `SearchInput`, `TableSkeleton`, `ToolbarSelect` (Task 3).
- Produces: không có interface mới.

- [ ] **Step 1: `ProductStats.tsx`**

Thay toàn bộ file:

```tsx
import { formatMoney, type Product } from '@tiny-pos/shared';
import { Stat, StatStrip } from '@/components/StatStrip';

/** Bốn ô tổng quan: tính từ toàn bộ hàng đang bán (không phụ thuộc bộ lọc). */
export function ProductStats({ products, categoryCount }: { products: Product[]; categoryCount: number }) {
  const low = products.filter((p) => p.stock < p.minStock);
  const weighed = products.filter((p) => p.isWeighed).length;
  const inventoryValue = products.reduce((sum, p) => sum + p.stock * p.costPrice, 0);
  return (
    <StatStrip cols={4}>
      <Stat label="Mặt hàng đang bán" value={String(products.length)} hint={weighed ? `${weighed} hàng cân` : 'Chưa có hàng cân'} />
      <Stat
        label="Sắp hết hàng"
        value={String(low.length)}
        hint={low.length ? low.slice(0, 2).map((p) => p.name).join(', ') : 'Tồn đều trên mức tối thiểu'}
        tone={low.length ? 'danger' : 'default'}
      />
      <Stat label="Giá trị tồn kho" value={formatMoney(inventoryValue)} hint="Tính theo giá nhập" />
      <Stat label="Danh mục" value={String(categoryCount)} hint="Nhóm hàng để lọc nhanh" />
    </StatStrip>
  );
}
```

- [ ] **Step 2: `ProductToolbar.tsx` – ô tìm + chọn danh mục + công tắc**

Thay phần `const chip = …` và toàn bộ `return (...)` bằng (giữ `useEffect` phím "/" và `SEARCH_ID`):

```tsx
  const categoryOptions = categories.map((c) => ({ value: String(c.id), label: `${c.name} (${c.productCount})` }));

  return (
    <>
      <SearchInput id={SEARCH_ID} value={q} onChange={setQ} placeholder="Tìm theo tên hoặc mã vạch…" hotkey="/" />
      <ToolbarSelect value={categoryId} onChange={setCategoryId} options={categoryOptions} emptyLabel="Tất cả danh mục" aria-label="Lọc danh mục" />
      <label className="flex h-11 cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 text-sm font-medium md:h-10">
        <Switch checked={includeInactive} onCheckedChange={setIncludeInactive} />
        Hiện hàng ngừng bán
      </label>
    </>
  );
```

Imports: bỏ `Search`, `InputGroup*`, `Kbd`, `cn`; thêm `import { SearchInput } from '@/components/SearchInput';` và `import { ToolbarSelect } from '@/components/SelectField';`. Comment đầu component: `/** Thanh công cụ danh sách sản phẩm: ô tìm (phím "/"), lọc danh mục, công tắc hàng ngừng bán. */`.

- [ ] **Step 3: `ProductListPage.tsx`**

- Imports: dòng lucide giữ `FileSpreadsheet, Package, Plus, Search` (vẫn dùng) và thêm `ScanBarcode`. Bỏ `PageHeader`, `Card`, `Skeleton`; thêm `import { PageTitle } from '@/components/layout/PageTitle';`, `import { ListPanel } from '@/components/ListPanel';`, `import { TableSkeleton } from '@/components/TableSkeleton';`.
- Thay khối từ `<PageHeader` đến hết `</Card>` bằng:

```tsx
      <PageTitle
        title="Sản phẩm"
        count={`${all.length} mặt hàng`}
        actions={[
          { label: 'Nhập nhanh', icon: ScanBarcode, to: '/quick-add' },
          { label: 'Nhập / Xuất CSV', icon: FileSpreadsheet, onClick: () => setCsvOpen(true) },
          { label: 'Thêm sản phẩm', icon: Plus, onClick: () => setCreating(true), primary: true },
        ]}
      />

      <ProductStats products={all} categoryCount={categories.length} />

      <ListPanel
        toolbar={
          <ProductToolbar
            q={q}
            setQ={resetPage(setQ)}
            categoryId={categoryId}
            setCategoryId={resetPage((v: string) => {
              setCategoryId(v);
              if (searchParams.has('categoryId')) setSearchParams({}, { replace: true });
            })}
            includeInactive={includeInactive}
            setIncludeInactive={resetPage(setIncludeInactive)}
            categories={categories}
          />
        }
        footer={products.length > 0 && <Pager page={currentPage} pageSize={PAGE_SIZE} total={products.length} onPageChange={setPage} noun="mặt hàng" />}
      >
        {isLoading ? (
          <TableSkeleton />
        ) : products.length === 0 ? (
          <EmptyState
            icon={filtered ? Search : Package}
            title={filtered ? 'Không tìm thấy sản phẩm nào' : 'Chưa có sản phẩm'}
            description={filtered ? 'Thử từ khóa khác hoặc bỏ lọc danh mục.' : 'Thêm bằng tay, quét mã ở Nhập nhanh, hoặc nhập từ file CSV.'}
            action={
              !filtered && (
                <Button onClick={() => setCreating(true)}>
                  <Plus data-icon="inline-start" />
                  Thêm sản phẩm
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className="hidden md:block">
              <ProductTable products={pageItems} onEdit={edit} onToggle={toggle} />
            </div>
            <div className="md:hidden">
              <ProductCardList products={pageItems} onEdit={edit} onToggle={toggle} />
            </div>
          </>
        )}
      </ListPanel>
```

- [ ] **Step 4: Màu trạng thái trong Sản phẩm**

- `ProductTable.tsx` dòng badge Hàng cân: `className="bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"` → `className="bg-warning/15 text-warning"`.
- `StockHistoryDialog.tsx`: `m.qty > 0 ? 'text-emerald-600' : 'text-destructive'` → `m.qty > 0 ? 'text-success' : 'text-destructive'`.
- `CsvDialog.tsx`: `'bg-amber-50 text-amber-900'` → `'bg-warning/10 text-foreground'`.
- `ProductCardList.tsx`: `text-primary` ở giá bán giữ nguyên (giá là liên kết màu nhấn trên thẻ).

- [ ] **Step 5: `CategoriesPage.tsx`**

- Imports: bỏ `FolderX`, `Info`, `Layers`, `PackageOpen` khỏi lucide nếu không còn dùng (sau thay đổi dưới: `Info` vẫn dùng; `Layers`, `PackageOpen`, `FolderX` bỏ); bỏ `PageHeader`, `StatCard`, `Card`, `InputGroup*`, `Skeleton`; thêm `PageTitle`, `Stat`/`StatStrip`, `ListPanel`, `SearchInput`, `TableSkeleton`.
- Bỏ `className="mx-auto max-w-5xl"` của `div` ngoài cùng (dùng chiều rộng chung).
- Thay `<PageHeader … />` bằng:

```tsx
      <PageTitle title="Danh mục" count={`${categories.length} danh mục`} actions={[{ label: 'Thêm danh mục', icon: Plus, onClick: openCreate, primary: true }]} />
```

- Thay khối lưới 4 `StatCard` bằng:

```tsx
      <StatStrip cols={4}>
        <Stat label="Danh mục" value={String(categories.length)} hint="Nhóm hàng để lọc nhanh" />
        <Stat label="Hàng đã phân loại" value={String(products.length - uncategorized)} hint={`/ ${products.length} mặt hàng đang bán`} />
        <Stat
          label="Chưa có danh mục"
          value={String(uncategorized)}
          hint={uncategorized ? 'Nên xếp vào nhóm để dễ tìm' : 'Mọi hàng đã có nhóm'}
          tone={uncategorized ? 'warning' : 'default'}
        />
        <Stat
          label="Danh mục trống"
          value={String(empty.length)}
          hint={empty.length ? empty.slice(0, 2).map((c) => c.name).join(', ') : 'Danh mục nào cũng có'}
          tone={empty.length ? 'danger' : 'default'}
        />
      </StatStrip>
```

- Thay `<Card className="gap-0 py-0">` + khối toolbar `div` đầu bằng `ListPanel`:

```tsx
      <ListPanel
        toolbar={
          <>
            <SearchInput value={q} onChange={setQ} placeholder="Tìm danh mục…" className="md:max-w-sm" />
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Info className="size-4 shrink-0" />
              Thứ tự ở đây là thứ tự nút danh mục ở màn bán hàng.
            </p>
          </>
        }
        footer={
          !isLoading &&
          categories.length > 0 && (
            <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
              <span>
                {term ? `${shown.length} / ` : ''}
                {categories.length} danh mục
              </span>
              {uncategorized > 0 && <span>{uncategorized} mặt hàng chưa có danh mục</span>}
            </div>
          )
        }
      >
```

  giữ nguyên phần thân (loading → dùng `<TableSkeleton />` thay khối 3 `Skeleton`; `EmptyState`; `<ul>`), bỏ khối footer cũ ở cuối (đã chuyển vào `footer`), đóng bằng `</ListPanel>` thay `</Card>`.
- Trong `<li>`: `py-3` → `py-2.5`.

- [ ] **Step 6: `QuickAddPage.tsx` – bỏ khối hero gradient**

- Thêm imports `PageTitle`; bỏ `cn` nếu không còn dùng.
- Thay `<section className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br …"> … </section>` bằng:

```tsx
      <PageTitle title="Nhập nhanh" back="/products" />
      <p className="mb-3 text-sm text-muted-foreground">Quét mã: có rồi thì hiện thông tin, chưa có thì mở form thêm mới.</p>
      <div className="mb-(--gap) flex items-center gap-3 rounded-lg border-2 border-primary/60 bg-card px-3 py-2 focus-within:border-primary">
        <ScanBarcode className="size-6 shrink-0 text-primary" />
        <input
          ref={scan.ref}
          onKeyDown={scan.onKeyDown}
          placeholder="Quét mã vạch tại đây…"
          className="min-h-11 w-full bg-transparent text-xl font-medium outline-none placeholder:text-muted-foreground/60"
          autoComplete="off"
          aria-label="Quét mã vạch"
        />
        <span className="shrink-0 text-xs text-muted-foreground">{dialogOpen ? 'Đang nhập thông tin' : 'Sẵn sàng quét'}</span>
      </div>
```

- `div` ngoài cùng `className="mx-auto max-w-2xl"` giữ nguyên (màn quét hẹp có chủ đích).
- Hàm `Stat` nội bộ: `accent && 'text-primary'` giữ; khối `Card` kết quả: `className="mb-5 animate-in …"` → `mb-(--gap)` thay `mb-5`; `ProductAvatar … className="size-14 rounded-2xl text-lg"` → `className="size-14 text-lg"`.

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck` → không lỗi.

- [ ] **Step 8: Kiểm trên trình duyệt**

`t4.mjs`:

```js
import { BASE, check, withPage } from './harness.mjs';

await withPage(async (page) => {
  await page.goto(`${BASE}/products`);
  await page.waitForLoadState('networkidle');
  check('topbar có tiêu đề Sản phẩm', (await page.locator('header h1').innerText()) === 'Sản phẩm');
  check('document.title', (await page.title()).startsWith('Sản phẩm · '), await page.title());
  check('nút Thêm sản phẩm trên topbar', await page.locator('header').getByRole('button', { name: 'Thêm sản phẩm' }).isVisible());
  const cut = await page.locator('.truncate').evaluateAll((els) => els.filter((e) => e.closest('.grid') && e.scrollWidth > e.clientWidth && /\d/.test(e.textContent ?? '')).map((e) => e.textContent));
  check('không số liệu nào bị cắt', cut.length === 0, cut);
  const rows = await page.locator('tbody tr').evaluateAll((trs) => trs.filter((tr) => tr.getBoundingClientRect().bottom <= innerHeight).length);
  check('thấy ≥ 6 dòng bảng không cuộn', rows >= 6, rows);
  await page.getByRole('combobox', { name: 'Lọc danh mục' }).click();
  await page.getByRole('option').nth(1).click();
  check('lọc danh mục còn ít dòng hơn', (await page.locator('tbody tr').count()) <= 20);
  await page.locator('header').getByRole('link', { name: 'Nhập nhanh' }).click();
  await page.waitForURL('**/quick-add');
  check('Nhập nhanh: sidebar sáng mục Sản phẩm', (await page.locator('[data-sidebar=menu-button][data-active=true]').innerText()).includes('Sản phẩm'));
  check('Nhập nhanh: không còn gradient', (await page.locator('[class*=gradient]').count()) === 0);
  await page.goto(`${BASE}/categories`);
  await page.waitForLoadState('networkidle');
  check('Danh mục có tiêu đề topbar', (await page.locator('header h1').innerText()) === 'Danh mục');
  await page.screenshot({ path: 't4-categories.png' });
});

await withPage(
  async (page) => {
    await page.goto(`${BASE}/products`);
    await page.waitForLoadState('networkidle');
    check('điện thoại: nút + icon', await page.locator('header').getByRole('button', { name: 'Thêm sản phẩm' }).isVisible());
    await page.locator('header').getByRole('button', { name: 'Thao tác khác' }).click();
    check('menu ⋯ có Nhập / Xuất CSV', await page.getByRole('menuitem', { name: 'Nhập / Xuất CSV' }).isVisible());
    await page.keyboard.press('Escape');
    check('không cuộn ngang', (await page.evaluate(() => document.documentElement.scrollWidth)) <= 390);
    await page.screenshot({ path: 't4-mob.png', fullPage: true });
  },
  { width: 390, height: 844 },
);
```

Run: `node t4.mjs` → `ALL PASS`. Đọc ảnh máy tính + điện thoại.

---

### Task 5: Hóa đơn, Nhập hàng, Tạo phiếu nhập, Kiểm kê

**Files:**
- Modify: `client/src/pages/orders/OrdersPage.tsx`, `client/src/pages/imports/ImportsPage.tsx`, `ImportFormPage.tsx`, `ImportFooter.tsx`
- Modify: `client/src/pages/stocktake/StocktakePage.tsx`, `StocktakeStart.tsx`, `StocktakeSession.tsx`, `StocktakeHistory.tsx`, `StocktakeItemsTable.tsx` (1 dòng màu), `CountDialog.tsx` (1 dòng màu)

**Interfaces:**
- Consumes: `PageTitle`, `Stat`/`StatStrip`, `ListPanel`, `TableSkeleton`, `DayPicker` (Task 2–3), `formatDateVn` (shared).

- [ ] **Step 1: `OrdersPage.tsx`**

Imports: lucide chỉ còn `ReceiptText`; bỏ `PageHeader`, `StatCard`, `Card`, `Skeleton`; thêm `PageTitle`, `Stat`/`StatStrip`, `ListPanel`, `TableSkeleton`. Thay `return (…)`:

```tsx
  const collected = (s?.debtCollected.cash ?? 0) + (s?.debtCollected.transfer ?? 0);
  return (
    <>
      <PageTitle title="Hóa đơn" count={s ? `${s.count} đơn` : undefined} />
      <StatStrip cols={6}>
        <Stat label="Số đơn" value={String(s?.count ?? 0)} hint="Không tính đơn đã hủy" />
        <Stat label="Doanh thu" value={formatMoney(s?.total ?? 0)} />
        <Stat label="Tiền mặt" value={formatMoney(s?.cash ?? 0)} />
        <Stat label="Chuyển khoản" value={formatMoney(s?.transfer ?? 0)} />
        <Stat label="Ghi nợ" value={formatMoney(s?.debt ?? 0)} hint="Phần khách còn thiếu" tone={s?.debt ? 'danger' : 'default'} />
        <Stat
          label="Thu nợ"
          value={formatMoney(collected)}
          hint={`Tiền mặt ${formatMoney(s?.debtCollected.cash ?? 0)} · CK ${formatMoney(s?.debtCollected.transfer ?? 0)}`}
          tone={collected ? 'success' : 'default'}
        />
      </StatStrip>
      <ListPanel toolbar={<DayPicker value={date} onChange={setDate} />}>
        {isLoading ? (
          <TableSkeleton />
        ) : data?.orders.length ? (
          <OrderTable orders={data.orders} onOpen={setOpenId} />
        ) : (
          <EmptyState icon={ReceiptText} title="Chưa có hóa đơn" description="Ngày này chưa bán đơn nào." />
        )}
      </ListPanel>
      <OrderDetailDialog id={openId} onClose={() => setOpenId(null)} />
    </>
  );
```

- [ ] **Step 2: `ImportsPage.tsx`**

Imports: lucide `PackagePlus, PackageOpen`; bỏ `Link`, `PageHeader`, `StatCard`, `Button`, `Card`, `Skeleton`; thêm `PageTitle`, `Stat`/`StatStrip`, `ListPanel`, `TableSkeleton`. Thay `return (…)`:

```tsx
  return (
    <>
      <PageTitle
        title="Nhập hàng"
        count={s ? `${s.count} phiếu` : undefined}
        actions={[{ label: 'Tạo phiếu nhập', icon: PackagePlus, to: '/imports/new', primary: true }]}
      />
      <StatStrip cols={3}>
        <Stat label="Số phiếu" value={String(s?.count ?? 0)} hint="Không tính phiếu đã hủy" />
        <Stat label="Tổng nhập" value={formatMoney(s?.total ?? 0)} />
        <Stat label="Đã trả" value={formatMoney(s?.paid ?? 0)} />
      </StatStrip>
      <ListPanel toolbar={<DayPicker value={date} onChange={setDate} />}>
        {isLoading ? (
          <TableSkeleton rows={3} />
        ) : data?.imports.length ? (
          <ImportTable imports={data.imports} onOpen={setOpenId} />
        ) : (
          <EmptyState icon={PackageOpen} title="Chưa có phiếu nhập" description="Ngày này chưa nhập hàng. Hủy phiếu sẽ trừ lại kho." />
        )}
      </ListPanel>
      <ImportDetailDialog id={openId} onClose={() => setOpenId(null)} />
    </>
  );
```

Trên điện thoại, nút `primary` có `to` → `MobileActions.run` gọi `navigate` (Task 2).

- [ ] **Step 3: `ImportFormPage.tsx` và `ImportFooter.tsx`**

`ImportFormPage.tsx`:
- Imports: bỏ `ArrowLeft, PackagePlus` (xóa cả dòng lucide nếu trống), bỏ `Link` khỏi `react-router` (giữ `useNavigate`), bỏ `PageHeader`, `Button`, `Card`; thêm `PageTitle`, `ListPanel`.
- Thay `<PageHeader … />` bằng `<PageTitle title="Tạo phiếu nhập" back="/imports" />`.
- `div` ngoài cùng `className="space-y-4 pb-4"` → `className="space-y-3 pb-4"`.
- Thay `<Card className="gap-0 overflow-hidden py-0">…</Card>` bằng `<ListPanel>…</ListPanel>` (giữ `ImportLinesTable` bên trong).
- Thêm một dòng mô tả ngay sau `PageTitle`: `<p className="text-sm text-muted-foreground">Quét mã hàng về; mã lạ sẽ mở form thêm sản phẩm.</p>`.

`ImportFooter.tsx`:
- `<Card className="gap-0 py-0">` → `<Card className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 gap-0 py-0 md:bottom-4">` (dính đáy, trên thanh menu điện thoại 68px + 8px).
- `CardContent className="flex flex-wrap items-end justify-between gap-4 p-5"` → `p-4`.
- Tổng tiền: `text-3xl font-semibold text-primary` → `text-3xl font-semibold`.

- [ ] **Step 4: Kiểm kê**

`StocktakePage.tsx`: `if (isLoading) return <Skeleton className="h-40 w-full" />;` → `if (isLoading) return <TableSkeleton />;` (đổi import `Skeleton` → `TableSkeleton` từ `@/components/TableSkeleton`). Nhánh lỗi thêm `<PageTitle title="Kiểm kê" />` trước `EmptyState` (bọc trong `<>…</>`).

`StocktakeStart.tsx`:
- Bỏ `PageHeader`, `ClipboardList` (nếu không còn dùng); thêm `PageTitle`.
- `<PageHeader … />` → `<PageTitle title="Kiểm kê" />`.
- `Card` + `CardContent className="space-y-4"` giữ; nút *Bắt đầu kiểm kê* `className="h-14 w-full text-lg sm:w-auto sm:px-10"` → `className="h-12 w-full text-base sm:w-auto sm:px-8"`.

`StocktakeSession.tsx`:
- Bỏ `PageHeader`, `Card`; thêm `PageTitle`, `ListPanel`.
- Thay `<PageHeader … />` bằng:

```tsx
      <PageTitle
        title="Kiểm kê"
        count={`${session.code} · ${session.itemCount} món đã đếm · ${session.diffCount} món lệch`}
        actions={[
          { label: 'Hủy phiên', icon: X, onClick: () => void onCancel(), danger: true, disabled: cancel.isPending },
          { label: 'Chốt kiểm kê', icon: CheckCheck, onClick: () => void onFinish(), primary: true, disabled: !session.itemCount || finish.isPending },
        ]}
      />
      {session.note && <p className="text-sm text-muted-foreground">Ghi chú: {session.note}</p>}
```

- `div` ngoài cùng `space-y-4` → `space-y-3`.
- Thay khối `label` công tắc + `Card` bằng:

```tsx
      <ListPanel
        toolbar={
          <label className="flex min-h-11 items-center gap-3 md:min-h-10">
            <Switch checked={onlyDiff} onCheckedChange={setOnlyDiff} />
            <span>Chỉ món lệch</span>
          </label>
        }
      >
        {items.length ? (
          <StocktakeItemsTable
            items={items}
            onEdit={(i) => void onEdit(i)}
            onRemove={(i) => remove.mutate({ id: session.id, productId: i.productId }, { onError: (e) => toast.error(e.message) })}
          />
        ) : (
          <EmptyState icon={ClipboardList} title={onlyDiff ? 'Không có món lệch' : 'Chưa đếm món nào'} description="Quét mã hoặc gõ tên để đếm." />
        )}
      </ListPanel>
```

`StocktakeHistory.tsx`:
- `<h2 className="mt-8 mb-3 font-heading text-lg font-semibold">` → `<h2 className="mt-(--gap) mb-2 text-sm font-semibold text-muted-foreground">`.
- `<Card className="gap-0 overflow-hidden py-0">…</Card>` → `<ListPanel>…</ListPanel>` (đổi import `Card` → `ListPanel`).
- Hai chỗ `new Date(s.createdAt).toLocaleDateString('vi-VN')` → `formatDateVn(localDate(new Date(s.createdAt), currentTzOffset()))` (import `currentTzOffset, formatDateVn, localDate` từ `@tiny-pos/shared`) để luôn `dd/mm/yyyy`.

Màu: `StocktakeItemsTable.tsx` và `CountDialog.tsx`: `'text-emerald-600'` → `'text-success'`.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck` → không lỗi.

- [ ] **Step 6: Kiểm trên trình duyệt**

`t5.mjs` (phiên kiểm kê đang mở được stub, không tạo thật):

```js
import { BASE, check, withPage } from './harness.mjs';

await withPage(async (page) => {
  for (const [path, title] of [['orders', 'Hóa đơn'], ['imports', 'Nhập hàng'], ['imports/new', 'Tạo phiếu nhập'], ['stocktake', 'Kiểm kê']]) {
    await page.goto(`${BASE}/${path}`);
    await page.waitForLoadState('networkidle');
    check(`${path}: tiêu đề topbar`, (await page.locator('header h1').innerText()) === title, await page.locator('header h1').innerText());
  }
  await page.goto(`${BASE}/imports`);
  await page.locator('header').getByRole('link', { name: 'Tạo phiếu nhập' }).click();
  await page.waitForURL('**/imports/new');
  check('Tạo phiếu: có nút quay lại', await page.locator('header').getByRole('link', { name: 'Quay lại' }).isVisible());
  await page.locator('header').getByRole('link', { name: 'Quay lại' }).click();
  await page.waitForURL('**/imports');
  check('SPA: tiêu đề đổi về Nhập hàng', (await page.locator('header h1').innerText()) === 'Nhập hàng');
  check('SPA: không còn nút quay lại', (await page.locator('header').getByRole('link', { name: 'Quay lại' }).count()) === 0);
  await page.screenshot({ path: 't5-imports.png' });
});

// Phiên kiểm kê đang mở (stub GET)
await withPage(async (page) => {
  await page.route('**/api/stocktakes/current', (r) =>
    r.fulfill({
      json: {
        id: 1,
        code: 'KK-20260930-01',
        status: 'open',
        note: 'Quầy nước',
        createdAt: new Date().toISOString(),
        finishedAt: null,
        itemCount: 0,
        diffCount: 0,
        diffValue: 0,
        items: [],
      },
    }),
  );
  await page.goto(`${BASE}/stocktake`);
  await page.waitForLoadState('networkidle');
  check('phiên mở: nút Chốt bị khóa khi chưa đếm', await page.locator('header').getByRole('button', { name: 'Chốt kiểm kê' }).isDisabled());
  check('phiên mở: nút Hủy phiên màu đỏ', (await page.locator('header').getByRole('button', { name: 'Hủy phiên' }).getAttribute('class')).includes('text-destructive'));
  await page.screenshot({ path: 't5-stocktake.png' });
});
```

Nếu shape `StocktakeDetail` khác (xem `shared/src/types.ts`), sửa JSON stub cho khớp kiểu – không sửa code app.

Run: `node t5.mjs` → `ALL PASS`. Đọc ảnh.

---

### Task 6: Nhà cung cấp, Khách hàng, Cài đặt (Giao diện + Thông tin phần mềm), trang 404

**Files:**
- Modify: `client/src/pages/suppliers/SuppliersPage.tsx`, `SupplierDetailDialog.tsx` (1 dòng màu)
- Modify: `client/src/pages/customers/CustomersPage.tsx`, `CustomerDetailDialog.tsx`, `CollectDebtDialog.tsx` (màu)
- Modify: `client/src/pages/settings/SettingsPage.tsx`
- Create: `client/src/pages/settings/AppearanceCard.tsx`
- Modify: `client/src/pages/PlaceholderPage.tsx`, `client/src/router.tsx` (không đổi – 404 vẫn dùng `PlaceholderPage`)
- Delete: `client/src/components/PageHeader.tsx`, `client/src/components/StatCard.tsx`

**Interfaces:**
- Consumes: `useUiPrefs`, `ACCENTS`, `FONT_SIZES`, `DENSITIES`, `RADII` (Task 1); `APP_VERSION`, `BUILD_DATE`; `useTheme` (next-themes); `PageTitle` (`form` action).

- [ ] **Step 1: `SuppliersPage.tsx`**

Imports: bỏ `PageHeader`, `Card`; thêm `PageTitle`, `Stat`/`StatStrip`, `ListPanel`, `TableSkeleton`. Thay `return (…)`:

```tsx
  return (
    <>
      <PageTitle
        title="Nhà cung cấp"
        count={`${suppliers.length} nhà cung cấp`}
        actions={[{ label: 'Thêm nhà cung cấp', icon: Plus, onClick: () => setAdding(true), primary: true }]}
      />
      <StatStrip cols={3}>
        <Stat label="Tổng đang nợ" value={formatMoney(totalDebt)} tone={totalDebt ? 'danger' : 'default'} />
        <Stat label="Nhà cung cấp" value={String(suppliers.length)} />
        <Stat label="Đang nợ" value={String(suppliers.filter((x) => x.debt > 0).length)} hint="Số nhà cung cấp tiệm còn nợ" />
      </StatStrip>
      <ListPanel>
        {isLoading ? (
          <TableSkeleton />
        ) : !suppliers.length ? (
          <EmptyState icon={Truck} title="Chưa có nhà cung cấp" description="Thêm nhà cung cấp để ghi nợ khi nhập hàng." />
        ) : (
          <Table>
            …giữ nguyên TableHeader/TableBody hiện có…
          </Table>
        )}
      </ListPanel>
      <SupplierFormDialog open={adding} onClose={() => setAdding(false)} onSaved={() => setAdding(false)} />
      <SupplierDetailDialog id={openId} onClose={() => setOpenId(null)} />
    </>
  );
```

(Giữ nguyên nội dung `<Table>` cũ, chỉ đổi khung bọc.) Trong `TableCell` đang nợ: giữ `text-destructive`.

- [ ] **Step 2: `CustomersPage.tsx`**

Imports: bỏ `Search, Wallet` khỏi lucide? `Search` vẫn dùng ở `EmptyState` tìm không thấy → giữ `Search`, bỏ `Wallet`; bỏ `PageHeader`, `StatCard`, `Card`, `InputGroup*`; thêm `PageTitle`, `Stat`/`StatStrip`, `ListPanel`, `SearchInput`, `TableSkeleton`. Thay `return (…)`:

```tsx
  const all = data?.customers ?? [];
  return (
    <>
      <PageTitle title="Khách hàng" count={`${all.length} khách`} actions={[{ label: 'Thêm khách', icon: Plus, onClick: () => setAdding(true), primary: true }]} />
      <StatStrip cols={3}>
        <Stat label="Tổng nợ phải thu" value={formatMoney(data?.totalDebt ?? 0)} tone={data?.totalDebt ? 'danger' : 'default'} />
        <Stat label="Khách hàng" value={String(all.length)} />
        <Stat label="Đang nợ" value={String(all.filter((c) => c.debt > 0).length)} hint="Số khách còn nợ tiệm" />
      </StatStrip>
      <ListPanel toolbar={<SearchInput value={q} onChange={setQ} placeholder="Tìm tên hoặc số điện thoại…" className="md:max-w-sm" />}>
        {isLoading ? (
          <TableSkeleton />
        ) : !customers.length ? (
          t ? (
            <EmptyState icon={Search} title="Không tìm thấy" description={`Không có khách nào khớp "${q.trim()}".`} />
          ) : (
            <EmptyState icon={Users} title="Chưa có khách hàng" description="Thêm khách để ghi nợ khi bán chịu." />
          )
        ) : (
          <Table>
            …giữ nguyên TableHeader/TableBody hiện có…
          </Table>
        )}
      </ListPanel>
      <CustomerFormDialog open={adding} onClose={() => setAdding(false)} onSaved={() => setAdding(false)} />
      <CustomerDetailDialog id={openId} onClose={() => setOpenId(null)} />
    </>
  );
```

- [ ] **Step 3: Màu trạng thái Khách hàng / NCC**

- `CustomerDetailDialog.tsx`, `SupplierDetailDialog.tsx`: `t.amount > 0 ? 'text-destructive' : 'text-emerald-600'` → `t.amount > 0 ? 'text-destructive' : 'text-success'`.
- `CollectDebtDialog.tsx`: `className="flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 dark:bg-emerald-500/10"` → `className="flex items-center gap-3 rounded-lg bg-success/10 px-4 py-3"`; `className="size-7 shrink-0 text-emerald-600"` → `className="size-7 shrink-0 text-success"`.

- [ ] **Step 4: `AppearanceCard.tsx`**

Tạo `client/src/pages/settings/AppearanceCard.tsx`:

```tsx
import { Check, RotateCcw } from 'lucide-react';
import { useTheme } from 'next-themes';
import { SectionTitle } from '@/components/TextField';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ACCENTS, DENSITIES, FONT_SIZES, RADII, useUiPrefs } from '@/lib/ui-prefs';
import { cn } from '@/lib/utils';

const MODES = [
  { value: 'light', label: 'Sáng' },
  { value: 'dark', label: 'Tối' },
  { value: 'system', label: 'Theo máy' },
] as const;

/** Nhóm nút chọn một (segmented). */
function Segmented<T extends string>({ label, options, value, onChange }: { label: string; options: readonly { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="font-medium">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1 rounded-lg border bg-muted p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            onClick={() => onChange(o.value)}
            className={cn(
              'h-11 min-w-16 flex-1 rounded-md px-3 text-sm font-medium transition-colors md:h-9',
              o.value === value ? 'bg-card text-foreground shadow-sm ring-1 ring-border' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Tùy chỉnh giao diện theo máy: chọn là áp dụng ngay, không cần bấm Lưu. */
export function AppearanceCard() {
  const { prefs, update, reset } = useUiPrefs();
  const { theme = 'system', setTheme } = useTheme();
  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <SectionTitle>Giao diện (trên máy này)</SectionTitle>
            <p className="-mt-2 text-sm text-muted-foreground">Chỉ áp dụng cho máy/trình duyệt này. Chọn là thấy ngay.</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="h-11 shrink-0 md:h-9"
            onClick={() => {
              reset();
              setTheme('system');
            }}
          >
            <RotateCcw data-icon="inline-start" />
            Khôi phục mặc định
          </Button>
        </div>
        <Segmented label="Chế độ" options={MODES} value={theme as (typeof MODES)[number]['value']} onChange={setTheme} />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-medium">Màu nhấn</span>
          <div role="radiogroup" aria-label="Màu nhấn" className="flex flex-wrap gap-2">
            {ACCENTS.map((a) => (
              <button
                key={a.value}
                type="button"
                role="radio"
                aria-checked={a.value === prefs.accent}
                aria-label={a.label}
                title={a.label}
                onClick={() => update({ accent: a.value })}
                className="grid size-11 place-items-center rounded-full ring-offset-2 ring-offset-card transition-shadow aria-checked:ring-2 aria-checked:ring-foreground md:size-9"
                style={{ backgroundColor: a.swatch }}
              >
                {a.value === prefs.accent && <Check className="size-4 text-white" />}
              </button>
            ))}
          </div>
        </div>
        <Segmented label="Cỡ chữ" options={FONT_SIZES} value={prefs.font} onChange={(font) => update({ font })} />
        <Segmented label="Mật độ" options={DENSITIES} value={prefs.density} onChange={(density) => update({ density })} />
        <Segmented label="Bo góc" options={RADII} value={prefs.radius} onChange={(radius) => update({ radius })} />
      </CardContent>
    </Card>
  );
}
```

(`style={{ backgroundColor }}` ở chấm màu là ngoại lệ có chủ đích: chấm phải hiện đúng màu của lựa chọn, không theo màu nhấn đang dùng.)

- [ ] **Step 5: `SettingsPage.tsx`**

- Imports: lucide `Check, Info, Printer` (bỏ `Settings as SettingsIcon`); bỏ `PageHeader`; thêm `PageTitle`, `import { APP_VERSION, BUILD_DATE } from '@/lib/version';`, `import { AppearanceCard } from './AppearanceCard';`.
- `<form onSubmit={submit} className="mx-auto max-w-3xl space-y-5">` → `<form id="settings-form" onSubmit={submit} className="space-y-(--gap)">` (rộng như các trang khác theo spec).
- Thay `<PageHeader … />` bằng:

```tsx
      <PageTitle title="Cài đặt" actions={[{ label: 'Lưu', icon: Check, form: 'settings-form', primary: true, disabled: save.isPending }]} />
      <AppearanceCard />
```

- Thêm card cuối, ngay trước `</form>`:

```tsx
      <Card>
        <CardContent className="space-y-2">
          <SectionTitle>Thông tin phần mềm</SectionTitle>
          <div className="flex items-center gap-2 text-sm">
            <Info className="size-4 text-muted-foreground" />
            Phiên bản <span className="font-semibold tabular-nums">{APP_VERSION}</span>
            <span className="text-muted-foreground">· build ngày {BUILD_DATE}</span>
          </div>
        </CardContent>
      </Card>
```

- Chỉ card *Cửa hàng* / *Chuyển khoản* / *In hóa đơn* thuộc form lưu; `AppearanceCard` không có input form nào nên không ảnh hưởng submit (các nút trong nó đều `type="button"`).

- [ ] **Step 6: Trang 404, xóa `PageHeader`, `StatCard`**

`client/src/pages/PlaceholderPage.tsx`:

```tsx
import { CircleAlert, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { PageTitle } from '@/components/layout/PageTitle';
import { Button } from '@/components/ui/button';

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <>
      <PageTitle title={title} />
      <EmptyState
        icon={CircleAlert}
        title={title}
        description="Trang này chưa có hoặc đường dẫn không đúng."
        action={
          <Button asChild>
            <Link to="/sell">
              <ShoppingCart data-icon="inline-start" />
              Về Bán hàng
            </Link>
          </Button>
        }
      />
    </>
  );
}
```

```bash
grep -rn "PageHeader\|StatCard" client/src
```

Expected: không còn chỗ dùng ngoài chính hai file đó. Rồi:

```bash
git rm client/src/components/PageHeader.tsx client/src/components/StatCard.tsx
```

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck` → không lỗi.

- [ ] **Step 8: Kiểm trên trình duyệt**

`t6.mjs`:

```js
import { BASE, check, withPage } from './harness.mjs';

// Tùy chọn giao diện: đổi là thấy ngay, reload vẫn giữ; Lưu gửi đúng PUT
await withPage(async (page, writes) => {
  await page.goto(`${BASE}/settings`);
  await page.waitForLoadState('networkidle');
  await page.getByRole('radio', { name: 'Xanh lá' }).click();
  check('accent green', (await page.evaluate(() => document.documentElement.dataset.accent)) === 'green');
  await page.getByRole('radiogroup', { name: 'Cỡ chữ' }).getByRole('radio', { name: 'Lớn' }).click();
  check('cỡ chữ 18px', (await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)) === '18px');
  await page.getByRole('radiogroup', { name: 'Chế độ' }).getByRole('radio', { name: 'Tối' }).click();
  check('chế độ tối', await page.evaluate(() => document.documentElement.classList.contains('dark')));
  await page.reload();
  await page.waitForLoadState('networkidle');
  check('reload giữ green + lg + tối', await page.evaluate(() => {
    const d = document.documentElement;
    return d.dataset.accent === 'green' && d.dataset.font === 'lg' && d.classList.contains('dark');
  }));
  check('thông tin phần mềm', (await page.getByText('0.5.0').count()) >= 1);
  await page.getByRole('button', { name: 'Khôi phục mặc định' }).click();
  check('khôi phục về blue/md', await page.evaluate(() => document.documentElement.dataset.accent === 'blue' && document.documentElement.dataset.font === 'md'));
  check('tùy chọn giao diện không gửi request ghi', writes.length === 0, writes);
  await page.locator('header').getByRole('button', { name: 'Lưu' }).click();
  await page.waitForTimeout(300);
  check('Lưu (máy tính) gửi PUT /api/settings', writes.some((w) => w.method === 'PUT' && w.url.endsWith('/api/settings')), writes);
  await page.screenshot({ path: 't6-settings.png', fullPage: true });
});

// Điện thoại: Lưu là nút icon chính trên header, vẫn submit form
await withPage(
  async (page, writes) => {
    await page.goto(`${BASE}/settings`);
    await page.waitForLoadState('networkidle');
    await page.locator('header').getByRole('button', { name: 'Lưu' }).click();
    await page.waitForTimeout(300);
    check('Lưu (điện thoại) gửi PUT', writes.some((w) => w.method === 'PUT' && w.url.endsWith('/api/settings')), writes);
    check('không cuộn ngang', (await page.evaluate(() => document.documentElement.scrollWidth)) <= 390);
  },
  { width: 390, height: 844 },
);

await withPage(async (page) => {
  for (const [path, title] of [['suppliers', 'Nhà cung cấp'], ['customers', 'Khách hàng'], ['khong-co', 'Không tìm thấy trang']]) {
    await page.goto(`${BASE}/${path}`);
    await page.waitForLoadState('networkidle');
    check(`${path}: tiêu đề`, (await page.locator('header h1').innerText()) === title);
  }
});
```

Run: `node t6.mjs` → `ALL PASS`. Body PUT đã chặn phải là object cài đặt hiện có (không đổi giá trị nào). Đọc ảnh Cài đặt.

---

### Task 7: Màn Bán hàng

**Files:**
- Modify: `client/src/pages/sell/SellPage.tsx`, `CheckoutPanel.tsx`, `HeldCarts.tsx`, `CartTable.tsx`, `CartLine.tsx`, `SaleResult.tsx`
- Modify: `client/src/components/ProductSearch.tsx` (chỉ class)

**Interfaces:**
- Consumes: `PageTitle` (Task 2), token `success`/`warning`, `Kbd`.
- Produces: `HeldCarts` nhận thêm `currentCount: number`; `CartLine` nhận thêm `index: number`; `CheckoutPanel` nhận thêm `lineCount: number`.

- [ ] **Step 1: `ProductSearch.tsx` – ô quét phẳng**

- `className="flex items-center gap-3 rounded-2xl border bg-card p-2 shadow-sm focus-within:ring-3 focus-within:ring-ring/40"` → `className="flex items-center gap-3 rounded-lg border-2 border-primary/60 bg-card px-3 py-1 focus-within:border-primary"`.
- `<span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">` → `<span className="grid size-9 shrink-0 place-items-center text-primary">`.
- input `text-xl` → `text-lg`.
- `<ul className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border bg-popover shadow-xl" role="listbox">` → `rounded-lg border bg-popover shadow-lg` (giữ phần còn lại).

- [ ] **Step 2: `HeldCarts.tsx` – tab đơn**

Thay toàn bộ file:

```tsx
import { PauseCircle, ShoppingBasket, X } from 'lucide-react';
import { cartTotals, formatMoney, type HeldCart } from '@tiny-pos/shared';
import { Button } from '@/components/ui/button';

interface Props {
  held: HeldCart[];
  /** Số món của đơn đang làm. */
  currentCount: number;
  onOpen: (id: string) => void;
  onDrop: (id: string) => void;
}

const time = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

/** Tab đơn: đơn đang làm + các đơn chờ. Bấm tab chờ để mở lại (đơn đang làm được cất vào chờ), × để bỏ. */
export function HeldCarts({ held, currentCount, onOpen, onDrop }: Props) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Đơn đang bán">
      <span
        role="tab"
        aria-selected="true"
        className="flex h-11 items-center gap-2 rounded-lg border border-primary bg-accent px-3 text-sm font-semibold text-accent-foreground md:h-9"
      >
        <ShoppingBasket className="size-4" />
        Đơn hiện tại · {currentCount} món
      </span>
      {held.map((h, i) => (
        <div key={h.id} role="tab" aria-selected="false" className="flex items-center rounded-lg border bg-card">
          <Button variant="ghost" className="h-11 rounded-r-none px-3 text-sm md:h-9" onClick={() => onOpen(h.id)}>
            <PauseCircle data-icon="inline-start" className="text-warning" />
            Chờ {i + 1} · {time(h.at)} · {formatMoney(cartTotals(h.cart.lines, h.cart.discount).payable)}
          </Button>
          <Button variant="ghost" size="icon-lg" className="size-11 rounded-l-none md:size-9" aria-label={`Bỏ đơn chờ ${i + 1}`} onClick={() => onDrop(h.id)}>
            <X />
          </Button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: `CartTable.tsx` và `CartLine.tsx` – cột #, đơn giá trước số lượng**

`CartTable.tsx` – thay `<TableHeader>…</TableHeader>`:

```tsx
      <TableHeader>
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <TableHead className="hidden w-10 pl-4 sm:table-cell">#</TableHead>
          <TableHead className="px-4 sm:pl-2">Sản phẩm</TableHead>
          <TableHead className="px-2 text-right">Đơn giá</TableHead>
          <TableHead className="px-2">Số lượng</TableHead>
          <TableHead className="px-4 text-right">Thành tiền</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
```

và trong `cart.lines.map((l) => (` đổi thành `cart.lines.map((l, i) => (`, thêm prop `index={i}` cho `<CartLine`.

`CartLine.tsx`:
- `interface Props` thêm `/** Thứ tự dòng (từ 0) để hiện cột #. */ index: number;`, destructure `index`.
- Import lucide: `Trash2` → `X`.
- Trong `<TableRow>`, thêm ô đầu:

```tsx
      <TableCell className="hidden w-10 pl-4 text-muted-foreground tabular-nums sm:table-cell">{index + 1}</TableCell>
```

- Ô tên: `className="px-4 py-2 whitespace-normal"` → `className="px-4 whitespace-normal sm:pl-2"`.
- Đưa **nguyên khối** `<TableCell className="px-2 py-2">` chứa ô *Đơn giá* lên **trước** khối `<TableCell>` chứa số lượng (chỉ đổi thứ tự JSX, giữ nguyên handler). Ô đơn giá thêm `text-right` vào `TableCell`.
- Badge thiếu tồn: `className="bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"` → `className="bg-warning/15 text-warning"`.
- Nút xóa dòng: `<Trash2 />` → `<X />` (giữ `aria-label="Xóa dòng"`).

- [ ] **Step 4: `CheckoutPanel.tsx`**

- `interface Props` thêm `/** Số dòng trong giỏ. */ lineCount: number;`, destructure `lineCount`.
- `TodaySummary` – thay phần `return (…)`:

```tsx
  return (
    <div className="mt-auto border-t pt-3 text-sm text-muted-foreground">
      <div className="font-medium text-foreground">
        Hôm nay: {s.count} đơn · {formatMoney(s.total)}
      </div>
      <div>
        Tiền mặt {formatMoney(s.cash)} · CK {formatMoney(s.transfer)}
        {s.debt > 0 && ` · Ghi nợ ${formatMoney(s.debt)}`}
      </div>
    </div>
  );
```

- Card: `<Card className="gap-0 py-0 lg:sticky lg:top-20">` → `<Card className="gap-0 py-0 lg:h-full">`; `<CardContent className="space-y-4 p-5">` → `<CardContent className="flex h-full flex-col gap-3 p-4">`.
- Nhãn `Tổng tiền` → `` {`Tổng tiền (${lineCount} món)`} ``.
- Khối phải trả: `<div className="border-t pt-4">` → `<div className="border-t pt-3">`; nhãn `Phải trả` → `Khách phải trả`; class số tiền `font-heading text-4xl font-semibold tracking-tight text-primary tabular-nums` → `font-heading text-4xl font-bold tracking-tight tabular-nums`.
- Nút Thanh toán `className="h-14 w-full text-lg"` → `className="h-12 w-full text-base"`.
- Nút *Món ngoài (F4)* → chữ `Món ngoài` (phím tắt đã có ở dòng phím tắt).
- Thanh điện thoại: `text-2xl font-semibold text-primary tabular-nums` → `text-2xl font-bold tabular-nums`.

- [ ] **Step 5: `SaleResult.tsx`**

- Card: `className="flex-row items-center gap-4 border-emerald-300 bg-emerald-50 px-5 py-4 dark:border-emerald-500/30 dark:bg-emerald-500/10"` → `className="flex-row items-center gap-4 bg-success/10 px-4 py-3 ring-success/30"`.
- Icon: `text-emerald-600` → `text-success`.
- Tiền thối: `font-heading text-3xl font-semibold text-emerald-700 tabular-nums dark:text-emerald-300` → `font-heading text-3xl font-bold text-success tabular-nums`.

- [ ] **Step 6: `SellPage.tsx` – bố cục hết chiều cao**

- Imports: bỏ `Card`; thêm `import { PageTitle } from '@/components/layout/PageTitle';` và `import { Kbd } from '@/components/ui/kbd';`.
- Thêm hằng trên component (sau `const noop = () => {};`):

```tsx
const SHORTCUTS = [
  ['F2', 'Quét'],
  ['F4', 'Món ngoài'],
  ['F9', 'Thanh toán'],
  ['Esc', 'Đóng hộp thoại'],
] as const;
```

- Thay `return (` … đến hết `<CheckoutPanel … />` (giữ nguyên ba dialog phía sau) bằng:

```tsx
  return (
    // Máy tính: hết chiều cao dưới topbar 3rem (+ đệm main 2rem); giỏ cuộn bên trong, cột phải cố định
    <div className="grid gap-3 pb-20 md:pb-0 lg:h-[calc(100dvh-5rem)] lg:grid-cols-[1fr_20rem]">
      <PageTitle title="Bán hàng" />
      <div className="flex min-h-0 min-w-0 flex-col gap-3">
        <ProductSearch inputRef={scan.ref} onScan={(c) => void onScan(c)} onPick={(p) => addProduct(p, null)} />
        <HeldCarts held={heldCarts.held} currentCount={cart.lines.length} onOpen={openHeld} onDrop={(id) => void dropHeld(id)} />
        {lastOrder && <SaleResult order={lastOrder} onReprint={() => void print(receiptFromOrder(lastOrder))} />}
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border bg-card">
          <CartTable cart={cart} shortages={shortages} dispatch={dispatch} onEditWeight={editWeight} onDone={scan.focus} />
        </div>
        <div className="hidden flex-wrap gap-4 text-xs text-muted-foreground lg:flex">
          {SHORTCUTS.map(([k, label]) => (
            <span key={k} className="flex items-center gap-1.5">
              <Kbd>{k}</Kbd>
              {label}
            </span>
          ))}
        </div>
      </div>
      <CheckoutPanel
        totals={totals}
        lineCount={cart.lines.length}
        empty={!cart.lines.length}
        canHold={!heldCarts.full}
        onDiscount={(d) => dispatch({ type: 'setDiscount', discount: d })}
        onCheckout={() => setCheckoutOpen(true)}
        onHold={hold}
        onCustom={() => setCustomOpen(true)}
        onClear={() => void clearCart()}
      />
```

Không đổi `useEffect` phím tắt, `add`, `addProduct`, `onScan`, `hold`, `openHeld`, `dropHeld`, `clearCart`, `onPaid`.

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck` → không lỗi.

- [ ] **Step 8: Kiểm trên trình duyệt**

`t7.mjs` (tra mã vạch và gợi ý là GET thật trên dữ liệu seed; không thanh toán):

```js
import { BASE, check, withPage } from './harness.mjs';

await withPage(async (page, writes) => {
  await page.goto(`${BASE}/sell`);
  await page.waitForLoadState('networkidle');
  const scanBox = page.getByRole('textbox', { name: 'Quét mã hoặc tìm sản phẩm' });
  check('ô quét có focus', await scanBox.evaluate((el) => el === document.activeElement));
  await page.keyboard.press('F9');
  check('F9 giỏ trống: không mở thanh toán', (await page.locator('[role=dialog]').count()) === 0);

  // Thêm 2 món bằng mã vạch có trong seed
  const codes = await page.evaluate(async () => (await (await fetch('/api/products')).json()).filter((p) => p.barcode && !p.isWeighed && p.isActive).slice(0, 2).map((p) => p.barcode));
  for (const c of codes) {
    await scanBox.fill(c);
    await scanBox.press('Enter');
    await page.waitForTimeout(400);
  }
  check('giỏ có 2 dòng', (await page.locator('tbody tr').count()) === 2);
  check('cột # hiện 1, 2', (await page.locator('tbody tr td:first-child').allInnerTexts()).join(',') === '1,2');
  check('tab đơn hiện tại 2 món', await page.getByRole('tab', { name: /Đơn hiện tại · 2 món/ }).isVisible());

  await page.getByRole('button', { name: 'Cất chờ' }).click();
  check('cất chờ: có tab Chờ 1', await page.getByRole('tab').filter({ hasText: 'Chờ 1' }).isVisible());
  check('giỏ trống sau cất', (await page.locator('tbody tr').count()) === 0);
  await page.getByRole('tab').filter({ hasText: 'Chờ 1' }).getByRole('button').first().click();
  check('mở lại đơn chờ: giỏ về 2 dòng', (await page.locator('tbody tr').count()) === 2);

  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('F2');
  check('F2 focus ô quét', await scanBox.evaluate((el) => el === document.activeElement));
  await page.keyboard.press('F4');
  check('F4 mở Món ngoài', await page.getByRole('dialog').isVisible());
  await page.keyboard.press('Escape');
  await page.keyboard.press('F9');
  check('F9 mở thanh toán', await page.getByRole('dialog').isVisible());
  await page.keyboard.press('Escape');

  const panel = await page.locator('[data-slot=card]').last().boundingBox();
  check('cột phải nằm trong màn (không cần cuộn trang)', panel.y + panel.height <= 768 + 1, panel);
  check('không gửi request ghi', writes.length === 0, writes);
  await page.screenshot({ path: 't7-sell.png' });
});

await withPage(
  async (page) => {
    await page.goto(`${BASE}/sell`);
    await page.waitForLoadState('networkidle');
    check('điện thoại: thanh Thanh toán hiện', await page.getByRole('button', { name: 'Thanh toán' }).last().isVisible());
    check('không cuộn ngang', (await page.evaluate(() => document.documentElement.scrollWidth)) <= 390);
    await page.screenshot({ path: 't7-mob.png' });
  },
  { width: 390, height: 844 },
);
```

`localStorage` giỏ nháp/đơn chờ chỉ nằm trong profile tạm của Chrome headless, không đụng máy người dùng. `/api/products` trả `Product[]` (xem `client/src/api/products.ts`).

Run: `node t7.mjs` → `ALL PASS`. Đọc ảnh, so với mockup đã duyệt (tab đơn, cột #, dòng phím tắt, *Khách phải trả* chữ đậm màu chữ thường).

---

### Task 8: Tài liệu, soát toàn bộ, một commit

**Files:**
- Modify: `CLAUDE.md`, `.claude/rules/client.md`, `README.md`
- (Đã có từ lúc viết spec: `.gitignore` có `.superpowers/`.)

- [ ] **Step 1: Soát mã màu cứng và component cũ**

```bash
grep -rnE "emerald|amber-|red-[0-9]|sky-[0-9]|green-[0-9]|gradient|#[0-9a-fA-F]{6}" client/src --include=*.tsx | grep -v "components/ui/" | grep -v "components/receipt/"
grep -rn "PageHeader\|StatCard\|Topbar\|type=\"date\"\|toLocaleDateString" client/src
```

Expected: lệnh 1 chỉ còn `ProductAvatar.tsx` (bảng `TINTS`) và `lib/ui-prefs.ts` (swatch) – hai ngoại lệ có chủ đích; lệnh 2 không còn kết quả. Chỗ nào khác thì đổi sang token như Task 4–7.

- [ ] **Step 2: `CLAUDE.md`**

- Dòng *Đã xong*: thêm `, làm mới giao diện 0.5.0 (sidebar nhóm menu, tùy chỉnh giao diện theo máy, version)` vào cuối câu (trước dấu chấm).
- Mục *Quy ước làm việc*, gạch *UI*: thêm câu cuối: `Tiêu đề + nút của trang dùng \`PageTitle\` (vẽ lên topbar), danh sách dùng \`ListPanel\`, số liệu \`StatStrip\`, ngày \`DateField\`/\`DayPicker\`; màu lấy từ token CSS (\`primary\`, \`success\`, \`warning\`, \`destructive\`), không viết mã màu trong trang.`
- Mục *Kiến trúc*, gạch `client/`: thêm câu cuối: `Version ở \`package.json\` gốc (Vite chèn \`__APP_VERSION__\`); tùy chọn giao diện theo máy ở \`lib/ui-prefs.ts\` (\`data-*\` trên \`<html>\`).`

- [ ] **Step 3: `.claude/rules/client.md`**

Trong gạch *Component*, dòng `- Trạng thái rỗng dùng \`EmptyState\`, xác nhận dùng \`ConfirmDialog\`, tiêu đề trang dùng \`PageHeader\`.` thay bằng:

```md
  - Trạng thái rỗng dùng `EmptyState`, xác nhận dùng `ConfirmDialog`, đang tải dùng `TableSkeleton`.
  - Tiêu đề trang + nút hành động dùng `PageTitle` (`actions: PageAction[]`, vẽ lên topbar bằng portal; nút submit form dùng `form: '<id>'`). Danh sách dùng `ListPanel` (toolbar: `SearchInput`, `ToolbarSelect`, `DayPicker`), số liệu `StatStrip` + `Stat`.
  - Ngày dùng `DateField`/`DayPicker` (hiện `dd/mm/yyyy`), không dùng `<input type="date">`; ngày in ra chữ dùng `formatDateVn` (shared).
  - Dialog chọn cỡ bằng `size` của `DialogContent` (`sm`/`md`/`lg`/`xl`), không tự đặt `sm:max-w-*`.
- **Màu và tùy chỉnh giao diện**: dùng token (`primary`, `accent`, `muted-foreground`, `success`, `warning`, `destructive`), không viết `emerald-*`/`amber-*`/mã hex trong trang. Màu nhấn, cỡ chữ, mật độ, bo góc là `data-*` trên `<html>` (`lib/ui-prefs.ts`, CSS ở `index.css`); chế độ sáng/tối do next-themes.
```

- [ ] **Step 4: `README.md`**

Thêm cuối file:

```md
## Kiểm thử thủ công – Giao diện 0.5.0

1. Mở máy tính: sidebar trắng có tên cửa hàng, 3 nhóm menu, chân ghi *Phiên bản 0.5.0*. Tiêu đề và nút của trang nằm trên thanh trên cùng.
2. *Cài đặt → Giao diện (trên máy này)*: đổi màu nhấn, cỡ chữ, mật độ, bo góc, chế độ sáng/tối → thấy đổi ngay; tải lại trang vẫn giữ, không nháy. *Khôi phục mặc định* về xanh dương, chữ Vừa.
3. *Hóa đơn*: ô ngày hiện `dd/mm/yyyy`, bấm mở lịch tiếng Việt.
4. *Bán hàng*: quét 2 món, *Cất chờ* → có tab *Chờ 1*; bấm tab mở lại đúng giỏ. F2/F4/F9 như cũ. In thử hóa đơn vẫn khổ 80mm.
5. Điện thoại: thanh dưới 4 mục + *Thêm*; nút chính của trang là nút icon trên header, các nút khác trong ⋯; không trang nào cuộn ngang, kể cả cỡ chữ *Rất lớn*.
```

- [ ] **Step 5: Kiểm toàn bộ bằng lệnh**

```bash
npm run typecheck
npm test
npm run build
```

Expected: cả ba không lỗi; test shared + server xanh (có test `formatDateVn` mới).

- [ ] **Step 6: Kiểm toàn bộ trên trình duyệt**

`t8.mjs`:

```js
import { BASE, PAGES, check, withPage } from './harness.mjs';

const configs = [
  { name: 'desk-light', width: 1366, height: 768 },
  { name: 'desk-dark', width: 1366, height: 768, theme: 'dark' },
  { name: 'mob-md', width: 390, height: 844 },
  { name: 'mob-xl', width: 390, height: 844, prefs: { accent: 'blue', font: 'xl', density: 'compact', radius: 'md' } },
];
for (const c of configs) {
  await withPage(
    async (page) => {
      for (const p of PAGES) {
        await page.goto(`${BASE}/${p}`);
        await page.waitForLoadState('networkidle');
        const h1 = await page.locator('header h1').count();
        check(`${c.name} ${p}: có PageTitle`, h1 === 1, h1);
        if (c.width === 390) {
          const sw = await page.evaluate(() => document.documentElement.scrollWidth);
          check(`${c.name} ${p}: không cuộn ngang`, sw <= 390, sw);
          const small = await page.locator('header button, header a, nav.fixed a').evaluateAll((els) =>
            els.filter((e) => e.offsetParent && e.getBoundingClientRect().height < 43.5).map((e) => e.getAttribute('aria-label') ?? e.textContent),
          );
          check(`${c.name} ${p}: nút header/menu ≥ 44px`, small.length === 0, small);
        }
        await page.screenshot({ path: `t8-${c.name}-${p.replace('/', '-')}.png`, fullPage: c.width === 390 });
      }
    },
    { width: c.width, height: c.height, prefs: c.prefs, theme: c.theme },
  );
}

// In thử: #print-root vẫn 80mm, không nhận màu nhấn
await withPage(async (page) => {
  await page.goto(`${BASE}/settings`);
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'In thử' }).click();
  await page.waitForTimeout(500);
  await page.emulateMedia({ media: 'print' });
  const w = await page.locator('#print-root').evaluate((el) => el.getBoundingClientRect().width);
  check('hóa đơn in rộng ~80mm (≈302px)', Math.abs(w - 302) < 20, w);
});
```

Run: `node t8.mjs` → `ALL PASS`. Đọc **toàn bộ** ảnh `t8-*` (44 ảnh): so với tiêu chí mục 1 của spec (không còn gradient/avatar giả/"Giai đoạn 3", số liệu không bị cắt, ô ngày `dd/mm/yyyy`, bố cục thống nhất, chế độ tối đồng bộ sidebar). Nếu `In thử` không vẽ vào `#print-root` khi `window.print` bị stub, ghi lại hành vi thật quan sát được và kiểm bằng cách đọc CSS `@page` (không đổi) thay vì sửa code in.

- [ ] **Step 7: Soát diff và commit một lần**

```bash
git status --short
git diff --stat
```

Kiểm: `package.json` gốc +1 dòng; `client/package.json` chỉ thêm dependency của shadcn; `vite.config.ts`, `index.html`, `main.tsx` chỉ các dòng nêu ở Task 1; không file cũ nào bị thụt lề/sắp xếp import lại ngoài dòng cần. File nào có hunk chỉ là format thì hoàn tác hunk đó.

```bash
git add -A client shared package.json package-lock.json CLAUDE.md README.md .claude/rules/client.md docs/superpowers/plans/2026-09-30-ui-refresh.md docs/superpowers/specs/2026-09-30-tiny-pos-ui-refresh-design.md
git status --short   # không được có data/, .certs/, .npmrc, .superpowers/
git commit -F - <<'EOF'
feat(client): làm mới giao diện 0.5.0 – sidebar nhóm menu, tùy chỉnh giao diện theo máy, version

- Khung AppShell (shadcn sidebar) + PageTitle trên topbar, bỏ avatar giả và thẻ giai đoạn
- Bảng màu trắng + xanh dương, phẳng; 6 màu nhấn, 4 cỡ chữ, mật độ, bo góc, sáng/tối theo máy
- StatStrip, ListPanel, DateField (dd/mm/yyyy), dialog theo cỡ; chuyển 11 trang
- Màn Bán hàng hết chiều cao, tab đơn chờ, cột giỏ rõ ràng, dòng phím tắt
- Version 0.5.0 ở package.json gốc, hiện ở sidebar và Cài đặt

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git log --oneline -1
```

Dừng tiến trình `npm run dev` nếu chính mình đã bật ở phần chuẩn bị (không dừng tiến trình người dùng tự bật).
