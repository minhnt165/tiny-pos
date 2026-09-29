import { Navigate, Route, Routes } from 'react-router';
import { PlaceholderPage } from './pages/PlaceholderPage';

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
      <Route path="/products" element={<PlaceholderPage title="Sản phẩm" />} />
      <Route path="/categories" element={<PlaceholderPage title="Danh mục" />} />
      <Route path="/quick-add" element={<PlaceholderPage title="Nhập nhanh" />} />
      <Route path="*" element={<PlaceholderPage title="Không tìm thấy trang" />} />
    </Routes>
  );
}
