import { createContext, useContext, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Ellipsis, type LucideIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useSettings } from '@/api/settings';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface PageAction {
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  /** Đường dẫn: nút là link. */
  to?: string;
  /** Id của form: nút là nút submit của form đó (nút nằm trên topbar, ngoài form). */
  form?: string;
  /** Nút chính (tối đa 1): màu nhấn; trên điện thoại hiện thành nút icon. */
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
}

interface Props {
  title: string;
  /** Chữ phụ cạnh tiêu đề, ví dụ "78 mặt hàng". */
  count?: string;
  /** Trang con: đường dẫn của nút ← quay lại. */
  back?: string;
  actions?: PageAction[];
}

/** Ô tiêu đề trên topbar do AppShell tạo; PageTitle vẽ vào đó bằng portal. */
export const TitleSlotContext = createContext<HTMLElement | null>(null);

function DesktopAction({ a }: { a: PageAction }) {
  const Icon = a.icon;
  const variant = a.primary ? 'default' : 'outline';
  const className = cn('h-9 px-3', a.danger && !a.primary && 'text-destructive');
  const inner = (
    <>
      <Icon data-icon="inline-start" />
      {a.label}
    </>
  );
  if (a.to)
    return (
      <Button variant={variant} className={className} asChild>
        <Link to={a.to}>{inner}</Link>
      </Button>
    );
  return (
    <Button type={a.form ? 'submit' : 'button'} form={a.form} variant={variant} className={className} disabled={a.disabled} onClick={a.onClick}>
      {inner}
    </Button>
  );
}

/** Điện thoại: nút chính thành nút icon, các nút còn lại vào menu ⋯. */
function MobileActions({ actions }: { actions: PageAction[] }) {
  const navigate = useNavigate();
  const primary = actions.find((a) => a.primary);
  const rest = actions.filter((a) => a !== primary);
  const run = (a: PageAction) => {
    if (a.to) navigate(a.to);
    else if (a.form) (document.getElementById(a.form) as HTMLFormElement | null)?.requestSubmit();
    else a.onClick?.();
  };
  const PrimaryIcon = primary?.icon;
  return (
    <div className="flex items-center gap-1">
      {primary && PrimaryIcon && (
        <Button size="icon-lg" className="size-11" aria-label={primary.label} title={primary.label} disabled={primary.disabled} onClick={() => run(primary)}>
          <PrimaryIcon />
        </Button>
      )}
      {rest.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-lg" className="size-11" aria-label="Thao tác khác">
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            {rest.map((a) => (
              <DropdownMenuItem
                key={a.label}
                className="h-11 text-base"
                variant={a.danger ? 'destructive' : 'default'}
                disabled={a.disabled}
                onSelect={() => run(a)}
              >
                <a.icon />
                {a.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

/** Tiêu đề trang + nút hành động trên topbar; tại chỗ không vẽ gì. */
export function PageTitle({ title, count, back, actions = [] }: Props) {
  const slot = useContext(TitleSlotContext);
  const { data: settings } = useSettings();
  const store = settings?.storeName || 'Tạp hóa';
  useEffect(() => {
    document.title = `${title} · ${store}`;
  }, [title, store]);
  if (!slot) return null;
  return createPortal(
    <>
      {back && (
        <Button variant="ghost" size="icon-lg" className="-ml-2 size-11 md:size-9" aria-label="Quay lại" title="Quay lại" asChild>
          <Link to={back}>
            <ArrowLeft />
          </Link>
        </Button>
      )}
      {/* Điện thoại: số đếm thành dòng thứ hai dưới tiêu đề (kiểm kê cần thấy tiến độ phiên) */}
      <div className="flex min-w-0 flex-col sm:flex-row sm:items-baseline sm:gap-2">
        <h1 className="truncate font-heading text-lg leading-tight font-semibold">{title}</h1>
        {count && <span className="truncate text-xs text-muted-foreground tabular-nums sm:text-sm">{count}</span>}
      </div>
      {actions.length > 0 && (
        <>
          <div className="ml-auto hidden items-center gap-2 md:flex">
            {actions.map((a) => (
              <DesktopAction key={a.label} a={a} />
            ))}
          </div>
          <div className="ml-auto md:hidden">
            <MobileActions actions={actions} />
          </div>
        </>
      )}
    </>,
    slot,
  );
}
