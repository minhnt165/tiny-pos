import { ClipboardList, RefreshCw } from 'lucide-react';
import { useCurrentStocktake } from '@/api/stocktakes';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StocktakeSession } from './StocktakeSession';
import { StocktakeStart } from './StocktakeStart';

/** Có phiên đang mở thì vào màn đếm, không thì màn bắt đầu + lịch sử. */
export function StocktakePage() {
  const { data: current, isLoading, isError, error, refetch } = useCurrentStocktake();
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  // Lỗi tải khác với "chưa có phiên": không cho bắt đầu phiên mới khi chưa biết đã có phiên mở hay chưa
  // Lỗi khi tải lại nền mà đã có dữ liệu thì giữ màn đang đếm
  if (isError && current === undefined)
    return (
      <EmptyState
        icon={ClipboardList}
        title="Không tải được phiên kiểm kê"
        description={error.message}
        action={
          <Button className="h-11 text-base" onClick={() => void refetch()}>
            <RefreshCw data-icon="inline-start" />
            Thử lại
          </Button>
        }
      />
    );
  return current ? <StocktakeSession session={current} /> : <StocktakeStart />;
}
