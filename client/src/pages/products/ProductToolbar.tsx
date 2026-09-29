import { useEffect } from 'react';
import { Search } from 'lucide-react';
import type { Category } from '@tiny-pos/shared';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Kbd } from '@/components/ui/kbd';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface Props {
  q: string;
  setQ: (v: string) => void;
  categoryId: string;
  setCategoryId: (v: string) => void;
  includeInactive: boolean;
  setIncludeInactive: (v: boolean) => void;
  categories: Category[];
}

const SEARCH_ID = 'product-search';

/** Ô tìm (phím "/" để nhảy vào), công tắc hàng ngừng bán, chip lọc danh mục. */
export function ProductToolbar({ q, setQ, categoryId, setCategoryId, includeInactive, setIncludeInactive, categories }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !t.closest('input, textarea, [contenteditable]')) {
        e.preventDefault();
        document.getElementById(SEARCH_ID)?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const chip = (value: string, label: string, count?: number) => {
    const active = categoryId === value;
    return (
      <button
        key={value}
        type="button"
        onClick={() => setCategoryId(value)}
        className={cn(
          'flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors',
          active ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        {label}
        {count !== undefined && (
          <span className={cn('rounded-full px-1.5 text-xs', active ? 'bg-white/20' : 'bg-muted')}>{count}</span>
        )}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-3 border-b px-4 py-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <InputGroup className="h-11 flex-1 bg-card">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput id={SEARCH_ID} className="h-11 text-base" placeholder="Tìm theo tên hoặc mã vạch…" value={q} onChange={(e) => setQ(e.target.value)} />
          <InputGroupAddon align="inline-end" className="hidden md:flex">
            <Kbd>/</Kbd>
          </InputGroupAddon>
        </InputGroup>
        <label className="flex h-11 cursor-pointer items-center gap-3 rounded-lg border bg-card px-3.5 text-sm font-medium">
          <Switch checked={includeInactive} onCheckedChange={setIncludeInactive} />
          Hiện hàng ngừng bán
        </label>
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {chip('', 'Tất cả')}
        {categories.map((c) => chip(String(c.id), c.name, c.productCount))}
      </div>
    </div>
  );
}
