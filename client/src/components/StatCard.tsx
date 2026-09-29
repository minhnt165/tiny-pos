import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Tone = 'default' | 'warn' | 'danger' | 'info';

const tones: Record<Tone, string> = {
  default: 'bg-primary/10 text-primary',
  warn: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  danger: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  info: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
};

interface Props {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
}

/** Ô số liệu tổng quan đầu trang. */
export function StatCard({ icon: Icon, label, value, hint, tone = 'default' }: Props) {
  return (
    <Card size="sm">
      <CardContent className="flex items-center gap-4">
        <div className={cn('grid size-11 shrink-0 place-items-center rounded-xl', tones[tone])}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="truncate font-heading text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
          {hint && <div className="truncate text-xs text-muted-foreground">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
