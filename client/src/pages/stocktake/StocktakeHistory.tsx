import { useState } from 'react';
import { currentTzOffset, formatDateVn, formatMoney, localDate } from '@tiny-pos/shared';
import { useStocktakes } from '@/api/stocktakes';
import { ListPanel } from '@/components/ListPanel';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { StocktakeDetailDialog } from './StocktakeDetailDialog';

export function StocktakeHistory() {
  const { data = [] } = useStocktakes();
  const [openId, setOpenId] = useState<number | null>(null);
  if (!data.length) return null;
  return (
    <>
      <h2 className="mt-(--gap) mb-2 text-sm font-semibold text-muted-foreground">Các lần kiểm kê trước</h2>
      <ListPanel>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="px-4">Mã</TableHead>
              <TableHead className="hidden px-4 sm:table-cell">Ngày</TableHead>
              <TableHead className="hidden px-4 text-right sm:table-cell">Số món</TableHead>
              <TableHead className="px-4 text-right">Món lệch</TableHead>
              <TableHead className="px-4 text-right">Giá trị lệch</TableHead>
              <TableHead className="hidden px-4 sm:table-cell">Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((s) => (
              <TableRow key={s.id} className="cursor-pointer" onClick={() => setOpenId(s.id)}>
                <TableCell className="px-4 py-3">
                  <div className="font-mono">{s.code}</div>
                  <div className="text-sm text-muted-foreground sm:hidden">
                    {formatDateVn(localDate(new Date(s.createdAt), currentTzOffset()))}
                    {s.status === 'cancelled' && ' · Đã hủy'}
                  </div>
                </TableCell>
                <TableCell className="hidden px-4 py-3 sm:table-cell">{formatDateVn(localDate(new Date(s.createdAt), currentTzOffset()))}</TableCell>
                <TableCell className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">{s.itemCount}</TableCell>
                <TableCell className="px-4 py-3 text-right tabular-nums">{s.diffCount}</TableCell>
                <TableCell className={cn('px-4 py-3 text-right tabular-nums', s.status !== 'cancelled' && s.diffValue < 0 && 'text-destructive')}>{s.status === 'cancelled' ? '—' : formatMoney(s.diffValue)}</TableCell>
                <TableCell className="hidden px-4 py-3 sm:table-cell">{s.status === 'done' ? <Badge>Đã chốt</Badge> : <Badge variant="secondary">Đã hủy</Badge>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ListPanel>
      <StocktakeDetailDialog id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
