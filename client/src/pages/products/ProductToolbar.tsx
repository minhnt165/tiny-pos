import { useEffect } from 'react';
import { formatMoney, PRODUCT_SORTS, STOCK_FILTERS, type Category, type ProductView } from '@tiny-pos/shared';
import { CommitInput } from '@/components/CommitInput';
import { ChoiceChips } from '@/components/filters/ChoiceChips';
import { FilterBar, FilterGroup, type FilterChip } from '@/components/filters/FilterBar';
import { ToolbarSelect } from '@/components/SelectField';
import { Switch } from '@/components/ui/switch';

const SEARCH_ID = 'product-search';

const STOCK_LABEL: Record<(typeof STOCK_FILTERS)[number], string> = { low: 'Sắp hết', out: 'Hết hàng', negative: 'Tồn âm' };
const SORT_LABEL: Record<ProductView['sort'], string> = {
  name: 'Tên A–Z',
  'price-asc': 'Giá tăng dần',
  'price-desc': 'Giá giảm dần',
  'stock-asc': 'Tồn ít trước',
  'stock-desc': 'Tồn nhiều trước',
  'value-desc': 'Giá trị tồn lớn nhất',
};

interface Props {
  view: ProductView;
  set: (patch: Partial<ProductView>) => void;
  clear: () => void;
  categories: Category[];
  resultCount: number;
}

/** Số lọc đang bật (không tính ô tìm và sắp xếp). */
export const productFilterCount = (v: ProductView) =>
  [v.categoryId, v.stock, v.weighed, v.noBarcode, v.priceMin !== undefined || v.priceMax !== undefined, v.includeInactive].filter(Boolean).length;

/** Thanh lọc sản phẩm: ô tìm (phím "/"), bảng lọc tồn/loại/giá/danh mục/ngừng bán, sắp xếp. Lọc ngay trên trình duyệt. */
export function ProductFilters({ view: v, set, clear, categories, resultCount }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !t.closest('input, textarea, [contenteditable]')) {
        e.preventDefault();
        document.getElementById(SEARCH_ID)?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const category = categories.find((c) => c.id === v.categoryId);
  const price =
    v.priceMin !== undefined || v.priceMax !== undefined
      ? `Giá ${v.priceMin !== undefined ? formatMoney(v.priceMin) : '0đ'} – ${v.priceMax !== undefined ? formatMoney(v.priceMax) : '…'}`
      : null;
  const chips: FilterChip[] = [
    ...(category ? [{ key: 'cat', label: category.name, onRemove: () => set({ categoryId: undefined }) }] : []),
    ...(v.stock ? [{ key: 'stock', label: STOCK_LABEL[v.stock], onRemove: () => set({ stock: undefined }) }] : []),
    ...(v.weighed ? [{ key: 'weighed', label: 'Hàng cân', onRemove: () => set({ weighed: false }) }] : []),
    ...(v.noBarcode ? [{ key: 'nobarcode', label: 'Không mã vạch', onRemove: () => set({ noBarcode: false }) }] : []),
    ...(price ? [{ key: 'price', label: price, onRemove: () => set({ priceMin: undefined, priceMax: undefined }) }] : []),
    ...(v.includeInactive ? [{ key: 'inactive', label: 'Cả hàng ngừng bán', onRemove: () => set({ includeInactive: false }) }] : []),
  ];

  return (
    <FilterBar
      search={{ id: SEARCH_ID, value: v.q ?? '', onChange: (q) => set({ q }), placeholder: 'Tìm theo tên hoặc mã vạch…', hotkey: '/' }}
      activeCount={productFilterCount(v)}
      chips={chips}
      onClearAll={clear}
      resultLabel={`Xem ${resultCount} mặt hàng`}
    >
      <FilterGroup label="Danh mục">
        <ToolbarSelect
          value={v.categoryId ? String(v.categoryId) : ''}
          onChange={(x) => set({ categoryId: x ? Number(x) : undefined })}
          options={categories.map((c) => ({ value: String(c.id), label: `${c.name} (${c.productCount})` }))}
          emptyLabel="Tất cả danh mục"
          aria-label="Lọc danh mục"
          className="w-full"
        />
      </FilterGroup>
      <FilterGroup label="Tồn kho">
        <ChoiceChips label="Tồn kho" options={STOCK_FILTERS.map((s) => ({ value: s, label: STOCK_LABEL[s] }))} value={v.stock} onChange={(stock) => set({ stock })} />
      </FilterGroup>
      <FilterGroup label="Loại hàng">
        <div className="flex flex-wrap gap-4">
          <label className="flex min-h-11 items-center gap-2 text-sm md:min-h-9">
            <Switch checked={v.weighed} onCheckedChange={(weighed) => set({ weighed })} /> Hàng cân
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm md:min-h-9">
            <Switch checked={v.noBarcode} onCheckedChange={(noBarcode) => set({ noBarcode })} /> Không mã vạch
          </label>
        </div>
      </FilterGroup>
      <FilterGroup label="Giá bán (0 = không giới hạn)">
        <div className="flex items-center gap-2">
          <CommitInput money value={v.priceMin ?? 0} onCommit={(n) => set({ priceMin: n || undefined })} aria-label="Giá từ" className="h-11 text-right md:h-9" />
          <span className="text-muted-foreground">–</span>
          <CommitInput money value={v.priceMax ?? 0} onCommit={(n) => set({ priceMax: n || undefined })} aria-label="Giá đến" className="h-11 text-right md:h-9" />
        </div>
      </FilterGroup>
      <label className="flex min-h-11 items-center justify-between gap-3 md:min-h-9">
        <span className="text-sm font-medium">Hiện cả hàng ngừng bán</span>
        <Switch checked={v.includeInactive} onCheckedChange={(includeInactive) => set({ includeInactive })} />
      </label>
      <FilterGroup label="Sắp xếp">
        <ToolbarSelect
          value={v.sort === 'name' ? '' : v.sort}
          onChange={(x) => set({ sort: (x || 'name') as ProductView['sort'] })}
          options={PRODUCT_SORTS.filter((s) => s !== 'name').map((s) => ({ value: s, label: SORT_LABEL[s] }))}
          emptyLabel={SORT_LABEL.name}
          aria-label="Sắp xếp"
          className="w-full"
        />
      </FilterGroup>
    </FilterBar>
  );
}
