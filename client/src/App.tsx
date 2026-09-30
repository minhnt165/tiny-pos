import { AppShell } from '@/components/layout/AppShell';
import { AppRoutes } from './router';

export default function App() {
  return (
    <AppShell>
      <AppRoutes />
    </AppShell>
  );
}
