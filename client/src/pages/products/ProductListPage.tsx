import { useState } from 'react';
import { FileSpreadsheet, Package, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import type { Product } from '@tiny-pos/shared';
import { useCategories } from '@/api/categories';
import { useProduct, useProducts, useSetProductActive } from '@/api/products';
import { useConfirm } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CsvDialog } from './CsvDialog';
import { ProductCardList } from './ProductCardList';
import { ProductFormDialog } from './ProductFormDialog';
import { ProductStats } from './ProductStats';
import { ProductTable } from './ProductTable';
import { ProductToolbar } from './ProductToolbar';

export function ProductListPage() {
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);

  const { data: all = [] } = useProducts({});
  const { data: products = [], isLoading } = useProducts({
    q,
    categoryId: categoryId ? Number(categoryId) : undefined,
    includeInactive,
  });
  const { data: categories = [] } = useCategories();
  const { data: editing } = useProduct(editingId);
  const setActive = useSetProductActive();
  const confirm = useConfirm();

  const toggle = async (p: Product) => {
    if (p.isActive) {
      const ok = await confirm({
        title: `Ngừng bán "${p.name}"?`,
        description: 'Hàng sẽ ẩn khỏi danh sách và màn bán hàng. Tồn kho và lịch sử vẫn giữ nguyên, có thể bán lại bất cứ lúc nào.',
        confirmText: 'Ngừng bán',
        destructive: true,
      });
      if (!ok) return;
    }
    setActive.mutate(
      { id: p.id, active: !p.isActive },
      { onSuccess: () => toast.success(p.isActive ? `Đã ngừng bán "${p.name}"` : `"${p.name}" bán lại`), onError: (e) => toast.error(e.message) },
    );
  };
  const edit = (p: Product) => setEditingId(p.id);
  const close = () => {
    setEditingId(null);
    setCreating(false);
  };
  const filtered = q !== '' || categoryId !== '';

  return (
    <div>
      <PageHeader
        icon={Package}
        title="Sản phẩm"
        description="Danh sách hàng hóa, giá bán và tồn kho của tiệm."
        actions={
          <>
            <Button variant="outline" className="h-11 px-4 text-base" onClick={() => setCsvOpen(true)}>
              <FileSpreadsheet data-icon="inline-start" />
              Nhập / Xuất CSV
            </Button>
            <Button className="h-11 px-5 text-base" onClick={() => setCreating(true)}>
              <Plus data-icon="inline-start" />
              Thêm sản phẩm
            </Button>
          </>
        }
      />

      <ProductStats products={all} categoryCount={categories.length} />

      <Card className="gap-0 py-0">
        <ProductToolbar
          q={q}
          setQ={setQ}
          categoryId={categoryId}
          setCategoryId={setCategoryId}
          includeInactive={includeInactive}
          setIncludeInactive={setIncludeInactive}
          categories={categories}
        />
        {isLoading ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            icon={filtered ? Search : Package}
            title={filtered ? 'Không tìm thấy sản phẩm nào' : 'Chưa có sản phẩm'}
            description={filtered ? 'Thử từ khóa khác hoặc bỏ lọc danh mục.' : 'Thêm bằng tay, quét mã ở Nhập nhanh, hoặc nhập từ file CSV.'}
            action={
              !filtered && (
                <Button onClick={() => setCreating(true)}>
                  <Plus data-icon="inline-start" />
                  Thêm sản phẩm
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className="hidden md:block">
              <ProductTable products={products} onEdit={edit} onToggle={toggle} />
            </div>
            <div className="md:hidden">
              <ProductCardList products={products} onEdit={edit} onToggle={toggle} />
            </div>
            <div className="border-t px-4 py-3 text-sm text-muted-foreground">
              Hiển thị {products.length} / {all.length} mặt hàng
            </div>
          </>
        )}
      </Card>

      <ProductFormDialog
        open={creating || (editingId !== null && !!editing)}
        product={creating ? null : (editing ?? null)}
        onClose={close}
        onSaved={close}
      />
      <CsvDialog open={csvOpen} onClose={() => setCsvOpen(false)} />
    </div>
  );
}
