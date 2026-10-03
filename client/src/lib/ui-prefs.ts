import { useState } from 'react';
import { readStorage, writeStorage } from '@/lib/storage';

/** Tùy chọn giao diện theo máy (Cài đặt → Giao diện). Áp bằng data-* trên <html>, CSS ở index.css. */
export const ACCENTS = [
  { value: 'blue', label: 'Xanh dương', swatch: '#2563eb' },
  { value: 'green', label: 'Xanh lá', swatch: '#047857' },
  { value: 'violet', label: 'Tím', swatch: '#7c3aed' },
  { value: 'orange', label: 'Cam', swatch: '#c2410c' },
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
  /** Mở phần mềm (đường dẫn gốc) vào thẳng cửa sổ quầy /pos thay vì Bán hàng có menu. */
  startPos: boolean;
}

export const DEFAULT_UI_PREFS: UiPrefs = { accent: 'blue', font: 'md', density: 'compact', radius: 'md', startPos: false };
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
    startPos: o.startPos === true,
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
