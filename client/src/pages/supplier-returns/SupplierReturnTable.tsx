import { formatMoney, type SupplierReturnSummary } from '@tiny-pos/shared';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { dayTime, time } from '../orders/OrderTable';

/** Bảng phiếu trả NCC; xem nhiều ngày thì cột thời gian ghi cả ngày. Bấm vào hàng để xem chi tiết. */
export function SupplierReturnTable({ rows, onOpen, showDate = false }: { rows: SupplierReturnSummary[]; onOpen: (id: number) => void; showDate?: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <TableHead className="px-4">Mã</TableHead>
          <TableHead className="px-4">{showDate ? 'Thời gian' : 'Giờ'}</TableHead>
          <TableHead className="px-4">Nhà cung cấp</TableHead>
          <TableHead className="px-4 text-right">Số món</TableHead>
          <TableHead className="px-4 text-right">Tổng trả</TableHead>
          <TableHead className="px-4">Trạng thái</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const cancelled = r.status === 'cancelled';
          return (
            <TableRow key={r.id} className={cn('cursor-pointer', cancelled && 'text-muted-foreground')} onClick={() => onOpen(r.id)}>
              <TableCell className={cn('px-4 py-3 font-mono', cancelled && 'line-through')}>{r.code}</TableCell>
              <TableCell className="px-4 py-3 tabular-nums">{showDate ? dayTime(r.createdAt) : time(r.createdAt)}</TableCell>
              <TableCell className="px-4 py-3">{r.supplierName}</TableCell>
              <TableCell className="px-4 py-3 text-right tabular-nums">{r.itemCount}</TableCell>
              <TableCell className={cn('px-4 py-3 text-right font-semibold tabular-nums', cancelled && 'line-through')}>{formatMoney(r.total)}</TableCell>
              <TableCell className="px-4 py-3">{cancelled ? <Badge variant="secondary">Đã hủy</Badge> : <Badge>Hoàn tất</Badge>}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
