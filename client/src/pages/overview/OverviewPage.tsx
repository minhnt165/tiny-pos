import { LayoutDashboard, RefreshCw, Truck, Users } from 'lucide-react';
import { formatDateVn } from '@tiny-pos/shared';
import { useOverview } from '@/api/overview';
import { EmptyState } from '@/components/EmptyState';
import { PageTitle } from '@/components/layout/PageTitle';
import { Button } from '@/components/ui/button';
import { today as todayOf } from '@/lib/today';
import { AlertsCard } from './AlertsCard';
import { DebtPanel } from './DebtPanel';
import { LowStockList } from './LowStockList';
import { RecentOrders } from './RecentOrders';
import { TodayStats } from './TodayStats';
import { WeekTable } from './WeekTable';

/**
 * Tổng quan: một API, tự làm mới mỗi phút. Hôm nay và Cần chú ý chiếm cả hàng; 5 khối còn lại lưới 2 cột trên máy tính.
 * Ngày lấy theo server khi đã có dữ liệu (điện thoại và máy quầy cùng một "hôm nay").
 * Lỗi tải (server tắt): chưa có số thì màn Thử lại như trang Kiểm kê; đã có số cũ thì giữ nguyên và báo một dòng.
 */
export function OverviewPage() {
  const { data, isLoading, isFetching, isError, error, refetch } = useOverview();
  const today = data?.today ?? todayOf();
  const loading = isLoading || !data;
  const title = (
    <PageTitle
      title="Tổng quan"
      count={formatDateVn(today)}
      actions={[{ label: isFetching ? 'Đang tải…' : 'Làm mới', icon: RefreshCw, onClick: () => void refetch(), disabled: isFetching }]}
    />
  );
  if (isError && data === undefined)
    return (
      <>
        {title}
        <EmptyState
          icon={LayoutDashboard}
          title="Không tải được tổng quan"
          description={error.message}
          action={
            <Button className="h-11 text-base" onClick={() => void refetch()}>
              <RefreshCw data-icon="inline-start" />
              Thử lại
            </Button>
          }
        />
      </>
    );
  return (
    <>
      {title}
      {isError && <p className="mb-(--gap) text-sm text-destructive">Không tải được số liệu mới ({error.message}). Số đang hiện là của lần tải trước.</p>}
      <TodayStats week={data?.week} outCount={data?.lowStock.outCount} />
      <AlertsCard data={data} today={today} loading={loading} />
      <div className="grid gap-(--gap) lg:grid-cols-2">
        <WeekTable week={data?.week} today={today} loading={loading} />
        <RecentOrders orders={data?.recentOrders} count={data?.week.rows[0]?.orders} loading={loading} />
        <LowStockList low={data?.lowStock} loading={loading} />
        <DebtPanel
          title="Khách nợ"
          icon={Users}
          debtHeader="Đang nợ"
          summary={data?.customers}
          rows={data?.customers.top}
          listPath="/customers"
          loading={loading}
          emptyTitle="Không ai đang nợ"
        />
        <DebtPanel
          title="Nợ nhà cung cấp"
          icon={Truck}
          debtHeader="Còn nợ"
          summary={data?.suppliers}
          rows={data?.suppliers.top}
          listPath="/suppliers"
          loading={loading}
          emptyTitle="Không nợ nhà cung cấp nào"
        />
      </div>
    </>
  );
}
