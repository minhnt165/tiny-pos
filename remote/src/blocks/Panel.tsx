import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';

/** Một khối: tiêu đề + số đếm bên phải + nội dung; không nút hành động vì trang chỉ đọc. */
export function Panel({ title, count, children }: { title: string; count?: string; children: ReactNode }) {
  return (
    <Card className="py-0">
      <CardContent className="px-0">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {count && <span className="text-sm text-muted-foreground">{count}</span>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="border-t px-4 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}
