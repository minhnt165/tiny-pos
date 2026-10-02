import { useEffect, useState, type FormEvent } from 'react';
import { Check, Info, Printer, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { BANKS, LABEL_LAYOUT, LABEL_SIZES, SETTINGS_DEFAULTS, stripDiacritics, type LabelSize, type Settings } from '@tiny-pos/shared';
import { openLabelWindow, useSampleLabel } from '@/api/labels';
import { useSaveSettings, useSettings } from '@/api/settings';
import { PageTitle } from '@/components/layout/PageTitle';
import { usePrint } from '@/components/receipt/PrintProvider';
import { sampleReceipt } from '@/components/receipt/receipt-data';
import { SelectField } from '@/components/SelectField';
import { SectionTitle, TextField } from '@/components/TextField';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { APP_VERSION, BUILD_DATE } from '@/lib/version';
import { AppearanceCard } from './AppearanceCard';
import { BackupCard } from './BackupCard';
import { RemoteCard } from './RemoteCard';

type TextKey = 'storeName' | 'storeAddress' | 'storePhone' | 'receiptFooter';
const bankOptions = BANKS.map((b) => ({ value: b.bin, label: `${b.shortName} – ${b.name}` }));
const labelSizeOptions = LABEL_SIZES.map((s) => ({ value: s, label: LABEL_LAYOUT[s].label }));

export function SettingsPage() {
  const { data } = useSettings();
  const save = useSaveSettings();
  const print = usePrint();
  const sample = useSampleLabel();
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
    <form id="settings-form" onSubmit={submit} className="space-y-(--gap)">
      <PageTitle title="Cài đặt" actions={[{ label: 'Lưu', icon: Check, form: 'settings-form', primary: true, disabled: save.isPending }]} />
      <AppearanceCard />
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
      <Card>
        <CardContent className="space-y-4">
          <SectionTitle>Tem mã vạch</SectionTitle>
          <SelectField id="st-label-size" label="Khổ tem" value={form.labelSize} onChange={(v) => set('labelSize', v as LabelSize)} options={labelSizeOptions} />
          <label className="flex items-center justify-between gap-4">
            <span>
              <span className="block font-medium">In giá trên tem</span>
              <span className="text-sm text-muted-foreground">Tắt nếu chỉ cần mã vạch</span>
            </span>
            <Switch checked={form.labelShowPrice} onCheckedChange={(v) => set('labelShowPrice', v)} />
          </label>
          <Button
            type="button"
            variant="outline"
            className="h-11 text-base"
            disabled={sample.isPending}
            onClick={() => sample.mutate(undefined, { onSuccess: openLabelWindow, onError: (e) => toast.error(e.message) })}
          >
            <Tag data-icon="inline-start" />
            In thử 1 tem
          </Button>
          <p className="text-sm text-muted-foreground">
            In thử dùng khổ đã lưu. Tem in ra máy in tem riêng: lần đầu chọn máy tem trong hộp in, các lần sau tự nhớ; hóa đơn vẫn in thẳng ra máy hóa đơn.
          </p>
        </CardContent>
      </Card>
      <BackupCard />
      <RemoteCard />
      <Card>
        <CardContent className="space-y-2">
          <SectionTitle>Thông tin phần mềm</SectionTitle>
          <div className="flex items-center gap-2 text-sm">
            <Info className="size-4 text-muted-foreground" />
            Phiên bản <span className="font-semibold tabular-nums">{APP_VERSION}</span>
            <span className="text-muted-foreground">· build ngày {BUILD_DATE}</span>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
