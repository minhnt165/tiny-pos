import { useEffect, useState, type FormEvent } from 'react';
import { Check, NotebookPen } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney, parseVnNumber, type Customer } from '@tiny-pos/shared';
import { useAddManualDebt } from '@/api/customers';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { moneyChange } from '@/lib/money-input';

/** Ghi nợ tay: quên ghi hoặc sửa lần thu nhầm; bắt buộc ghi chú để sổ còn truy được. */
export function ManualDebtDialog({ customer, open, onClose }: { customer: Customer; open: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const add = useAddManualDebt();

  useEffect(() => {
    if (!open) return;
    setAmount('');
    setNote('');
  }, [open]);

  const n = parseVnNumber(amount || 'x');
  const valid = Number.isFinite(n) && n > 0 && note.trim().length > 0;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid || add.isPending) return;
    add.mutate(
      { id: customer.id, amount: Math.round(n), note },
      {
        onSuccess: (c) => {
          toast.success(`Đã ghi thêm ${formatMoney(n)} · tổng nợ ${formatMoney(c.debt)}`);
          onClose();
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <NotebookPen className="size-5 text-primary" />
            Ghi nợ tay – {customer.name}
          </DialogTitle>
          <DialogDescription className="text-base">Đang nợ {formatMoney(customer.debt)}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <TextField id="md-amount" label="Số tiền ghi thêm" suffix="đ" inputMode="numeric" autoFocus value={amount} onChange={moneyChange(setAmount)} />
          <TextField
            id="md-note"
            label="Ghi chú (bắt buộc)"
            placeholder="Ví dụ: quên ghi gói thuốc ngày 28"
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button type="submit" className="h-11 w-full text-base" disabled={!valid || add.isPending}>
            <Check data-icon="inline-start" />
            Ghi nợ
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
