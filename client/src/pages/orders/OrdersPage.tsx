import { useState } from 'react';
import { ReceiptText } from 'lucide-react';
import { formatMoney } from '@tiny-pos/shared';
import { useOrders } from '@/api/orders';
import { EmptyState } from '@/components/EmptyState';
import { PageTitle } from '@/components/layout/PageTitle';
import { ListPanel } from '@/components/ListPanel';
import { Stat, StatStrip } from '@/components/StatStrip';
import { TableSkeleton } from '@/components/TableSkeleton';
import { DayPicker, today } from '@/components/DayPicker';
import { OrderDetailDialog } from './OrderDetailDialog';
import { OrderTable } from './OrderTable';

export function OrdersPage() {
  const [date, setDate] = useState(today);
  const [openId, setOpenId] = useState<number | null>(null);
  const { data, isLoading } = useOrders(date);
  const s = data?.summary;
  const collected = (s?.debtCollected.cash ?? 0) + (s?.debtCollected.transfer ?? 0);

  return (
    <>
      <PageTitle title="Hóa đơn" count={s ? `${s.count} đơn` : undefined} />
      <StatStrip cols={6}>
        <Stat label="Số đơn" value={String(s?.count ?? 0)} hint="Không tính đơn đã hủy" />
        <Stat label="Doanh thu" value={formatMoney(s?.total ?? 0)} />
        <Stat label="Tiền mặt" value={formatMoney(s?.cash ?? 0)} />
        <Stat label="Chuyển khoản" value={formatMoney(s?.transfer ?? 0)} />
        <Stat label="Ghi nợ" value={formatMoney(s?.debt ?? 0)} hint="Phần khách còn thiếu" tone={s?.debt ? 'danger' : 'default'} />
        <Stat
          label="Thu nợ"
          value={formatMoney(collected)}
          hint={`Tiền mặt ${formatMoney(s?.debtCollected.cash ?? 0)} · CK ${formatMoney(s?.debtCollected.transfer ?? 0)}`}
          tone={collected ? 'success' : 'default'}
        />
      </StatStrip>
      <ListPanel toolbar={<DayPicker value={date} onChange={setDate} />}>
        {isLoading ? (
          <TableSkeleton />
        ) : data?.orders.length ? (
          <OrderTable orders={data.orders} onOpen={setOpenId} />
        ) : (
          <EmptyState icon={ReceiptText} title="Chưa có hóa đơn" description="Ngày này chưa bán đơn nào." />
        )}
      </ListPanel>
      <OrderDetailDialog id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
