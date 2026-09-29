import { Store } from 'lucide-react';
import { NavLink } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AppRoutes, NAV } from './router';

/** Bố cục: sidebar tối trên máy tính, thanh dưới trên điện thoại. */
export default function App() {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-black/30">
            <Store className="size-6" />
          </div>
          <div>
            <div className="font-heading text-lg font-semibold leading-tight">Tạp hóa</div>
            <div className="text-xs text-sidebar-foreground/60">Quản lý cửa hàng</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map(({ to, label, icon: Icon, disabled }) =>
            disabled ? (
              <div
                key={to}
                className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sidebar-foreground/35"
                title="Sẽ có ở giai đoạn sau"
              >
                <Icon className="size-5" />
                <span className="flex-1">{label}</span>
                <Badge variant="outline" className="border-sidebar-border text-[10px] text-sidebar-foreground/50">
                  Sắp có
                </Badge>
              </div>
            ) : (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-black/20'
                      : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                  )
                }
              >
                <Icon className="size-5" />
                {label}
              </NavLink>
            ),
          )}
        </nav>
        <div className="border-t border-sidebar-border px-5 py-4 text-xs text-sidebar-foreground/50">Giai đoạn 1 · Sản phẩm</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b bg-card px-4 py-3 md:hidden">
          <Store className="size-6 text-primary" />
          <span className="font-heading font-semibold">Tạp hóa</span>
        </header>
        <main className="flex-1 px-4 py-5 pb-28 md:px-8 md:py-8 md:pb-8">
          <div className="mx-auto max-w-6xl">
            <AppRoutes />
          </div>
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {NAV.filter((n) => !n.disabled).map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn('flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium', isActive ? 'text-primary' : 'text-muted-foreground')
            }
          >
            {({ isActive }) => (
              <>
                <span className={cn('grid h-8 w-14 place-items-center rounded-full transition-colors', isActive && 'bg-accent')}>
                  <Icon className="size-5" />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
