import { useState } from 'react';
import { useNavigate } from 'react-router';
import { HandCoins, PackageMinus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney } from '@tiny-pos/shared';
import { useDeleteSupplier, useSupplierTransactions, useSuppliers } from '@/api/suppliers';
import { useConfirm } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { PaymentDialog } from './PaymentDialog';
import { SupplierFormDialog } from './SupplierFormDialog';

const when = (iso: string) => new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

/** Thông tin NCC + sổ nợ + trả nợ / sửa / xóa. */
export function SupplierDetailDialog({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data: suppliers = [] } = useSuppliers(true); // Lấy cả NCC đã xóa: danh sách bật "Hiện cả người đã xóa" vẫn mở được chi tiết
  const s = suppliers.find((x) => x.id === id) ?? null;
  const { data: txs = [] } = useSupplierTransactions(id);
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState(false);
  const del = useDeleteSupplier();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const onDelete = async () => {
    if (!s) return;
    if (!(await confirm({ title: `Xóa nhà cung cấp "${s.name}"?`, confirmText: 'Xóa', destructive: true }))) return;
    del.mutate(s.id, {
      onSuccess: () => {
        toast.success('Đã xóa');
        onClose();
      },
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <>
      <Dialog open={s !== null} onOpenChange={(o) => !o && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl">{s?.name}</DialogTitle>
            <DialogDescription className="text-base">{[s?.phone, s?.note].filter(Boolean).join(' · ') || 'Chưa có số điện thoại'}</DialogDescription>
          </DialogHeader>
          <div className="rounded-xl bg-muted/60 px-4 py-3">
            <div className="text-sm text-muted-foreground">{(s?.debt ?? 0) < 0 ? 'NCC đang nợ lại' : 'Đang nợ'}</div>
            <div className={cn('font-heading text-3xl font-semibold tabular-nums', (s?.debt ?? 0) > 0 && 'text-destructive')}>
              {formatMoney(Math.abs(s?.debt ?? 0))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-sm font-medium text-muted-foreground">Sổ nợ</div>
            {txs.length ? (
              <ul className="divide-y rounded-xl border">
                {txs.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{t.note ?? (t.amount > 0 ? 'Ghi nợ' : 'Trả nợ')}</div>
                      <div className="text-sm text-muted-foreground">{when(t.createdAt)}</div>
                    </div>
                    <div className="text-right tabular-nums">
                      <div className={cn('font-semibold', t.amount > 0 ? 'text-destructive' : 'text-success')}>
                        {t.amount > 0 ? '+' : '−'}
                        {formatMoney(Math.abs(t.amount))}
                      </div>
                      <div className="text-sm text-muted-foreground">còn {formatMoney(t.balance)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">Chưa có giao dịch.</p>
            )}
          </div>
          {s && !s.isActive ? (
            <p className="text-sm text-muted-foreground">Nhà cung cấp đã xóa: chỉ xem sổ nợ, không trả nợ hay sửa được.</p>
          ) : (
            <DialogFooter className="gap-2">
              {s?.debt === 0 && (
                <Button variant="outline" className="h-11 text-base text-destructive" onClick={() => void onDelete()}>
                  <Trash2 data-icon="inline-start" />
                  Xóa
                </Button>
              )}
              <Button variant="outline" className="h-11 text-base" disabled={!s} onClick={() => s && navigate(`/supplier-returns/new?supplierId=${s.id}`)}>
                <PackageMinus data-icon="inline-start" />
                Trả hàng
              </Button>
              <Button variant="outline" className="h-11 text-base" onClick={() => setEditing(true)}>
                <Pencil data-icon="inline-start" />
                Sửa
              </Button>
              <Button className="h-11 text-base" disabled={!s || s.debt <= 0} onClick={() => setPaying(true)}>
                <HandCoins data-icon="inline-start" />
                Trả nợ
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
      <SupplierFormDialog open={editing} supplier={s} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />
      {s && <PaymentDialog supplier={s} open={paying} onClose={() => setPaying(false)} />}
    </>
  );
}
