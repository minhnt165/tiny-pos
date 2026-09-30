import { useEffect, useState, type FormEvent } from 'react';
import { Check, Scale } from 'lucide-react';
import { formatMoney, formatQty, lineAmount, parseVnNumber, type NewCartLine } from '@tiny-pos/shared';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { groupThousands, moneyChange } from '@/lib/money-input';

export interface WeighTarget {
  line: NewCartLine;
  /** Có key = sửa khối lượng dòng đã có trong giỏ. */
  lineKey?: string;
}

interface Props {
  target: WeighTarget | null;
  onClose: () => void;
  onConfirm: (qty: number) => void;
}

/** Hàng cân: gõ số kg hoặc số tiền khách muốn mua, ô còn lại tự tính. */
export function WeighDialog({ target, onClose, onConfirm }: Props) {
  const [kg, setKg] = useState('');
  const [amount, setAmount] = useState('');
  const price = target?.line.price ?? 0;
  const amountOf = (qty: number) => groupThousands(String(lineAmount({ qty, price, isWeighed: true })));

  useEffect(() => {
    if (!target) return;
    const q = target.lineKey ? target.line.qty : 0;
    setKg(q ? formatQty(q) : '');
    setAmount(q ? amountOf(q) : '');
    // Chỉ khởi tạo khi mở dialog (target đổi), không chạy lại khi giá đổi
  }, [target]);

  const onKg = (v: string) => {
    setKg(v);
    const n = parseVnNumber(v);
    setAmount(Number.isFinite(n) && n > 0 ? amountOf(n) : '');
  };
  const onAmount = (v: string) => {
    setAmount(v);
    const n = parseVnNumber(v || '0');
    setKg(price > 0 && n > 0 ? formatQty(Math.round((n / price) * 1000) / 1000) : '');
  };

  const qty = parseVnNumber(kg);
  const valid = Number.isFinite(qty) && qty > 0;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (valid) onConfirm(qty);
  };

  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Scale className="size-5 text-primary" />
            {target?.line.name}
          </DialogTitle>
          <DialogDescription className="text-base">
            {formatMoney(price)} / {target?.line.unitName}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <TextField id="wd-kg" label="Khối lượng" suffix={target?.line.unitName} inputMode="decimal" autoFocus value={kg} onChange={(e) => onKg(e.target.value)} />
            <TextField id="wd-amount" label="Thành tiền" suffix="đ" inputMode="numeric" value={amount} onChange={moneyChange(onAmount)} />
          </div>
          <Button type="submit" className="h-11 w-full text-base" disabled={!valid}>
            <Check data-icon="inline-start" />
            {target?.lineKey ? 'Cập nhật' : 'Thêm vào giỏ'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
