import { Ban, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney, formatQty } from '@tiny-pos/shared';
import { useCancelOrder, useOrder } from '@/api/orders';
import { useConfirm } from '@/components/ConfirmDialog';
import { usePrint } from '@/components/receipt/PrintProvider';
import { receiptFromOrder } from '@/components/receipt/receipt-data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { METHOD_LABEL } from './OrderTable';

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? 'flex justify-between text-lg font-semibold' : 'flex justify-between text-muted-foreground'}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export function OrderDetailDialog({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data: o } = useOrder(id);
  const cancel = useCancelOrder();
  const confirm = useConfirm();
  const print = usePrint();

  const onCancel = async () => {
    if (!o) return;
    const ok = await confirm({
      title: `Hủy ${o.code} và trả hàng về kho?`,
      description: 'Hóa đơn vẫn được giữ lại với trạng thái Đã hủy và không tính vào doanh thu.',
      confirmText: 'Hủy hóa đơn',
      cancelText: 'Không',
      destructive: true,
    });
    if (!ok) return;
    cancel.mutate(o.id, { onSuccess: () => toast.success(`Đã hủy ${o.code}`), onError: (e) => toast.error(e.message) });
  };

  return (
    <Dialog open={id !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono text-xl">
            {o?.code ?? 'Hóa đơn'}
            {o?.status === 'cancelled' && <Badge variant="secondary">Đã hủy</Badge>}
          </DialogTitle>
          <DialogDescription className="text-base">
            {o && `${new Date(o.createdAt).toLocaleString('vi-VN')} · ${METHOD_LABEL[o.paymentMethod]}`}
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
            </div>
          </div>
        )}
        <DialogFooter>
          {o?.status === 'done' && (
            <Button variant="outline" className="h-11 text-base text-destructive" disabled={cancel.isPending} onClick={() => void onCancel()}>
              <Ban data-icon="inline-start" />
              Hủy đơn
            </Button>
          )}
          <Button className="h-11 text-base" disabled={!o} onClick={() => o && void print(receiptFromOrder(o))}>
            <Printer data-icon="inline-start" />
            In lại
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
