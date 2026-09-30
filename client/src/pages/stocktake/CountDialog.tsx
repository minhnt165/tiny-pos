import { useEffect, useState, type FormEvent } from 'react';
import { Check, ClipboardCheck } from 'lucide-react';
import { formatQty, parseVnNumber } from '@tiny-pos/shared';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export interface CountTarget {
  productId: number;
  name: string;
  unit: string;
  /** Tồn máy hiện tại (hoặc lúc đếm trước, khi sửa dòng đã đếm). */
  stock: number;
  /** Số đã đếm trước đó trong phiên, nếu có. */
  counted?: number;
  /** Quét mã của đơn vị quy đổi (thùng, lốc…): đếm theo đơn vị đó, ví dụ 'Thùng (24 lon)'. */
  unitLabel?: string;
  unitName?: string;
  /** Hệ số quy về đơn vị gốc; bỏ trống = 1 (đếm theo đơn vị gốc). */
  factor?: number;
}

interface Props {
  target: CountTarget | null;
  saving: boolean;
  onClose: () => void;
  onSave: (counted: number) => void;
}

export function CountDialog({ target, saving, onClose, onSave }: Props) {
  const [value, setValue] = useState('');
  const factor = target?.factor ?? 1;
  useEffect(() => {
    if (target) setValue(target.counted !== undefined ? formatQty(target.counted / (target.factor ?? 1)) : '');
  }, [target]);

  const n = parseVnNumber(value);
  const valid = value.trim() !== '' && Number.isFinite(n) && n >= 0;
  // Server lưu theo đơn vị gốc: số đếm × hệ số
  const base = Math.round(n * factor * 1000) / 1000;
  const diff = valid && target ? Math.round((base - target.stock) * 1000) / 1000 : null;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (valid && !saving) onSave(base);
  };

  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ClipboardCheck className="size-5 text-primary" />
            {target?.name}
          </DialogTitle>
          <DialogDescription className="text-base">
            Tồn máy: {target && `${formatQty(target.stock)} ${target.unit}`}
            {target?.unitLabel && ` (= ${formatQty(target.stock / factor)} ${target.unitName}) · Đếm theo ${target.unitLabel}`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <TextField
            id="cd-counted"
            label="Số đếm được"
            suffix={target?.unitName ?? target?.unit}
            inputMode="decimal"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={(e) => e.target.select()}
          />
          {diff !== null && (
            <p className={cn('text-base font-medium', diff > 0 ? 'text-success' : diff < 0 ? 'text-destructive' : 'text-muted-foreground')}>
              {diff === 0 ? 'Khớp tồn máy' : `Chênh lệch ${diff > 0 ? '+' : ''}${formatQty(diff)} ${target?.unit}`}
            </p>
          )}
          <Button type="submit" className="h-11 w-full text-base" disabled={!valid || saving}>
            <Check data-icon="inline-start" />
            Lưu (Enter)
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
