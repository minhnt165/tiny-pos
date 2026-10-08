import { CalendarClock } from 'lucide-react';
import { Link } from 'react-router';
import { formatDateVn, formatQty, type Overview } from '@tiny-pos/shared';
import { EmptyState } from '@/components/EmptyState';
import { ListPanel } from '@/components/ListPanel';
import { ProductAvatar } from '@/components/ProductAvatar';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { daysLabel } from '../lots/lot-labels';

const CELL = 'px-3 py-2 md:px-4';

/** Lô còn hàng đã/sắp hết hạn, quá hạn trước; "và n lô nữa" khi quá giới hạn. */
export function ExpiringList({ expiring, loading }: { expiring: Overview['expiring'] | undefined; loading: boolean }) {
  const total = expiring ? expiring.count + expiring.expiredCount : 0;
  const more = expiring ? total - expiring.items.length : 0;
  return (
    <ListPanel
      toolbar={
        <>
          <h2 className="text-sm font-semibold">Sắp hết hạn</h2>
          {expiring && <span className="text-sm text-muted-foreground">{total} lô</span>}
          <Button variant="outline" size="sm" className="ml-auto" asChild>
            <Link to="/lots?state=expired,expiring">Xem tất cả</Link>
          </Button>
        </>
      }
      footer={more > 0 ? <div className="border-t px-4 py-2 text-sm text-muted-foreground">và {more} lô nữa</div> : undefined}
    >
      {loading || !expiring ? (
        <TableSkeleton rows={5} />
      ) : expiring.items.length === 0 ? (
        <EmptyState icon={CalendarClock} title="Không có lô nào sắp hết hạn" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className={CELL}>Mặt hàng</TableHead>
              <TableHead className={CELL}>Hạn</TableHead>
              <TableHead className={`${CELL} text-right`}>Còn</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expiring.items.map((l) => (
              <TableRow key={l.id}>
                <TableCell className={`${CELL} w-full max-w-0 font-medium`}>
                  <span className="flex min-w-0 items-center gap-2">
                    <ProductAvatar name={l.productName} image={l.image} className="size-8 shrink-0" />
                    <span className="truncate">{l.productName}</span>
                  </span>
                </TableCell>
                <TableCell className={cn(CELL, 'tabular-nums', l.state === 'expired' ? 'text-destructive' : 'text-warning')}>
                  {l.expiresOn && formatDateVn(l.expiresOn)} <span className="text-xs text-muted-foreground max-md:block">{daysLabel(l.daysLeft)}</span>
                </TableCell>
                <TableCell className={`${CELL} text-right font-semibold tabular-nums`}>
                  {formatQty(l.remaining)} <span className="font-normal text-muted-foreground">{l.unit}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </ListPanel>
  );
}
