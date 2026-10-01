import { useLocation } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';
import { LabelPrintPage } from './pages/labels/LabelPrintPage';
import { AppRoutes } from './router';

export default function App() {
  const { pathname } = useLocation();
  // Trang in tem mở trong cửa sổ riêng: không sidebar/topbar
  if (pathname === '/labels/print') return <LabelPrintPage />;
  return (
    <AppShell>
      <AppRoutes />
    </AppShell>
  );
}
