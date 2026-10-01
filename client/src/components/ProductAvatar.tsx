import { useState } from 'react';
import { productImageUrl } from '@/api/products';
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

/** Ảnh sản phẩm nếu có; không có hoặc tải lỗi thì ô chữ cái đầu nền nhạt. */
export function ProductAvatar({ name, image, className }: { name: string; image?: string | null; className?: string }) {
  // Tên ảnh tải lỗi (file không còn sau khi khôi phục bản sao cũ); đổi ảnh khác thì thử lại
  const [broken, setBroken] = useState<string | null>(null);
  const src = image && broken !== image ? productImageUrl(image) : null;
  return (
    <div
      className={cn(
        'grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg text-sm font-semibold',
        src ? 'bg-muted' : tintFor(name),
        className,
      )}
      aria-hidden="true"
    >
      {src ? <img src={src} alt="" loading="lazy" className="size-full object-cover" onError={() => setBroken(image ?? null)} /> : initials(name) || '?'}
    </div>
  );
}
