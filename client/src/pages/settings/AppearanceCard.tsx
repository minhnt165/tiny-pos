import { Check, RotateCcw } from 'lucide-react';
import { useTheme } from 'next-themes';
import { SectionTitle } from '@/components/TextField';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { ACCENTS, DENSITIES, FONT_SIZES, RADII, useUiPrefs } from '@/lib/ui-prefs';
import { cn } from '@/lib/utils';

const MODES = [
  { value: 'light', label: 'Sáng' },
  { value: 'dark', label: 'Tối' },
  { value: 'system', label: 'Theo máy' },
] as const;

/** Nhóm nút chọn một (segmented). */
function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="font-medium">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1 rounded-lg border bg-muted p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            onClick={() => onChange(o.value)}
            className={cn(
              'h-11 min-w-16 flex-1 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors md:h-9',
              o.value === value ? 'bg-card text-foreground shadow-sm ring-1 ring-border' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Tùy chỉnh giao diện theo máy: chọn là áp dụng ngay, không cần bấm Lưu. */
export function AppearanceCard() {
  const { prefs, update, reset } = useUiPrefs();
  const { theme = 'system', setTheme } = useTheme();
  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div>
            <SectionTitle>Giao diện (trên máy này)</SectionTitle>
            <p className="-mt-2 text-sm text-muted-foreground">Chỉ áp dụng cho máy/trình duyệt này. Chọn là thấy ngay.</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            className="h-11 shrink-0 self-start md:h-9"
            onClick={() => {
              reset();
              setTheme('system');
            }}
          >
            <RotateCcw data-icon="inline-start" />
            Khôi phục mặc định
          </Button>
        </div>
        <Segmented label="Chế độ" options={MODES} value={theme as (typeof MODES)[number]['value']} onChange={setTheme} />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-medium">Màu nhấn</span>
          <div role="radiogroup" aria-label="Màu nhấn" className="flex flex-wrap gap-2">
            {ACCENTS.map((a) => (
              // Chấm màu tô đúng màu của lựa chọn (không theo màu nhấn đang dùng) nên dùng style
              <button
                key={a.value}
                type="button"
                role="radio"
                aria-checked={a.value === prefs.accent}
                aria-label={a.label}
                title={a.label}
                onClick={() => update({ accent: a.value })}
                className="grid size-11 place-items-center rounded-full ring-offset-2 ring-offset-card transition-shadow aria-checked:ring-2 aria-checked:ring-foreground md:size-9"
                style={{ backgroundColor: a.swatch }}
              >
                {a.value === prefs.accent && <Check className="size-4 text-white" />}
              </button>
            ))}
          </div>
        </div>
        <Segmented label="Cỡ chữ" options={FONT_SIZES} value={prefs.font} onChange={(font) => update({ font })} />
        <Segmented label="Mật độ" options={DENSITIES} value={prefs.density} onChange={(density) => update({ density })} />
        <Segmented label="Bo góc" options={RADII} value={prefs.radius} onChange={(radius) => update({ radius })} />
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block font-medium">Mở phần mềm vào thẳng cửa sổ quầy</span>
            <span className="block text-sm text-muted-foreground">Bán hàng toàn màn hình, không menu. Bấm Quản lý trên cùng để vào các trang khác.</span>
          </span>
          <Switch checked={prefs.startPos} onCheckedChange={(startPos) => update({ startPos })} />
        </label>
      </CardContent>
    </Card>
  );
}
