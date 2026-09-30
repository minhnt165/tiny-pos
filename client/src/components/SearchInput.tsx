import { Search } from 'lucide-react';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Kbd } from '@/components/ui/kbd';
import { cn } from '@/lib/utils';

interface Props {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  /** Phím tắt hiện ở cuối ô (máy tính), ví dụ "/". */
  hotkey?: string;
  className?: string;
}

/** Ô tìm trong thanh công cụ danh sách: cao 44px trên điện thoại, 40px trên máy tính. */
export function SearchInput({ id, value, onChange, placeholder, hotkey, className }: Props) {
  return (
    <InputGroup className={cn('h-11 min-w-0 flex-1 basis-60 md:h-10', className)}>
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput id={id} type="search" className="text-base" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      {hotkey && (
        <InputGroupAddon align="inline-end" className="hidden md:flex">
          <Kbd>{hotkey}</Kbd>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}
