import { Trash2 } from 'lucide-react';
import { formatDateVn, formatMoney, formatQty, type LotRow } from '@tiny-pos/shared';
import { ProductAvatar } from '@/components/ProductAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { daysLabel, LOT_STATE_LABEL } from './lot-labels';

const CELL = 'px-3 py-2 md:px-4';
const NUM = `${CELL} text-right tabular-nums whitespace-nowrap`;

function ExpiryBadge({ l }: { l: LotRow }) {
  if (l.expiresOn === null) return <span className="text-muted-foreground">Không hạn</span>;
  const variant = l.state === 'expired' ? 'destructive' : l.state === 'expiring' ? 'outline' : 'secondary';
  return (
    <span className="flex flex-col items-start gap-0.5">
      <Badge variant={variant} className={cn(l.state === 'expiring' && 'border-warning text-warning')}>
        {formatDateVn(l.expiresOn)}
      </Badge>
      <span className="text-xs text-muted-foreground">{daysLabel(l.daysLeft)}</span>
    </span>
  );
}

/** Bảng lô; cột phiếu/giá vốn ẩn trên điện thoại. Nút Bỏ hàng chỉ với lô còn hàng. */
export function LotTable({ rows, onOpenImport, onDispose }: { rows: LotRow[]; onOpenImport: (importId: number) => void; onDispose: (l: LotRow) => void }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <TableHead className={CELL}>Sản phẩm</TableHead>
          <TableHead className={`${CELL} max-md:hidden`}>Phiếu nhập</TableHead>
          <TableHead className={CELL}>Hạn dùng</TableHead>
          <TableHead className={`${CELL} text-right`}>Còn</TableHead>
          <TableHead className={`${CELL} text-right max-md:hidden`}>Giá vốn</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((l) => (
          <TableRow key={l.id} className={cn(l.state === 'empty' && 'text-muted-foreground')}>
            <TableCell className={`${CELL} font-medium`}>
              <span className="flex min-w-0 items-center gap-2">
                <ProductAvatar name={l.productName} image={l.image} className="size-8 shrink-0" />
                <span className="truncate">{l.productName}</span>
              </span>
            </TableCell>
            <TableCell className={`${CELL} max-md:hidden`}>
              {l.importId !== null ? (
                <Button variant="link" className="h-auto p-0 font-mono" onClick={() => onOpenImport(l.importId!)}>
                  {l.importCode}
                </Button>
              ) : (
                <span className="text-muted-foreground">Tồn đầu</span>
              )}
            </TableCell>
            <TableCell className={CELL}>
              <ExpiryBadge l={l} />
              {l.state === 'empty' && <Badge variant="secondary" className="ml-2">{LOT_STATE_LABEL.empty}</Badge>}
            </TableCell>
            <TableCell className={cn(NUM, 'font-semibold', l.remaining < 0 && 'text-destructive')}>
              {formatQty(l.remaining)} <span className="font-normal text-muted-foreground">{l.unit}</span>
            </TableCell>
            <TableCell className={`${NUM} max-md:hidden`}>{formatMoney(l.costPrice)}</TableCell>
            <TableCell className="py-2 pr-2">
              {l.remaining > 0 && (
                <Button variant="ghost" size="icon-lg" className="size-11 text-destructive" aria-label="Bỏ hàng" title="Bỏ hàng" onClick={() => onDispose(l)}>
                  <Trash2 />
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
