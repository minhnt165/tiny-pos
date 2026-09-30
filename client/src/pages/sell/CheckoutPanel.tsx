import { useEffect, useState } from 'react';
import { CreditCard, PackagePlus, PauseCircle, Trash2 } from 'lucide-react';
import { currentTzOffset, formatMoney, localDate, parseVnNumber, type Totals } from '@tiny-pos/shared';
import { useOrders } from '@/api/orders';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Kbd } from '@/components/ui/kbd';
import { groupThousands, moneyChange } from '@/lib/money-input';

interface Props {
  totals: Totals;
  /** Số dòng trong giỏ. */
  lineCount: number;
  empty: boolean;
  canHold: boolean;
  onDiscount: (v: number) => void;
  onCheckout: () => void;
  onHold: () => void;
  onCustom: () => void;
  onClear: () => void;
}

function TodaySummary() {
  const { data } = useOrders(localDate(new Date(), currentTzOffset()));
  const s = data?.summary;
  if (!s) return null;
  return (
    <div className="mt-auto border-t pt-3 text-sm text-muted-foreground">
      <div className="font-medium text-foreground">
        Hôm nay: {s.count} đơn · {formatMoney(s.total)}
      </div>
      <div>
        Tiền mặt {formatMoney(s.cash)} · CK {formatMoney(s.transfer)}
        {s.debt > 0 && ` · Ghi nợ ${formatMoney(s.debt)}`}
      </div>
    </div>
  );
}

/** Cột phải: tổng tiền, giảm giá, nút Thanh toán lớn và các thao tác phụ. */
export function CheckoutPanel({ totals, lineCount, empty, canHold, onDiscount, onCheckout, onHold, onCustom, onClear }: Props) {
  const [discount, setDiscount] = useState('');
  useEffect(() => setDiscount(totals.discount ? groupThousands(String(totals.discount)) : ''), [totals.discount]);
  const bad = totals.payable < 0;

  return (
    <>
      <Card className="gap-0 py-0 lg:h-full">
        <CardContent className="flex h-full flex-col gap-3 p-4">
          <div className="flex items-baseline justify-between text-muted-foreground">
            <span>{`Tổng tiền (${lineCount} món)`}</span>
            <span className="text-lg tabular-nums">{formatMoney(totals.total)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="cp-discount" className="text-muted-foreground">
              Giảm giá
            </label>
            <Input
              id="cp-discount"
              inputMode="numeric"
              placeholder="0"
              value={discount}
              onChange={moneyChange((v) => {
                setDiscount(v);
                onDiscount(parseVnNumber(v || '0'));
              })}
              aria-invalid={bad}
              className="h-10 w-36 text-right text-base tabular-nums"
            />
          </div>
          {bad && <p className="text-sm text-destructive">Giảm giá lớn hơn tổng tiền</p>}
          <div className="border-t pt-3">
            <div className="text-sm text-muted-foreground">Khách phải trả</div>
            <div className="font-heading text-4xl font-bold tracking-tight tabular-nums">{formatMoney(Math.max(0, totals.payable))}</div>
          </div>
          <Button className="h-12 w-full text-base" disabled={empty || bad} onClick={onCheckout}>
            <CreditCard data-icon="inline-start" />
            Thanh toán <Kbd className="ml-1">F9</Kbd>
          </Button>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" className="h-11 flex-col gap-0 text-xs" disabled={empty || !canHold} title={canHold ? undefined : 'Đã đủ 5 đơn chờ'} onClick={onHold}>
              <PauseCircle /> Cất chờ
            </Button>
            <Button variant="outline" className="h-11 flex-col gap-0 text-xs" onClick={onCustom}>
              <PackagePlus /> Món ngoài
            </Button>
            <Button variant="outline" className="h-11 flex-col gap-0 text-xs text-destructive" disabled={empty} onClick={onClear}>
              <Trash2 /> Xóa giỏ
            </Button>
          </div>
          <TodaySummary />
        </CardContent>
      </Card>

      {/* Điện thoại: tổng tiền + nút Thanh toán dính ngay trên thanh menu dưới (cao 68px + safe-area, xem App.tsx) */}
      <div className="fixed inset-x-0 bottom-[calc(68px+env(safe-area-inset-bottom))] z-30 flex items-center gap-3 border-t bg-card/95 px-4 py-2 backdrop-blur md:hidden">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-muted-foreground">Phải trả</div>
          <div className="font-heading text-2xl font-bold tabular-nums">{formatMoney(Math.max(0, totals.payable))}</div>
        </div>
        <Button className="h-12 px-6 text-base" disabled={empty || bad} onClick={onCheckout}>
          Thanh toán
        </Button>
      </div>
    </>
  );
}
