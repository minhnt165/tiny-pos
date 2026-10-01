import { Link } from 'react-router';
import { formatMoney, type ProfitReport } from '@tiny-pos/shared';
import { Stat, StatStrip } from '@/components/StatStrip';

const percent = (profit: number, revenue: number) => (revenue > 0 ? `${((profit / revenue) * 100).toFixed(1).replace('.', ',')}% doanh thu` : undefined);
const tone = (n: number) => (n > 0 ? 'success' : n < 0 ? 'danger' : 'default');
/** "+120.000 ₫" / "−30.000 ₫" / "0 ₫". */
const signed = (n: number) => (n > 0 ? `+${formatMoney(n)}` : n < 0 ? `−${formatMoney(-n)}` : formatMoney(0));
/** Ô số liệu bấm được: bọc Stat bằng Link, vòng focus như nút (như thẻ Mặt hàng của Báo cáo). */
const LINK = 'block rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';
const DASH = '—';

/** Hai hàng số liệu hôm nay; rows[0] của báo cáo 7 ngày là hôm nay, rows[1] hôm qua. Chưa có dữ liệu thì "—". */
export function TodayStats({ week, outCount }: { week: ProfitReport | undefined; outCount: number | undefined }) {
  const t = week?.rows[0];
  const y = week?.rows[1];
  const money = (n: number | undefined) => (n === undefined ? DASH : formatMoney(n));
  const collected = t ? t.debtCollected.cash + t.debtCollected.transfer : undefined;
  const diff = t && y ? t.revenue - y.revenue : undefined;
  return (
    <>
      <StatStrip>
        <Stat label="Doanh thu hôm nay" value={money(t?.revenue)} hint={t ? (t.orders ? `${t.orders} đơn` : 'Chưa có hóa đơn hôm nay') : undefined} />
        <Stat label="Lãi gộp" value={money(t?.profit)} hint={t ? percent(t.profit, t.revenue) : undefined} tone={tone(t?.profit ?? 0)} />
        <Stat label="Tiền mặt" value={money(t?.cash)} hint="Gồm trả trước của đơn ghi nợ" />
        <Stat label="Chuyển khoản" value={money(t?.transfer)} />
      </StatStrip>
      <StatStrip>
        <Stat label="Ghi nợ" value={money(t?.debt)} hint="Phần khách còn thiếu" tone={t?.debt ? 'danger' : 'default'} />
        <Stat
          label="Thu nợ"
          value={money(collected)}
          hint={t ? `Tiền mặt ${formatMoney(t.debtCollected.cash)} · CK ${formatMoney(t.debtCollected.transfer)}` : undefined}
          tone={collected ? 'success' : 'default'}
        />
        <Stat label="So với hôm qua" value={diff === undefined ? DASH : signed(diff)} hint={y ? `Hôm qua ${formatMoney(y.revenue)}` : undefined} tone={tone(diff ?? 0)} />
        <Link to="/products?stock=out" className={LINK}>
          <Stat label="Hết hàng" value={outCount === undefined ? DASH : `${outCount} mặt hàng`} hint="Bấm để xem" tone={outCount ? 'danger' : 'default'} />
        </Link>
      </StatStrip>
    </>
  );
}
