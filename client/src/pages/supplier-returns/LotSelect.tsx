import { formatDateVn, formatQty, type ProductLot } from '@tiny-pos/shared';
import { useProductLots } from '@/api/lots';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const AUTO = '__auto__';

export function lotLabel(l: ProductLot): string {
  return `${l.importCode ?? 'Tồn đầu'} · ${l.expiresOn ? `HSD ${formatDateVn(l.expiresOn)}` : 'không hạn'} · còn ${formatQty(l.remaining)}`;
}

/** Chọn lô để trừ khi trả NCC; "Tự động" = hết hạn sớm trước (như bán hàng). */
export function LotSelect({ productId, value, onChange }: { productId: number; value: number | null; onChange: (lotId: number | null) => void }) {
  const { data: lots = [] } = useProductLots(productId);
  return (
    <Select value={value === null ? AUTO : String(value)} onValueChange={(v) => v !== '' && onChange(v === AUTO ? null : Number(v))}>
      <SelectTrigger aria-label="Lô" className="h-11 w-full bg-card text-base data-[size=default]:h-11 md:h-10 md:data-[size=default]:h-10">
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" sideOffset={4}>
        <SelectItem value={AUTO} className="py-2 text-base">
          Tự động (hết hạn sớm trước)
        </SelectItem>
        {lots.map((l) => (
          <SelectItem key={l.id} value={String(l.id)} className="py-2 text-base">
            {lotLabel(l)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
