import { cn } from '@/lib/utils';

export const GRADIENTS = [
  'from-emerald-400 to-teal-600',
  'from-sky-400 to-blue-600',
  'from-amber-400 to-orange-600',
  'from-violet-400 to-purple-600',
  'from-rose-400 to-pink-600',
  'from-lime-400 to-green-600',
];

/** Băm tên thành chỉ số màu ổn định, để cùng một tên luôn cùng màu. */
export function gradientFor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length]!;
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

/** Ô chữ cái đầu có màu gradient thay cho ảnh sản phẩm (chưa có chụp ảnh). */
export function ProductAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <div
      className={cn(
        'grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-sm font-semibold text-white shadow-sm',
        gradientFor(name),
        className,
      )}
      aria-hidden="true"
    >
      {initials(name) || '?'}
    </div>
  );
}
