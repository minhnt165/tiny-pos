import { CircleCheck, Printer } from 'lucide-react';
import { formatMoney, type OrderDetail } from '@tiny-pos/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/** Kết quả đơn vừa thanh toán: tiền thối chữ lớn; ẩn khi thêm món tiếp theo. */
export function SaleResult({ order, onReprint }: { order: OrderDetail; onReprint: () => void }) {
  const cash = order.paymentMethod === 'cash';
  return (
    <Card className="flex-row items-center gap-4 border-emerald-300 bg-emerald-50 px-5 py-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
      <CircleCheck className="size-8 shrink-0 text-emerald-600" />
      <div className="min-w-0 flex-1">
        <div className="font-medium">
          Đã thanh toán {order.code} · {formatMoney(order.payable)}
        </div>
        {cash ? (
          <div className="font-heading text-3xl font-semibold text-emerald-700 tabular-nums dark:text-emerald-300">
            Tiền thối: {formatMoney(order.paid - order.payable)}
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
