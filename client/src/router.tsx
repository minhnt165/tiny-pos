import { Navigate, Route, Routes } from 'react-router';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { CategoriesPage } from './pages/categories/CategoriesPage';
import { ProductListPage } from './pages/products/ProductListPage';
import { QuickAddPage } from './pages/quick-add/QuickAddPage';

export const NAV = [
  { to: '/sell', label: 'Bán hàng', icon: '🛒', disabled: true },
  { to: '/products', label: 'Sản phẩm', icon: '📦' },
  { to: '/categories', label: 'Danh mục', icon: '🗂️' },
  { to: '/quick-add', label: 'Nhập nhanh', icon: '📷' },
  { to: '/settings', label: 'Cài đặt', icon: '⚙️', disabled: true },
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
