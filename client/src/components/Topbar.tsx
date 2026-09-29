import { ChevronRight } from 'lucide-react';
import { useLocation } from 'react-router';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NAV } from '@/router';

function todayLabel(): string {
  const s = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Thanh trên cùng (máy tính): đường dẫn, ngày, nút sáng/tối. */
export function Topbar() {
  const { pathname } = useLocation();
  const current = NAV.find((n) => pathname.startsWith(n.to));
  return (
    <header className="sticky top-0 z-30 hidden h-16 items-center gap-4 border-b bg-background/80 px-8 backdrop-blur md:flex">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>Tạp hóa</span>
        <ChevronRight className="size-4" />
        <span className="font-medium text-foreground">{current?.label ?? 'Trang'}</span>
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <span className="hidden items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground lg:flex">
          <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
          {todayLabel()}
        </span>
        <ThemeToggle />
        <div
          className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-sm font-semibold text-white shadow-sm"
          title="Chủ tiệm"
        >
          TH
        </div>
      </div>
    </header>
  );
}
