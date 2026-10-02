import { formatMoney, type OrderSummary } from '@tiny-pos/shared';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { EmptyLine, Panel } from './Panel';
import { METHOD_LABEL, time } from './format';

const CELL = 'px-3 py-2';

function payment(o: OrderSummary) {
  if (o.status === 'cancelled') return <Badge variant="secondary">Đã hủy</Badge>;
  if (o.paymentMethod === 'debt') return <Badge variant="outline">Ghi nợ · {o.customerName}</Badge>;
  return METHOD_LABEL[o.paymentMethod];
}

/** Hóa đơn hôm nay mới nhất trước, kể cả đơn hủy (gạch ngang). */
export function RecentOrders({ orders, count }: { orders: OrderSummary[]; count: number }) {
  return (
    <Panel title="Hóa đơn hôm nay" count={`${count} đơn`}>
      {orders.length === 0 ? (
        <EmptyLine>Chưa có hóa đơn hôm nay</EmptyLine>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className={CELL}>Mã</TableHead>
              <TableHead className={CELL}>Thanh toán</TableHead>
              <TableHead className={`${CELL} text-right`}>Tổng</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => (
              <TableRow key={o.id} className={cn(o.status === 'cancelled' && 'text-muted-foreground line-through')}>
                <TableCell className={CELL}>
                  <div className="font-medium">{o.code.slice(-4)}</div>
                  <div className="text-xs text-muted-foreground">{time(o.createdAt)}</div>
                </TableCell>
                <TableCell className={`${CELL} no-underline`}>{payment(o)}</TableCell>
                <TableCell className={`${CELL} text-right font-medium tabular-nums`}>{formatMoney(o.payable)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}
