import { formatMoney } from '@tiny-pos/shared';
import { useStocktake } from '@/api/stocktakes';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StocktakeItemsTable } from './StocktakeItemsTable';

export function StocktakeDetailDialog({ id, onClose }: { id: number | null; onClose: () => void }) {
  const { data: s } = useStocktake(id);
  return (
    <Dialog open={id !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono text-xl">
            {s?.code ?? 'Kiểm kê'}
            {s?.status === 'cancelled' && <Badge variant="secondary">Đã hủy</Badge>}
          </DialogTitle>
          <DialogDescription className="text-base">
            {s && `${new Date(s.createdAt).toLocaleString('vi-VN')} · ${s.itemCount} món · ${s.diffCount} món lệch · ${formatMoney(s.diffValue)}`}
          </DialogDescription>
        </DialogHeader>
        {s && <StocktakeItemsTable items={s.items} />}
      </DialogContent>
    </Dialog>
  );
}
