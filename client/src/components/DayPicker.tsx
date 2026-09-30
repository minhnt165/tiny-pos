import { ChevronLeft, ChevronRight } from 'lucide-react';
import { currentTzOffset, localDate, shiftDate } from '@tiny-pos/shared';
import { DateField } from '@/components/DateField';
import { Button } from '@/components/ui/button';

export const today = () => localDate(new Date(), currentTzOffset());

/** Chọn ngày: ◀ ô ngày ▶, và nút "Hôm nay" khi đang xem ngày khác. */
export function DayPicker({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const isToday = value === today();
  return (
    // Điện thoại: ô ngày giãn theo chỗ trống (không co nhỏ hơn chữ), nút "Hôm nay" xuống hàng riêng
    <div className="flex w-full flex-wrap items-center gap-1 sm:w-auto">
      <Button variant="outline" size="icon-lg" className="size-11 md:size-10" aria-label="Ngày trước" onClick={() => onChange(shiftDate(value, -1))}>
        <ChevronLeft />
      </Button>
      <DateField value={value} max={today()} onChange={onChange} aria-label="Chọn ngày" className="flex-1 sm:w-40 sm:flex-none" />
      <Button variant="outline" size="icon-lg" className="size-11 md:size-10" aria-label="Ngày sau" disabled={isToday} onClick={() => onChange(shiftDate(value, 1))}>
        <ChevronRight />
      </Button>
      {!isToday && (
        <Button variant="ghost" className="h-11 basis-full sm:basis-auto md:h-10" onClick={() => onChange(today())}>
          Hôm nay
        </Button>
      )}
    </div>
  );
}
