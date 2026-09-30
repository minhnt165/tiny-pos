import { useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { vi } from 'react-day-picker/locale';
import { DATE_PRESETS, datePresetRange, detectPreset, formatRangeVn, validRange, type DatePreset } from '@tiny-pos/shared';
import { Calendar } from '@/components/ui/calendar';
import { ChoiceChips } from './ChoiceChips';

export const PRESET_LABELS: Record<DatePreset, string> = {
  today: 'Hôm nay',
  yesterday: 'Hôm qua',
  last7: '7 ngày qua',
  thisMonth: 'Tháng này',
  lastMonth: 'Tháng trước',
};

/** Nhãn chip: tên mốc nếu trùng, không thì "01/09 – 15/09". */
export function rangeChipLabel(from: string, to: string, today: string): string {
  const p = detectPreset(from, to, today);
  return p ? PRESET_LABELS[p] : formatRangeVn(from, to, today);
}

const toDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
};
const toYmd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

type Choice = DatePreset | 'custom';
const OPTIONS: { value: Choice; label: string }[] = [...DATE_PRESETS.map((p) => ({ value: p, label: PRESET_LABELS[p] })), { value: 'custom', label: 'Tùy chọn…' }];

/** Mốc thời gian có sẵn + "Tùy chọn" mở lịch chọn khoảng (tối đa 366 ngày, không quá hôm nay). */
export function DateRangeFilter({ from, to, today, onChange }: { from: string; to: string; today: string; onChange: (r: { from: string; to: string }) => void }) {
  const preset = detectPreset(from, to, today);
  const [custom, setCustom] = useState(preset === null);
  const [draft, setDraft] = useState<DateRange | undefined>({ from: toDate(from), to: toDate(to) });
  return (
    <div className="space-y-2">
      <ChoiceChips<Choice>
        label="Thời gian"
        options={OPTIONS}
        value={custom ? 'custom' : (preset ?? undefined)}
        onChange={(v) => {
          if (!v) return;
          if (v === 'custom') return setCustom(true);
          setCustom(false);
          onChange(datePresetRange(v, today));
        }}
      />
      {custom && (
        <Calendar
          mode="range"
          locale={vi}
          weekStartsOn={1}
          selected={draft}
          defaultMonth={toDate(from)}
          disabled={{ after: toDate(today) }}
          onSelect={(r) => {
            setDraft(r);
            if (r?.from && r.to && validRange(toYmd(r.from), toYmd(r.to))) onChange({ from: toYmd(r.from), to: toYmd(r.to) });
          }}
          className="rounded-md border"
        />
      )}
    </div>
  );
}
