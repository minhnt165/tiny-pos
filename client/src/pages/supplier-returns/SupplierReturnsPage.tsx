import { useEffect, useState } from 'react';
import { PackageMinus } from 'lucide-react';
import { DOC_STATUSES, formatMoney, resolveRange, supplierReturnListFields, validRange, type DocStatus } from '@tiny-pos/shared';
import { useSupplierReturns } from '@/api/supplier-returns';
import { useSuppliers } from '@/api/suppliers';
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
import { useExportAction } from '@/hooks/useExportAction';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { today as todayOf } from '@/lib/today';
import { SupplierReturnDetailDialog } from './SupplierReturnDetailDialog';
import { SupplierReturnTable } from './SupplierReturnTable';

const STATUS_LABEL: Record<DocStatus, string> = { done: 'Hoàn tất', cancelled: 'Đã hủy' };
const STATUS_OPTIONS = DOC_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }));

export function SupplierReturnsPage() {
  const [openId, setOpenId] = useState<number | null>(null);
  const { filters: f, set, clear } = useUrlFilters(supplierReturnListFields);
  const exportAction = useExportAction('/supplier-returns/export.xlsx');
  const { data: suppliers = [] } = useSuppliers(true);
  const today = todayOf();
  const picked = resolveRange(f, today);
  // Khoảng sai trên URL (sửa tay) thì về hôm nay, không báo lỗi
  const range = validRange(picked.from, picked.to) ? picked : { from: today, to: today };
  const isToday = range.from === today && range.to === today;
  const { data, isLoading } = useSupplierReturns({ ...range, q: f.q, status: f.status, supplierId: f.supplierId, page: f.page });
  const s = data?.summary;

  // Lọc hẹp lại làm trang hiện tại vượt số trang → về trang cuối có dữ liệu
  useEffect(() => {
    if (data && data.page > 1 && !data.returns.length && data.total > 0) set({ page: Math.ceil(data.total / data.pageSize) });
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const status = f.status ?? [];
  const supplierLabel = suppliers.find((x) => x.id === f.supplierId)?.name;
  const chips: FilterChip[] = [
    { key: 'range', label: rangeChipLabel(range.from, range.to, today), onRemove: isToday ? undefined : () => set({ from: undefined, to: undefined, date: undefined }) },
    ...(f.supplierId ? [{ key: 'supplier', label: `NCC: ${supplierLabel ?? '…'}`, onRemove: () => set({ supplierId: undefined }) }] : []),
    ...status.map((st) => ({ key: `st-${st}`, label: STATUS_LABEL[st], onRemove: () => set({ status: status.filter((x) => x !== st) }) })),
  ];
  const activeCount = (isToday ? 0 : 1) + (f.supplierId ? 1 : 0) + (status.length ? 1 : 0);
  const filtered = activeCount > 0 || !!f.q;

  return (
    <>
      <PageTitle
        title="Trả NCC"
        count={data ? `${data.total} phiếu` : undefined}
        actions={[exportAction, { label: 'Lập phiếu trả', icon: PackageMinus, to: '/supplier-returns/new', primary: true }]}
      />
      <StatStrip cols={4}>
        <Stat label="Số phiếu" value={String(s?.count ?? 0)} hint="Không tính phiếu đã hủy" />
        <Stat label="Tổng trả" value={formatMoney(s?.total ?? 0)} />
        <Stat label="Trừ nợ" value={formatMoney(s?.debt ?? 0)} hint="Trừ vào nợ NCC" />
        <Stat label="NCC trả tiền mặt" value={formatMoney(s?.cash ?? 0)} />
      </StatStrip>
      <ListPanel
        toolbar={
          <FilterBar
            search={{ value: f.q ?? '', onChange: (q) => set({ q }), placeholder: 'Mã phiếu hoặc tên hàng…' }}
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
            <FilterGroup label="Nhà cung cấp">
              <ToolbarSelect
                value={f.supplierId === undefined ? '' : String(f.supplierId)}
                onChange={(v) => set({ supplierId: v === '' ? undefined : Number(v) })}
                options={suppliers.map((x) => ({ value: String(x.id), label: x.isActive ? x.name : `${x.name} (đã xóa)` }))}
                emptyLabel="Mọi nhà cung cấp"
                aria-label="Lọc theo nhà cung cấp"
                className="w-full"
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
          <SupplierReturnTable rows={data.returns} onOpen={setOpenId} showDate={range.from !== range.to} />
        ) : filtered ? (
          <EmptyState
            icon={PackageMinus}
            title="Không có phiếu trả NCC khớp bộ lọc"
            description="Thử bỏ bớt lọc hoặc đổi khoảng thời gian."
            action={
              <Button variant="outline" onClick={clear}>
                Xóa lọc
              </Button>
            }
          />
        ) : (
          <EmptyState icon={PackageMinus} title="Chưa có phiếu trả NCC" description="Hàng hết hạn, móp, lỗi trả lại NCC: bấm Lập phiếu trả." />
        )}
      </ListPanel>
      <SupplierReturnDetailDialog id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
