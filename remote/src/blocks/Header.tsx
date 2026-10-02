import { useEffect, useState } from 'react';
import { LogOut, WifiOff } from 'lucide-react';
import { REMOTE_STALE_MS, formatDateVn } from '@tiny-pos/shared';
import { Button } from '@/components/ui/button';
import { signOutUser } from '../auth';
import { localDay, time } from './format';

/** Cập nhật lúc HH:mm (kèm ngày nếu không phải hôm nay của điện thoại); quá REMOTE_STALE_MS thì cảnh báo máy quầy có thể tắt. Tính lại mỗi 30 s. */
export function Header({ storeName, updatedAt, fromCache }: { storeName: string; updatedAt: string; fromCache: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const stale = now - Date.parse(updatedAt) > REMOTE_STALE_MS;
  const day = localDay(updatedAt);
  const sameDay = day === localDay(new Date(now).toISOString());
  const at = sameDay ? time(updatedAt) : `${time(updatedAt)} ${formatDateVn(day)}`;
  return (
    <header className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold">{storeName}</h1>
        {stale ? (
          <p className="text-sm text-warning">Máy quầy chưa gửi số mới từ {at}, có thể đang tắt hoặc mất mạng.</p>
        ) : (
          <p className="text-sm text-muted-foreground">Cập nhật lúc {at}</p>
        )}
        {fromCache && (
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <WifiOff className="size-3.5" />
            Điện thoại đang ngoại tuyến, số đang hiện là bản đã tải.
          </p>
        )}
      </div>
      <Button variant="ghost" size="icon-lg" aria-label="Đăng xuất" title="Đăng xuất" onClick={() => void signOutUser()}>
        <LogOut />
      </Button>
    </header>
  );
}
