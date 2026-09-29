import { useState } from 'react';
import { ArrowDown, ArrowUp, FolderOpen, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Category } from '@tiny-pos/shared';
import { useCategories, useDeleteCategory, useSaveCategory } from '@/api/categories';
import { useConfirm } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { gradientFor } from '@/components/ProductAvatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function CategoriesPage() {
  const { data: categories = [], isLoading } = useCategories();
  const save = useSaveCategory();
  const remove = useDeleteCategory();
  const confirm = useConfirm();
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);

  const onError = (e: Error) => toast.error(e.message);

  /** Tên hợp lệ: không trống, ≤100 ký tự, không trùng (không phân biệt hoa thường). */
  const validate = (name: string, exceptId?: number): string | undefined => {
    const n = name.trim();
    if (!n) return 'Nhập tên danh mục';
    if (n.length > 100) return 'Tối đa 100 ký tự';
    if (categories.some((c) => c.id !== exceptId && c.name.toLowerCase() === n.toLowerCase())) return `Đã có danh mục "${n}"`;
    return undefined;
  };

  const add = () => {
    const err = validate(newName);
    if (err) return setError(err);
    save.mutate({ name: newName.trim(), sortOrder: categories.length }, { onSuccess: () => setNewName(''), onError });
  };

  const rename = () => {
    if (!editing) return;
    const c = categories.find((x) => x.id === editing.id);
    if (!c || c.name === editing.name.trim()) return setEditing(null);
    const err = validate(editing.name, c.id);
    if (err) return toast.error(err);
    save.mutate({ id: c.id, name: editing.name.trim(), sortOrder: c.sortOrder }, { onSuccess: () => setEditing(null), onError });
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

  const del = async (c: Category) => {
    const ok = await confirm({
      title: `Xóa danh mục "${c.name}"?`,
      description:
        c.productCount > 0
          ? `${c.productCount} sản phẩm trong danh mục sẽ chuyển sang "Không danh mục". Sản phẩm không bị xóa.`
          : 'Danh mục này chưa có sản phẩm nào.',
      confirmText: 'Xóa danh mục',
      destructive: true,
    });
    if (ok) remove.mutate(c.id, { onSuccess: () => toast.success(`Đã xóa "${c.name}"`), onError });
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader icon={FolderOpen} title="Danh mục" description="Gom hàng theo nhóm để lọc nhanh và bấm chọn khi bán." />

      <Card size="sm" className="mb-5">
        <CardContent>
          <div className="flex gap-2">
            <Input
              className="h-11 text-base"
              placeholder="Tên danh mục mới, ví dụ: Đồ uống"
              value={newName}
              aria-invalid={!!error}
              onChange={(e) => {
                setNewName(e.target.value);
                setError(undefined);
              }}
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
            <Button className="h-11 shrink-0 px-5 text-base" onClick={add} disabled={save.isPending}>
              <Plus data-icon="inline-start" />
              Thêm
            </Button>
          </div>
          {error && <FieldError className="mt-2">{error}</FieldError>}
        </CardContent>
      </Card>

      {isLoading && <p className="text-muted-foreground">Đang tải…</p>}
      {!isLoading && categories.length === 0 && (
        <Card>
          <EmptyState icon={FolderOpen} title="Chưa có danh mục nào" description="Thêm danh mục đầu tiên ở ô bên trên, ví dụ Đồ uống, Bánh kẹo, Gia vị." />
        </Card>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c, i) => (
          <Card key={c.id} size="sm" className="gap-0 py-0">
            <div className={cn('h-1.5 bg-gradient-to-r', gradientFor(c.name))} />
            <CardContent className="flex items-start gap-3 py-3">
              <div className={cn('grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br font-heading text-lg font-semibold text-white', gradientFor(c.name))}>
                {i + 1}
              </div>
              <div className="min-w-0 flex-1">
                {editing?.id === c.id ? (
                  <Input
                    autoFocus
                    className="h-9 text-base"
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
                    className="block w-full truncate text-left text-base font-semibold hover:text-primary"
                    title="Bấm để đổi tên"
                    onClick={() => setEditing({ id: c.id, name: c.name })}
                  >
                    {c.name}
                  </button>
                )}
                <p className="text-sm text-muted-foreground">{c.productCount} sản phẩm</p>
              </div>
              <div className="flex shrink-0">
                <Button variant="ghost" size="icon-sm" aria-label="Lên" title="Lên" onClick={() => move(i, -1)} disabled={i === 0}>
                  <ArrowUp />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Xuống" title="Xuống" onClick={() => move(i, 1)} disabled={i === categories.length - 1}>
                  <ArrowDown />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Xóa" title="Xóa" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => del(c)}>
                  <Trash2 />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
