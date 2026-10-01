import { Save } from 'lucide-react';
import { formatMoney } from '@tiny-pos/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  totals: { total: number; debtReduced: number; cashReceived: number };
  hasSupplier: boolean;
  onSave: () => void;
  saving: boolean;
  empty: boolean;
}

export function SupplierReturnFooter({ totals, hasSupplier, onSave, saving, empty }: Props) {
  return (
    <Card className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 gap-0 py-0 md:bottom-4">
      <CardContent className="flex flex-wrap items-end justify-between gap-4 p-4">
        <div>
          <div className="text-sm text-muted-foreground">Tổng trả</div>
          <div className="font-heading text-3xl font-semibold tabular-nums">{formatMoney(totals.total)}</div>
          <div className="text-sm text-muted-foreground tabular-nums">
            {hasSupplier
              ? `Trừ nợ ${formatMoney(totals.debtReduced)} · NCC trả tiền mặt ${formatMoney(totals.cashReceived)}`
              : 'Chọn nhà cung cấp để lưu phiếu'}
          </div>
        </div>
        <Button className="h-14 px-8 text-lg" disabled={empty || !hasSupplier || saving} onClick={onSave}>
          <Save data-icon="inline-start" />
          Lưu phiếu trả
        </Button>
      </CardContent>
    </Card>
  );
}
