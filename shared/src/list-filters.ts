import type { PartyView, ProductView } from './schemas/list-filters.js';
import { stripDiacritics } from './text.js';
import type { Product } from './types.js';

/** Chữ thường, bỏ dấu tiếng Việt: dùng để so khớp ô tìm. */
export const foldText = (s: string) => stripDiacritics(s).toLowerCase();

/** Lọc sản phẩm ngay trên trình duyệt (danh sách đã tải hết). */
export function filterProducts(products: Product[], f: ProductView): Product[] {
  const q = f.q ? foldText(f.q) : '';
  return products.filter(
    (p) =>
      (f.includeInactive || p.isActive) &&
      (!q || foldText(p.name).includes(q) || (p.barcode?.toLowerCase().includes(q) ?? false)) &&
      (!f.categoryId || p.categoryId === f.categoryId) &&
      (f.stock !== 'low' || p.stock < p.minStock) &&
      (f.stock !== 'out' || p.stock <= 0) &&
      (f.stock !== 'negative' || p.stock < 0) &&
      (!f.weighed || p.isWeighed) &&
      (!f.noBarcode || !p.barcode) &&
      (f.priceMin === undefined || p.sellPrice >= f.priceMin) &&
      (f.priceMax === undefined || p.sellPrice <= f.priceMax),
  );
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'vi');

/** Sắp xếp bản sao; cùng giá trị thì theo tên. */
export function sortProducts(products: Product[], sort: ProductView['sort']): Product[] {
  const key: Record<ProductView['sort'], (p: Product) => number> = {
    name: () => 0,
    'price-asc': (p) => p.sellPrice,
    'price-desc': (p) => -p.sellPrice,
    'stock-asc': (p) => p.stock,
    'stock-desc': (p) => -p.stock,
    'value-desc': (p) => -p.stock * p.costPrice,
  };
  const k = key[sort];
  return [...products].sort((a, b) => k(a) - k(b) || byName(a, b));
}

export interface PartyLike {
  name: string;
  phone: string | null;
  debt: number;
  isActive: boolean;
  lastActivityAt: string | null;
}

/** Lọc khách hàng / nhà cung cấp trên trình duyệt. */
export function filterParties<T extends PartyLike>(list: T[], f: PartyView): T[] {
  const q = f.q ? foldText(f.q) : '';
  return list.filter(
    (x) => (f.includeInactive || x.isActive) && (!q || foldText(x.name).includes(q) || (x.phone?.includes(q) ?? false)) && (!f.debtOnly || x.debt > 0),
  );
}

export function sortParties<T extends PartyLike>(list: T[], sort: PartyView['sort']): T[] {
  const copy = [...list];
  if (sort === 'debt-desc') return copy.sort((a, b) => b.debt - a.debt || byName(a, b));
  if (sort === 'recent') return copy.sort((a, b) => (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? '') || byName(a, b));
  return copy.sort(byName);
}
