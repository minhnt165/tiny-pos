import { useState } from 'react';
import { Check, ChevronsUpDown, Plus, Truck } from 'lucide-react';
import { foldText, formatMoney } from '@tiny-pos/shared';
import { useSuppliers } from '@/api/suppliers';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { SupplierFormDialog } from '../suppliers/SupplierFormDialog';

interface Props {
  value: number | null;
  onChange: (id: number | null) => void;
  /** Có mục "Không ghi nhà cung cấp" (phiếu nhập); phiếu trả NCC thì bắt buộc chọn. */
  allowNone?: boolean;
}

/** Ô chọn NCC có tìm; có mục "Không ghi nhà cung cấp" và "+ Thêm nhà cung cấp". */
export function SupplierPicker({ value, onChange, allowNone = true }: Props) {
  const { data: suppliers = [] } = useSuppliers();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const current = suppliers.find((s) => s.id === value);
  const pick = (id: number | null) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="h-11 w-full justify-between text-base sm:w-96">
            <span className="flex min-w-0 items-center gap-2">
              <Truck className="shrink-0 text-primary" />
              <span className="truncate">{current ? current.name : allowNone ? 'Không ghi nhà cung cấp' : 'Chọn nhà cung cấp'}</span>
            </span>
            <ChevronsUpDown className="opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command filter={(value, search) => (foldText(value).includes(foldText(search)) ? 1 : 0)}>
            <CommandInput placeholder="Tìm nhà cung cấp…" className="h-11 text-base" />
            <CommandList>
              <CommandEmpty>Không tìm thấy</CommandEmpty>
              <CommandGroup>
                {allowNone && (
                  <CommandItem value="Không ghi nhà cung cấp #none" className="py-2 text-base" onSelect={() => pick(null)}>
                    <Check className={cn(value === null ? 'opacity-100' : 'opacity-0')} />
                    Không ghi nhà cung cấp
                  </CommandItem>
                )}
                {suppliers.map((s) => (
                  <CommandItem key={s.id} value={`${s.name} ${s.phone ?? ''} #${s.id}`} className="py-2 text-base" onSelect={() => pick(s.id)}>
                    <Check className={cn(value === s.id ? 'opacity-100' : 'opacity-0')} />
                    <span className="flex-1 truncate">{s.name}</span>
                    {s.debt > 0 && <span className="text-sm text-destructive tabular-nums">nợ {formatMoney(s.debt)}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  value="Thêm nhà cung cấp #add"
                  className="py-2 text-base"
                  onSelect={() => {
                    setOpen(false);
                    setAdding(true);
                  }}
                >
                  <Plus />
                  Thêm nhà cung cấp
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <SupplierFormDialog
        open={adding}
        onClose={() => setAdding(false)}
        onSaved={(s) => {
          setAdding(false);
          onChange(s.id);
        }}
      />
    </>
  );
}
