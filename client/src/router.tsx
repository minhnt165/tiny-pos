import { BarChart3, ClipboardList, FolderOpen, Package, PackageOpen, ReceiptText, Settings, ShoppingCart, Truck, Users, type LucideIcon } from 'lucide-react';
import { Navigate, Route, Routes } from 'react-router';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { CategoriesPage } from './pages/categories/CategoriesPage';
import { CustomersPage } from './pages/customers/CustomersPage';
import { ImportFormPage } from './pages/imports/ImportFormPage';
import { ImportsPage } from './pages/imports/ImportsPage';
import { OrdersPage } from './pages/orders/OrdersPage';
import { ProductListPage } from './pages/products/ProductListPage';
import { QuickAddPage } from './pages/quick-add/QuickAddPage';
import { ReportsPage } from './pages/reports/ReportsPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { StocktakePage } from './pages/stocktake/StocktakePage';
import { SuppliersPage } from './pages/suppliers/SuppliersPage';
import { SellPage } from './pages/sell/SellPage';

export type NavGroup = 'sell' | 'stock' | 'other';

export const NAV_GROUPS: { key: NavGroup; label: string }[] = [
  { key: 'sell', label: 'Bán hàng' },
  { key: 'stock', label: 'Kho hàng' },
  { key: 'other', label: 'Khác' },
];

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  group: NavGroup;
  /** Vị trí trên thanh dưới điện thoại (1–4); không có thì vào nút "Thêm". */
  mobile?: number;
}

/** Nhập nhanh không có trong menu: mở từ nút trên trang Sản phẩm (route vẫn giữ). */
export const NAV: NavItem[] = [
  { to: '/sell', label: 'Bán hàng', icon: ShoppingCart, group: 'sell', mobile: 1 },
  { to: '/orders', label: 'Hóa đơn', icon: ReceiptText, group: 'sell', mobile: 2 },
  { to: '/reports', label: 'Báo cáo', icon: BarChart3, group: 'sell' },
  { to: '/customers', label: 'Khách hàng', icon: Users, group: 'sell' },
  { to: '/products', label: 'Sản phẩm', icon: Package, group: 'stock', mobile: 4 },
  { to: '/imports', label: 'Nhập hàng', icon: PackageOpen, group: 'stock' },
  { to: '/stocktake', label: 'Kiểm kê', icon: ClipboardList, group: 'stock', mobile: 3 },
  { to: '/categories', label: 'Danh mục', icon: FolderOpen, group: 'stock' },
  { to: '/suppliers', label: 'Nhà cung cấp', icon: Truck, group: 'other' },
  { to: '/settings', label: 'Cài đặt', icon: Settings, group: 'other' },
];

/** Mục menu đang mở; Nhập nhanh thuộc Sản phẩm. */
export function activeNav(pathname: string): NavItem | undefined {
  const path = pathname === '/quick-add' ? '/products' : pathname;
  return NAV.find((n) => path.startsWith(n.to));
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/sell" replace />} />
      <Route path="/sell" element={<SellPage />} />
      <Route path="/orders" element={<OrdersPage />} />
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="/imports" element={<ImportsPage />} />
      <Route path="/imports/new" element={<ImportFormPage />} />
      <Route path="/stocktake" element={<StocktakePage />} />
      <Route path="/products" element={<ProductListPage />} />
      <Route path="/categories" element={<CategoriesPage />} />
      <Route path="/suppliers" element={<SuppliersPage />} />
      <Route path="/customers" element={<CustomersPage />} />
      <Route path="/quick-add" element={<QuickAddPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<PlaceholderPage title="Không tìm thấy trang" />} />
    </Routes>
  );
}
