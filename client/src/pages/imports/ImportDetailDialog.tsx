import { useNavigate } from 'react-router';
import { Ban, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { formatLabelItems, formatMoney, formatQty, importLabelRefs } from '@tiny-pos/shared';
import { useCancelImport, useImport } from '@/api/imports';
import { useConfirm } from '@/components/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function ImportDetailDialog({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data: r } = useImport(id);
  const cancel = useCancelImport();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const onCancel = async () => {
    if (!r) return;
    const ok = await confirm({
      title: `Hủy ${r.code} và trừ lại kho?`,
      description: 'Tồn kho và nợ nhà cung cấp được trừ lại; giá vốn, giá bán giữ nguyên.',
      confirmText: 'Hủy phiếu',
      cancelText: 'Không',
      destructive: true,
    });
    if (!ok) return;
    cancel.mutate(r.id, { onSuccess: () => toast.success(`Đã hủy ${r.code}`), onError: (e) => toast.error(e.message) });
  };

  return (
    <Dialog open={id !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono text-xl">
            {r?.code ?? 'Phiếu nhập'}
            {r?.status === 'cancelled' && <Badge variant="secondary">Đã hủy</Badge>}
          </DialogTitle>
          <DialogDescription className="text-base">
            {r && `${new Date(r.createdAt).toLocaleString('vi-VN')} · ${r.supplierName ?? 'Không ghi NCC'}${r.note ? ` · ${r.note}` : ''}`}
          </DialogDescription>
        </DialogHeader>
        {r && (
          <div className="space-y-4">
            <ul className="divide-y rounded-xl border">
              {r.items.map((it) => (
                <li key={it.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="font-medium">{it.productName}</div>
                    <div className="text-sm text-muted-foreground tabular-nums">
                      {formatQty(it.qty)} {it.unitName} × {formatMoney(it.unitCost)}
                    </div>
                  </div>
                  <div className="font-semibold tabular-nums">{formatMoney(it.amount)}</div>
                </li>
              ))}
            </ul>
            <div className="space-y-1 tabular-nums">
              <div className="flex justify-between text-lg font-semibold">
                <span>Tổng</span>
                <span>{formatMoney(r.total)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Đã trả</span>
                <span>{formatMoney(r.paid)}</span>
              </div>
              {r.total > r.paid && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Ghi nợ</span>
                  <span>{formatMoney(r.total - r.paid)}</span>
                </div>
              )}
            </div>
          </div>
        )}
        <DialogFooter>
          {r?.status === 'done' && (
            <Button variant="outline" className="h-11 text-base text-destructive" disabled={cancel.isPending} onClick={() => void onCancel()}>
              <Ban data-icon="inline-start" />
              Hủy phiếu
            </Button>
          )}
          {r && (
            <Button variant="outline" className="h-11 text-base" onClick={() => navigate(`/labels?add=${formatLabelItems(importLabelRefs(r.items))}`)}>
              <Tag data-icon="inline-start" />
              In tem
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
