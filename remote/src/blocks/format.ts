import { currentTzOffset, formatDateVn, localDate } from '@tiny-pos/shared';

export const time = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
export const localDay = (iso: string) => localDate(new Date(iso), currentTzOffset());
/** "dd/mm" */
export const shortDay = (ymd: string) => formatDateVn(ymd).slice(0, 5);
export const METHOD_LABEL = { cash: 'Tiền mặt', transfer: 'Chuyển khoản', debt: 'Ghi nợ' } as const;

const TINTS = [
  'bg-blue-500/12 text-blue-700 dark:text-blue-300',
  'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
  'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  'bg-violet-500/12 text-violet-700 dark:text-violet-300',
  'bg-rose-500/12 text-rose-700 dark:text-rose-300',
  'bg-cyan-500/12 text-cyan-700 dark:text-cyan-300',
];
/** Màu ô chữ cái ổn định theo tên, cùng thuật toán với ProductAvatar của client. */
export function tintFor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length]!;
}
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter((w) => /^[\p{L}\p{N}]/u.test(w))
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}
