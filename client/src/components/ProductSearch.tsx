import { useEffect, useState, type KeyboardEvent, type RefObject } from 'react';
import { ScanBarcode } from 'lucide-react';
import { formatMoney, formatQty, type Product } from '@tiny-pos/shared';
import { useProductSuggestions } from '@/api/products';
import { ProductAvatar } from '@/components/ProductAvatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Props {
  inputRef: RefObject<HTMLInputElement | null>;
  onScan: (code: string) => void;
  onPick: (p: Product) => void;
  /** Gợi ý cả hàng ngừng bán (màn Nhập hàng, Kiểm kê). */
  includeInactive?: boolean;
}

/**
 * Ô quét mã luôn focus. Máy quét gõ nhanh rồi Enter (chưa kịp debounce) → tra mã vạch.
 * Gõ chữ → sau 200ms hiện tối đa 8 gợi ý; ↑↓ chọn, Enter thêm.
 */
export function ProductSearch({ inputRef, onScan, onPick, includeInactive }: Props) {
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [active, setActive] = useState(-1);

  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 200);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setActive(-1), [term]);

  const searching = term.length >= 1 && /\D/.test(term);
  const { data = [] } = useProductSuggestions(searching ? term : '', includeInactive);
  const items = searching && q.trim() ? data.slice(0, 8) : [];

  const reset = () => {
    setQ('');
    setTerm('');
    setActive(-1);
  };
  const pick = (p: Product) => {
    reset();
    onPick(p);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && items.length) {
      e.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === 'ArrowUp' && items.length) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === 'Escape') {
      reset();
    } else if (e.key === 'Enter') {
      // Đang gõ dở bằng bộ gõ (Telex/IME): Enter chỉ chốt chữ, chưa phải lệnh thêm hàng
      if (e.nativeEvent.isComposing) return;
      e.preventDefault();
      const picked = items[active];
      const code = q.trim();
      if (picked) return pick(picked);
      reset();
      if (code) onScan(code);
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-3 rounded-lg border-2 border-primary/60 bg-card px-3 py-1 focus-within:border-primary">
        <span className="grid size-9 shrink-0 place-items-center text-primary">
          <ScanBarcode className="size-6" />
        </span>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Quét mã hoặc gõ tên sản phẩm… (F2)"
          className="min-h-11 w-full bg-transparent text-lg font-medium outline-none placeholder:text-muted-foreground/60"
          autoComplete="off"
          aria-label="Quét mã hoặc tìm sản phẩm"
        />
      </div>
      {items.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-lg border bg-popover shadow-lg" role="listbox">
          {items.map((p, i) => (
            <li
              key={p.id}
              role="option"
              aria-selected={i === active}
              className={cn('flex cursor-pointer items-center gap-3 px-4 py-2.5', i === active ? 'bg-accent' : 'hover:bg-muted')}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(p)}
            >
              <ProductAvatar name={p.name} image={p.image} className="size-9 rounded-lg text-xs" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{p.name}</div>
                <div className="text-sm text-muted-foreground">
                  Tồn {formatQty(p.stock)} {p.unit}
                  {!p.isActive && (
                    <Badge variant="secondary" className="ml-2">
                      Ngừng bán
                    </Badge>
                  )}
                </div>
              </div>
              <div className="font-semibold tabular-nums">{formatMoney(p.sellPrice)}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
