import { useState } from 'react';
import type { Category } from '@tiny-pos/shared';
import { useCategories, useDeleteCategory, useSaveCategory } from '../../api/categories';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toast';

export function CategoriesPage() {
  const { data: categories = [], isLoading } = useCategories();
  const save = useSaveCategory();
  const remove = useDeleteCategory();
  const toast = useToast();
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);

  const onError = (e: Error) => toast(e.message, 'error');

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
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold">Danh mục</h1>
      <div className="mb-4 flex gap-2">
        <Input
          placeholder="Tên danh mục mới"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <Button onClick={add} disabled={save.isPending}>
          Thêm
        </Button>
      </div>
      {isLoading && <p>Đang tải…</p>}
      <ul className="divide-y rounded-xl border bg-white">
        {categories.map((c, i) => (
          <li key={c.id} className="flex items-center gap-2 p-2">
            {editing?.id === c.id ? (
              <Input
                autoFocus
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
                className="min-h-11 flex-1 text-left"
                onClick={() => setEditing({ id: c.id, name: c.name })}
              >
                {c.name} <span className="text-sm text-gray-500">({c.productCount} sản phẩm)</span>
              </button>
            )}
            <Button variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Lên">
              ↑
            </Button>
            <Button variant="ghost" onClick={() => move(i, 1)} disabled={i === categories.length - 1} aria-label="Xuống">
              ↓
            </Button>
            <Button variant="ghost" className="text-red-600" onClick={() => del(c)}>
              Xóa
            </Button>
          </li>
        ))}
        {!isLoading && categories.length === 0 && <li className="p-4 text-gray-500">Chưa có danh mục nào.</li>}
      </ul>
    </div>
  );
}
