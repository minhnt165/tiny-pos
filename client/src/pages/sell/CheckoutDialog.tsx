import { useEffect, useRef, useState, type FormEvent } from 'react';
import QRCode from 'qrcode';
import { Banknote, Check, Landmark, Printer } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { BANKS, formatMoney, parseVnNumber, suggestCash, toOrderItems, vietQrFromSettings, type Cart, type OrderDetail } from '@tiny-pos/shared';
import { useCreateOrder } from '@/api/orders';
import { useSettings } from '@/api/settings';
import { usePrint } from '@/components/receipt/PrintProvider';
import { draftReceipt } from '@/components/receipt/receipt-data';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { groupThousands, moneyChange } from '@/lib/money-input';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  cart: Cart;
  payable: number;
  onClose: () => void;
  onDone: (order: OrderDetail) => void;
}
type Method = 'cash' | 'transfer';

export function CheckoutDialog({ open, cart, payable, onClose, onDone }: Props) {
  const [method, setMethod] = useState<Method>('cash');
  const [given, setGiven] = useState('');
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);
  const givenRef = useRef<HTMLInputElement>(null);
  const { data: settings } = useSettings();
  const create = useCreateOrder();
  const print = usePrint();
  const qrPayload = settings ? vietQrFromSettings(settings, payable) : null;
  const bank = BANKS.find((b) => b.bin === settings?.bankBin);
  // Nhắc theo trường còn thiếu trong Cài đặt (không dựa vào qrUrl để tránh chớp trong lúc QR đang sinh)
  const missing = !settings ? null : !settings.bankBin ? 'Chưa chọn ngân hàng' : !settings.bankAccount ? 'Chưa nhập số tài khoản' : null;

  useEffect(() => {
    if (!open) return;
    setMethod('cash');
    setGiven(groupThousands(String(payable)));
  }, [open, payable]);
  useEffect(() => {
    setQrError(false);
    if (!qrPayload) {
      setQrUrl(null);
      return;
    }
    let alive = true;
    QRCode.toDataURL(qrPayload, { margin: 1, width: 320 })
      .then((u) => alive && setQrUrl(u))
      .catch(() => alive && setQrError(true));
    return () => {
      alive = false;
    };
  }, [qrPayload]);

  const paid = method === 'cash' ? parseVnNumber(given || '0') : payable;
  const change = paid - payable;
  const short = method === 'cash' && (!Number.isFinite(paid) || change < 0);

  const pickCash = (v: number) => {
    setGiven(groupThousands(String(v)));
    givenRef.current?.focus(); // trả focus về ô nhập để Enter xác nhận đơn, không kích hoạt lại nút gợi ý
  };

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    // Khóa khi đang gửi để Enter/bấm hai lần không tạo hai đơn
    if (short || create.isPending) return;
    create.mutate(
      { items: toOrderItems(cart.lines), discount: cart.discount, paymentMethod: method, paid },
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
            <TabsList className="grid h-11 w-full grid-cols-2">
              <TabsTrigger value="cash" className="text-base">
                <Banknote /> Tiền mặt
              </TabsTrigger>
              <TabsTrigger value="transfer" className="text-base">
                <Landmark /> Chuyển khoản
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
          ) : (
            <div className="space-y-3 text-center">
              {qrUrl ? (
                <img src={qrUrl} alt="Mã VietQR" className="mx-auto size-64 rounded-xl border bg-white p-2" />
              ) : missing || qrError ? (
                <p className="rounded-xl bg-muted px-4 py-6 text-muted-foreground">
                  {missing ?? 'Không tạo được mã QR'}.{' '}
                  <Link to="/settings" className="font-medium text-primary underline">
                    Mở Cài đặt
                  </Link>
                </p>
              ) : (
                <div className="mx-auto size-64 animate-pulse rounded-xl bg-muted" />
              )}
              {!missing && settings?.bankAccount && (
                <div className="text-sm">
                  <div className="font-medium">{bank?.shortName ?? settings.bankBin}</div>
                  <div className="font-mono text-base">{settings.bankAccount}</div>
                  <div className="text-muted-foreground">{settings.bankAccountName}</div>
                </div>
              )}
              {qrPayload && (
                <Button type="button" variant="outline" className="h-11 w-full text-base" onClick={() => void print(draftReceipt(cart, qrPayload))}>
                  <Printer data-icon="inline-start" />
                  In tạm tính kèm QR
                </Button>
              )}
            </div>
          )}

          <Button type="submit" className="h-12 w-full text-lg" disabled={short || create.isPending}>
            <Check data-icon="inline-start" />
            {method === 'cash' ? 'Xác nhận (Enter)' : 'Đã nhận tiền'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
