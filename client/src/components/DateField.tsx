import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { vi } from 'react-day-picker/locale';
import { formatDateVn } from '@tiny-pos/shared';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface Props {
  /** "YYYY-MM-DD" */
  value: string;
  onChange: (value: string) => void;
  /** Ngày muộn nhất được chọn, "YYYY-MM-DD". */
  max?: string;
  id?: string;
  className?: string;
  'aria-label'?: string;
}

export const toDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
};
export const toYmd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Ô ngày kiểu Việt Nam (dd/mm/yyyy, tuần bắt đầu Thứ Hai) thay cho <input type="date"> hiện theo locale máy. */
export function DateField({ value, onChange, max, id, className, 'aria-label': ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const selected = toDate(value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} variant="outline" aria-label={ariaLabel} className={cn('h-11 justify-start gap-2 px-3 text-base tabular-nums md:h-10', className)}>
          {/* Điện thoại hẹp: bỏ icon để ◀ ngày ▶ vừa một hàng kể cả chữ Rất lớn */}
          <CalendarDays data-icon="inline-start" className="max-sm:hidden" />
          {formatDateVn(value)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={vi}
          weekStartsOn={1}
          selected={selected}
          defaultMonth={selected}
          disabled={max ? { after: toDate(max) } : undefined}
          onSelect={(d) => {
            if (!d) return;
            onChange(toYmd(d));
            setOpen(false);
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
