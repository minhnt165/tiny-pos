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

/** Một ô số liệu: nhãn, giá trị đậm, gợi ý. Giá trị không bị cắt "…" hay ngắt giữa số (StatStrip bớt cột khi hẹp). */
export function Stat({ label, value, hint, tone = 'default' }: StatProps) {
  return (
    <div className="min-w-0 rounded-lg border bg-card px-4 py-3">
      <div className="truncate text-sm text-muted-foreground">{label}</div>
      <div className={cn('font-heading text-lg leading-tight font-semibold tracking-tight whitespace-nowrap tabular-nums @3xl:text-2xl', tones[tone])}>
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

// Số cột theo bề ngang khung tính bằng rem (container query), nên cỡ chữ càng to thì càng ít cột và số không bị tràn
const colClass = { 3: '@2xl:grid-cols-3', 4: '@3xl:grid-cols-4', 6: '@2xl:grid-cols-3 @6xl:grid-cols-6' } as const;

/** Hàng số liệu đầu trang: 1–2 cột trên điện thoại (tùy cỡ chữ), `cols` cột khi đủ rộng. */
export function StatStrip({ cols = 4, children }: { cols?: keyof typeof colClass; children: ReactNode }) {
  return (
    <div className="@container mb-(--gap)">
      <div className={cn('grid grid-cols-1 gap-3 @xs:grid-cols-2', colClass[cols])}>{children}</div>
    </div>
  );
}
