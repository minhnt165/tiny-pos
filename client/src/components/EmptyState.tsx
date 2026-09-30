import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

interface Props {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

/** Trạng thái rỗng gọn: icon nhỏ, tiêu đề, hướng dẫn, nút tùy chọn. */
export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <Empty className="py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="size-10 rounded-lg bg-muted text-muted-foreground [&_svg]:size-5">
          <Icon />
        </EmptyMedia>
        <EmptyTitle className="text-base">{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}
