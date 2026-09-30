import { useEffect, useState } from 'react';
import { PackagePlus, PackageOpen } from 'lucide-react';
import { DOC_STATUSES, formatMoney, importListFields, resolveRange, validRange, type DocStatus } from '@tiny-pos/shared';
import { useImports } from '@/api/imports';
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
import { Switch } from '@/components/ui/switch';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { today as todayOf } from '@/lib/today';
import { ImportDetailDialog } from './ImportDetailDialog';
import { ImportTable } from './ImportTable';

const STATUS_LABEL: Record<DocStatus, string> = { done: 'Hoàn tất', cancelled: 'Đã hủy' };
const STATUS_OPTIONS = DOC_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }));

export function ImportsPage() {
  const [openId, setOpenId] = useState<number | null>(null);
  const { filters: f, set, clear } = useUrlFilters(importListFields);
  const today = todayOf();
  const picked = resolveRange(f, today);
  // Khoảng sai trên URL (sửa tay) thì về hôm nay, không báo lỗi
  const range = validRange(picked.from, picked.to) ? picked : { from: today, to: today };
  const isToday = range.from === today && range.to === today;
  const { data, isLoading } = useImports({ ...range, q: f.q, status: f.status, supplierId: f.supplierId, unpaid: f.unpaid, page: f.page });
  const { data: suppliers = [] } = useSuppliers(true);
  const s = data?.summary;

  // Lọc hẹp lại làm trang hiện tại vượt số trang → về trang cuối có dữ liệu
  useEffect(() => {
    if (data && data.page > 1 && !data.imports.length && data.total > 0) set({ page: Math.ceil(data.total / data.pageSize) });
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const status = f.status ?? [];
  const supplierLabel = f.supplierId === 'none' ? 'Không ghi NCC' : suppliers.find((x) => x.id === f.supplierId)?.name;
  const chips: FilterChip[] = [
    { key: 'range', label: rangeChipLabel(range.from, range.to, today), onRemove: isToday ? undefined : () => set({ from: undefined, to: undefined, date: undefined }) },
    ...status.map((st) => ({ key: `st-${st}`, label: STATUS_LABEL[st], onRemove: () => set({ status: status.filter((x) => x !== st) }) })),
    ...(f.supplierId ? [{ key: 'supplier', label: `NCC: ${supplierLabel ?? '…'}`, onRemove: () => set({ supplierId: undefined }) }] : []),
    ...(f.unpaid ? [{ key: 'unpaid', label: 'Còn nợ', onRemove: () => set({ unpaid: false }) }] : []),
  ];
  const activeCount = (isToday ? 0 : 1) + (status.length ? 1 : 0) + (f.supplierId ? 1 : 0) + (f.unpaid ? 1 : 0);
  const filtered = activeCount > 0 || !!f.q;

  return (
    <>
      <PageTitle
        title="Nhập hàng"
        count={data ? `${data.total} phiếu` : undefined}
        actions={[{ label: 'Tạo phiếu nhập', icon: PackagePlus, to: '/imports/new', primary: true }]}
      />
      <StatStrip cols={3}>
        <Stat label="Số phiếu" value={String(s?.count ?? 0)} hint="Không tính phiếu đã hủy" />
        <Stat label="Tổng nhập" value={formatMoney(s?.total ?? 0)} />
        <Stat label="Đã trả" value={formatMoney(s?.paid ?? 0)} />
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
                onChange={(v) => set({ supplierId: v === '' ? undefined : v === 'none' ? 'none' : Number(v) })}
                options={[
                  { value: 'none', label: 'Không ghi NCC' },
                  ...suppliers.map((x) => ({ value: String(x.id), label: x.isActive ? x.name : `${x.name} (đã xóa)` })),
                ]}
                emptyLabel="Mọi nhà cung cấp"
                aria-label="Lọc theo nhà cung cấp"
                className="w-full"
              />
            </FilterGroup>
            <FilterGroup label="Trạng thái">
              <MultiChoiceChips<DocStatus> label="Trạng thái" options={STATUS_OPTIONS} value={status} onChange={(v) => set({ status: v })} />
            </FilterGroup>
            <label className="flex min-h-11 items-center justify-between gap-3 md:min-h-9">
              <span className="text-sm font-medium">Chỉ phiếu còn nợ</span>
              <Switch checked={f.unpaid} onCheckedChange={(v) => set({ unpaid: v })} />
            </label>
          </FilterBar>
        }
        footer={data && data.total > 0 && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={(page) => set({ page })} noun="phiếu" />}
      >
        {isLoading ? (
          <TableSkeleton rows={3} />
        ) : data?.imports.length ? (
          <ImportTable imports={data.imports} onOpen={setOpenId} showDate={range.from !== range.to} />
        ) : filtered ? (
          <EmptyState
            icon={PackageOpen}
            title="Không có phiếu nhập khớp bộ lọc"
            description="Thử bỏ bớt lọc hoặc đổi khoảng thời gian."
            action={
              <Button variant="outline" onClick={clear}>
                Xóa lọc
              </Button>
            }
          />
        ) : (
          <EmptyState icon={PackageOpen} title="Chưa có phiếu nhập" description="Khoảng thời gian này chưa nhập hàng. Hủy phiếu sẽ trừ lại kho." />
        )}
      </ListPanel>
      <ImportDetailDialog id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
