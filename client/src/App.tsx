import { useLocation } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';
import { PosShell } from '@/components/layout/PosShell';
import { LabelPrintPage } from './pages/labels/LabelPrintPage';
import { SellPage } from './pages/sell/SellPage';
import { AppRoutes } from './router';

export default function App() {
  const { pathname } = useLocation();
  // Trang in tem mở trong cửa sổ riêng: không sidebar/topbar
  if (pathname === '/labels/print') return <LabelPrintPage />;
  // Cửa sổ quầy: Bán hàng toàn màn hình, không menu
  if (pathname === '/pos')
    return (
      <PosShell>
        <SellPage standalone />
      </PosShell>
    );
  return (
    <AppShell>
      <AppRoutes />
    </AppShell>
  );
}
