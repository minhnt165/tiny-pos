import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Banknote, Check, Landmark, NotebookPen, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney, parseVnNumber, suggestCash, toOrderItems, vietQrFromSettings, type Cart, type Customer, type OrderDetail } from '@tiny-pos/shared';
import { useCreateOrder } from '@/api/orders';
import { useSettings } from '@/api/settings';
import { TransferQr } from '@/components/TransferQr';
import { usePrint } from '@/components/receipt/PrintProvider';
import { draftReceipt } from '@/components/receipt/receipt-data';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { groupThousands, moneyChange } from '@/lib/money-input';
import { cn } from '@/lib/utils';
import { DebtPanel } from './DebtPanel';

interface Props {
  open: boolean;
  cart: Cart;
  payable: number;
  onClose: () => void;
  onDone: (order: OrderDetail) => void;
}
type Method = 'cash' | 'transfer' | 'debt';

export function CheckoutDialog({ open, cart, payable, onClose, onDone }: Props) {
  const [method, setMethod] = useState<Method>('cash');
  const [given, setGiven] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [prepaid, setPrepaid] = useState('');
  const givenRef = useRef<HTMLInputElement>(null);
  const { data: settings } = useSettings();
  const create = useCreateOrder();
  const print = usePrint();
  const qrPayload = settings ? vietQrFromSettings(settings, payable) : null;

  useEffect(() => {
    if (!open) return;
    setMethod('cash');
    setGiven(groupThousands(String(payable)));
    setCustomer(null);
    setPrepaid('');
  }, [open, payable]);

  const paid = method === 'cash' ? parseVnNumber(given || '0') : method === 'debt' ? parseVnNumber(prepaid || '0') : payable;
  const change = paid - payable;
  const short = method === 'cash' && (!Number.isFinite(paid) || change < 0);
  // Ghi nợ: phải chọn khách và còn thiếu ít nhất 1đ (trả đủ thì là đơn tiền mặt)
  const debtInvalid = method === 'debt' && (customer === null || !Number.isFinite(paid) || paid < 0 || paid >= payable);

  const pickCash = (v: number) => {
    setGiven(groupThousands(String(v)));
    givenRef.current?.focus(); // trả focus về ô nhập để Enter xác nhận đơn, không kích hoạt lại nút gợi ý
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    // Khóa khi đang gửi để Enter/bấm hai lần không tạo hai đơn
    if (short || debtInvalid || create.isPending) return;
    create.mutate(
      {
        items: toOrderItems(cart.lines),
        discount: cart.discount,
        paymentMethod: method,
        paid,
        customerId: method === 'debt' ? (customer?.id ?? null) : null,
      },
      { onSuccess: onDone, onError: (err) => toast.error(err.message) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !create.isPending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Thanh toán</DialogTitle>
          <DialogDescription className="text-base">
            Phải trả <span className="font-heading text-2xl font-semibold text-foreground tabular-nums">{formatMoney(payable)}</span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Tabs value={method} onValueChange={(v) => setMethod(v as Method)}>
            <TabsList className="grid h-11 w-full grid-cols-3">
              <TabsTrigger value="cash" className="text-sm sm:text-base max-sm:[&_svg]:hidden">
                <Banknote /> Tiền mặt
              </TabsTrigger>
              <TabsTrigger value="transfer" className="text-sm sm:text-base max-sm:[&_svg]:hidden">
                <Landmark /> Chuyển khoản
              </TabsTrigger>
              <TabsTrigger value="debt" className="text-sm sm:text-base max-sm:[&_svg]:hidden">
                <NotebookPen /> Ghi nợ
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {method === 'cash' ? (
            <div className="space-y-3">
              <label htmlFor="co-given" className="text-sm font-medium">
                Khách đưa
              </label>
              <Input
                id="co-given"
                ref={givenRef}
                autoFocus
                inputMode="numeric"
                value={given}
                onChange={moneyChange(setGiven)}
                onFocus={(e) => e.target.select()}
                className="h-14 text-right font-heading text-3xl! font-semibold tabular-nums"
              />
              <div className="grid grid-cols-4 gap-2">
                {suggestCash(payable).map((v) => (
                  <Button key={v} type="button" variant="outline" className="h-11 tabular-nums" onClick={() => pickCash(v)}>
                    {v === payable ? 'Đủ tiền' : formatMoney(v)}
                  </Button>
                ))}
              </div>
              <div className={cn('flex items-baseline justify-between rounded-xl px-4 py-3', short ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary')}>
                <span className="font-medium">{short ? 'Còn thiếu' : 'Tiền thối'}</span>
                <span className="font-heading text-3xl font-semibold tabular-nums">{formatMoney(Math.abs(Number.isFinite(change) ? change : 0))}</span>
              </div>
            </div>
          ) : method === 'transfer' ? (
            <div className="space-y-3 text-center">
              <TransferQr amount={payable} />
              {qrPayload && (
                <Button type="button" variant="outline" className="h-11 w-full text-base" onClick={() => void print(draftReceipt(cart, qrPayload))}>
                  <Printer data-icon="inline-start" />
                  In tạm tính kèm QR
                </Button>
              )}
            </div>
          ) : (
            <DebtPanel payable={payable} customer={customer} onCustomer={setCustomer} prepaid={prepaid} onPrepaid={setPrepaid} paid={paid} />
          )}

          <Button type="submit" className="h-12 w-full text-lg" disabled={short || debtInvalid || create.isPending}>
            <Check data-icon="inline-start" />
            {method === 'cash' ? 'Xác nhận (Enter)' : method === 'debt' ? 'Ghi nợ (Enter)' : 'Đã nhận tiền'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
