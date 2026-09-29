import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
}

/** Thanh tiêu đề trang: icon, tên, mô tả ngắn và các nút hành động bên phải. */
export function PageHeader({ title, description, icon: Icon, actions }: Props) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-4 md:mb-6">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-6" />
          </div>
        )}
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
