import { useEffect, useState } from 'react';
import { ReceiptText } from 'lucide-react';
import { DOC_STATUSES, formatMoney, orderListFields, PAY_METHODS, resolveRange, validRange, type DocStatus, type PayMethod } from '@tiny-pos/shared';
import { useCustomers } from '@/api/customers';
import { useOrders } from '@/api/orders';
import { EmptyState } from '@/components/EmptyState';
import { MultiChoiceChips } from '@/components/filters/ChoiceChips';
import { DateRangeFilter, rangeChipLabel } from '@/components/filters/DateRangeFilter';
import { FilterBar, FilterGroup, type FilterChip } from '@/components/filters/FilterBar';
import { PageTitle } from '@/components/layout/PageTitle';
import { ListPanel } from '@/components/ListPanel';
import { Pager } from '@/components/Pager';
import { ToolbarSelect } from '@/components/SelectField';
import { Stat, StatStrip } from '@/components/StatStrip';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Button } from '@/components/ui/button';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useExportAction } from '@/hooks/useExportAction';
import { today as todayOf } from '@/lib/today';
import { OrderDetailDialog } from './OrderDetailDialog';
import { METHOD_LABEL, OrderTable } from './OrderTable';

const PAY_OPTIONS = PAY_METHODS.map((m) => ({ value: m, label: METHOD_LABEL[m] }));
const STATUS_LABEL: Record<DocStatus, string> = { done: 'Hoàn tất', cancelled: 'Đã hủy' };
const STATUS_OPTIONS = DOC_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }));

export function OrdersPage() {
  const [openId, setOpenId] = useState<number | null>(null);
  const { filters: f, set, clear } = useUrlFilters(orderListFields);
  const exportAction = useExportAction('/orders/export.xlsx');
  const today = todayOf();
  const picked = resolveRange(f, today);
  // Khoảng sai trên URL (sửa tay) thì về hôm nay, không báo lỗi
  const range = validRange(picked.from, picked.to) ? picked : { from: today, to: today };
  const isToday = range.from === today && range.to === today;
  const { data, isLoading } = useOrders({ ...range, q: f.q, pay: f.pay, status: f.status, customerId: f.customerId, page: f.page });
  const { data: customerData } = useCustomers(true);
  const customers = customerData?.customers ?? [];
  const s = data?.summary;
  const collected = (s?.debtCollected.cash ?? 0) + (s?.debtCollected.transfer ?? 0);
  // Phiếu trả trong khoảng: Doanh thu và Tiền mặt hiện số thuần để khớp két (Báo cáo dùng cùng công thức)
  const ret = s?.returns ?? { count: 0, refund: 0, cash: 0, debt: 0 };

  // Lọc hẹp lại làm trang hiện tại vượt số trang → về trang cuối có dữ liệu
  useEffect(() => {
    if (data && data.page > 1 && !data.orders.length && data.total > 0) set({ page: Math.ceil(data.total / data.pageSize) });
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const pay = f.pay ?? [];
  const status = f.status ?? [];
  const customerName = customers.find((c) => c.id === f.customerId)?.name;
  const chips: FilterChip[] = [
    { key: 'range', label: rangeChipLabel(range.from, range.to, today), onRemove: isToday ? undefined : () => set({ from: undefined, to: undefined, date: undefined }) },
    ...pay.map((m) => ({ key: `pay-${m}`, label: METHOD_LABEL[m], onRemove: () => set({ pay: pay.filter((x) => x !== m) }) })),
    ...status.map((st) => ({ key: `st-${st}`, label: STATUS_LABEL[st], onRemove: () => set({ status: status.filter((x) => x !== st) }) })),
    ...(f.customerId ? [{ key: 'customer', label: `Khách: ${customerName ?? '…'}`, onRemove: () => set({ customerId: undefined }) }] : []),
  ];
  const activeCount = (isToday ? 0 : 1) + (pay.length ? 1 : 0) + (status.length ? 1 : 0) + (f.customerId ? 1 : 0);
  const filtered = activeCount > 0 || !!f.q;

  return (
    <>
      <PageTitle title="Hóa đơn" count={data ? `${data.total} đơn` : undefined} actions={[exportAction]} />
      <StatStrip cols={6}>
        <Stat label="Số đơn" value={String(s?.count ?? 0)} hint="Không tính đơn đã hủy" />
        <Stat
          label="Doanh thu"
          value={formatMoney((s?.total ?? 0) - ret.refund)}
          hint={ret.count ? `Bán ${formatMoney(s?.total ?? 0)} · Trả ${formatMoney(ret.refund)}` : undefined}
        />
        <Stat
          label="Tiền mặt"
          value={formatMoney((s?.cash ?? 0) - ret.cash)}
          hint={ret.count ? `Đã trừ hoàn ${formatMoney(ret.cash)}` : undefined}
        />
        <Stat label="Chuyển khoản" value={formatMoney(s?.transfer ?? 0)} />
        <Stat label="Ghi nợ" value={formatMoney(s?.debt ?? 0)} hint="Phần khách còn thiếu" tone={s?.debt ? 'danger' : 'default'} />
        <Stat
          label="Thu nợ"
          value={formatMoney(collected)}
          hint={`Tiền mặt ${formatMoney(s?.debtCollected.cash ?? 0)} · CK ${formatMoney(s?.debtCollected.transfer ?? 0)}`}
          tone={collected ? 'success' : 'default'}
        />
      </StatStrip>
      <ListPanel
        toolbar={
          <FilterBar
            search={{ value: f.q ?? '', onChange: (q) => set({ q }), placeholder: 'Mã hóa đơn hoặc tên hàng…' }}
            activeCount={activeCount}
            chips={chips}
            onClearAll={clear}
            resultLabel={`Xem ${data?.total ?? 0} hóa đơn`}
          >
            <FilterGroup label="Thời gian">
              <DateRangeFilter
                from={range.from}
                to={range.to}
                today={today}
                // Hôm nay không ghi ngày vào URL: máy quầy để qua đêm thì sáng hôm sau vẫn là hôm nay
                onChange={(r) => set(r.from === today && r.to === today ? { from: undefined, to: undefined, date: undefined } : { ...r, date: undefined })}
              />
            </FilterGroup>
            <FilterGroup label="Thanh toán">
              <MultiChoiceChips<PayMethod> label="Thanh toán" options={PAY_OPTIONS} value={pay} onChange={(v) => set({ pay: v })} />
            </FilterGroup>
            <FilterGroup label="Trạng thái">
              <MultiChoiceChips<DocStatus> label="Trạng thái" options={STATUS_OPTIONS} value={status} onChange={(v) => set({ status: v })} />
            </FilterGroup>
            <FilterGroup label="Khách (đơn ghi nợ)">
              <ToolbarSelect
                value={f.customerId ? String(f.customerId) : ''}
                onChange={(v) => set({ customerId: v ? Number(v) : undefined })}
                options={customers.map((c) => ({ value: String(c.id), label: c.isActive ? c.name : `${c.name} (đã xóa)` }))}
                emptyLabel="Mọi khách"
                aria-label="Lọc theo khách"
                className="w-full"
              />
            </FilterGroup>
          </FilterBar>
        }
        footer={data && data.total > 0 && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={(page) => set({ page })} noun="hóa đơn" />}
      >
        {isLoading ? (
          <TableSkeleton />
        ) : data?.orders.length ? (
          <OrderTable orders={data.orders} onOpen={setOpenId} showDate={range.from !== range.to} />
        ) : filtered ? (
          <EmptyState
            icon={ReceiptText}
            title="Không có hóa đơn khớp bộ lọc"
            description="Thử bỏ bớt lọc hoặc đổi khoảng thời gian."
            action={
              <Button variant="outline" onClick={clear}>
                Xóa lọc
              </Button>
            }
          />
        ) : (
          <EmptyState icon={ReceiptText} title="Chưa có hóa đơn" description="Khoảng thời gian này chưa bán đơn nào." />
        )}
      </ListPanel>
      <OrderDetailDialog id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
