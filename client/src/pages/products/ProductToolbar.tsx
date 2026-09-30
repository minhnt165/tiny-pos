import { useEffect } from 'react';
import type { Category } from '@tiny-pos/shared';
import { SearchInput } from '@/components/SearchInput';
import { ToolbarSelect } from '@/components/SelectField';
import { Switch } from '@/components/ui/switch';

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

/** Thanh công cụ danh sách sản phẩm: ô tìm (phím "/"), lọc danh mục, công tắc hàng ngừng bán. */
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

  const categoryOptions = categories.map((c) => ({ value: String(c.id), label: `${c.name} (${c.productCount})` }));

  return (
    <>
      <SearchInput id={SEARCH_ID} value={q} onChange={setQ} placeholder="Tìm theo tên hoặc mã vạch…" hotkey="/" />
      <ToolbarSelect value={categoryId} onChange={setCategoryId} options={categoryOptions} emptyLabel="Tất cả danh mục" aria-label="Lọc danh mục" />
      <label className="flex h-11 cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 text-sm font-medium md:h-10">
        <Switch checked={includeInactive} onCheckedChange={setIncludeInactive} />
        Hiện hàng ngừng bán
      </label>
    </>
  );
}
