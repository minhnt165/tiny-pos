import { useEffect, useState, type FormEvent } from 'react';
import { Check, PackagePlus } from 'lucide-react';
import { customLine, parseVnNumber, type NewCartLine } from '@tiny-pos/shared';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { moneyChange } from '@/lib/money-input';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (line: NewCartLine) => void;
}

/** Món ngoài (chưa khai báo, không có mã): chỉ tên + giá + số lượng, không trừ kho. */
export function CustomItemDialog({ open, onClose, onConfirm }: Props) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('1');

  useEffect(() => {
    if (!open) return;
    setName('');
    setPrice('');
    setQty('1');
  }, [open]);

  const p = parseVnNumber(price || 'x');
  const q = parseVnNumber(qty);
  const valid = Number.isFinite(p) && p >= 0 && Number.isFinite(q) && q > 0;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (valid) onConfirm(customLine(name, Math.round(p), q));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <PackagePlus className="size-5 text-primary" />
            Món ngoài
          </DialogTitle>
          <DialogDescription className="text-base">Món chưa có trong danh sách; không trừ tồn kho.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <TextField id="ci-name" label="Tên món" placeholder="Hàng khác" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <TextField id="ci-price" label="Giá" suffix="đ" inputMode="numeric" autoFocus value={price} onChange={moneyChange(setPrice)} />
            <TextField id="ci-qty" label="Số lượng" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <Button type="submit" className="h-11 w-full text-base" disabled={!valid}>
            <Check data-icon="inline-start" />
            Thêm vào giỏ
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
