import { useState } from 'react';
import { ArrowDown, ArrowUp, FolderOpen, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Category } from '@tiny-pos/shared';
import { useCategories, useDeleteCategory, useSaveCategory } from '@/api/categories';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function CategoriesPage() {
  const { data: categories = [], isLoading } = useCategories();
  const save = useSaveCategory();
  const remove = useDeleteCategory();
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);

  const onError = (e: Error) => toast.error(e.message);

  const add = () => {
    if (!newName.trim()) return;
    save.mutate({ name: newName, sortOrder: categories.length }, { onSuccess: () => setNewName(''), onError });
  };

  const rename = () => {
    if (!editing) return;
    const c = categories.find((x) => x.id === editing.id);
    if (!c || c.name === editing.name.trim()) return setEditing(null);
    save.mutate({ id: c.id, name: editing.name, sortOrder: c.sortOrder }, { onSuccess: () => setEditing(null), onError });
  };

  /** Đổi chỗ với hàng kề rồi gán lại sortOrder = vị trí cho các hàng bị lệch. */
  const move = (index: number, dir: -1 | 1) => {
    const next = [...categories];
    const [item] = next.splice(index, 1);
    next.splice(index + dir, 0, item!);
    next.forEach((c, i) => {
      if (c.sortOrder !== i) save.mutate({ id: c.id, name: c.name, sortOrder: i }, { onError });
    });
  };

  const del = (c: Category) => {
    if (!confirm(`Xóa danh mục "${c.name}"? Sản phẩm trong danh mục sẽ chuyển sang "Không danh mục".`)) return;
    remove.mutate(c.id, { onError });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader icon={FolderOpen} title="Danh mục" description="Gom hàng theo nhóm để lọc nhanh và bấm chọn khi bán." />

      <Card size="sm" className="mb-4">
        <CardContent className="flex gap-2">
          <Input
            className="h-11 text-base"
            placeholder="Tên danh mục mới, ví dụ: Đồ uống"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <Button className="h-11 shrink-0 px-5 text-base" onClick={add} disabled={save.isPending || !newName.trim()}>
            <Plus data-icon="inline-start" />
            Thêm
          </Button>
        </CardContent>
      </Card>

      <Card className="py-0">
        {isLoading && <p className="p-6 text-muted-foreground">Đang tải…</p>}
        <ul className="divide-y">
          {categories.map((c, i) => (
            <li key={c.id} className="flex items-center gap-2 px-3 py-2 transition-colors hover:bg-muted/50 md:gap-3 md:px-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-sm font-semibold text-muted-foreground">
                {i + 1}
              </span>
              {editing?.id === c.id ? (
                <Input
                  autoFocus
                  className="h-10 text-base"
                  value={editing.name}
                  onChange={(e) => setEditing({ id: c.id, name: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') rename();
                    if (e.key === 'Escape') setEditing(null);
                  }}
                  onBlur={rename}
                />
              ) : (
                <button
                  type="button"
                  className="min-h-11 min-w-0 flex-1 truncate text-left text-base font-medium hover:text-primary"
                  title="Bấm để đổi tên"
                  onClick={() => setEditing({ id: c.id, name: c.name })}
                >
                  {c.name}
                </button>
              )}
              <Badge variant="secondary" className="hidden sm:inline-flex">
                {c.productCount} sản phẩm
              </Badge>
              <div className="flex shrink-0">
                <Button variant="ghost" size="icon-lg" aria-label="Lên" title="Lên" onClick={() => move(i, -1)} disabled={i === 0}>
                  <ArrowUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  aria-label="Xuống"
                  title="Xuống"
                  onClick={() => move(i, 1)}
                  disabled={i === categories.length - 1}
                >
                  <ArrowDown />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  aria-label="Xóa"
                  title="Xóa"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => del(c)}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
        {!isLoading && categories.length === 0 && (
          <EmptyState
            icon={FolderOpen}
            title="Chưa có danh mục nào"
            description="Thêm danh mục đầu tiên ở ô bên trên, ví dụ Đồ uống, Bánh kẹo, Gia vị."
          />
        )}
      </Card>
    </div>
  );
}
