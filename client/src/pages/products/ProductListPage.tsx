import { useState } from 'react';
import { formatMoney, type Product } from '@tiny-pos/shared';
import { useCategories } from '../../api/categories';
import { useProduct, useProducts, useSetProductActive } from '../../api/products';
import { Button } from '../../components/ui/Button';
import { Checkbox, Input, Select } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toast';
import { CsvDialog } from './CsvDialog';
import { ProductFormDialog } from './ProductFormDialog';

export function ProductListPage() {
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const { data: products = [], isLoading } = useProducts({
    q,
    categoryId: categoryId ? Number(categoryId) : undefined,
    includeInactive,
  });
  const { data: categories = [] } = useCategories();
  const { data: editing } = useProduct(editingId);
  const setActive = useSetProductActive();
  const toast = useToast();

  const toggle = (p: Product) =>
    setActive.mutate({ id: p.id, active: !p.isActive }, { onError: (e) => toast(e.message, 'error') });
  const close = () => {
    setEditingId(null);
    setCreating(false);
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-bold">Sản phẩm</h1>
        <Button variant="secondary" onClick={() => setCsvOpen(true)}>
          Nhập / Xuất CSV
        </Button>
        <Button onClick={() => setCreating(true)}>+ Thêm sản phẩm</Button>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Tìm tên hoặc mã vạch" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select className="max-w-xs" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Tất cả danh mục</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Checkbox
          label="Hiện hàng ngừng bán"
          checked={includeInactive}
          onChange={(e) => setIncludeInactive(e.target.checked)}
        />
      </div>
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left">
          <thead className="bg-gray-100 text-sm uppercase text-gray-600">
            <tr>
              <th className="p-3">Mã vạch</th>
              <th className="p-3">Tên</th>
              <th className="p-3">ĐV</th>
              <th className="p-3 text-right">Giá bán</th>
              <th className="p-3 text-right">Tồn</th>
              <th className="p-3">Danh mục</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {products.map((p) => (
              <tr key={p.id} className={p.isActive ? '' : 'text-gray-400'}>
                <td className="p-3 font-mono text-sm">{p.barcode ?? '—'}</td>
                <td className="p-3 font-medium">
                  {p.name}
                  {!p.isActive && ' (ngừng bán)'}
                </td>
                <td className="p-3">{p.unit}</td>
                <td className="p-3 text-right">{formatMoney(p.sellPrice)}</td>
                <td className={`p-3 text-right ${p.stock < p.minStock ? 'font-bold text-red-600' : ''}`}>{p.stock}</td>
                <td className="p-3">{p.categoryName ?? ''}</td>
                <td className="whitespace-nowrap p-3">
                  <Button variant="ghost" onClick={() => setEditingId(p.id)}>
                    Sửa
                  </Button>
                  <Button
                    variant="ghost"
                    className={p.isActive ? 'text-red-600' : 'text-green-700'}
                    onClick={() => toggle(p)}
                  >
                    {p.isActive ? 'Ngừng bán' : 'Bán lại'}
                  </Button>
                </td>
              </tr>
            ))}
            {!isLoading && products.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  Không có sản phẩm.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
