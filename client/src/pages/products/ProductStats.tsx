import { formatMoney, type Product } from '@tiny-pos/shared';
import { Stat, StatStrip } from '@/components/StatStrip';

/** Bốn ô tổng quan: tính từ toàn bộ hàng đang bán (không phụ thuộc bộ lọc). */
export function ProductStats({ products, categoryCount }: { products: Product[]; categoryCount: number }) {
  const low = products.filter((p) => p.stock < p.minStock);
  const weighed = products.filter((p) => p.isWeighed).length;
  const inventoryValue = products.reduce((sum, p) => sum + p.stock * p.costPrice, 0);
  return (
    <StatStrip cols={4}>
      <Stat label="Mặt hàng đang bán" value={String(products.length)} hint={weighed ? `${weighed} hàng cân` : 'Chưa có hàng cân'} />
      <Stat
        label="Sắp hết hàng"
        value={String(low.length)}
        hint={low.length ? low.slice(0, 2).map((p) => p.name).join(', ') : 'Tồn đều trên mức tối thiểu'}
        tone={low.length ? 'danger' : 'default'}
      />
      <Stat label="Giá trị tồn kho" value={formatMoney(inventoryValue)} hint="Tính theo giá nhập" />
      <Stat label="Danh mục" value={String(categoryCount)} hint="Nhóm hàng để lọc nhanh" />
    </StatStrip>
  );
}
