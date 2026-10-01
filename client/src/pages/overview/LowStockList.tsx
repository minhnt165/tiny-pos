import { PackageMinus } from 'lucide-react';
import { Link } from 'react-router';
import { formatQty, type Overview } from '@tiny-pos/shared';
import { EmptyState } from '@/components/EmptyState';
import { ListPanel } from '@/components/ListPanel';
import { ProductAvatar } from '@/components/ProductAvatar';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const CELL = 'px-3 py-2 md:px-4';
const NUM = `${CELL} text-right tabular-nums whitespace-nowrap`;

/** Hàng đang bán dưới mức tối thiểu, thiếu nặng nhất trước; tồn ≤ 0 tô đỏ; "và n mặt hàng nữa" khi quá giới hạn. */
export function LowStockList({ low, loading }: { low: Overview['lowStock'] | undefined; loading: boolean }) {
  const more = low ? low.count - low.items.length : 0;
  return (
    <ListPanel
      toolbar={
        <>
          <h2 className="text-sm font-semibold">Hàng sắp hết</h2>
          {low && <span className="text-sm text-muted-foreground">{low.count} mặt hàng</span>}
          <Button variant="outline" size="sm" className="ml-auto" asChild>
            <Link to="/products?stock=low">Xem tất cả</Link>
          </Button>
        </>
      }
      footer={more > 0 ? <div className="border-t px-4 py-2 text-sm text-muted-foreground">và {more} mặt hàng nữa</div> : undefined}
    >
      {loading || !low ? (
        <TableSkeleton rows={5} />
      ) : low.items.length === 0 ? (
        <EmptyState icon={PackageMinus} title="Không có mặt hàng nào dưới mức tối thiểu" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="px-3 md:px-4">Mặt hàng</TableHead>
              <TableHead className="px-3 text-right md:px-4">Tồn</TableHead>
              <TableHead className="px-3 text-right md:px-4">Tối thiểu</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {low.items.map((i) => (
              <TableRow key={i.productId}>
                <TableCell className={`${CELL} font-medium`}>
                  <span className="flex min-w-0 items-center gap-2">
                    <ProductAvatar name={i.name} image={i.image} className="size-8 shrink-0" />
                    <span className="truncate">{i.name}</span>
                  </span>
                </TableCell>
                <TableCell className={cn(NUM, 'font-semibold', i.stock <= 0 && 'text-destructive')}>
                  {formatQty(i.stock)} <span className="font-normal text-muted-foreground">{i.unit}</span>
                </TableCell>
                <TableCell className={`${NUM} text-muted-foreground`}>{formatQty(i.minStock)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </ListPanel>
  );
}
