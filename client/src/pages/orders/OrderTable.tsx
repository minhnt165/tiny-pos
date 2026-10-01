import { formatMoney, type OrderSummary } from '@tiny-pos/shared';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export const METHOD_LABEL = { cash: 'Tiền mặt', transfer: 'Chuyển khoản', debt: 'Ghi nợ' } as const;
export const time = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
/** "30/09 13:33": xem nhiều ngày thì cần cả ngày. */
export const dayTime = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${time(iso)}`;
};

/** Bảng hóa đơn; xem nhiều ngày thì cột thời gian ghi cả ngày. Bấm vào hàng để xem chi tiết. */
export function OrderTable({ orders, onOpen, showDate = false }: { orders: OrderSummary[]; onOpen: (id: number) => void; showDate?: boolean }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <TableHead className="px-4">Mã</TableHead>
          <TableHead className="px-4">{showDate ? 'Thời gian' : 'Giờ'}</TableHead>
          <TableHead className="px-4 text-right">Số món</TableHead>
          <TableHead className="px-4 text-right">Phải trả</TableHead>
          <TableHead className="px-4">Thanh toán</TableHead>
          <TableHead className="px-4">Trạng thái</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((o) => {
          const cancelled = o.status === 'cancelled';
          return (
            <TableRow key={o.id} className={cn('cursor-pointer', cancelled && 'text-muted-foreground')} onClick={() => onOpen(o.id)}>
              <TableCell className={cn('px-4 py-3 font-mono', cancelled && 'line-through')}>{o.code}</TableCell>
              <TableCell className="px-4 py-3 tabular-nums">{showDate ? dayTime(o.createdAt) : time(o.createdAt)}</TableCell>
              <TableCell className="px-4 py-3 text-right tabular-nums">{o.itemCount}</TableCell>
              <TableCell className={cn('px-4 py-3 text-right font-semibold tabular-nums', cancelled && 'line-through')}>{formatMoney(o.payable)}</TableCell>
              <TableCell className="px-4 py-3">
                {o.paymentMethod === 'debt' ? <Badge variant="outline">Ghi nợ · {o.customerName}</Badge> : METHOD_LABEL[o.paymentMethod]}
              </TableCell>
              <TableCell className="px-4 py-3">
                {cancelled ? <Badge variant="secondary">Đã hủy</Badge> : <Badge>Hoàn tất</Badge>}
                {o.refunded > 0 && <Badge variant="outline" className="ml-1">Có trả hàng</Badge>}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
