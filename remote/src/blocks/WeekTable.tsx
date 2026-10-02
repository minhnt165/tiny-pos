import { formatMoney, shiftDate, type ProfitReport, type ProfitRow } from '@tiny-pos/shared';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Panel } from './Panel';
import { shortDay } from './format';

const CELL = 'px-3 py-2';
const MONEY = `${CELL} text-right tabular-nums`;

function dayLabel(period: string, today: string): string {
  if (period === today) return 'Hôm nay';
  if (period === shiftDate(today, -1)) return 'Hôm qua';
  return shortDay(period);
}

function Row({ r, label, total = false }: { r: ProfitRow; label: string; total?: boolean }) {
  const cls = total ? 'font-semibold' : '';
  return (
    <TableRow className={total ? 'bg-muted/40 hover:bg-muted/40' : undefined}>
      <TableCell className={`${CELL} ${cls}`}>{label}</TableCell>
      <TableCell className={`${MONEY} ${cls}`}>{r.orders}</TableCell>
      <TableCell className={`${MONEY} ${cls}`}>{formatMoney(r.revenue)}</TableCell>
      <TableCell className={`${MONEY} font-semibold ${r.profit < 0 ? 'text-destructive' : ''}`}>{formatMoney(r.profit)}</TableCell>
    </TableRow>
  );
}

/** 7 ngày gần đây, mới nhất trước, dòng tổng cuối. */
export function WeekTable({ week, today }: { week: ProfitReport; today: string }) {
  return (
    <Panel title="7 ngày gần đây">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className={CELL}>Ngày</TableHead>
            <TableHead className={`${CELL} text-right`}>Đơn</TableHead>
            <TableHead className={`${CELL} text-right`}>Doanh thu</TableHead>
            <TableHead className={`${CELL} text-right`}>Lãi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {week.rows.map((r) => (
            <Row key={r.period} r={r} label={dayLabel(r.period, today)} />
          ))}
          <Row r={week.total} label="Tổng 7 ngày" total />
        </TableBody>
      </Table>
    </Panel>
  );
}
