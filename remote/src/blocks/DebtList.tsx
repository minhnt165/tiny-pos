import { formatMoney, type DebtPartyRow, type OverdueCustomerRow } from '@tiny-pos/shared';
import { Badge } from '@/components/ui/badge';
import { EmptyLine, Panel } from './Panel';
import { shortDay, localDay } from './format';

type Row = DebtPartyRow & Partial<Pick<OverdueCustomerRow, 'lastPaymentAt' | 'owingSince' | 'overdue'>>;

/** "Nợ từ dd/mm · trả gần nhất dd/mm" cho khách nợ lâu, như DebtPanel máy quầy. */
function overdueHint(r: Row): string {
  const since = r.owingSince ?? r.lastPaymentAt;
  const from = since ? `Nợ từ ${shortDay(localDay(since))}` : 'Chưa có giao dịch';
  return r.lastPaymentAt ? `${from} · trả gần nhất ${shortDay(localDay(r.lastPaymentAt))}` : `${from} · chưa trả lần nào`;
}

/** Khách nợ / nợ NCC: tổng + số người ở đầu, danh sách nợ nhiều nhất; khách nợ lâu có badge và hint vàng. */
export function DebtList({ title, summary, rows, emptyTitle }: { title: string; summary: { total: number; count: number }; rows: Row[]; emptyTitle: string }) {
  const more = summary.count - rows.length;
  return (
    <Panel title={title} count={summary.count ? `${summary.count} người · ${formatMoney(summary.total)}` : undefined}>
      {rows.length === 0 ? (
        <EmptyLine>{emptyTitle}</EmptyLine>
      ) : (
        <ul className="divide-y border-t">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{r.name}</span>
                  {r.overdue && <Badge variant="outline" className="border-warning text-warning">Nợ lâu</Badge>}
                </div>
                {r.overdue ? <div className="text-xs text-warning">{overdueHint(r)}</div> : r.phone && <div className="text-xs text-muted-foreground">{r.phone}</div>}
              </div>
              <span className="shrink-0 font-semibold tabular-nums">{formatMoney(r.debt)}</span>
            </li>
          ))}
        </ul>
      )}
      {more > 0 && <div className="border-t px-4 py-2 text-sm text-muted-foreground">và {more} người nữa</div>}
    </Panel>
  );
}
