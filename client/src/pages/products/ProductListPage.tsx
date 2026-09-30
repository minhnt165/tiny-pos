import { useState } from 'react';
import { FileSpreadsheet, Package, Plus, ScanBarcode, Search } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import type { Product } from '@tiny-pos/shared';
import { useCategories } from '@/api/categories';
import { useProduct, useProducts, useSetProductActive } from '@/api/products';
import { useConfirm } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { PageTitle } from '@/components/layout/PageTitle';
import { ListPanel } from '@/components/ListPanel';
import { Pager } from '@/components/Pager';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Button } from '@/components/ui/button';
import { CsvDialog } from './CsvDialog';
import { ProductCardList } from './ProductCardList';
import { ProductFormDialog } from './ProductFormDialog';
import { ProductStats } from './ProductStats';
import { ProductTable } from './ProductTable';
import { ProductToolbar } from './ProductToolbar';

const PAGE_SIZE = 20;

export function ProductListPage() {
  // Màn Danh mục mở sang đây kèm ?categoryId= để lọc sẵn
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState(() => searchParams.get('categoryId') ?? '');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [page, setPage] = useState(1);
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
  // Đổi bộ lọc thì quay về trang 1; danh sách ngắn lại thì kẹp về trang cuối còn có
  const resetPage =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };
  const currentPage = Math.min(page, Math.max(1, Math.ceil(products.length / PAGE_SIZE)));
  const pageItems = products.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div>
      <PageTitle
        title="Sản phẩm"
        count={`${all.length} mặt hàng`}
        actions={[
          { label: 'Nhập nhanh', icon: ScanBarcode, to: '/quick-add' },
          { label: 'Nhập / Xuất CSV', icon: FileSpreadsheet, onClick: () => setCsvOpen(true) },
          { label: 'Thêm sản phẩm', icon: Plus, onClick: () => setCreating(true), primary: true },
        ]}
      />

      <ProductStats products={all} categoryCount={categories.length} />

      <ListPanel
        toolbar={
          <ProductToolbar
            q={q}
            setQ={resetPage(setQ)}
            categoryId={categoryId}
            setCategoryId={resetPage((v: string) => {
              setCategoryId(v);
              if (searchParams.has('categoryId')) setSearchParams({}, { replace: true });
            })}
            includeInactive={includeInactive}
            setIncludeInactive={resetPage(setIncludeInactive)}
            categories={categories}
          />
        }
        footer={products.length > 0 && <Pager page={currentPage} pageSize={PAGE_SIZE} total={products.length} onPageChange={setPage} noun="mặt hàng" />}
      >
        {isLoading ? (
          <TableSkeleton />
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
              <ProductTable products={pageItems} onEdit={edit} onToggle={toggle} />
            </div>
            <div className="md:hidden">
              <ProductCardList products={pageItems} onEdit={edit} onToggle={toggle} />
            </div>
          </>
        )}
      </ListPanel>

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
