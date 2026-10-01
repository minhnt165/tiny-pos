import { Users } from 'lucide-react';
import { useNavigate } from 'react-router';
import { formatMoney, type DebtPartyRow } from '@tiny-pos/shared';
import { useDebtReport, type ReportRangeParams } from '@/api/reports';
import { EmptyState } from '@/components/EmptyState';
import { ListPanel } from '@/components/ListPanel';
import { Stat, StatStrip } from '@/components/StatStrip';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/** Bảng top nợ; bấm dòng mở trang danh sách với ô tìm điền sẵn tên người đó. */
function PartyPanel({
  title,
  debtHeader,
  rows,
  listPath,
  loading,
  emptyTitle,
}: {
  title: string;
  debtHeader: string;
  rows: DebtPartyRow[] | undefined;
  listPath: '/customers' | '/suppliers';
  loading: boolean;
  emptyTitle: string;
}) {
  const navigate = useNavigate();
  return (
    <ListPanel toolbar={<h2 className="text-sm font-semibold">{title}</h2>}>
      {loading || !rows ? (
        <TableSkeleton />
      ) : rows.length ? (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="px-4">Tên</TableHead>
              <TableHead className="px-4">SĐT</TableHead>
              <TableHead className="px-4 text-right">{debtHeader}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`${listPath}?q=${encodeURIComponent(r.name)}`)}>
                <TableCell className="px-4 py-3 font-medium">{r.name}</TableCell>
                <TableCell className="px-4 py-3 tabular-nums text-muted-foreground">{r.phone ?? '—'}</TableCell>
                <TableCell className="px-4 py-3 text-right font-semibold tabular-nums">{formatMoney(r.debt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState icon={Users} title={emptyTitle} />
      )}
    </ListPanel>
  );
}

export function DebtTab({ range }: { range: ReportRangeParams }) {
  const { data, isLoading } = useDebtReport(range);
  const c = data?.customers;
  const s = data?.suppliers;
  const p = data?.period;
  const collected = (p?.collected.cash ?? 0) + (p?.collected.transfer ?? 0);
  const loading = isLoading || !data;
  return (
    <>
      <StatStrip>
        <Stat label="Khách đang nợ" value={formatMoney(c?.total ?? 0)} hint={`Hiện tại · ${c?.count ?? 0} khách`} tone={c?.total ? 'danger' : 'default'} />
        <Stat label="Mình nợ NCC" value={formatMoney(s?.total ?? 0)} hint={`Hiện tại · ${s?.count ?? 0} nhà cung cấp`} tone={s?.total ? 'warning' : 'default'} />
        <Stat label="Ghi nợ trong kỳ" value={formatMoney(p?.debt ?? 0)} hint="Phần khách còn thiếu trên hóa đơn" />
        <Stat
          label="Thu nợ trong kỳ"
          value={formatMoney(collected)}
          hint={`Tiền mặt ${formatMoney(p?.collected.cash ?? 0)} · CK ${formatMoney(p?.collected.transfer ?? 0)}`}
          tone={collected ? 'success' : 'default'}
        />
      </StatStrip>
      <div className="grid gap-(--gap) lg:grid-cols-2">
        <PartyPanel title="Khách nợ nhiều nhất" debtHeader="Đang nợ" rows={c?.top} listPath="/customers" loading={loading} emptyTitle="Không khách nào đang nợ" />
        <PartyPanel title="Mình nợ NCC nhiều nhất" debtHeader="Còn nợ" rows={s?.top} listPath="/suppliers" loading={loading} emptyTitle="Không nợ nhà cung cấp nào" />
      </div>
    </>
  );
}
