import { FolderOpen, Package, ScanBarcode, Settings, ShoppingCart, type LucideIcon } from 'lucide-react';
import { Navigate, Route, Routes } from 'react-router';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { CategoriesPage } from './pages/categories/CategoriesPage';
import { ProductListPage } from './pages/products/ProductListPage';
import { QuickAddPage } from './pages/quick-add/QuickAddPage';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
}

export const NAV: NavItem[] = [
  { to: '/sell', label: 'Bán hàng', icon: ShoppingCart, disabled: true },
  { to: '/products', label: 'Sản phẩm', icon: Package },
  { to: '/categories', label: 'Danh mục', icon: FolderOpen },
  { to: '/quick-add', label: 'Nhập nhanh', icon: ScanBarcode },
  { to: '/settings', label: 'Cài đặt', icon: Settings, disabled: true },
];

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/products" replace />} />
      <Route path="/products" element={<ProductListPage />} />
      <Route path="/categories" element={<CategoriesPage />} />
      <Route path="/quick-add" element={<QuickAddPage />} />
      <Route path="*" element={<PlaceholderPage title="Không tìm thấy trang" />} />
    </Routes>
  );
}
