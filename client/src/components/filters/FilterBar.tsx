import { useEffect, useState, type ReactNode } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { SearchInput } from '@/components/SearchInput';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';

export interface FilterChip {
  key: string;
  label: string;
  /** Không có = chip chỉ để xem (ví dụ thời gian đang là mặc định). */
  onRemove?: () => void;
}

interface Props {
  search: { value: string; onChange: (v: string) => void; placeholder: string; id?: string; hotkey?: string };
  /** Số lọc khác mặc định, hiện trên nút. */
  activeCount: number;
  chips: FilterChip[];
  onClearAll: () => void;
  /** Nhãn nút đóng bảng lọc trên điện thoại, ví dụ "Xem 12 hóa đơn". */
  resultLabel: string;
  children: ReactNode;
}

/** Nhóm trong bảng lọc: tiêu đề nhỏ + nội dung. */
export function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

/** Ô tìm gõ nháp, ghi ra ngoài sau 300ms ngừng gõ; đổi từ ngoài (Xóa lọc) thì cập nhật lại. */
function DebouncedSearch({ value, onChange, ...rest }: Props['search']) {
  const [text, setText] = useState(value);
  // Giá trị URL đã trim: chỉ nhận khi thật sự khác, để không nuốt dấu cách người dùng vừa gõ ("banh " → "banh mi")
  useEffect(() => setText((t) => (t.trim() === value ? t : value)), [value]);
  useEffect(() => {
    if (text === value) return;
    const t = setTimeout(() => onChange(text), 300);
    return () => clearTimeout(t);
  }, [text, value, onChange]);
  return <SearchInput {...rest} value={text} onChange={setText} />;
}

/** Thanh lọc trong toolbar ListPanel: ô tìm, nút "Bộ lọc · n" (Popover máy tính / Sheet điện thoại), hàng chip đang bật. */
export function FilterBar({ search, activeCount, chips, onClearAll, resultLabel, children }: Props) {
  const mobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const trigger = (
    <Button variant={activeCount ? 'default' : 'outline'} className="h-11 px-3 md:h-10" aria-label={`Bộ lọc${activeCount ? `, ${activeCount} đang bật` : ''}`}>
      <SlidersHorizontal data-icon="inline-start" />
      Bộ lọc{activeCount ? ` · ${activeCount}` : ''}
    </Button>
  );
  const body = <div className="space-y-4">{children}</div>;
  return (
    <>
      <DebouncedSearch {...search} />
      {mobile ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>{trigger}</SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Bộ lọc</SheetTitle>
            </SheetHeader>
            <div className="px-4">{body}</div>
            <SheetFooter className="flex-row gap-2">
              <Button variant="outline" className="h-11 flex-1" onClick={onClearAll}>
                Xóa lọc
              </Button>
              <Button className="h-11 flex-1" onClick={() => setOpen(false)}>
                {resultLabel}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent align="end" className="w-[22rem] max-w-[calc(100vw-2rem)]">
            {body}
          </PopoverContent>
        </Popover>
      )}
      {chips.length > 0 && (
        <div className="flex basis-full flex-wrap items-center gap-1.5 pt-1">
          {chips.map((c) =>
            c.onRemove ? (
              <span key={c.key} className="flex h-8 items-center gap-1 rounded-full bg-accent pr-1 pl-3 text-sm text-accent-foreground">
                {c.label}
                <button type="button" aria-label={`Bỏ lọc ${c.label}`} className="-my-1.5 -mr-1 grid size-11 place-items-center rounded-full hover:bg-background/60 md:m-0 md:size-6" onClick={c.onRemove}>
                  <X className="size-3.5" />
                </button>
              </span>
            ) : (
              <span key={c.key} className="flex h-8 items-center rounded-full bg-muted px-3 text-sm text-muted-foreground">
                {c.label}
              </span>
            ),
          )}
          {activeCount > 0 && (
            <Button variant="link" className="h-8 px-1 text-sm" onClick={onClearAll}>
              Xóa lọc
            </Button>
          )}
        </div>
      )}
    </>
  );
}
