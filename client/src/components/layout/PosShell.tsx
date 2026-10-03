import { useState, type CSSProperties, type ReactNode } from 'react';
import { LayoutDashboard, Store } from 'lucide-react';
import { Link } from 'react-router';
import { useSettings } from '@/api/settings';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { todayLabel } from './AppShell';
import { TitleSlotContext } from './PageTitle';

/** Khung cửa sổ quầy (/pos): chỉ một thanh trên cùng chiều cao topbar của AppShell, không sidebar, không thanh dưới điện thoại. */
export function PosShell({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  const { data: settings } = useSettings();
  return (
    // Không có thanh dưới: thanh Thanh toán trên điện thoại bám sát đáy (xem CheckoutPanel)
    <div className="flex min-h-svh flex-col" style={{ '--bottom-nav': '0px' } as CSSProperties}>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-3 backdrop-blur md:h-12 md:px-4">
        <div className="hidden min-w-0 shrink-0 items-center gap-2 md:flex">
          <div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Store className="size-4" />
          </div>
          <span className="max-w-48 truncate font-heading font-semibold">{settings?.storeName || 'Tạp hóa'}</span>
          <span className="text-muted-foreground">·</span>
        </div>
        <div ref={setSlot} className="flex min-w-0 flex-1 items-center gap-2" />
        <span className="hidden text-sm text-muted-foreground lg:inline">{todayLabel()}</span>
        <div className="hidden md:block">
          <ThemeToggle />
        </div>
        <Button variant="outline" className="h-11 px-3 md:h-9" title="Về màn quản lý có menu" asChild>
          <Link to="/overview">
            <LayoutDashboard data-icon="inline-start" />
            Quản lý
          </Link>
        </Button>
      </header>
      <TitleSlotContext.Provider value={slot}>
        <main className="flex-1 px-3 pt-3 pb-[env(safe-area-inset-bottom)] md:p-4">{children}</main>
      </TitleSlotContext.Provider>
    </div>
  );
}
