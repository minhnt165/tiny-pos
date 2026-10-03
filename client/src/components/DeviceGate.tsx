import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useDevice } from '@/api/device';
import { Skeleton } from '@/components/ui/skeleton';
import { PairScreen } from '@/pages/pair/PairScreen';

/**
 * Máy trong LAN chưa ghép → màn ghép thay cả app (kể cả /pos, /labels/print). Máy quầy / đã ghép → render bình thường.
 * Không gọi được server (mất mạng, 5xx) → vẫn render app để các trang tự báo lỗi, không bắt ghép.
 */
export function DeviceGate({ children }: { children: ReactNode }) {
  const { pathname, search } = useLocation();
  const { data, isPending } = useDevice();
  if (isPending)
    return (
      <div className="grid min-h-svh place-items-center p-4">
        <Skeleton className="h-40 w-full max-w-sm rounded-xl" />
      </div>
    );
  if (data?.kind === 'unpaired') return <PairScreen autoCode={pathname === '/pair' ? new URLSearchParams(search).get('code') : null} />;
  if (pathname === '/pair') return <Navigate to="/" replace />;
  return children;
}
