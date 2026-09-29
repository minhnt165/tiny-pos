import { useEffect, useState, type FormEvent } from 'react';
import { Check, Printer, Settings as SettingsIcon } from 'lucide-react';
import { toast } from 'sonner';
import { BANKS, SETTINGS_DEFAULTS, stripDiacritics, type Settings } from '@tiny-pos/shared';
import { useSaveSettings, useSettings } from '@/api/settings';
import { PageHeader } from '@/components/PageHeader';
import { usePrint } from '@/components/receipt/PrintProvider';
import { sampleReceipt } from '@/components/receipt/receipt-data';
import { SelectField } from '@/components/SelectField';
import { SectionTitle, TextField } from '@/components/TextField';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

type TextKey = 'storeName' | 'storeAddress' | 'storePhone' | 'receiptFooter';
const bankOptions = BANKS.map((b) => ({ value: b.bin, label: `${b.shortName} – ${b.name}` }));

export function SettingsPage() {
  const { data } = useSettings();
  const save = useSaveSettings();
  const print = usePrint();
  const [form, setForm] = useState<Settings>(SETTINGS_DEFAULTS);
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setForm((f) => ({ ...f, [k]: v }));
  const text = (k: TextKey, label: string, hint?: string) => (
    <TextField id={`st-${k}`} label={label} hint={hint} value={form[k]} onChange={(e) => set(k, e.target.value)} />
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(form, { onSuccess: () => toast.success('Đã lưu cài đặt'), onError: (err) => toast.error(err.message) });
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Cài đặt"
        description="Thông tin in trên hóa đơn và tài khoản nhận chuyển khoản"
        icon={SettingsIcon}
        actions={
          <Button type="submit" className="h-11 px-5 text-base" disabled={save.isPending}>
            <Check data-icon="inline-start" />
            Lưu
          </Button>
        }
      />
      <Card>
        <CardContent className="space-y-4">
          <SectionTitle>Cửa hàng</SectionTitle>
          {text('storeName', 'Tên cửa hàng')}
          {text('storeAddress', 'Địa chỉ')}
          {text('storePhone', 'Số điện thoại')}
          {text('receiptFooter', 'Lời chào cuối hóa đơn')}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-4">
          <SectionTitle>Chuyển khoản (VietQR)</SectionTitle>
          <SelectField id="st-bank" label="Ngân hàng" value={form.bankBin} onChange={(v) => set('bankBin', v)} options={bankOptions} emptyLabel="Chưa chọn" />
          <TextField
            id="st-account"
            label="Số tài khoản"
            inputMode="numeric"
            value={form.bankAccount}
            onChange={(e) => set('bankAccount', e.target.value.replace(/\D/g, ''))}
          />
          <TextField
            id="st-account-name"
            label="Tên chủ tài khoản"
            hint="Viết hoa, không dấu – giống trên thẻ ngân hàng"
            value={form.bankAccountName}
            onChange={(e) => set('bankAccountName', stripDiacritics(e.target.value).toUpperCase())}
          />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-4">
          <SectionTitle>In hóa đơn</SectionTitle>
          <label className="flex items-center justify-between gap-4">
            <span>
              <span className="block font-medium">Tự in sau khi thanh toán</span>
              <span className="text-sm text-muted-foreground">Tắt nếu chỉ muốn in khi bấm "In lại"</span>
            </span>
            <Switch checked={form.autoPrint} onCheckedChange={(v) => set('autoPrint', v)} />
          </label>
          <Button type="button" variant="outline" className="h-11 text-base" onClick={() => void print(sampleReceipt())}>
            <Printer data-icon="inline-start" />
            In thử
          </Button>
          <p className="text-sm text-muted-foreground">In thử dùng thông tin đã lưu. Máy quầy mở Chrome với --kiosk-printing để in không cần hỏi.</p>
        </CardContent>
      </Card>
    </form>
  );
}
