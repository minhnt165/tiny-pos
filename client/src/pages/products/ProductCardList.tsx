import { formatMoney, type Product } from '@tiny-pos/shared';
import { ProductAvatar } from '@/components/ProductAvatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ProductMenu, StockCell } from './ProductTable';

interface Props {
  products: Product[];
  onEdit: (p: Product) => void;
  onToggle: (p: Product) => void;
}

/** Danh sách dạng thẻ cho điện thoại; bấm vào thẻ để sửa. */
export function ProductCardList({ products, onEdit, onToggle }: Props) {
  return (
    <ul className="divide-y">
      {products.map((p) => (
        <li
          key={p.id}
          className={cn('flex items-center gap-3 px-4 py-3 active:bg-muted/50', !p.isActive && 'opacity-60')}
          onClick={() => onEdit(p)}
        >
          <ProductAvatar name={p.name} className="size-12" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 font-medium">
              <span className="truncate">{p.name}</span>
              {!p.isActive && <Badge variant="secondary">Ngừng bán</Badge>}
            </div>
            <div className="text-sm text-muted-foreground">
              {p.barcode ?? 'Không mã'} · {p.categoryName ?? 'Không danh mục'}
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-semibold text-primary tabular-nums">{formatMoney(p.sellPrice)}</span>
              <StockCell p={p} />
            </div>
          </div>
          <ProductMenu p={p} onEdit={() => onEdit(p)} onToggle={() => onToggle(p)} />
        </li>
      ))}
    </ul>
  );
}
