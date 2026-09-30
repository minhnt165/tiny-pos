import { ClipboardList, FolderOpen, Package, PackageOpen, ReceiptText, ScanBarcode, Settings, ShoppingCart, Truck, type LucideIcon } from 'lucide-react';
import { Navigate, Route, Routes } from 'react-router';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { CategoriesPage } from './pages/categories/CategoriesPage';
import { ImportFormPage } from './pages/imports/ImportFormPage';
import { ImportsPage } from './pages/imports/ImportsPage';
import { OrdersPage } from './pages/orders/OrdersPage';
import { ProductListPage } from './pages/products/ProductListPage';
import { QuickAddPage } from './pages/quick-add/QuickAddPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { StocktakePage } from './pages/stocktake/StocktakePage';
import { SuppliersPage } from './pages/suppliers/SuppliersPage';
import { SellPage } from './pages/sell/SellPage';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  /** Hiện trên thanh dưới điện thoại (tối đa 4 mục, còn lại vào nút "Thêm"). */
  mobile?: boolean;
}

export const NAV: NavItem[] = [
  { to: '/sell', label: 'Bán hàng', icon: ShoppingCart, mobile: true },
  { to: '/orders', label: 'Hóa đơn', icon: ReceiptText, mobile: true },
  { to: '/imports', label: 'Nhập hàng', icon: PackageOpen },
  { to: '/stocktake', label: 'Kiểm kê', icon: ClipboardList, mobile: true },
  { to: '/products', label: 'Sản phẩm', icon: Package, mobile: true },
  { to: '/categories', label: 'Danh mục', icon: FolderOpen },
  { to: '/suppliers', label: 'Nhà cung cấp', icon: Truck },
  { to: '/quick-add', label: 'Nhập nhanh', icon: ScanBarcode },
  { to: '/settings', label: 'Cài đặt', icon: Settings },
];

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/sell" replace />} />
      <Route path="/sell" element={<SellPage />} />
      <Route path="/orders" element={<OrdersPage />} />
      <Route path="/imports" element={<ImportsPage />} />
      <Route path="/imports/new" element={<ImportFormPage />} />
      <Route path="/stocktake" element={<StocktakePage />} />
      <Route path="/products" element={<ProductListPage />} />
      <Route path="/categories" element={<CategoriesPage />} />
      <Route path="/suppliers" element={<SuppliersPage />} />
      <Route path="/quick-add" element={<QuickAddPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<PlaceholderPage title="Không tìm thấy trang" />} />
    </Routes>
  );
}
