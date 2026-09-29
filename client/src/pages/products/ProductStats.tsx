import { FolderOpen, Package, TriangleAlert, Wallet } from 'lucide-react';
import { formatMoney, type Product } from '@tiny-pos/shared';
import { StatCard } from '@/components/StatCard';

/** Bốn ô tổng quan: tính từ toàn bộ hàng đang bán (không phụ thuộc bộ lọc). */
export function ProductStats({ products, categoryCount }: { products: Product[]; categoryCount: number }) {
  const low = products.filter((p) => p.stock < p.minStock);
  const weighed = products.filter((p) => p.isWeighed).length;
  const inventoryValue = products.reduce((sum, p) => sum + p.stock * p.costPrice, 0);
  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard icon={Package} label="Mặt hàng đang bán" value={String(products.length)} hint={weighed ? `${weighed} hàng cân` : 'Chưa có hàng cân'} />
      <StatCard
        icon={TriangleAlert}
        label="Sắp hết hàng"
        value={String(low.length)}
        hint={low.length ? low.slice(0, 2).map((p) => p.name).join(', ') : 'Tồn đều trên mức tối thiểu'}
        tone={low.length ? 'danger' : 'default'}
      />
      <StatCard icon={Wallet} label="Giá trị tồn kho" value={formatMoney(inventoryValue)} hint="Tính theo giá nhập" tone="info" />
      <StatCard icon={FolderOpen} label="Danh mục" value={String(categoryCount)} hint="Nhóm hàng để lọc nhanh" tone="warn" />
    </div>
  );
}
