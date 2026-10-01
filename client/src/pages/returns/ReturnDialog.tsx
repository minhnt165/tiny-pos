import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney, formatQty, remainingQty, returnAmounts, roundQty, splitRefund, type OrderDetail } from '@tiny-pos/shared';
import { useCreateReturn } from '@/api/returns';
import { CommitInput } from '@/components/CommitInput';
import { MoneyLine } from '@/components/MoneyLine';
import { usePrint } from '@/components/receipt/PrintProvider';
import { receiptFromReturn } from '@/components/receipt/receipt-data';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Pick {
  qty: number;
  restock: boolean;
}
const NONE: Pick = { qty: 0, restock: true };

/** Lập phiếu trả cho một hóa đơn: số lượng từng món (≤ phần còn lại), có nhập lại kho hay không; tiền hoàn tính sẵn như server. */
export function ReturnDialog({ order, open, onClose }: { order: OrderDetail; open: boolean; onClose: () => void }) {
  const [picks, setPicks] = useState<Record<number, Pick>>({});
  const [note, setNote] = useState('');
  const create = useCreateReturn();
  const print = usePrint();

  useEffect(() => {
    if (!open) return;
    setPicks({});
    setNote('');
  }, [open]);

  const setPick = (id: number, p: Partial<Pick>) => setPicks((s) => ({ ...s, [id]: { ...NONE, ...s[id], ...p } }));
  const amounts = useMemo(
    () => returnAmounts(order.items, order.discount, new Map(order.items.map((it) => [it.id, picks[it.id]?.qty ?? 0]))),
    [order, picks],
  );
  const refund = [...amounts.values()].reduce((s, a) => s + a, 0);
  const split = splitRefund(refund, order.paymentMethod, order.customerDebt);
  const chosen = order.items.filter((it) => (picks[it.id]?.qty ?? 0) > 0);

  const fillAll = () =>
    setPicks((s) => Object.fromEntries(order.items.map((it) => [it.id, { ...NONE, ...s[it.id], qty: remainingQty(it.qty, it.returnedQty) }])));

  const onSave = () =>
    create.mutate(
      { orderId: order.id, note, items: chosen.map((it) => ({ orderItemId: it.id, qty: picks[it.id]!.qty, restock: picks[it.id]!.restock })) },
      {
        onSuccess: (r) => {
          toast.success(`Đã lập ${r.code}`, { action: { label: 'In phiếu', onClick: () => void print(receiptFromReturn(r)) } });
          onClose();
        },
        onError: (e) => toast.error(e.message),
      },
    );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Trả hàng · {order.code}</DialogTitle>
          <DialogDescription className="text-base">Chọn số lượng khách trả. Bỏ chọn "Nhập lại kho" với hàng hỏng, hết hạn.</DialogDescription>
        </DialogHeader>
        <ul className="divide-y rounded-xl border">
          {order.items.map((it) => {
            const left = remainingQty(it.qty, it.returnedQty);
            const p = picks[it.id] ?? NONE;
            return (
              <li key={it.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{it.productName}</div>
                  <div className="text-sm text-muted-foreground tabular-nums">
                    Đã mua {formatQty(it.qty)} {it.unit}
                    {it.returnedQty > 0 && ` · đã trả ${formatQty(it.returnedQty)}`}
                  </div>
                </div>
                {left > 0 ? (
                  <>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-11"
                        aria-label={`Bớt ${it.productName}`}
                        disabled={p.qty <= 0}
                        onClick={() => setPick(it.id, { qty: Math.max(roundQty(p.qty - 1), 0) })}
                      >
                        <Minus />
                      </Button>
                      <CommitInput
                        value={p.qty}
                        onCommit={(n) => setPick(it.id, { qty: Math.min(roundQty(n), left) })}
                        className="h-11 w-20 text-right text-base"
                        aria-label={`Số lượng trả ${it.productName}`}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-11"
                        aria-label={`Thêm ${it.productName}`}
                        disabled={p.qty >= left}
                        onClick={() => setPick(it.id, { qty: Math.min(roundQty(p.qty + 1), left) })}
                      >
                        <Plus />
                      </Button>
                    </div>
                    {it.productId !== null && (
                      <Label className="flex items-center gap-2 text-sm">
                        <Checkbox checked={p.restock} onCheckedChange={(v) => setPick(it.id, { restock: v === true })} />
                        Nhập lại kho
                      </Label>
                    )}
                    <div className="w-24 text-right font-semibold tabular-nums">{formatMoney(amounts.get(it.id) ?? 0)}</div>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">Đã trả hết</span>
                )}
              </li>
            );
          })}
        </ul>
        <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Lý do trả (không bắt buộc)" className="h-11 text-base" />
        <div className="space-y-1">
          <MoneyLine label="Tổng hoàn" value={formatMoney(refund)} strong />
          {split.debtReduced > 0 && <MoneyLine label="Trừ nợ khách" value={formatMoney(split.debtReduced)} />}
          <MoneyLine label="Trả tiền mặt" value={formatMoney(split.cashRefund)} />
        </div>
        <DialogFooter>
          <Button variant="outline" className="h-11 text-base" onClick={fillAll}>
            Trả hết
          </Button>
          <Button className="h-11 text-base" disabled={!chosen.length || create.isPending} onClick={onSave}>
            <Undo2 data-icon="inline-start" />
            Lập phiếu trả
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
