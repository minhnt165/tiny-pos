import { BarChart3 } from 'lucide-react';
import { Link } from 'react-router';
import { formatDateVn, formatMoney, shiftDate, type ProfitReport, type ProfitRow } from '@tiny-pos/shared';
import { ListPanel } from '@/components/ListPanel';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const CELL = 'px-3 py-3 md:px-4';
const MONEY = `${CELL} text-right tabular-nums`;
const HEAD = 'bg-muted/40 hover:bg-muted/40';

/** Hôm nay / Hôm qua / dd/mm. */
function dayLabel(period: string, today: string): string {
  if (period === today) return 'Hôm nay';
  if (period === shiftDate(today, -1)) return 'Hôm qua';
  return formatDateVn(period).slice(0, 5);
}

function Row({ r, label, total = false }: { r: ProfitRow; label: string; total?: boolean }) {
  const cls = total ? 'font-semibold' : '';
  return (
    <TableRow className={total ? HEAD : undefined}>
      <TableCell className={`${CELL} ${cls}`}>{label}</TableCell>
      <TableCell className={`${MONEY} ${cls}`}>{r.orders}</TableCell>
      <TableCell className={`${MONEY} ${cls}`}>{formatMoney(r.revenue)}</TableCell>
      <TableCell className={`${MONEY} font-semibold ${r.profit < 0 ? 'text-destructive' : ''}`}>{formatMoney(r.profit)}</TableCell>
    </TableRow>
  );
}

/** Bảng 7 ngày gần đây từ báo cáo lãi lỗ (ngày trống vẫn có dòng 0), dòng Tổng; nút sang Báo cáo. */
export function WeekTable({ week, today, loading }: { week: ProfitReport | undefined; today: string; loading: boolean }) {
  return (
    <ListPanel
      toolbar={
        <>
          <h2 className="text-sm font-semibold">7 ngày gần đây</h2>
          <Button variant="outline" size="sm" className="ml-auto" asChild>
            <Link to="/reports">
              <BarChart3 data-icon="inline-start" />
              Báo cáo
            </Link>
          </Button>
        </>
      }
    >
      {loading || !week ? (
        <TableSkeleton rows={7} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className={HEAD}>
              <TableHead className="px-3 md:px-4">Ngày</TableHead>
              <TableHead className="px-3 text-right md:px-4">Số đơn</TableHead>
              <TableHead className="px-3 text-right md:px-4">Doanh thu</TableHead>
              <TableHead className="px-3 text-right md:px-4">Lãi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {week.rows.map((r) => (
              <Row key={r.period} r={r} label={dayLabel(r.period, today)} />
            ))}
            <Row r={week.total} label="Tổng" total />
          </TableBody>
        </Table>
      )}
    </ListPanel>
  );
}
