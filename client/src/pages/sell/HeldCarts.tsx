import { PauseCircle, ShoppingBasket, X } from 'lucide-react';
import { cartTotals, formatMoney, type HeldCart } from '@tiny-pos/shared';
import { Button } from '@/components/ui/button';

interface Props {
  held: HeldCart[];
  /** Số món của đơn đang làm. */
  currentCount: number;
  onOpen: (id: string) => void;
  onDrop: (id: string) => void;
}

const time = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

/** Tab đơn: đơn đang làm + các đơn chờ. Bấm tab chờ để mở lại (đơn đang làm được cất vào chờ), × để bỏ. */
export function HeldCarts({ held, currentCount, onOpen, onDrop }: Props) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Đơn đang bán">
      <span
        role="tab"
        aria-selected="true"
        className="flex h-11 items-center gap-2 rounded-lg border border-primary bg-accent px-3 text-sm font-semibold text-accent-foreground md:h-9"
      >
        <ShoppingBasket className="size-4" />
        Đơn hiện tại · {currentCount} món
      </span>
      {held.map((h, i) => (
        <div key={h.id} role="tab" aria-selected="false" className="flex items-center rounded-lg border bg-card">
          <Button variant="ghost" className="h-11 rounded-r-none px-3 text-sm md:h-9" onClick={() => onOpen(h.id)}>
            <PauseCircle data-icon="inline-start" className="text-warning" />
            Chờ {i + 1} · {time(h.at)} · {formatMoney(cartTotals(h.cart.lines, h.cart.discount).payable)}
          </Button>
          <Button variant="ghost" size="icon-lg" className="size-11 rounded-l-none md:size-9" aria-label={`Bỏ đơn chờ ${i + 1}`} onClick={() => onDrop(h.id)}>
            <X />
          </Button>
        </div>
      ))}
    </div>
  );
}
