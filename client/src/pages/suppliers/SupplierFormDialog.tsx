import { useEffect, useState, type FormEvent } from 'react';
import { Check, Truck } from 'lucide-react';
import { toast } from 'sonner';
import type { Supplier } from '@tiny-pos/shared';
import { useSaveSupplier } from '@/api/suppliers';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Props {
  open: boolean;
  supplier?: Supplier | null;
  onClose: () => void;
  onSaved: (s: Supplier) => void;
}

export function SupplierFormDialog({ open, supplier, onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const save = useSaveSupplier();

  useEffect(() => {
    if (!open) return;
    setName(supplier?.name ?? '');
    setPhone(supplier?.phone ?? '');
    setNote(supplier?.note ?? '');
  }, [open, supplier]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || save.isPending) return;
    save.mutate(
      { id: supplier?.id, name, phone, note },
      {
        onSuccess: (s) => {
          toast.success(supplier ? 'Đã lưu' : `Đã thêm "${s.name}"`);
          onSaved(s);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Truck className="size-5 text-primary" />
            {supplier ? 'Sửa nhà cung cấp' : 'Thêm nhà cung cấp'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <TextField id="sf-name" label="Tên" autoFocus maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
          <TextField id="sf-phone" label="Số điện thoại" inputMode="tel" maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} />
          <TextField id="sf-note" label="Ghi chú" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
          <Button type="submit" className="h-11 w-full text-base" disabled={!name.trim() || save.isPending}>
            <Check data-icon="inline-start" />
            Lưu
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
