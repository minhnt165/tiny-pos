import { PauseCircle, X } from 'lucide-react';
import { cartTotals, formatMoney, type HeldCart } from '@tiny-pos/shared';
import { Button } from '@/components/ui/button';

interface Props {
  held: HeldCart[];
  onOpen: (id: string) => void;
  onDrop: (id: string) => void;
}

const time = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

/** Chip các đơn đang chờ: bấm để mở lại, × để bỏ. */
export function HeldCarts({ held, onOpen, onDrop }: Props) {
  if (!held.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {held.map((h, i) => (
        <div key={h.id} className="flex items-center rounded-full border bg-card shadow-sm">
          <Button variant="ghost" className="h-10 rounded-full px-3 text-sm" onClick={() => onOpen(h.id)}>
            <PauseCircle data-icon="inline-start" className="text-amber-600" />
            Chờ {i + 1} · {time(h.at)} · {formatMoney(cartTotals(h.cart.lines, h.cart.discount).payable)}
          </Button>
          <Button variant="ghost" size="icon" className="mr-1 size-8 rounded-full" aria-label="Bỏ đơn chờ" onClick={() => onDrop(h.id)}>
            <X />
          </Button>
        </div>
      ))}
    </div>
  );
}
