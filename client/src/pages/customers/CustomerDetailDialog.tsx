import { useState } from 'react';
import { HandCoins, NotebookPen, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney, type CustomerTransaction, type DebtTxKind } from '@tiny-pos/shared';
import { useCustomerTransactions, useCustomers, useDeleteCustomer } from '@/api/customers';
import { useConfirm } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { OrderDetailDialog } from '../orders/OrderDetailDialog';
import { CollectDebtDialog } from './CollectDebtDialog';
import { CustomerFormDialog } from './CustomerFormDialog';
import { ManualDebtDialog } from './ManualDebtDialog';

const KIND_LABEL: Record<DebtTxKind, string> = {
  opening: 'Nợ đầu kỳ',
  order: 'Mua chịu',
  order_cancel: 'Hủy đơn',
  payment: 'Thu nợ',
  manual: 'Ghi nợ tay',
  return: 'Trả hàng',
  return_cancel: 'Hủy phiếu trả',
};
const when = (iso: string) => new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
const title = (t: CustomerTransaction) => (t.kind === 'payment' ? `Thu nợ (${t.method === 'transfer' ? 'CK' : 'TM'})` : KIND_LABEL[t.kind]);
/** Ghi chú tự sinh ("Bán HD-…", "Thu nợ", "Nợ đầu kỳ") đã thể hiện qua tiêu đề/mã; chỉ hiện ghi chú người dùng gõ. */
const userNote = (t: CustomerTransaction) => (t.kind === 'manual' || (t.kind === 'payment' && t.note !== 'Thu nợ') ? t.note : null);

/** Thông tin khách + sổ nợ + thu nợ / ghi nợ tay / sửa / xóa. */
export function CustomerDetailDialog({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data } = useCustomers(true); // Lấy cả khách đã xóa: danh sách bật "Hiện cả người đã xóa" vẫn mở được chi tiết
  const c = data?.customers.find((x) => x.id === id) ?? null;
  const { data: txs = [] } = useCustomerTransactions(id);
  const [editing, setEditing] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);
  const del = useDeleteCustomer();
  const confirm = useConfirm();
  const debt = c?.debt ?? 0;

  const onDelete = async () => {
    if (!c) return;
    if (!(await confirm({ title: `Xóa khách "${c.name}"?`, description: 'Sổ nợ cũ vẫn được giữ lại.', confirmText: 'Xóa', destructive: true }))) return;
    del.mutate(c.id, {
      onSuccess: () => {
        toast.success('Đã xóa');
        onClose();
      },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <>
      <Dialog open={c !== null} onOpenChange={(o) => !o && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl">{c?.name}</DialogTitle>
            <DialogDescription className="text-base">{[c?.phone, c?.note].filter(Boolean).join(' · ') || 'Chưa có số điện thoại'}</DialogDescription>
          </DialogHeader>
          <div className="rounded-xl bg-muted/60 px-4 py-3">
            <div className="text-sm text-muted-foreground">{debt < 0 ? 'Tiệm đang nợ khách' : 'Khách đang nợ'}</div>
            <div className={cn('font-heading text-3xl font-semibold tabular-nums', debt > 0 && 'text-destructive')}>{formatMoney(Math.abs(debt))}</div>
          </div>
          <div>
            <div className="mb-2 text-sm font-medium text-muted-foreground">Sổ nợ</div>
            {txs.length ? (
              <ul className="divide-y rounded-xl border">
                {txs.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2 font-medium">
                        {title(t)}
                        {t.orderCode && t.orderId !== null && (
                          <button type="button" className="-my-3 px-1 py-3 font-mono text-sm text-primary underline" onClick={() => setOrderId(t.orderId)}>
                            {t.orderCode}
                          </button>
                        )}
                      </div>
                      <div className="truncate text-sm text-muted-foreground">
                        {when(t.createdAt)}
                        {userNote(t) && ` · ${userNote(t)}`}
                      </div>
                    </div>
                    <div className="text-right tabular-nums">
                      <div className={cn('font-semibold', t.amount > 0 ? 'text-destructive' : 'text-success')}>
                        {t.amount > 0 ? '+' : '−'}
                        {formatMoney(Math.abs(t.amount))}
                      </div>
                      <div className="text-sm text-muted-foreground">{t.balanceAfter < 0 ? 'tiệm nợ' : 'còn'} {formatMoney(Math.abs(t.balanceAfter))}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">Chưa có giao dịch.</p>
            )}
          </div>
          {c && !c.isActive ? (
            <p className="text-sm text-muted-foreground">Khách đã xóa: chỉ xem sổ nợ, không thu nợ hay sửa được.</p>
          ) : (
            <DialogFooter className="gap-2">
              {debt === 0 && (
                <Button variant="outline" className="h-11 text-base text-destructive" onClick={() => void onDelete()}>
                  <Trash2 data-icon="inline-start" />
                  Xóa
                </Button>
              )}
              <Button variant="outline" className="h-11 text-base" onClick={() => setEditing(true)}>
                <Pencil data-icon="inline-start" />
                Sửa
              </Button>
              <Button variant="outline" className="h-11 text-base" disabled={!c} onClick={() => setAdding(true)}>
                <NotebookPen data-icon="inline-start" />
                Ghi nợ tay
              </Button>
              <Button className="h-11 text-base" disabled={!c || debt <= 0} onClick={() => setCollecting(true)}>
                <HandCoins data-icon="inline-start" />
                Thu nợ
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
      <CustomerFormDialog open={editing} customer={c} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />
      {c && <CollectDebtDialog customer={c} open={collecting} onClose={() => setCollecting(false)} />}
      {c && <ManualDebtDialog customer={c} open={adding} onClose={() => setAdding(false)} />}
      <OrderDetailDialog id={orderId} onClose={() => setOrderId(null)} />
    </>
  );
}
