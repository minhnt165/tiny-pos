import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Khung danh sách: thanh công cụ (tìm, lọc), nội dung (bảng/thẻ), chân (phân trang, tổng). */
export function ListPanel({ toolbar, footer, children, className }: { toolbar?: ReactNode; footer?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('overflow-hidden rounded-lg border bg-card', className)}>
      {toolbar && <div className="flex flex-wrap items-center gap-2 border-b p-3">{toolbar}</div>}
      {children}
      {footer}
    </section>
  );
}
