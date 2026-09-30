import { useEffect, useRef } from 'react';
import { formatMoney, type Customer } from '@tiny-pos/shared';
import { Input } from '@/components/ui/input';
import { moneyChange } from '@/lib/money-input';
import { CustomerPicker } from '../customers/CustomerPicker';

interface Props {
  payable: number;
  customer: Customer | null;
  onCustomer: (c: Customer) => void;
  prepaid: string;
  onPrepaid: (v: string) => void;
  /** Số trả trước đã parse; NaN khi ô gõ sai. */
  paid: number;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/** Tab Ghi nợ: chọn khách, khách trả trước (tiền mặt), nợ cũ → tổng nợ sau đơn. */
export function DebtPanel({ payable, customer, onCustomer, prepaid, onPrepaid, paid }: Props) {
  const prepaidRef = useRef<HTMLInputElement>(null);
  const valid = Number.isFinite(paid) && paid >= 0 && paid < payable;
  const owed = valid ? payable - paid : 0;
  const before = customer?.debt ?? 0;

  // Bấm chuột vào tab làm trình duyệt trả focus về tab sau khi autoFocus chạy, nên focus lại nút chọn khách sau đó
  useEffect(() => {
    const t = setTimeout(() => document.getElementById('co-customer')?.focus(), 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label htmlFor="co-customer" className="text-sm font-medium">
          Khách
        </label>
        <CustomerPicker value={customer} onChange={onCustomer} onPicked={() => prepaidRef.current?.focus()} />
        {customer === null && <p className="text-sm text-muted-foreground">Chọn khách để ghi nợ</p>}
      </div>
      <div className="space-y-2">
        <label htmlFor="co-prepaid" className="text-sm font-medium">
          Khách trả trước (tiền mặt)
        </label>
        <Input
          id="co-prepaid"
          ref={prepaidRef}
          inputMode="numeric"
          placeholder="0"
          value={prepaid}
          onChange={moneyChange(onPrepaid)}
          onFocus={(e) => e.target.select()}
          aria-invalid={!valid}
          className="h-12 text-right font-heading text-2xl! font-semibold tabular-nums"
        />
        {!valid && <p className="text-sm text-destructive">Trả trước phải ít hơn số phải trả (trả đủ thì chọn Tiền mặt)</p>}
      </div>
      {customer && (
        <div className="space-y-1 rounded-xl bg-muted/60 px-4 py-3">
          <Row label={before < 0 ? 'Tiệm đang nợ khách' : 'Nợ cũ'} value={formatMoney(Math.abs(before))} />
          <Row label="Ghi nợ đơn này" value={`+${formatMoney(owed)}`} />
          <div className="flex items-baseline justify-between border-t pt-2 text-destructive">
            <span className="font-medium">{before + owed < 0 ? 'Tiệm còn nợ khách' : 'Tổng nợ sau đơn'}</span>
            <span className="font-heading text-2xl font-semibold tabular-nums">{formatMoney(Math.abs(before + owed))}</span>
          </div>
        </div>
      )}
    </div>
  );
}
