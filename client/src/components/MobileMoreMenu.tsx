import { Ellipsis } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { NavItem } from '@/router';

/** Nút "Thêm" ở thanh dưới điện thoại: chứa các mục không nằm trên thanh. */
export function MobileMoreMenu({ items }: { items: NavItem[] }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const active = items.some((i) => pathname.startsWith(i.to));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] leading-4 font-medium whitespace-nowrap',
            active ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          <span className={cn('grid h-8 w-14 place-items-center rounded-full transition-colors', active && 'bg-accent')}>
            <Ellipsis className="size-5" />
          </span>
          Thêm
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="min-w-56">
        {items.map(({ to, label, icon: Icon }) => (
          <DropdownMenuItem key={to} className="h-11 text-base" onSelect={() => navigate(to)}>
            <Icon />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
