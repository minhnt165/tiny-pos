import { cn } from '@/lib/utils';

export const TINTS = [
  'bg-blue-500/12 text-blue-700 dark:text-blue-300',
  'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
  'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  'bg-violet-500/12 text-violet-700 dark:text-violet-300',
  'bg-rose-500/12 text-rose-700 dark:text-rose-300',
  'bg-cyan-500/12 text-cyan-700 dark:text-cyan-300',
];

/** Băm tên thành chỉ số màu ổn định, để cùng một tên luôn cùng màu. */
export function tintFor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length]!;
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    // Bỏ các "từ" chỉ là ký hiệu như "&", "-" để "Sữa & trứng" ra "ST" chứ không phải "S&"
    .filter((w) => /^[\p{L}\p{N}]/u.test(w))
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
}

/** Ô chữ cái đầu nền nhạt thay cho ảnh sản phẩm (chưa có chụp ảnh). */
export function ProductAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <div
      className={cn(
        'grid size-10 shrink-0 place-items-center rounded-lg text-sm font-semibold',
        tintFor(name),
        className,
      )}
      aria-hidden="true"
    >
      {initials(name) || '?'}
    </div>
  );
}
