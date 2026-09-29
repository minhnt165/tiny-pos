import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';

interface Props {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

/** Trạng thái rỗng có icon và hướng dẫn thay vì một dòng chữ xám. */
export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <Empty className="py-12">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="size-14 rounded-2xl bg-primary/10 text-primary [&_svg]:size-7">
          <Icon />
        </EmptyMedia>
        <EmptyTitle className="text-base">{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}
