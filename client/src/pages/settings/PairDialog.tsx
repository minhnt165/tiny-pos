import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import type { Device, PairingInfo } from '@tiny-pos/shared';
import { useStartPairing } from '@/api/device';
import { UrlQr } from '@/components/UrlQr';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Danh sách thiết bị đang được hỏi lại mỗi 2 giây (DevicesCard); có máy mới thì báo và tự đóng. */
  devices: Device[] | undefined;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Hộp thoại ghép: tạo mã khi mở, QR + mã 6 số + đếm ngược; đóng tay không hủy mã (tự hết hạn sau 5 phút). */
export function PairDialog({ open, onOpenChange, devices }: Props) {
  const start = useStartPairing();
  const [info, setInfo] = useState<PairingInfo | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Id thiết bị có sẵn lúc mở: id mới xuất hiện = vừa ghép xong
  const known = useRef<Set<number> | null>(null);
  // StrictMode chạy effect hai lần: mỗi lần mở chỉ tạo một mã (mã thứ hai làm mã đầu thành sai)
  const started = useRef(false);

  // Đặt lại `now` cùng lúc nhận mã: hộp thoại đóng thì đồng hồ dừng, giá trị cũ làm đếm ngược sai cho tới nhịp đầu tiên
  const newCode = () =>
    start.mutate(undefined, {
      onSuccess: (i) => {
        setNow(Date.now());
        setInfo(i);
      },
      onError: (e) => toast.error(e.message),
    });

  useEffect(() => {
    if (!open) {
      started.current = false;
      known.current = null;
      setInfo(null);
      return;
    }
    if (started.current) return;
    started.current = true;
    known.current = devices ? new Set(devices.map((d) => d.id)) : null;
    newCode();
  }, [open]);

  useEffect(() => {
    if (!open || !devices) return;
    if (!known.current) {
      known.current = new Set(devices.map((d) => d.id));
      return;
    }
    const added = devices.find((d) => !known.current!.has(d.id));
    if (!added) return;
    toast.success(`Đã ghép ${added.name}`);
    onOpenChange(false);
  }, [devices, open]);

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open]);

  const left = info ? Math.max(0, Math.ceil((Date.parse(info.expiresAt) - now) / 1000)) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ghép điện thoại</DialogTitle>
          <DialogDescription>Điện thoại bắt Wi‑Fi của tiệm rồi mở camera quét mã; hoặc mở địa chỉ máy quầy và gõ mã 6 số.</DialogDescription>
        </DialogHeader>
        {!info ? (
          <Skeleton className="mx-auto size-40" />
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <UrlQr url={info.url} alt="Mã QR ghép điện thoại" />
            <p className="font-mono text-4xl font-semibold tracking-[0.3em]">
              {info.code.slice(0, 3)} {info.code.slice(3)}
            </p>
            {left > 0 ? <p className="text-sm text-muted-foreground">Còn {mmss(left)}</p> : <p className="text-sm text-warning">Mã đã hết hạn</p>}
            <p className="break-all text-xs text-muted-foreground">{info.url.split('/pair')[0]}</p>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={start.isPending} onClick={newCode}>
            <RefreshCw data-icon="inline-start" />
            Tạo mã mới
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Xong
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
