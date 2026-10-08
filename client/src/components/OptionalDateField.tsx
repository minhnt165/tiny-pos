import { useState } from 'react';
import { CalendarDays, X } from 'lucide-react';
import { vi } from 'react-day-picker/locale';
import { formatDateVn } from '@tiny-pos/shared';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { toDate, toYmd } from '@/components/DateField';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface Props {
  /** "YYYY-MM-DD" hoặc null = chưa chọn. */
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
}

/** Khoảng tháng trên lịch: từ đầu tháng năm ngoái tới cuối tháng 10 năm sau, chọn tháng/năm bằng dropdown. */
const monthRange = () => {
  const now = new Date();
  return {
    startMonth: new Date(now.getFullYear() - 1, now.getMonth(), 1),
    endMonth: new Date(now.getFullYear() + 10, now.getMonth() + 1, 0),
  };
};

/** Ô ngày cho phép để trống (hạn dùng): bấm chọn trên lịch, nút × xóa. Không chặn ngày quá khứ. */
export function OptionalDateField({ value, onChange, placeholder = 'Không hạn', className, 'aria-label': ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const selected = value ? toDate(value) : undefined;
  const { startMonth, endMonth } = monthRange();
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" aria-label={ariaLabel} className={cn('h-11 flex-1 justify-start gap-2 px-3 text-base tabular-nums md:h-10', !value && 'text-muted-foreground')}>
            <CalendarDays data-icon="inline-start" className="max-sm:hidden" />
            {value ? formatDateVn(value) : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            // Bấm lại ngày đang chọn không xóa hạn dùng; xóa bằng nút ×
            required
            captionLayout="dropdown"
            startMonth={startMonth}
            endMonth={endMonth}
            locale={vi}
            weekStartsOn={1}
            selected={selected}
            defaultMonth={selected}
            onSelect={(d) => {
              onChange(toYmd(d));
              setOpen(false);
            }}
            autoFocus
          />
        </PopoverContent>
      </Popover>
      {value && (
        <Button variant="ghost" size="icon-lg" className="size-11 md:size-10" aria-label="Bỏ hạn dùng" onClick={() => onChange(null)}>
          <X />
        </Button>
      )}
    </div>
  );
}
