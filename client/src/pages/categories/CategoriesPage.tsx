import { useState } from 'react';
import { ArrowDown, ArrowUp, FolderOpen, FolderX, Info, Layers, MoreHorizontal, Package, PackageOpen, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import type { Category } from '@tiny-pos/shared';
import { useCategories, useDeleteCategory, useSaveCategory } from '@/api/categories';
import { useProducts } from '@/api/products';
import { useConfirm } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { ProductAvatar } from '@/components/ProductAvatar';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Skeleton } from '@/components/ui/skeleton';
import { CategoryFormDialog } from './CategoryFormDialog';

export function CategoriesPage() {
  const { data: categories = [], isLoading } = useCategories();
  const { data: products = [] } = useProducts({});
  const save = useSaveCategory();
  const remove = useDeleteCategory();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [dialog, setDialog] = useState<{ category: Category | null } | null>(null);

  const onError = (e: Error) => toast.error(e.message);
  const uncategorized = products.filter((p) => p.categoryId === null).length;
  const empty = categories.filter((c) => c.productCount === 0);
  const maxCount = Math.max(1, ...categories.map((c) => c.productCount));
  const categorized = Math.max(1, categories.reduce((sum, c) => sum + c.productCount, 0));
  const term = q.trim().toLowerCase();
  const shown = term ? categories.filter((c) => c.name.toLowerCase().includes(term)) : categories;

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

  const openCreate = () => setDialog({ category: null });
  const openRename = (c: Category) => setDialog({ category: c });

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        icon={FolderOpen}
        title="Danh mục"
        description="Gom hàng theo nhóm để lọc nhanh và bấm chọn khi bán."
        actions={
          <Button className="h-11 px-5 text-base" onClick={openCreate}>
            <Plus data-icon="inline-start" />
            Thêm danh mục
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard icon={Layers} label="Danh mục" value={String(categories.length)} hint="Nhóm hàng để lọc nhanh" />
        <StatCard
          icon={Package}
          label="Hàng đã phân loại"
          value={String(products.length - uncategorized)}
          hint={`/ ${products.length} mặt hàng đang bán`}
          tone="info"
        />
        <StatCard
          icon={PackageOpen}
          label="Chưa có danh mục"
          value={String(uncategorized)}
          hint={uncategorized ? 'Nên xếp vào nhóm để dễ tìm' : 'Mọi hàng đã có nhóm'}
          tone={uncategorized ? 'warn' : 'default'}
        />
        <StatCard
          icon={FolderX}
          label="Danh mục trống"
          value={String(empty.length)}
          hint={empty.length ? empty.slice(0, 2).map((c) => c.name).join(', ') : 'Danh mục nào cũng có'}
          tone={empty.length ? 'danger' : 'default'}
        />
      </div>

      <Card className="gap-0 py-0">
        <div className="flex flex-col gap-3 border-b px-4 py-4 md:flex-row md:items-center md:justify-between">
          <InputGroup className="h-11 bg-card md:max-w-sm">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput className="h-11 text-base" placeholder="Tìm danh mục…" value={q} onChange={(e) => setQ(e.target.value)} />
          </InputGroup>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="size-4 shrink-0" />
            Thứ tự ở đây là thứ tự nút danh mục ở màn bán hàng.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <EmptyState
            icon={term ? Search : FolderOpen}
            title={term ? 'Không tìm thấy danh mục nào' : 'Chưa có danh mục nào'}
            description={term ? 'Thử từ khóa khác.' : 'Tạo nhóm hàng đầu tiên, ví dụ Đồ uống, Bánh kẹo, Gia vị.'}
            action={
              !term && (
                <Button onClick={openCreate}>
                  <Plus data-icon="inline-start" />
                  Thêm danh mục
                </Button>
              )
            }
          />
        ) : (
          <ul className="divide-y">
            {shown.map((c) => {
              const i = categories.indexOf(c);
              return (
                <li key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
                  <span className="w-6 shrink-0 text-center text-sm font-medium text-muted-foreground tabular-nums">{i + 1}</span>
                  <ProductAvatar name={c.name} />
                  <button type="button" className="min-w-0 flex-1 text-left" title="Bấm để đổi tên" onClick={() => openRename(c)}>
                    <div className="truncate text-base font-medium">{c.name}</div>
                    <div className="text-sm text-muted-foreground">{c.productCount ? `${c.productCount} sản phẩm` : 'Chưa có sản phẩm'}</div>
                  </button>
                  <div className="hidden w-40 shrink-0 items-center gap-3 md:flex lg:w-56" title="Tỷ trọng trong số hàng đã phân loại">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(c.productCount / maxCount) * 100}%` }} />
                    </div>
                    <span className="w-9 text-right text-sm font-medium text-muted-foreground tabular-nums">
                      {Math.round((c.productCount / categorized) * 100)}%
                    </span>
                  </div>
                  {!term && (
                    <div className="hidden shrink-0 sm:flex">
                      <Button variant="ghost" size="icon-lg" aria-label="Lên" title="Lên" onClick={() => move(i, -1)} disabled={i === 0}>
                        <ArrowUp />
                      </Button>
                      <Button variant="ghost" size="icon-lg" aria-label="Xuống" title="Xuống" onClick={() => move(i, 1)} disabled={i === categories.length - 1}>
                        <ArrowDown />
                      </Button>
                    </div>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-lg" aria-label="Thao tác" title="Thao tác">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-44">
                      <DropdownMenuItem onSelect={() => navigate(`/products?categoryId=${c.id}`)}>
                        <Package />
                        Xem sản phẩm
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => openRename(c)}>
                        <Pencil />
                        Đổi tên
                      </DropdownMenuItem>
                      {/* Điện thoại không đủ chỗ cho nút lên/xuống nên đưa vào menu */}
                      {!term && (
                        <>
                          <DropdownMenuItem className="sm:hidden" disabled={i === 0} onSelect={() => move(i, -1)}>
                            <ArrowUp />
                            Chuyển lên
                          </DropdownMenuItem>
                          <DropdownMenuItem className="sm:hidden" disabled={i === categories.length - 1} onSelect={() => move(i, 1)}>
                            <ArrowDown />
                            Chuyển xuống
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => del(c)}>
                        <Trash2 />
                        Xóa danh mục
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              );
            })}
          </ul>
        )}

        {!isLoading && categories.length > 0 && (
          <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
            <span>
              {term ? `${shown.length} / ` : ''}
              {categories.length} danh mục
            </span>
            {uncategorized > 0 && <span>{uncategorized} mặt hàng chưa có danh mục</span>}
          </div>
        )}
      </Card>

      <CategoryFormDialog open={dialog !== null} category={dialog?.category ?? null} categories={categories} onClose={() => setDialog(null)} />
    </div>
  );
}
