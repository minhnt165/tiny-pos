import { PARTY_SORTS, type PartyView } from '@tiny-pos/shared';
import { ToolbarSelect } from '@/components/SelectField';
import { Switch } from '@/components/ui/switch';
import { FilterBar, FilterGroup, type FilterChip } from './FilterBar';

const SORT_LABEL: Record<PartyView['sort'], string> = { name: 'Tên A–Z', 'debt-desc': 'Nợ nhiều nhất', recent: 'Giao dịch gần nhất' };

interface Props {
  view: PartyView;
  set: (patch: Partial<PartyView>) => void;
  clear: () => void;
  placeholder: string;
  resultLabel: string;
}

/** Thanh lọc khách hàng / nhà cung cấp: tìm, chỉ người đang nợ, hiện cả người đã xóa, sắp xếp. */
export function PartyFilters({ view: v, set, clear, placeholder, resultLabel }: Props) {
  const chips: FilterChip[] = [
    ...(v.debtOnly ? [{ key: 'debt', label: 'Đang nợ', onRemove: () => set({ debtOnly: false }) }] : []),
    ...(v.includeInactive ? [{ key: 'inactive', label: 'Cả người đã xóa', onRemove: () => set({ includeInactive: false }) }] : []),
  ];
  return (
    <FilterBar search={{ value: v.q ?? '', onChange: (q) => set({ q }), placeholder }} activeCount={chips.length} chips={chips} onClearAll={clear} resultLabel={resultLabel}>
      <label className="flex min-h-11 items-center justify-between gap-3 md:min-h-9">
        <span className="text-sm font-medium">Chỉ người đang nợ</span>
        <Switch checked={v.debtOnly} onCheckedChange={(debtOnly) => set({ debtOnly })} />
      </label>
      <label className="flex min-h-11 items-center justify-between gap-3 md:min-h-9">
        <span className="text-sm font-medium">Hiện cả người đã xóa</span>
        <Switch checked={v.includeInactive} onCheckedChange={(includeInactive) => set({ includeInactive })} />
      </label>
      <FilterGroup label="Sắp xếp">
        <ToolbarSelect
          value={v.sort === 'name' ? '' : v.sort}
          onChange={(x) => set({ sort: (x || 'name') as PartyView['sort'] })}
          options={PARTY_SORTS.filter((s) => s !== 'name').map((s) => ({ value: s, label: SORT_LABEL[s] }))}
          emptyLabel={SORT_LABEL.name}
          aria-label="Sắp xếp"
          className="w-full"
        />
      </FilterGroup>
    </FilterBar>
  );
}
