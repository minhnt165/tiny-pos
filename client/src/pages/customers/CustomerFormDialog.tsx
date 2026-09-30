import { useEffect, useState, type FormEvent } from 'react';
import { Check, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { parseVnNumber, type Customer } from '@tiny-pos/shared';
import { useCreateCustomer, useUpdateCustomer } from '@/api/customers';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { moneyChange } from '@/lib/money-input';

interface Props {
  open: boolean;
  customer?: Customer | null;
  onClose: () => void;
  onSaved: (c: Customer) => void;
}

/** Thêm/sửa khách; nợ đầu kỳ (chuyển từ sổ giấy) chỉ nhập khi thêm mới. */
export function CustomerFormDialog({ open, customer, onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [opening, setOpening] = useState('');
  const create = useCreateCustomer();
  const update = useUpdateCustomer();
  const pending = create.isPending || update.isPending;

  useEffect(() => {
    if (!open) return;
    setName(customer?.name ?? '');
    setPhone(customer?.phone ?? '');
    setNote(customer?.note ?? '');
    setOpening('');
  }, [open, customer]);

  const openingDebt = parseVnNumber(opening || '0');
  const openingOk = Number.isFinite(openingDebt) && openingDebt >= 0;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !openingOk || pending) return;
    const opts = {
      onSuccess: (c: Customer) => {
        toast.success(customer ? 'Đã lưu' : `Đã thêm "${c.name}"`);
        onSaved(c);
      },
      onError: (err: Error) => toast.error(err.message),
    };
    if (customer) update.mutate({ id: customer.id, name, phone, note }, opts);
    else create.mutate({ name, phone, note, openingDebt: Math.round(openingDebt) }, opts);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <UserRound className="size-5 text-primary" />
            {customer ? 'Sửa khách hàng' : 'Thêm khách hàng'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <TextField id="cf-name" label="Tên" autoFocus maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
          <TextField id="cf-phone" label="Số điện thoại" inputMode="tel" maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} />
          <TextField id="cf-note" label="Ghi chú" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
          {!customer && (
            <TextField
              id="cf-opening"
              label="Nợ đầu kỳ"
              hint="Số khách đang nợ trong sổ giấy (bỏ trống nếu không nợ)"
              suffix="đ"
              inputMode="numeric"
              placeholder="0"
              value={opening}
              onChange={moneyChange(setOpening)}
              error={openingOk ? undefined : 'Số tiền không hợp lệ'}
            />
          )}
          <Button type="submit" className="h-11 w-full text-base" disabled={!name.trim() || !openingOk || pending}>
            <Check data-icon="inline-start" />
            Lưu
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
