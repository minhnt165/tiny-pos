import { formatQty } from '@tiny-pos/shared';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/** Radix không cho SelectItem value rỗng: đơn vị gốc dùng giá trị thay thế. */
const BASE = '__base__';

export interface UnitChoice {
  id: number | null;
  name: string;
  factor: number;
}

/** Chọn đơn vị gốc hoặc thùng/lốc (kèm hệ số); sản phẩm chỉ có đơn vị gốc thì hiện tên. */
export function UnitSelect({ options, value, onChange }: { options: UnitChoice[]; value: number | null; onChange: (unitId: number | null) => void }) {
  if (options.length <= 1) return <span className="px-2">{options[0]?.name}</span>;
  return (
    <Select value={value === null ? BASE : String(value)} onValueChange={(v) => onChange(v === BASE ? null : Number(v))}>
      <SelectTrigger aria-label="Đơn vị" className="h-11 w-36 text-base data-[size=default]:h-11">
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper">
        {options.map((o) => (
          <SelectItem key={o.id ?? BASE} value={o.id === null ? BASE : String(o.id)} className="py-2 text-base">
            {o.name}
            {o.factor !== 1 && ` (${formatQty(o.factor)})`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
