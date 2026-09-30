import { useState } from 'react';
import { Banknote, Landmark, ReceiptText, Wallet } from 'lucide-react';
import { formatMoney } from '@tiny-pos/shared';
import { useOrders } from '@/api/orders';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DayPicker, today } from '@/components/DayPicker';
import { OrderDetailDialog } from './OrderDetailDialog';
import { OrderTable } from './OrderTable';

export function OrdersPage() {
  const [date, setDate] = useState(today);
  const [openId, setOpenId] = useState<number | null>(null);
  const { data, isLoading } = useOrders(date);
  const s = data?.summary;

  return (
    <>
      <PageHeader title="Hóa đơn" description="Xem, in lại và hủy hóa đơn theo ngày" icon={ReceiptText} actions={<DayPicker value={date} onChange={setDate} />} />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={ReceiptText} label="Số đơn" value={String(s?.count ?? 0)} hint="Không tính đơn đã hủy" />
        <StatCard icon={Wallet} label="Doanh thu" value={formatMoney(s?.total ?? 0)} tone="info" />
        <StatCard icon={Banknote} label="Tiền mặt" value={formatMoney(s?.cash ?? 0)} />
        <StatCard icon={Landmark} label="Chuyển khoản" value={formatMoney(s?.transfer ?? 0)} tone="warn" />
      </div>
      <Card className="gap-0 overflow-hidden py-0">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : data?.orders.length ? (
          <OrderTable orders={data.orders} onOpen={setOpenId} />
        ) : (
          <EmptyState icon={ReceiptText} title="Chưa có hóa đơn" description="Ngày này chưa bán đơn nào." />
        )}
      </Card>
      <OrderDetailDialog id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
