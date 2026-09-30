import { formatMoney, type ImportSummary } from '@tiny-pos/shared';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const time = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
/** "30/09 13:33": xem nhiều ngày thì cần cả ngày. */
const dayTime = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${time(iso)}`;
};

export function ImportTable({ imports, onOpen, showDate = false }: { imports: ImportSummary[]; onOpen: (id: number) => void; showDate?: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <TableHead className="px-4">Mã</TableHead>
          <TableHead className="px-4">{showDate ? 'Thời gian' : 'Giờ'}</TableHead>
          <TableHead className="px-4">Nhà cung cấp</TableHead>
          <TableHead className="px-4 text-right">Số dòng</TableHead>
          <TableHead className="px-4 text-right">Tổng</TableHead>
          <TableHead className="px-4 text-right">Còn nợ</TableHead>
          <TableHead className="px-4">Trạng thái</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {imports.map((i) => {
          const cancelled = i.status === 'cancelled';
          return (
            <TableRow key={i.id} className={cn('cursor-pointer', cancelled && 'text-muted-foreground')} onClick={() => onOpen(i.id)}>
              <TableCell className={cn('px-4 py-3 font-mono', cancelled && 'line-through')}>{i.code}</TableCell>
              <TableCell className="px-4 py-3 tabular-nums">{showDate ? dayTime(i.createdAt) : time(i.createdAt)}</TableCell>
              <TableCell className="px-4 py-3">{i.supplierName ?? '—'}</TableCell>
              <TableCell className="px-4 py-3 text-right tabular-nums">{i.itemCount}</TableCell>
              <TableCell className={cn('px-4 py-3 text-right font-semibold tabular-nums', cancelled && 'line-through')}>{formatMoney(i.total)}</TableCell>
              <TableCell className="px-4 py-3 text-right tabular-nums">{i.total > i.paid ? formatMoney(i.total - i.paid) : '—'}</TableCell>
              <TableCell className="px-4 py-3">{cancelled ? <Badge variant="secondary">Đã hủy</Badge> : <Badge>Hoàn tất</Badge>}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
