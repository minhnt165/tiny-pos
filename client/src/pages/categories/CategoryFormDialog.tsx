import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import type { Category } from '@tiny-pos/shared';
import { useSaveCategory } from '@/api/categories';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Props {
  open: boolean;
  /** null = thêm mới; có giá trị = đổi tên. */
  category: Category | null;
  categories: Category[];
  onClose: () => void;
}

const NAME_ID = 'category-name';

/** Tên hợp lệ: không trống, ≤100 ký tự, không trùng (không phân biệt hoa thường). */
function validate(name: string, categories: Category[], exceptId?: number): string | undefined {
  const n = name.trim();
  if (!n) return 'Nhập tên danh mục';
  if (n.length > 100) return 'Tối đa 100 ký tự';
  if (categories.some((c) => c.id !== exceptId && c.name.toLowerCase() === n.toLowerCase())) return `Đã có danh mục "${n}"`;
  return undefined;
}

/** Hộp thoại thêm danh mục hoặc đổi tên danh mục. */
export function CategoryFormDialog({ open, category, categories, onClose }: Props) {
  const save = useSaveCategory();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? '');
    setError(undefined);
  }, [open, category]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const err = validate(name, categories, category?.id);
    if (err) {
      setError(err);
      document.getElementById(NAME_ID)?.focus();
      return;
    }
    const trimmed = name.trim();
    if (category && category.name === trimmed) return onClose();
    save.mutate(
      { id: category?.id, name: trimmed, sortOrder: category?.sortOrder ?? categories.length },
      {
        onSuccess: () => {
          toast.success(category ? `Đã đổi tên thành "${trimmed}"` : `Đã thêm "${trimmed}"`);
          onClose();
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        <DialogHeader className="border-b bg-muted/30 px-6 py-4">
          <DialogTitle className="text-xl">{category ? 'Đổi tên danh mục' : 'Thêm danh mục'}</DialogTitle>
          <DialogDescription>{category ? category.name : 'Ví dụ: Đồ uống, Bánh kẹo, Gia vị'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate>
          <div className="px-6 py-5">
            <TextField
              id={NAME_ID}
              label="Tên danh mục"
              autoFocus
              error={error}
              hint="Tên hiện trên nút chọn nhanh ở màn bán hàng"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(undefined);
              }}
              onFocus={(e) => e.target.select()}
            />
          </div>
          <DialogFooter className="mx-0 mb-0 px-6 py-4">
            <Button type="button" variant="outline" className="h-11 px-4 text-base" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" className="h-11 px-5 text-base" disabled={save.isPending}>
              {category ? 'Lưu tên' : 'Thêm danh mục'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
