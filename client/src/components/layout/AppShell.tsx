import { useState, type CSSProperties, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router';
import { MobileMoreMenu } from '@/components/MobileMoreMenu';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SidebarProvider } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { activeNav, NAV } from '@/router';
import { AppSidebar } from './AppSidebar';
import { TitleSlotContext } from './PageTitle';

export function todayLabel(): string {
  const s = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Khung app: sidebar + topbar trên máy tính, header + thanh dưới trên điện thoại. Trang đưa tiêu đề/nút lên topbar bằng PageTitle. */
export function AppShell({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const { pathname } = useLocation();
  // Màn Bán hàng dùng hết chiều rộng và chiều cao còn lại
  const fullBleed = pathname === '/sell';

  return (
    <SidebarProvider style={{ '--sidebar-width': '14rem', '--bottom-nav': '68px' } as CSSProperties}>
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur md:h-12 md:px-(--page-p)">
          <div ref={setSlot} className="flex min-w-0 flex-1 items-center gap-2">
            {/* Tiêu đề dự phòng khi trang chưa có PageTitle: ẩn ngay khi portal vẽ nội dung vào ô */}
            <span className="hidden truncate font-heading text-lg font-semibold only:block">{activeNav(pathname)?.label ?? 'Tạp hóa'}</span>
          </div>
          <span className="hidden text-sm text-muted-foreground lg:inline">{todayLabel()}</span>
          <div className="hidden md:block">
            <ThemeToggle />
          </div>
        </header>
        <TitleSlotContext.Provider value={slot}>
          {/* Mỗi nhánh đủ bộ padding riêng: cn của dự án không gộp class trùng */}
          <main className={cn('flex-1', fullBleed ? 'px-3 pt-3 pb-28 md:p-4' : 'px-4 pt-(--page-p) pb-28 md:px-(--page-p) md:pb-(--page-p)')}>
            {fullBleed ? children : <div className="mx-auto max-w-7xl">{children}</div>}
          </main>
        </TitleSlotContext.Provider>
      </div>

      {/* Cao cố định 68px (+ safe-area) vì thanh Thanh toán ở màn Bán hàng bám ngay trên nó */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(68px+env(safe-area-inset-bottom))] border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {NAV.filter((n) => n.mobile)
          .sort((a, b) => a.mobile! - b.mobile!)
          .map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] leading-4 font-medium whitespace-nowrap', isActive ? 'text-primary' : 'text-muted-foreground')
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
        <MobileMoreMenu items={NAV.filter((n) => !n.mobile)} />
      </nav>
    </SidebarProvider>
  );
}
