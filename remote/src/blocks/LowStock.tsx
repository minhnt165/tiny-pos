import { formatQty, type Overview } from '@tiny-pos/shared';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { EmptyLine, Panel } from './Panel';
import { initials, tintFor } from './format';

const CELL = 'px-3 py-2';

/** Hàng dưới mức tối thiểu, thiếu nặng nhất trước; ảnh nằm ở máy quầy nên chỉ hiện chữ cái. */
export function LowStock({ low }: { low: Overview['lowStock'] }) {
  const more = low.count - low.items.length;
  return (
    <Panel title="Hàng sắp hết" count={`${low.count} mặt hàng`}>
      {low.items.length === 0 ? (
        <EmptyLine>Không có mặt hàng nào dưới mức tối thiểu</EmptyLine>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className={CELL}>Mặt hàng</TableHead>
              <TableHead className={`${CELL} text-right`}>Tồn</TableHead>
              <TableHead className={`${CELL} text-right`}>Tối thiểu</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {low.items.map((p) => (
              <TableRow key={p.productId}>
                <TableCell className={CELL}>
                  <div className="flex items-center gap-2">
                    <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg text-xs font-semibold', tintFor(p.name))} aria-hidden="true">
                      {initials(p.name) || '?'}
                    </span>
                    <span className="min-w-0 truncate font-medium">{p.name}</span>
                  </div>
                </TableCell>
                <TableCell className={cn(CELL, 'text-right tabular-nums whitespace-nowrap', p.stock <= 0 && 'font-semibold text-destructive')}>
                  {formatQty(p.stock)} {p.unit}
                </TableCell>
                <TableCell className={`${CELL} text-right tabular-nums whitespace-nowrap text-muted-foreground`}>
                  {formatQty(p.minStock)} {p.unit}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {more > 0 && <div className="border-t px-4 py-2 text-sm text-muted-foreground">và {more} mặt hàng nữa</div>}
    </Panel>
  );
}
