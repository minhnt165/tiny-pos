import { useCurrentStocktake } from '@/api/stocktakes';
import { Skeleton } from '@/components/ui/skeleton';
import { StocktakeSession } from './StocktakeSession';
import { StocktakeStart } from './StocktakeStart';

/** Có phiên đang mở thì vào màn đếm, không thì màn bắt đầu + lịch sử. */
export function StocktakePage() {
  const { data: current, isLoading } = useCurrentStocktake();
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  return current ? <StocktakeSession session={current} /> : <StocktakeStart />;
}
