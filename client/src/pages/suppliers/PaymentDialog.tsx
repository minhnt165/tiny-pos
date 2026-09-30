import { useEffect, useState, type FormEvent } from 'react';
import { Check, HandCoins } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney, parseVnNumber, type Supplier } from '@tiny-pos/shared';
import { usePaySupplier } from '@/api/suppliers';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { groupThousands, moneyChange } from '@/lib/money-input';

/** Trả nợ NCC: mặc định trả hết số đang nợ. */
export function PaymentDialog({ supplier, open, onClose }: { supplier: Supplier; open: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const pay = usePaySupplier();

  useEffect(() => {
    if (!open) return;
    setAmount(groupThousands(String(Math.max(0, supplier.debt))));
    setNote('');
  }, [open, supplier.debt]);

  const n = parseVnNumber(amount || 'x');
  const valid = Number.isFinite(n) && n > 0 && n <= supplier.debt;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid || pay.isPending) return;
    pay.mutate(
      { id: supplier.id, amount: Math.round(n), note },
      {
        onSuccess: () => {
          toast.success(`Đã trả ${formatMoney(n)} cho ${supplier.name}`);
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
            <HandCoins className="size-5 text-primary" />
            Trả nợ {supplier.name}
          </DialogTitle>
          <DialogDescription className="text-base">Đang nợ {formatMoney(supplier.debt)}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <TextField
            id="pd-amount"
            label="Số tiền trả"
            suffix="đ"
            inputMode="numeric"
            autoFocus
            value={amount}
            onChange={moneyChange(setAmount)}
            onFocus={(e) => e.target.select()}
            error={amount && !valid ? 'Số tiền phải lớn hơn 0 và không vượt số đang nợ' : undefined}
          />
          <TextField id="pd-note" label="Ghi chú" placeholder="Trả nợ" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
          <Button type="submit" className="h-11 w-full text-base" disabled={!valid || pay.isPending}>
            <Check data-icon="inline-start" />
            Xác nhận trả
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
