import type { ReactNode } from 'react';
import { LogIn, LogOut, ShieldX, Store, WifiOff } from 'lucide-react';
import { signIn, signOutUser, useUser } from './auth';
import { useRemoteOverview } from './overview';
import { Button } from './components/ui/button';
import { Skeleton } from './components/ui/skeleton';
import { Header } from './blocks/Header';
import { TodayStats } from './blocks/TodayStats';
import { Alerts } from './blocks/Alerts';
import { WeekTable } from './blocks/WeekTable';
import { RecentOrders } from './blocks/RecentOrders';
import { LowStock } from './blocks/LowStock';
import { DebtList } from './blocks/DebtList';
import { BackupLine } from './blocks/BackupLine';

/** Màn giữa trang cho các trạng thái không có dữ liệu. */
function Centered({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">{children}</main>;
}

function Dashboard({ uid, email }: { uid: string; email: string }) {
  const state = useRemoteOverview(uid);
  if (state.status === 'loading')
    return (
      <main className="mx-auto max-w-3xl space-y-3 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </main>
    );
  if (state.status === 'denied')
    return (
      <Centered>
        <ShieldX className="size-12 text-destructive" />
        <h1 className="text-xl font-semibold">Chưa được cấp quyền xem</h1>
        <p className="text-muted-foreground">
          Tài khoản <span className="font-medium text-foreground">{email}</span> chưa có trong danh sách. Trên máy quầy vào Cài đặt → Xem từ xa và thêm email này.
        </p>
        <Button variant="outline" onClick={() => void signOutUser()}>
          <LogOut data-icon="inline-start" />
          Đăng xuất
        </Button>
      </Centered>
    );
  // Ngoại tuyến mà chưa có bản cache: Firestore trả snapshot rỗng fromCache → không được nói "máy quầy chưa gửi"
  if (state.status === 'missing' && state.fromCache)
    return (
      <Centered>
        <WifiOff className="size-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Điện thoại đang ngoại tuyến</h1>
        <p className="text-muted-foreground">Chưa tải được số liệu. Có mạng lại trang sẽ tự cập nhật.</p>
      </Centered>
    );
  if (state.status === 'missing')
    return (
      <Centered>
        <Store className="size-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Máy quầy chưa gửi số liệu lần nào</h1>
        <p className="text-muted-foreground">Trên máy quầy vào Cài đặt → Xem từ xa → Gửi ngay. Trang này sẽ tự cập nhật.</p>
        <Button variant="outline" onClick={() => void signOutUser()}>
          <LogOut data-icon="inline-start" />
          Đăng xuất
        </Button>
      </Centered>
    );
  const { doc, fromCache } = state;
  const o = doc.data;
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4 pb-8">
      <Header storeName={doc.storeName} updatedAt={doc.updatedAt} fromCache={fromCache} />
      <TodayStats week={o.week} outCount={o.lowStock.outCount} />
      <Alerts data={o} />
      <WeekTable week={o.week} today={o.today} />
      <RecentOrders orders={o.recentOrders} count={o.week.rows[0]?.orders ?? 0} />
      <LowStock low={o.lowStock} />
      <DebtList title="Khách nợ" summary={o.customers} rows={o.customers.top} emptyTitle="Không ai đang nợ" />
      <DebtList title="Nợ nhà cung cấp" summary={o.suppliers} rows={o.suppliers.top} emptyTitle="Không nợ nhà cung cấp nào" />
      <BackupLine backup={o.backup} />
      <p className="text-center text-xs text-muted-foreground">Tiny POS {doc.appVersion} · trang xem {__APP_VERSION__}</p>
    </main>
  );
}

export default function App() {
  const { user, ready } = useUser();
  if (!ready) return null;
  if (!user)
    return (
      <Centered>
        <Store className="size-12 text-primary" />
        <h1 className="text-2xl font-semibold">Tạp hóa – Xem từ xa</h1>
        <p className="text-muted-foreground">Đăng nhập bằng tài khoản Google đã được chủ tiệm cho phép.</p>
        <Button className="h-12 text-base" onClick={() => void signIn()}>
          <LogIn data-icon="inline-start" />
          Đăng nhập bằng Google
        </Button>
      </Centered>
    );
  return <Dashboard uid={user.uid} email={user.email ?? ''} />;
}
