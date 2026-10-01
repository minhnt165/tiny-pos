import { useState } from 'react';
import { Ban, Printer, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney, formatQty, remainingQty } from '@tiny-pos/shared';
import { useCancelOrder, useOrder } from '@/api/orders';
import { useConfirm } from '@/components/ConfirmDialog';
import { MoneyLine as Line } from '@/components/MoneyLine';
import { usePrint } from '@/components/receipt/PrintProvider';
import { receiptFromOrder } from '@/components/receipt/receipt-data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { ReturnDetailDialog } from '../returns/ReturnDetailDialog';
import { ReturnDialog } from '../returns/ReturnDialog';
import { METHOD_LABEL } from './OrderTable';

export function OrderDetailDialog({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data: o } = useOrder(id);
  const cancel = useCancelOrder();
  const confirm = useConfirm();
  const print = usePrint();
  const [returning, setReturning] = useState(false);
  const [returnId, setReturnId] = useState<number | null>(null);
  const hasReturns = !!o?.returns.some((r) => r.status === 'done');
  const canReturn = o?.status === 'done' && o.items.some((it) => remainingQty(it.qty, it.returnedQty) > 0);

  const onCancel = async () => {
    if (!o) return;
    const ok = await confirm({
      title: `Hủy ${o.code} và trả hàng về kho?`,
      description: `${o.debt && o.paid > 0 ? `Trả lại khách ${formatMoney(o.paid)} đã trả trước. ` : ''}${o.debt ? 'Nợ của khách được trừ lại. ' : ''}Hóa đơn vẫn được giữ lại với trạng thái Đã hủy và không tính vào doanh thu.`,
      confirmText: 'Hủy hóa đơn',
      cancelText: 'Không',
      destructive: true,
    });
    if (!ok) return;
    cancel.mutate(o.id, { onSuccess: () => toast.success(`Đã hủy ${o.code}`), onError: (e) => toast.error(e.message) });
  };

  return (
    <Dialog open={id !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono text-xl">
            {o?.code ?? 'Hóa đơn'}
            {o?.status === 'cancelled' && <Badge variant="secondary">Đã hủy</Badge>}
          </DialogTitle>
          <DialogDescription className="text-base">
            {o && `${new Date(o.createdAt).toLocaleString('vi-VN')} · ${METHOD_LABEL[o.paymentMethod]}${o.customerName ? ` · ${o.customerName}` : ''}`}
          </DialogDescription>
        </DialogHeader>
        {o && (
          <div className="space-y-4">
            <ul className="divide-y rounded-xl border">
              {o.items.map((it) => (
                <li key={it.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="font-medium">{it.productName}</div>
                    <div className="text-sm text-muted-foreground tabular-nums">
                      {formatQty(it.qty)} {it.unit} × {formatMoney(it.price)}
                    </div>
                    {it.returnedQty > 0 && (
                      <div className="text-sm text-warning tabular-nums">
                        Đã trả {formatQty(it.returnedQty)} {it.unit}
                      </div>
                    )}
                  </div>
                  <div className="font-semibold tabular-nums">{formatMoney(it.amount)}</div>
                </li>
              ))}
            </ul>
            <div className="space-y-1">
              <Line label="Tổng tiền" value={formatMoney(o.total)} />
              {o.discount > 0 && <Line label="Giảm giá" value={`-${formatMoney(o.discount)}`} />}
              <Line label="Phải trả" value={formatMoney(o.payable)} strong />
              {o.paymentMethod === 'cash' && (
                <>
                  <Line label="Khách đưa" value={formatMoney(o.paid)} />
                  <Line label="Tiền thối" value={formatMoney(o.paid - o.payable)} />
                </>
              )}
              {o.debt && (
                <>
                  <Line label="Khách trả" value={formatMoney(o.paid)} />
                  <Line label="Ghi nợ đơn này" value={formatMoney(o.debt.amount)} />
                  <Line
                    label={o.debt.balanceAfter - o.debt.amount < 0 ? 'Tiệm nợ khách (trước đơn)' : 'Nợ cũ'}
                    value={formatMoney(Math.abs(o.debt.balanceAfter - o.debt.amount))}
                  />
                  <Line label={o.debt.balanceAfter < 0 ? 'Tiệm còn nợ khách' : 'Tổng nợ sau đơn'} value={formatMoney(Math.abs(o.debt.balanceAfter))} />
                </>
              )}
            </div>
            {o.returns.length > 0 && (
              <div className="space-y-1">
                <div className="text-sm font-semibold">Phiếu trả</div>
                <ul className="divide-y rounded-xl border">
                  {o.returns.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-muted/40"
                        onClick={() => setReturnId(r.id)}
                      >
                        <span className={cn('font-mono', r.status === 'cancelled' && 'text-muted-foreground line-through')}>{r.code}</span>
                        <span className="text-sm text-muted-foreground">{new Date(r.createdAt).toLocaleString('vi-VN')}</span>
                        {r.status === 'cancelled' ? (
                          <Badge variant="secondary">Đã hủy</Badge>
                        ) : (
                          <span className="font-semibold tabular-nums">{formatMoney(r.refund)}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        {o?.status === 'done' && hasReturns && <p className="text-sm text-muted-foreground">Hủy các phiếu trả trước khi hủy hóa đơn.</p>}
        <DialogFooter>
          {o?.status === 'done' && (
            <Button variant="outline" className="h-11 text-base text-destructive" disabled={cancel.isPending || hasReturns} onClick={() => void onCancel()}>
              <Ban data-icon="inline-start" />
              Hủy đơn
            </Button>
          )}
          {canReturn && (
            <Button variant="outline" className="h-11 text-base" onClick={() => setReturning(true)}>
              <Undo2 data-icon="inline-start" />
              Trả hàng
            </Button>
          )}
          <Button className="h-11 text-base" disabled={!o} onClick={() => o && void print(receiptFromOrder(o))}>
            <Printer data-icon="inline-start" />
            In lại
          </Button>
        </DialogFooter>
        {o && <ReturnDialog order={o} open={returning} onClose={() => setReturning(false)} />}
        <ReturnDetailDialog id={returnId} onClose={() => setReturnId(null)} />
      </DialogContent>
    </Dialog>
  );
}
