import { CircleCheck, Printer } from 'lucide-react';
import { formatMoney, type OrderDetail } from '@tiny-pos/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/** Kết quả đơn vừa thanh toán: tiền thối chữ lớn; ẩn khi thêm món tiếp theo. */
export function SaleResult({ order, onReprint }: { order: OrderDetail; onReprint: () => void }) {
  const cash = order.paymentMethod === 'cash';
  return (
    <Card className="flex-row items-center gap-4 bg-success/10 px-4 py-3 ring-success/30">
      <CircleCheck className="size-8 shrink-0 text-success" />
      <div className="min-w-0 flex-1">
        <div className="font-medium">
          {order.debt ? 'Đã ghi nợ' : 'Đã thanh toán'} {order.code} · {formatMoney(order.payable)}
        </div>
        {cash ? (
          <div className="font-heading text-3xl font-bold text-success tabular-nums">
            Tiền thối: {formatMoney(order.paid - order.payable)}
          </div>
        ) : order.debt ? (
          <div className="text-muted-foreground">
            Ghi nợ {order.customerName} · {formatMoney(order.debt.amount)} ({order.debt.balanceAfter < 0 ? 'tiệm nợ khách' : 'tổng nợ'} {formatMoney(Math.abs(order.debt.balanceAfter))})
          </div>
        ) : (
          <div className="text-muted-foreground">Chuyển khoản</div>
        )}
      </div>
      <Button variant="outline" className="h-11 text-base" onClick={onReprint}>
        <Printer data-icon="inline-start" />
        In lại
      </Button>
    </Card>
  );
}
