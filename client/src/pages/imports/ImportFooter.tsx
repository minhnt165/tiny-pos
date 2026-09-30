import { Save } from 'lucide-react';
import { formatMoney } from '@tiny-pos/shared';
import { CommitInput } from '@/components/CommitInput';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Kbd } from '@/components/ui/kbd';

interface Props {
  totals: { total: number; paid: number; debt: number };
  hasSupplier: boolean;
  /** Đang để "trả đủ" (paid tự theo tổng). */
  paidAuto: boolean;
  onPaid: (v: number | null) => void;
  onSave: () => void;
  saving: boolean;
  empty: boolean;
}

export function ImportFooter({ totals, hasSupplier, paidAuto, onPaid, onSave, saving, empty }: Props) {
  const over = totals.paid > totals.total;
  return (
    <Card className="gap-0 py-0">
      <CardContent className="flex flex-wrap items-end justify-between gap-4 p-5">
        <div>
          <div className="text-sm text-muted-foreground">Tổng tiền nhập</div>
          <div className="font-heading text-3xl font-semibold text-primary tabular-nums">{formatMoney(totals.total)}</div>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Đã trả</label>
            {hasSupplier && !paidAuto && (
              <Button variant="link" className="h-auto p-0 text-sm" onClick={() => onPaid(null)}>
                Trả đủ
              </Button>
            )}
          </div>
          <CommitInput aria-label="Đã trả" money disabled={!hasSupplier} value={totals.paid} onCommit={(v) => onPaid(v)} className="w-40" />
          <div className={over ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
            {over ? 'Số đã trả lớn hơn tổng tiền' : hasSupplier ? `Ghi nợ: ${formatMoney(totals.debt)}` : 'Không ghi NCC thì trả đủ'}
          </div>
        </div>
        <Button className="h-14 px-8 text-lg" disabled={empty || over || saving} onClick={onSave}>
          <Save data-icon="inline-start" />
          Lưu phiếu <Kbd className="ml-1">F9</Kbd>
        </Button>
      </CardContent>
    </Card>
  );
}
