import { useState } from 'react';
import { formatMoney } from '@tiny-pos/shared';
import { useStocktakes } from '@/api/stocktakes';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { StocktakeDetailDialog } from './StocktakeDetailDialog';

export function StocktakeHistory() {
  const { data = [] } = useStocktakes();
  const [openId, setOpenId] = useState<number | null>(null);
  if (!data.length) return null;
  return (
    <>
      <h2 className="mt-8 mb-3 font-heading text-lg font-semibold">Các lần kiểm kê trước</h2>
      <Card className="gap-0 overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="px-4">Mã</TableHead>
              <TableHead className="px-4">Ngày</TableHead>
              <TableHead className="px-4 text-right">Số món</TableHead>
              <TableHead className="px-4 text-right">Món lệch</TableHead>
              <TableHead className="px-4 text-right">Giá trị lệch</TableHead>
              <TableHead className="px-4">Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((s) => (
              <TableRow key={s.id} className="cursor-pointer" onClick={() => setOpenId(s.id)}>
                <TableCell className="px-4 py-3 font-mono">{s.code}</TableCell>
                <TableCell className="px-4 py-3">{new Date(s.createdAt).toLocaleDateString('vi-VN')}</TableCell>
                <TableCell className="px-4 py-3 text-right tabular-nums">{s.itemCount}</TableCell>
                <TableCell className="px-4 py-3 text-right tabular-nums">{s.diffCount}</TableCell>
                <TableCell className={cn('px-4 py-3 text-right tabular-nums', s.diffValue < 0 && 'text-destructive')}>{formatMoney(s.diffValue)}</TableCell>
                <TableCell className="px-4 py-3">{s.status === 'done' ? <Badge>Đã chốt</Badge> : <Badge variant="secondary">Đã hủy</Badge>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <StocktakeDetailDialog id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
