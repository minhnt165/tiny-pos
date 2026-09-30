import { useEffect, useState, type FormEvent } from 'react';
import { Banknote, Check, CircleCheck, HandCoins, Landmark, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney, parseVnNumber, type CollectMethod, type Customer, type CustomerPaymentResult } from '@tiny-pos/shared';
import { useCollectDebt } from '@/api/customers';
import { useSettings } from '@/api/settings';
import { TextField } from '@/components/TextField';
import { TransferQr } from '@/components/TransferQr';
import { usePrint } from '@/components/receipt/PrintProvider';
import { debtReceiptFromPayment } from '@/components/receipt/receipt-data';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { groupThousands, moneyChange } from '@/lib/money-input';

/** Thu nợ: mặc định thu hết; chuyển khoản hiện QR đúng số tiền; lưu xong cho in biên nhận. */
export function CollectDebtDialog({ customer, open, onClose }: { customer: Customer; open: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<CollectMethod>('cash');
  const [note, setNote] = useState('');
  const [result, setResult] = useState<CustomerPaymentResult | null>(null);
  const collect = useCollectDebt();
  const print = usePrint();
  const { data: settings } = useSettings();

  // Chỉ đặt lại khi mở hộp: thu xong nợ khách đổi (refetch) nhưng không được xóa màn kết quả
  useEffect(() => {
    if (!open) return;
    setAmount(groupThousands(String(Math.max(0, customer.debt))));
    setMethod('cash');
    setNote('');
    setResult(null);
  }, [open]);

  const n = parseVnNumber(amount || 'x');
  const valid = Number.isFinite(n) && n > 0 && n <= customer.debt;
  const printReceipt = (r: CustomerPaymentResult) => void print(debtReceiptFromPayment(r));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid || collect.isPending) return;
    collect.mutate(
      { id: customer.id, amount: Math.round(n), method, note },
      {
        onSuccess: (r) => {
          toast.success(`Đã thu ${formatMoney(n)} của ${customer.name}`);
          setResult(r);
          if (settings?.autoPrint ?? true) printReceipt(r);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !collect.isPending && onClose()}>
      <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <HandCoins className="size-5 text-primary" />
            Thu nợ {customer.name}
          </DialogTitle>
          <DialogDescription className="text-base">
            {result ? 'Đã ghi vào sổ nợ' : `Đang nợ ${formatMoney(customer.debt)}`}
          </DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 dark:bg-emerald-500/10">
              <CircleCheck className="size-7 shrink-0 text-emerald-600" />
              <div>
                <div className="font-heading text-2xl font-semibold tabular-nums">Đã thu {formatMoney(-result.transaction.amount)}</div>
                <div className="text-muted-foreground">
                  {result.transaction.method === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt'} · còn nợ {formatMoney(result.transaction.balanceAfter)}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-11 text-base" onClick={() => printReceipt(result)}>
                <Printer data-icon="inline-start" />
                In biên nhận
              </Button>
              <Button className="h-11 text-base" onClick={onClose}>
                Xong
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <TextField
              id="cd-amount"
              label="Số tiền thu"
              suffix="đ"
              inputMode="numeric"
              autoFocus
              value={amount}
              onChange={moneyChange(setAmount)}
              onFocus={(e) => e.target.select()}
              error={amount && !valid ? 'Số tiền phải lớn hơn 0 và không vượt số đang nợ' : undefined}
            />
            <Tabs value={method} onValueChange={(v) => setMethod(v as CollectMethod)}>
              <TabsList className="grid h-11 w-full grid-cols-2">
                <TabsTrigger value="cash" className="text-base">
                  <Banknote /> Tiền mặt
                </TabsTrigger>
                <TabsTrigger value="transfer" className="text-base">
                  <Landmark /> Chuyển khoản
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {method === 'transfer' && valid && (
              <div className="space-y-3 text-center">
                <TransferQr amount={Math.round(n)} />
              </div>
            )}
            <TextField id="cd-note" label="Ghi chú" placeholder="Thu nợ" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
            <Button type="submit" className="h-11 w-full text-base" disabled={!valid || collect.isPending}>
              <Check data-icon="inline-start" />
              Xác nhận thu
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
