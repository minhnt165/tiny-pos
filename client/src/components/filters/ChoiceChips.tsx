import { cn } from '@/lib/utils';

interface Option<T extends string> {
  value: T;
  label: string;
}

const chip = (on: boolean) =>
  cn(
    'h-11 rounded-md border px-3 text-sm font-medium transition-colors md:h-9',
    on ? 'border-primary bg-accent text-accent-foreground' : 'bg-card text-muted-foreground hover:text-foreground',
  );

/** Chọn một (bấm lại lựa chọn đang bật để bỏ). */
export function ChoiceChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly Option<T>[];
  value: T | undefined;
  onChange: (v: T | undefined) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={chip(o.value === value)}
          onClick={() => onChange(o.value === value ? undefined : o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Chọn nhiều; không chọn gì = không lọc. */
export function MultiChoiceChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly Option<T>[];
  value: T[];
  onChange: (v: T[]) => void;
}) {
  const toggle = (v: T) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="checkbox"
          aria-checked={value.includes(o.value)}
          className={chip(value.includes(o.value))}
          onClick={() => toggle(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
