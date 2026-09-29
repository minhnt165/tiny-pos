import { ChevronLeft, ChevronRight } from 'lucide-react';
import { currentTzOffset, localDate, shiftDate } from '@tiny-pos/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const today = () => localDate(new Date(), currentTzOffset());

/** Chọn ngày: ◀ ô ngày ▶, và nút "Hôm nay" khi đang xem ngày khác. */
export function DayPicker({ value, onChange }: { value: string; onChange: (d: string) => void }) {
  const isToday = value === today();
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon-lg" aria-label="Ngày trước" onClick={() => onChange(shiftDate(value, -1))}>
        <ChevronLeft />
      </Button>
      <Input type="date" value={value} max={today()} onChange={(e) => e.target.value && onChange(e.target.value)} className="h-11 w-44 text-base" />
      <Button variant="outline" size="icon-lg" aria-label="Ngày sau" disabled={isToday} onClick={() => onChange(shiftDate(value, 1))}>
        <ChevronRight />
      </Button>
      {!isToday && (
        <Button variant="ghost" className="h-11" onClick={() => onChange(today())}>
          Hôm nay
        </Button>
      )}
    </div>
  );
}
