import { useEffect, useState } from 'react';
import { Undo2 } from 'lucide-react';
import { DOC_STATUSES, formatMoney, resolveRange, returnListFields, validRange, type DocStatus } from '@tiny-pos/shared';
import { useReturns } from '@/api/returns';
import { EmptyState } from '@/components/EmptyState';
import { MultiChoiceChips } from '@/components/filters/ChoiceChips';
import { DateRangeFilter, rangeChipLabel } from '@/components/filters/DateRangeFilter';
import { FilterBar, FilterGroup, type FilterChip } from '@/components/filters/FilterBar';
import { PageTitle } from '@/components/layout/PageTitle';
import { ListPanel } from '@/components/ListPanel';
import { Pager } from '@/components/Pager';
import { Stat, StatStrip } from '@/components/StatStrip';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Button } from '@/components/ui/button';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useExportAction } from '@/hooks/useExportAction';
import { today as todayOf } from '@/lib/today';
import { OrderDetailDialog } from '../orders/OrderDetailDialog';
import { ReturnDetailDialog } from './ReturnDetailDialog';
import { ReturnTable } from './ReturnTable';

const STATUS_LABEL: Record<DocStatus, string> = { done: 'Hoàn tất', cancelled: 'Đã hủy' };
const STATUS_OPTIONS = DOC_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }));

export function ReturnsPage() {
  const [openId, setOpenId] = useState<number | null>(null);
  const [orderId, setOrderId] = useState<number | null>(null);
  const { filters: f, set, clear } = useUrlFilters(returnListFields);
  const exportAction = useExportAction('/returns/export.xlsx');
  const today = todayOf();
  const picked = resolveRange(f, today);
  // Khoảng sai trên URL (sửa tay) thì về hôm nay, không báo lỗi
  const range = validRange(picked.from, picked.to) ? picked : { from: today, to: today };
  const isToday = range.from === today && range.to === today;
  const { data, isLoading } = useReturns({ ...range, q: f.q, status: f.status, page: f.page });
  const s = data?.summary;

  // Lọc hẹp lại làm trang hiện tại vượt số trang → về trang cuối có dữ liệu
  useEffect(() => {
    if (data && data.page > 1 && !data.returns.length && data.total > 0) set({ page: Math.ceil(data.total / data.pageSize) });
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const status = f.status ?? [];
  const chips: FilterChip[] = [
    { key: 'range', label: rangeChipLabel(range.from, range.to, today), onRemove: isToday ? undefined : () => set({ from: undefined, to: undefined, date: undefined }) },
    ...status.map((st) => ({ key: `st-${st}`, label: STATUS_LABEL[st], onRemove: () => set({ status: status.filter((x) => x !== st) }) })),
  ];
  const activeCount = (isToday ? 0 : 1) + (status.length ? 1 : 0);
  const filtered = activeCount > 0 || !!f.q;

  return (
    <>
      <PageTitle title="Trả hàng" count={data ? `${data.total} phiếu` : undefined} actions={[exportAction]} />
      <StatStrip cols={4}>
        <Stat label="Số phiếu" value={String(s?.count ?? 0)} hint="Không tính phiếu đã hủy" />
        <Stat label="Tổng hoàn" value={formatMoney(s?.refund ?? 0)} />
        <Stat label="Hoàn tiền mặt" value={formatMoney(s?.cash ?? 0)} hint="Tiền chi ra từ két" />
        <Stat label="Trừ nợ" value={formatMoney(s?.debt ?? 0)} hint="Trừ vào nợ khách" />
      </StatStrip>
      <ListPanel
        toolbar={
          <FilterBar
            search={{ value: f.q ?? '', onChange: (q) => set({ q }), placeholder: 'Mã phiếu, mã hóa đơn hoặc tên hàng…' }}
            activeCount={activeCount}
            chips={chips}
            onClearAll={clear}
            resultLabel={`Xem ${data?.total ?? 0} phiếu`}
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
            <FilterGroup label="Trạng thái">
              <MultiChoiceChips<DocStatus> label="Trạng thái" options={STATUS_OPTIONS} value={status} onChange={(v) => set({ status: v })} />
            </FilterGroup>
          </FilterBar>
        }
        footer={data && data.total > 0 && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={(page) => set({ page })} noun="phiếu" />}
      >
        {isLoading ? (
          <TableSkeleton />
        ) : data?.returns.length ? (
          <ReturnTable rows={data.returns} onOpen={setOpenId} showDate={range.from !== range.to} />
        ) : filtered ? (
          <EmptyState
            icon={Undo2}
            title="Không có phiếu trả khớp bộ lọc"
            description="Thử bỏ bớt lọc hoặc đổi khoảng thời gian."
            action={
              <Button variant="outline" onClick={clear}>
                Xóa lọc
              </Button>
            }
          />
        ) : (
          <EmptyState icon={Undo2} title="Chưa có phiếu trả" description="Khách trả hàng: mở hóa đơn ở trang Hóa đơn rồi bấm Trả hàng." />
        )}
      </ListPanel>
      <ReturnDetailDialog
        id={openId}
        onClose={() => setOpenId(null)}
        onOpenOrder={(id) => {
          setOpenId(null);
          setOrderId(id);
        }}
      />
      <OrderDetailDialog id={orderId} onClose={() => setOrderId(null)} />
    </>
  );
}
