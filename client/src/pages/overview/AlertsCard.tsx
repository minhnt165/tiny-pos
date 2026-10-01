import { CircleCheck, ClipboardList, DatabaseBackup, PackageMinus, PackageX, TriangleAlert, Users, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { BACKUP_STALE_DAYS, currentTzOffset, DEBT_OVERDUE_DAYS, formatDateVn, formatMoney, localDate, shiftDate, type Overview } from '@tiny-pos/shared';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type Tone = 'warning' | 'destructive';
interface Alert {
  key: string;
  icon: LucideIcon;
  text: string;
  tone: Tone;
  to: string;
  action: string;
}
const TONE: Record<Tone, string> = { warning: 'text-warning', destructive: 'text-destructive' };
const localDay = (iso: string) => localDate(new Date(iso), currentTzOffset());

/** Danh sách cảnh báo theo thứ tự spec: sao lưu lỗi → sao lưu cũ → kiểm kê dở → hết hàng → sắp hết → nợ lâu. */
export function buildAlerts(o: Overview, today: string): Alert[] {
  const list: Alert[] = [];
  const b = o.backup;
  if (b?.lastError) list.push({ key: 'backup-error', icon: DatabaseBackup, text: `Sao lưu tự động gần nhất bị lỗi: ${b.lastError}`, tone: 'destructive', to: '/settings', action: 'Cài đặt' });
  if (b?.extraError) list.push({ key: 'backup-extra', icon: DatabaseBackup, text: `Không chép được bản sao sang thư mục thêm: ${b.extraError}`, tone: 'warning', to: '/settings', action: 'Cài đặt' });
  if (b && !b.lastBackupAt) list.push({ key: 'backup-none', icon: DatabaseBackup, text: 'Chưa có bản sao lưu nào', tone: 'warning', to: '/settings', action: 'Cài đặt' });
  else if (b?.lastBackupAt && localDay(b.lastBackupAt) < shiftDate(today, -BACKUP_STALE_DAYS))
    list.push({ key: 'backup-stale', icon: DatabaseBackup, text: `Chưa sao lưu từ ${formatDateVn(localDay(b.lastBackupAt))}`, tone: 'warning', to: '/settings', action: 'Cài đặt' });
  if (o.stocktake)
    list.push({ key: 'stocktake', icon: ClipboardList, text: `Kiểm kê ${o.stocktake.code} đang dở, đã đếm ${o.stocktake.itemCount} món`, tone: 'warning', to: '/stocktake', action: 'Tiếp tục' });
  if (o.lowStock.outCount > 0) list.push({ key: 'out', icon: PackageX, text: `${o.lowStock.outCount} mặt hàng đã hết`, tone: 'destructive', to: '/products?stock=out', action: 'Xem' });
  if (o.lowStock.count > 0) list.push({ key: 'low', icon: PackageMinus, text: `${o.lowStock.count} mặt hàng sắp hết`, tone: 'warning', to: '/products?stock=low', action: 'Xem' });
  if (o.customers.overdueCount > 0)
    list.push({
      key: 'overdue',
      icon: Users,
      text: `${o.customers.overdueCount} khách nợ quá ${DEBT_OVERDUE_DAYS} ngày chưa trả, tổng ${formatMoney(o.customers.overdueTotal)}`,
      tone: 'warning',
      to: '/customers',
      action: 'Xem',
    });
  return list;
}

/** Thẻ "Cần chú ý": mỗi cảnh báo một dòng có nút sang trang xử lý; không có gì thì nói rõ là ổn. */
export function AlertsCard({ data, today, loading }: { data: Overview | undefined; today: string; loading: boolean }) {
  const alerts = data ? buildAlerts(data, today) : [];
  return (
    <Card className="mb-(--gap) py-0">
      <CardContent className="px-4 py-3">
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <TriangleAlert className="size-4 text-muted-foreground" />
          Cần chú ý
        </h2>
        {loading || !data ? (
          <TableSkeleton rows={2} />
        ) : alerts.length === 0 ? (
          <p className="flex items-center gap-2 py-1 text-sm text-success">
            <CircleCheck className="size-4 shrink-0" />
            Mọi thứ ổn: không có cảnh báo.
          </p>
        ) : (
          <ul className="divide-y">
            {alerts.map(({ key, icon: Icon, text, tone, to, action }) => (
              <li key={key} className="flex items-center gap-3 py-2">
                <Icon className={`size-5 shrink-0 ${TONE[tone]}`} />
                <span className="min-w-0 flex-1 text-sm">{text}</span>
                <Button variant="outline" size="sm" asChild>
                  <Link to={to}>{action}</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
