import { ReceiptText } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { formatMoney, type OrderSummary } from '@tiny-pos/shared';
import { EmptyState } from '@/components/EmptyState';
import { ListPanel } from '@/components/ListPanel';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { METHOD_LABEL } from '@/pages/orders/OrderTable';

const time = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
const CELL = 'px-3 py-3 md:px-4';
// Khối nằm trong nửa lưới nên chỉ màn rất rộng mới đủ chỗ cho cột Số món; cột Thanh toán không được bị cắt
const WIDE_ONLY = 'hidden 2xl:table-cell';
// Điện thoại 390px chỉ đủ 3 cột: hình thức thanh toán xuống dòng nhỏ dưới mã
const MOBILE_HIDDEN = 'hidden md:table-cell';

/** Ô Thanh toán: nhãn hình thức, đơn ghi nợ kèm tên khách, đơn hủy chỉ ghi Đã hủy. */
function payment(o: OrderSummary) {
  if (o.status === 'cancelled') return <Badge variant="secondary">Đã hủy</Badge>;
  if (o.paymentMethod === 'debt') return <Badge variant="outline">Ghi nợ · {o.customerName}</Badge>;
  return METHOD_LABEL[o.paymentMethod];
}

/** 5 hóa đơn mới nhất hôm nay, kể cả đơn hủy (gạch ngang); bấm dòng sang trang Hóa đơn (mặc định hôm nay). */
export function RecentOrders({ orders, count, loading }: { orders: OrderSummary[] | undefined; count: number | undefined; loading: boolean }) {
  const navigate = useNavigate();
  return (
    <ListPanel
      toolbar={
        <>
          <h2 className="text-sm font-semibold">Hóa đơn hôm nay</h2>
          {count !== undefined && <span className="text-sm text-muted-foreground">{count} đơn</span>}
          <Button variant="outline" size="sm" className="ml-auto" asChild>
            <Link to="/orders">
              <ReceiptText data-icon="inline-start" />
              Hóa đơn
            </Link>
          </Button>
        </>
      }
    >
      {loading || !orders ? (
        <TableSkeleton rows={5} />
      ) : orders.length === 0 ? (
        <EmptyState icon={ReceiptText} title="Hôm nay chưa có hóa đơn" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="px-3 md:px-4">Giờ</TableHead>
              <TableHead className="px-3 md:px-4">Mã</TableHead>
              <TableHead className={`px-3 text-right md:px-4 ${WIDE_ONLY}`}>Số món</TableHead>
              <TableHead className="px-3 text-right md:px-4">Phải trả</TableHead>
              <TableHead className={`px-3 md:px-4 ${MOBILE_HIDDEN}`}>Thanh toán</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => {
              const cancelled = o.status === 'cancelled';
              return (
                <TableRow key={o.id} className={cn('cursor-pointer', cancelled && 'text-muted-foreground')} onClick={() => navigate('/orders')}>
                  <TableCell className={`${CELL} tabular-nums`}>{time(o.createdAt)}</TableCell>
                  <TableCell className={CELL}>
                    <div className={cn('font-mono', cancelled && 'line-through')}>{o.code}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground md:hidden">{payment(o)}</div>
                  </TableCell>
                  <TableCell className={`${CELL} text-right tabular-nums ${WIDE_ONLY}`}>{o.itemCount}</TableCell>
                  <TableCell className={cn(CELL, 'text-right font-semibold tabular-nums', cancelled && 'line-through')}>{formatMoney(o.payable)}</TableCell>
                  <TableCell className={`${CELL} ${MOBILE_HIDDEN}`}>{payment(o)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </ListPanel>
  );
}
