import { Users, type LucideIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { currentTzOffset, formatDateVn, formatMoney, localDate, type DebtPartyRow, type OverdueCustomerRow } from '@tiny-pos/shared';
import { EmptyState } from '@/components/EmptyState';
import { ListPanel } from '@/components/ListPanel';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Row = DebtPartyRow & Partial<Pick<OverdueCustomerRow, 'lastActivityAt' | 'overdue'>>;
const CELL = 'px-3 py-3 md:px-4';
const lastDay = (iso: string) => formatDateVn(localDate(new Date(iso), currentTzOffset())).slice(0, 5);

/** Khách nợ / nợ NCC dùng chung: header tổng + số người + nút sang trang; khách nợ lâu có hint vàng dưới tên; bấm dòng mở trang với tên điền sẵn. */
export function DebtPanel({
  title,
  icon: Icon,
  debtHeader,
  summary,
  rows,
  listPath,
  loading,
  emptyTitle,
}: {
  title: string;
  icon: LucideIcon;
  debtHeader: string;
  summary: { total: number; count: number } | undefined;
  rows: Row[] | undefined;
  listPath: '/customers' | '/suppliers';
  loading: boolean;
  emptyTitle: string;
}) {
  const navigate = useNavigate();
  return (
    <ListPanel
      toolbar={
        <>
          <h2 className="text-sm font-semibold">{title}</h2>
          {summary && (
            <span className="text-sm text-muted-foreground">
              {formatMoney(summary.total)} · {summary.count} người
            </span>
          )}
          <Button variant="outline" size="sm" className="ml-auto" asChild>
            <Link to={listPath}>
              <Icon data-icon="inline-start" />
              Xem tất cả
            </Link>
          </Button>
        </>
      }
    >
      {loading || !rows ? (
        <TableSkeleton rows={3} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} title={emptyTitle} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="px-3 md:px-4">Tên</TableHead>
              <TableHead className="hidden px-3 md:table-cell md:px-4">SĐT</TableHead>
              <TableHead className="px-3 text-right md:px-4">{debtHeader}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`${listPath}?q=${encodeURIComponent(r.name)}`)}>
                <TableCell className={`${CELL} font-medium`}>
                  <div className="truncate">{r.name}</div>
                  {r.overdue && r.lastActivityAt && <div className="text-xs font-normal text-warning">Giao dịch gần nhất {lastDay(r.lastActivityAt)}</div>}
                  {r.overdue && !r.lastActivityAt && <div className="text-xs font-normal text-warning">Chưa có giao dịch</div>}
                </TableCell>
                <TableCell className={`${CELL} hidden tabular-nums text-muted-foreground md:table-cell`}>{r.phone ?? '—'}</TableCell>
                <TableCell className={`${CELL} text-right font-semibold tabular-nums`}>{formatMoney(r.debt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </ListPanel>
  );
}
