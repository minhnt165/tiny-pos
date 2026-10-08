import { useEffect, useState } from 'react';
import { Layers } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney, formatQty, LOT_STATES, lotListFields, type LotRow, type LotState } from '@tiny-pos/shared';
import { useDisposeLot, useLots } from '@/api/lots';
import { useProduct } from '@/api/products';
import { useConfirm } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { MultiChoiceChips } from '@/components/filters/ChoiceChips';
import { FilterBar, FilterGroup, type FilterChip } from '@/components/filters/FilterBar';
import { PageTitle } from '@/components/layout/PageTitle';
import { ListPanel } from '@/components/ListPanel';
import { Pager } from '@/components/Pager';
import { Stat, StatStrip } from '@/components/StatStrip';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Button } from '@/components/ui/button';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { ImportDetailDialog } from '../imports/ImportDetailDialog';
import { LotTable } from './LotTable';
import { LOT_STATE_LABEL } from './lot-labels';

const STATE_OPTIONS = LOT_STATES.map((s) => ({ value: s, label: LOT_STATE_LABEL[s] }));

/** Trang Lô hàng: mọi lô còn hàng (mặc định), lọc trạng thái/sản phẩm, bỏ hàng hết hạn. */
export function LotsPage() {
  const [importId, setImportId] = useState<number | null>(null);
  const { filters: f, set, clear } = useUrlFilters(lotListFields);
  const { data, isLoading } = useLots({ q: f.q, productId: f.productId, state: f.state, page: f.page });
  const { data: product } = useProduct(f.productId ?? null);
  const dispose = useDisposeLot();
  const confirm = useConfirm();

  useEffect(() => {
    if (data && data.page > 1 && !data.lots.length && data.total > 0) set({ page: Math.ceil(data.total / data.pageSize) });
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const onDispose = async (l: LotRow) => {
    const ok = await confirm({
      title: `Bỏ ${formatQty(l.remaining)} ${l.unit} ${l.productName}?`,
      description: `Trừ hết số còn của lô ${l.importCode ?? 'tồn đầu'} khỏi kho (ghi điều chỉnh "Bỏ hàng"). Không hoàn tác được.`,
      confirmText: 'Bỏ hàng',
      cancelText: 'Không',
      destructive: true,
    });
    if (!ok) return;
    dispose.mutate({ id: l.id }, { onSuccess: () => toast.success(`Đã bỏ lô ${l.importCode ?? 'tồn đầu'} của ${l.productName}`), onError: (e) => toast.error(e.message) });
  };

  const state = f.state ?? [];
  const chips: FilterChip[] = [
    ...(f.productId ? [{ key: 'product', label: `Sản phẩm: ${product?.name ?? '…'}`, onRemove: () => set({ productId: undefined }) }] : []),
    ...state.map((s) => ({ key: `st-${s}`, label: LOT_STATE_LABEL[s], onRemove: () => set({ state: state.filter((x) => x !== s) }) })),
  ];
  const activeCount = (f.productId ? 1 : 0) + (state.length ? 1 : 0);
  const filtered = activeCount > 0 || !!f.q;
  const s = data?.summary;

  return (
    <>
      <PageTitle title="Lô hàng" count={data ? `${data.total} lô` : undefined} />
      <StatStrip cols={3}>
        <Stat label="Sắp hết hạn" value={String(s?.expiringCount ?? 0)} tone={s?.expiringCount ? 'warning' : 'default'} hint="Lô còn hàng trong ngưỡng cảnh báo" />
        <Stat label="Đã hết hạn" value={String(s?.expiredCount ?? 0)} tone={s?.expiredCount ? 'danger' : 'default'} hint="Lô còn hàng đã quá hạn" />
        <Stat label="Giá trị tồn" value={formatMoney(s?.stockValue ?? 0)} hint="Σ số còn × giá vốn lô" />
      </StatStrip>
      <ListPanel
        toolbar={
          <FilterBar
            search={{ value: f.q ?? '', onChange: (q) => set({ q }), placeholder: 'Tên sản phẩm…' }}
            activeCount={activeCount}
            chips={chips}
            onClearAll={clear}
            resultLabel={`Xem ${data?.total ?? 0} lô`}
          >
            <FilterGroup label="Trạng thái">
              <MultiChoiceChips<LotState> label="Trạng thái" options={STATE_OPTIONS} value={state} onChange={(v) => set({ state: v })} />
            </FilterGroup>
          </FilterBar>
        }
        footer={data && data.total > 0 && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={(page) => set({ page })} noun="lô" />}
      >
        {isLoading ? (
          <TableSkeleton />
        ) : data?.lots.length ? (
          <LotTable rows={data.lots} onOpenImport={setImportId} onDispose={(l) => void onDispose(l)} />
        ) : filtered ? (
          <EmptyState icon={Layers} title="Không có lô khớp bộ lọc" description="Thử bỏ bớt lọc." action={<Button variant="outline" onClick={clear}>Xóa lọc</Button>} />
        ) : (
          <EmptyState icon={Layers} title="Chưa có lô nào" description="Nhập hàng bằng phiếu nhập, mỗi dòng sẽ thành một lô có hạn dùng riêng." />
        )}
      </ListPanel>
      <ImportDetailDialog id={importId} onClose={() => setImportId(null)} />
    </>
  );
}
