import { formatMoney, type ProfitReport } from '@tiny-pos/shared';
import { cn } from '@/lib/utils';

type Tone = 'default' | 'success' | 'warning' | 'danger';
const tones: Record<Tone, string> = { default: '', success: 'text-success', warning: 'text-warning', danger: 'text-destructive' };
const percent = (profit: number, revenue: number) => (revenue > 0 ? `${((profit / revenue) * 100).toFixed(1).replace('.', ',')}% doanh thu` : undefined);
const tone = (n: number): Tone => (n > 0 ? 'success' : n < 0 ? 'danger' : 'default');
const signed = (n: number) => (n > 0 ? `+${formatMoney(n)}` : n < 0 ? `−${formatMoney(-n)}` : formatMoney(0));

function Stat({ label, value, hint, tone = 'default' }: { label: string; value: string; hint?: string; tone?: Tone }) {
  return (
    <div className="min-w-0 rounded-lg border bg-card px-4 py-3">
      <div className="truncate text-sm text-muted-foreground">{label}</div>
      <div className={cn('text-lg leading-tight font-semibold tracking-tight whitespace-nowrap tabular-nums sm:text-2xl', tones[tone])}>{value}</div>
      {hint && <div className="truncate text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

/** Hôm nay = rows[0], hôm qua = rows[1] của báo cáo 7 ngày (cùng công thức trang Tổng quan máy quầy). */
export function TodayStats({ week, outCount }: { week: ProfitReport; outCount: number }) {
  const t = week.rows[0];
  const y = week.rows[1];
  if (!t) return null;
  const collected = t.debtCollected.cash + t.debtCollected.transfer;
  const diff = y ? t.revenue - y.revenue : undefined;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label="Doanh thu hôm nay" value={formatMoney(t.revenue)} hint={t.orders ? `${t.orders} đơn` : 'Chưa có hóa đơn hôm nay'} />
      <Stat label="Lãi gộp" value={formatMoney(t.profit)} hint={percent(t.profit, t.revenue)} tone={tone(t.profit)} />
      <Stat label="Tiền mặt" value={formatMoney(t.cash)} hint="Gồm trả trước của đơn ghi nợ" />
      <Stat label="Chuyển khoản" value={formatMoney(t.transfer)} />
      <Stat label="Ghi nợ" value={formatMoney(t.debt)} hint="Phần khách còn thiếu" tone={t.debt ? 'danger' : 'default'} />
      <Stat label="Thu nợ" value={formatMoney(collected)} hint={`Tiền mặt ${formatMoney(t.debtCollected.cash)} · CK ${formatMoney(t.debtCollected.transfer)}`} tone={collected ? 'success' : 'default'} />
      <Stat label="So với hôm qua" value={diff === undefined ? '—' : signed(diff)} hint={y ? `Hôm qua ${formatMoney(y.revenue)}` : undefined} tone={tone(diff ?? 0)} />
      <Stat label="Hết hàng" value={`${outCount} mặt hàng`} tone={outCount ? 'danger' : 'default'} />
    </div>
  );
}
