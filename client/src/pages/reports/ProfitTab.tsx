import { ReceiptText } from 'lucide-react';
import { formatDateVn, formatMoney, formatMonthVn, type ProfitRow } from '@tiny-pos/shared';
import { useProfitReport, type ReportRangeParams } from '@/api/reports';
import { EmptyState } from '@/components/EmptyState';
import { ListPanel } from '@/components/ListPanel';
import { Stat, StatStrip } from '@/components/StatStrip';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/** "YYYY-MM-DD" → "dd/mm"; "YYYY-MM" → "Tháng mm/yyyy". */
const periodLabel = (p: string) => (p.length === 7 ? formatMonthVn(p) : formatDateVn(p).slice(0, 5));
const percent = (profit: number, revenue: number) => (revenue > 0 ? `${((profit / revenue) * 100).toFixed(1).replace('.', ',')}% doanh thu` : undefined);
const tone = (n: number) => (n > 0 ? 'success' : n < 0 ? 'danger' : 'default');

const CELL = 'px-3 py-3 md:px-4';
const MONEY = `${CELL} text-right tabular-nums`;
const HEAD = 'px-3 md:px-4';
// Điện thoại chỉ đủ chỗ 4 cột: ẩn Giá vốn và ba cột hình thức (đều đã có ở StatStrip)
const MOBILE_HIDDEN = 'hidden md:table-cell';

function Row({ r, total = false }: { r: ProfitRow; total?: boolean }) {
  const cls = total ? 'font-semibold' : '';
  return (
    <TableRow className={total ? 'bg-muted/40 hover:bg-muted/40' : undefined}>
      <TableCell className={`${CELL} ${cls}`}>{total ? 'Tổng' : periodLabel(r.period)}</TableCell>
      <TableCell className={`${MONEY} ${cls}`}>{r.orders}</TableCell>
      <TableCell className={`${MONEY} ${cls}`}>{formatMoney(r.revenue)}</TableCell>
      <TableCell className={`${MONEY} ${MOBILE_HIDDEN} ${cls}`}>{formatMoney(r.cost)}</TableCell>
      <TableCell className={`${MONEY} font-semibold ${r.profit < 0 ? 'text-destructive' : ''}`}>{formatMoney(r.profit)}</TableCell>
      <TableCell className={`${MONEY} ${MOBILE_HIDDEN} ${cls}`}>{formatMoney(r.cash)}</TableCell>
      <TableCell className={`${MONEY} ${MOBILE_HIDDEN} ${cls}`}>{formatMoney(r.transfer)}</TableCell>
      <TableCell className={`${MONEY} ${MOBILE_HIDDEN} ${cls}`}>{formatMoney(r.debt)}</TableCell>
    </TableRow>
  );
}

export function ProfitTab({ range }: { range: ReportRangeParams }) {
  const { data, isLoading } = useProfitReport(range);
  const t = data?.total;
  const collected = (t?.debtCollected.cash ?? 0) + (t?.debtCollected.transfer ?? 0);
  return (
    <>
      <StatStrip>
        <Stat label="Doanh thu" value={formatMoney(t?.revenue ?? 0)} hint="Đơn hoàn tất, đã trừ giảm giá" />
        <Stat label="Giá vốn" value={formatMoney(t?.cost ?? 0)} hint="Giá vốn lúc bán" />
        <Stat label="Lãi gộp" value={formatMoney(t?.profit ?? 0)} hint={t ? percent(t.profit, t.revenue) : undefined} tone={tone(t?.profit ?? 0)} />
        <Stat label="Số đơn" value={String(t?.orders ?? 0)} hint="Không tính đơn đã hủy" />
      </StatStrip>
      <StatStrip>
        <Stat label="Tiền mặt" value={formatMoney(t?.cash ?? 0)} hint="Gồm tiền khách trả trước của đơn ghi nợ" />
        <Stat label="Chuyển khoản" value={formatMoney(t?.transfer ?? 0)} />
        <Stat label="Ghi nợ" value={formatMoney(t?.debt ?? 0)} hint="Phần khách còn thiếu" tone={t?.debt ? 'danger' : 'default'} />
        <Stat
          label="Thu nợ"
          value={formatMoney(collected)}
          hint={`Tiền mặt ${formatMoney(t?.debtCollected.cash ?? 0)} · CK ${formatMoney(t?.debtCollected.transfer ?? 0)}`}
          tone={collected ? 'success' : 'default'}
        />
      </StatStrip>
      <p className="-mt-2 mb-(--gap) text-xs text-muted-foreground">Lãi gộp = doanh thu − giá vốn lúc bán, chưa trừ chi phí khác (điện, thuê mặt bằng…).</p>
      <ListPanel>
        {isLoading || !data ? (
          <TableSkeleton />
        ) : data.total.orders === 0 ? (
          <EmptyState icon={ReceiptText} title="Chưa có hóa đơn trong khoảng này" description="Đổi khoảng thời gian ở trên để xem kỳ khác." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className={HEAD}>{data.range.groupBy === 'day' ? 'Ngày' : 'Tháng'}</TableHead>
                <TableHead className={`${HEAD} text-right`}>Số đơn</TableHead>
                <TableHead className={`${HEAD} text-right`}>Doanh thu</TableHead>
                <TableHead className={`${HEAD} text-right ${MOBILE_HIDDEN}`}>Giá vốn</TableHead>
                <TableHead className={`${HEAD} text-right`}>Lãi</TableHead>
                <TableHead className={`${HEAD} text-right ${MOBILE_HIDDEN}`}>Tiền mặt</TableHead>
                <TableHead className={`${HEAD} text-right ${MOBILE_HIDDEN}`}>CK</TableHead>
                <TableHead className={`${HEAD} text-right ${MOBILE_HIDDEN}`}>Ghi nợ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((r) => (
                <Row key={r.period} r={r} />
              ))}
              <Row r={data.total} total />
            </TableBody>
          </Table>
        )}
      </ListPanel>
    </>
  );
}
