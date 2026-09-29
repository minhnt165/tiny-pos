import { Store } from 'lucide-react';
import { NavLink } from 'react-router';
import { Topbar } from '@/components/Topbar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AppRoutes, NAV } from './router';

/** Bố cục: sidebar tối + topbar trên máy tính, header + thanh dưới trên điện thoại. */
export default function App() {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col bg-gradient-to-b from-[#0d3b2e] to-[#07261d] text-emerald-50 md:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-black/30">
            <Store className="size-6" />
          </div>
          <div>
            <div className="font-heading text-lg font-semibold leading-tight">Tạp hóa</div>
            <div className="text-xs text-emerald-100/60">Quản lý cửa hàng</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-emerald-100/40 uppercase">Menu</div>
          {NAV.map(({ to, label, icon: Icon, disabled }) =>
            disabled ? (
              <div
                key={to}
                className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-emerald-100/35"
                title="Sẽ có ở giai đoạn sau"
              >
                <Icon className="size-5" />
                <span className="flex-1">{label}</span>
                <Badge variant="outline" className="border-white/10 text-[10px] text-emerald-100/50">
                  Sắp có
                </Badge>
              </div>
            ) : (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition-all',
                    isActive
                      ? 'bg-white/10 text-white shadow-inner ring-1 ring-white/15'
                      : 'text-emerald-100/70 hover:bg-white/5 hover:text-white',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={cn('size-5', isActive && 'text-emerald-300')} />
                    {label}
                  </>
                )}
              </NavLink>
            ),
          )}
        </nav>
        <div className="m-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
          <div className="text-sm font-medium">Giai đoạn 1</div>
          <div className="text-xs text-emerald-100/60">Sản phẩm, danh mục, nhập nhanh, CSV</div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <header className="flex items-center gap-2 border-b bg-card px-4 py-3 md:hidden">
          <Store className="size-6 text-primary" />
          <span className="font-heading font-semibold">Tạp hóa</span>
        </header>
        <main className="flex-1 px-4 py-5 pb-28 md:px-8 md:py-8">
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
