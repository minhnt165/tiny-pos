import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Tên đơn vị đếm ở dòng "Hiển thị 1–20 / 80 …". */
  noun?: string;
}

/** Các số trang cần hiện: trang đầu, cuối và hai bên trang hiện tại; chỗ bị bỏ từ 2 trang trở lên là "…". */
function pageItems(page: number, pages: number): (number | '…')[] {
  const keep = [...new Set([1, page - 1, page, page + 1, pages])].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  keep.forEach((p, i) => {
    const gap = i > 0 ? p - keep[i - 1]! : 1;
    if (gap === 2) out.push(p - 1);
    else if (gap > 2) out.push('…');
    out.push(p);
  });
  return out;
}

/** Thanh phân trang cuối bảng: số dòng đang xem, nút trước/sau và số trang. */
export function Pager({ page, pageSize, total, onPageChange, noun = 'dòng' }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
      <span className="text-sm text-muted-foreground tabular-nums">
        Hiển thị {from}–{to} / {total} {noun}
      </span>
      {pages > 1 && (
        <nav className="flex items-center gap-1" aria-label="Phân trang">
          <Button variant="outline" size="icon-lg" aria-label="Trang trước" disabled={page === 1} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft />
          </Button>
          <span className="px-2 text-sm font-medium tabular-nums sm:hidden">
            {page} / {pages}
          </span>
          <div className="hidden items-center gap-1 sm:flex">
            {pageItems(page, pages).map((p, i) =>
              p === '…' ? (
                <span key={`gap-${i}`} className="w-8 text-center text-muted-foreground">
                  …
                </span>
              ) : (
                <Button
                  key={p}
                  variant={p === page ? 'default' : 'ghost'}
                  size="icon-lg"
                  className="tabular-nums"
                  aria-current={p === page ? 'page' : undefined}
                  onClick={() => onPageChange(p)}
                >
                  {p}
                </Button>
              ),
            )}
          </div>
          <Button variant="outline" size="icon-lg" aria-label="Trang sau" disabled={page === pages} onClick={() => onPageChange(page + 1)}>
            <ChevronRight />
          </Button>
        </nav>
      )}
    </div>
  );
}
