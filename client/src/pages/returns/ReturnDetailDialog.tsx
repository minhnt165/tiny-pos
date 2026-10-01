import { Ban, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney, formatQty } from '@tiny-pos/shared';
import { useCancelReturn, useReturn } from '@/api/returns';
import { useConfirm } from '@/components/ConfirmDialog';
import { MoneyLine } from '@/components/MoneyLine';
import { usePrint } from '@/components/receipt/PrintProvider';
import { receiptFromReturn } from '@/components/receipt/receipt-data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/** Chi tiết phiếu trả: các dòng, hóa đơn gốc, in, hủy phiếu. Có `onOpenOrder` thì mã hóa đơn bấm được. */
export function ReturnDetailDialog({ id, onClose, onOpenOrder }: { id: number | null; onClose: () => void; onOpenOrder?: (orderId: number) => void }) {
  const { data: r } = useReturn(id);
  const cancel = useCancelReturn();
  const confirm = useConfirm();
  const print = usePrint();

  const onCancel = async () => {
    if (!r) return;
    const ok = await confirm({
      title: `Hủy phiếu trả ${r.code}?`,
      description: 'Tồn của món đã nhập kho bị trừ lại; nợ đã trừ của khách được cộng lại. Phiếu vẫn được giữ với trạng thái Đã hủy.',
      confirmText: 'Hủy phiếu',
      cancelText: 'Không',
      destructive: true,
    });
    if (!ok) return;
    cancel.mutate(r.id, { onSuccess: () => toast.success(`Đã hủy ${r.code}`), onError: (e) => toast.error(e.message) });
  };

  return (
    <Dialog open={id !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono text-xl">
            {r?.code ?? 'Phiếu trả'}
            {r?.status === 'cancelled' && <Badge variant="secondary">Đã hủy</Badge>}
          </DialogTitle>
          <DialogDescription className="text-base">
            {r && `${new Date(r.createdAt).toLocaleString('vi-VN')}${r.customerName ? ` · ${r.customerName}` : ''}`}
          </DialogDescription>
        </DialogHeader>
        {r && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Hóa đơn gốc</span>
              {onOpenOrder ? (
                <Button variant="link" className="h-auto p-0 font-mono text-base" onClick={() => onOpenOrder(r.orderId)}>
                  {r.orderCode}
                </Button>
              ) : (
                <span className="font-mono">{r.orderCode}</span>
              )}
            </div>
            <ul className="divide-y rounded-xl border">
              {r.items.map((it) => (
                <li key={it.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="font-medium">{it.productName}</div>
                    <div className="text-sm text-muted-foreground tabular-nums">
                      {formatQty(it.qty)} {it.unit}
                      {it.productId !== null && !it.restock && ' · không nhập kho'}
                    </div>
                  </div>
                  <div className="font-semibold tabular-nums">{formatMoney(it.amount)}</div>
                </li>
              ))}
            </ul>
            <div className="space-y-1">
              <MoneyLine label="Tổng hoàn" value={formatMoney(r.refund)} strong />
              {r.debtReduced > 0 && <MoneyLine label="Trừ nợ khách" value={formatMoney(r.debtReduced)} />}
              <MoneyLine label="Trả tiền mặt" value={formatMoney(r.cashRefund)} />
            </div>
            {r.note && <p className="text-sm text-muted-foreground">Ghi chú: {r.note}</p>}
          </div>
        )}
        <DialogFooter>
          {r?.status === 'done' && (
            <Button variant="outline" className="h-11 text-base text-destructive" disabled={cancel.isPending} onClick={() => void onCancel()}>
              <Ban data-icon="inline-start" />
              Hủy phiếu
            </Button>
          )}
          <Button className="h-11 text-base" disabled={!r} onClick={() => r && void print(receiptFromReturn(r))}>
            <Printer data-icon="inline-start" />
            In phiếu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
