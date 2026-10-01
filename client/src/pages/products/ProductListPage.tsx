import { useState } from 'react';
import { Package, Plus, ScanBarcode, Search, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { filterProducts, productViewFields, sortProducts, type Product } from '@tiny-pos/shared';
import { useCategories } from '@/api/categories';
import { useProduct, useProducts, useSetProductActive } from '@/api/products';
import { useConfirm } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { PageTitle } from '@/components/layout/PageTitle';
import { ListPanel } from '@/components/ListPanel';
import { Pager } from '@/components/Pager';
import { ProductImageDialog } from '@/components/ProductImageDialog';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Button } from '@/components/ui/button';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useExportAction } from '@/hooks/useExportAction';
import { ImportDialog } from './ImportDialog';
import { ProductCardList } from './ProductCardList';
import { ProductFormDialog } from './ProductFormDialog';
import { ProductStats } from './ProductStats';
import { ProductTable } from './ProductTable';
import { ProductFilters, productFilterCount } from './ProductToolbar';

const PAGE_SIZE = 20;

export function ProductListPage() {
  // Màn Danh mục mở sang đây kèm ?categoryId= (cùng khóa URL của bộ lọc)
  const { filters: view, set, clear } = useUrlFilters(productViewFields);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [viewingImage, setViewingImage] = useState<Product | null>(null);
  const exportAction = useExportAction('/products/export.xlsx');

  // Tải hết một lần (kể cả ngừng bán) rồi lọc/sắp xếp trên trình duyệt
  const { data: everything = [], isLoading } = useProducts({ includeInactive: true });
  const all = everything.filter((p) => p.isActive);
  const products = sortProducts(filterProducts(everything, view), view.sort);
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
  const filtered = !!view.q || productFilterCount(view) > 0;
  // Danh sách ngắn lại thì kẹp về trang cuối còn có
  const currentPage = Math.min(view.page, Math.max(1, Math.ceil(products.length / PAGE_SIZE)));
  const pageItems = products.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div>
      <PageTitle
        title="Sản phẩm"
        count={`${all.length} mặt hàng`}
        actions={[
          { label: 'Nhập nhanh', icon: ScanBarcode, to: '/quick-add' },
          { label: 'Nhập từ Excel', icon: Upload, onClick: () => setImportOpen(true) },
          exportAction,
          { label: 'Thêm sản phẩm', icon: Plus, onClick: () => setCreating(true), primary: true },
        ]}
      />

      <ProductStats products={all} categoryCount={categories.length} />

      <ListPanel
        toolbar={
          <ProductFilters view={view} set={set} clear={clear} categories={categories} resultCount={products.length} />
        }
        footer={products.length > 0 && <Pager page={currentPage} pageSize={PAGE_SIZE} total={products.length} onPageChange={(page) => set({ page })} noun="mặt hàng" />}
      >
        {isLoading ? (
          <TableSkeleton />
        ) : products.length === 0 ? (
          <EmptyState
            icon={filtered ? Search : Package}
            title={filtered ? 'Không tìm thấy sản phẩm nào' : 'Chưa có sản phẩm'}
            description={filtered ? 'Thử từ khóa khác hoặc bỏ bớt lọc.' : 'Thêm bằng tay, quét mã ở Nhập nhanh, hoặc nhập từ file CSV.'}
            action={
              filtered ? (
                <Button variant="outline" onClick={clear}>
                  Xóa lọc
                </Button>
              ) : (
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
              <ProductTable products={pageItems} onEdit={edit} onToggle={toggle} onViewImage={setViewingImage} />
            </div>
            <div className="md:hidden">
              <ProductCardList products={pageItems} onEdit={edit} onToggle={toggle} onViewImage={setViewingImage} />
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
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
      <ProductImageDialog product={viewingImage} onClose={() => setViewingImage(null)} />
    </div>
  );
}
