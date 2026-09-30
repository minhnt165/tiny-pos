import { useRef, useState } from 'react';
import { Check, ChevronsUpDown, Plus, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney, stripDiacritics, type Customer } from '@tiny-pos/shared';
import { useCreateCustomer, useCustomers } from '@/api/customers';
import { Button } from '@/components/ui/button';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface Props {
  value: Customer | null;
  onChange: (c: Customer) => void;
  /** Gọi sau khi chọn xong và popover đã đóng (để chuyển con trỏ sang ô kế tiếp). */
  onPicked?: () => void;
}

/** So khớp không phân biệt hoa/thường và dấu tiếng Việt ('chi lan' khớp 'Chị Lan'). */
const fold = (s: string) => stripDiacritics(s).toLowerCase();

/** Ô chọn khách có tìm; gõ tên chưa có thì "+ Thêm khách" tạo ngay (chỉ tên). */
export function CustomerPicker({ value, onChange, onPicked }: Props) {
  const { data } = useCustomers();
  const customers = data?.customers ?? [];
  const create = useCreateCustomer();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const picked = useRef(false);
  const name = search.trim();
  // So khớp bỏ hoa/thường và dấu để không tạo trùng "chi lan" với "Chị Lan"
  const exists = customers.some((c) => fold(c.name) === fold(name));

  const pick = (c: Customer) => {
    picked.current = true;
    onChange(c);
    setOpen(false);
    setSearch('');
  };
  const add = () => {
    if (!name || create.isPending) return;
    create.mutate({ name }, { onSuccess: pick, onError: (e) => toast.error(e.message) });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id="co-customer" type="button" variant="outline" role="combobox" aria-expanded={open} autoFocus className="h-12 w-full justify-between text-base">
          <span className="flex min-w-0 items-center gap-2">
            <UserRound className="shrink-0 text-primary" />
            <span className="truncate">{value ? value.name : 'Chọn khách…'}</span>
          </span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
        // Popover nằm trong Dialog: Radix Dialog chặn cuộn chuột/chạm ngoài hộp, nên phải giữ sự kiện wheel và touchmove lại để cuộn được danh sách
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onCloseAutoFocus={(e) => {
          if (!picked.current) return;
          picked.current = false;
          e.preventDefault();
          onPicked?.();
        }}
      >
        <Command filter={(value, search) => (fold(value).includes(fold(search)) ? 1 : 0)}>
          <CommandInput placeholder="Tên hoặc số điện thoại…" className="h-11 text-base" value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandGroup>
              {customers.map((c) => (
                <CommandItem key={c.id} value={`${c.name} ${c.phone ?? ''} #${c.id}`} className="py-2 text-base" onSelect={() => pick(c)}>
                  <Check className={cn(value?.id === c.id ? 'opacity-100' : 'opacity-0')} />
                  <span className="flex-1 truncate">
                    {c.name}
                    {c.phone && <span className="text-muted-foreground"> · {c.phone}</span>}
                  </span>
                  {c.debt > 0 && <span className="text-sm text-destructive tabular-nums">nợ {formatMoney(c.debt)}</span>}
                </CommandItem>
              ))}
              {name && !exists && (
                <CommandItem forceMount value={`#add ${name}`} className="py-2 text-base" disabled={create.isPending} onSelect={add}>
                  <Plus />
                  Thêm khách "{name}"
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
