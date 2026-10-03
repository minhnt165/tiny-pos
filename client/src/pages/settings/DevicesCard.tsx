import { useState } from 'react';
import { MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Device } from '@tiny-pos/shared';
import { useDevice, useDevices, useRevokeDevice } from '@/api/device';
import { useConfirm } from '@/components/ConfirmDialog';
import { SectionTitle } from '@/components/TextField';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { today } from '@/lib/today';
import { PairDialog } from './PairDialog';
import { RenameDeviceDialog } from './RenameDeviceDialog';

const dmy = (iso: string) => new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
/** last_seen_on (YYYY-MM-DD giờ địa phương) → "hôm nay" / "dd/mm" / "chưa dùng". */
const seen = (d: string | null) => (!d ? 'chưa dùng' : d === today() ? 'hôm nay' : `${d.slice(8, 10)}/${d.slice(5, 7)}`);

/**
 * Thẻ Thiết bị trong Cài đặt. Máy quầy: danh sách, ghép, đổi tên, gỡ. Điện thoại đã ghép: chỉ hiện tên máy này.
 * Nằm trong form cài đặt chung nên mọi nút là type="button".
 */
export function DevicesCard() {
  const { data: me } = useDevice();
  const counter = me?.kind === 'counter';
  const [pairing, setPairing] = useState(false);
  const [renaming, setRenaming] = useState<Device | null>(null);
  const { data: list } = useDevices(counter, pairing ? 2000 : false);
  const revoke = useRevokeDevice();
  const confirm = useConfirm();

  if (me?.kind === 'paired')
    return (
      <Card>
        <CardContent className="space-y-2">
          <SectionTitle>Thiết bị</SectionTitle>
          <p className="text-sm">
            Thiết bị này: <span className="font-medium">{me.device.name}</span>. Thêm hoặc gỡ thiết bị trên máy quầy.
          </p>
        </CardContent>
      </Card>
    );
  if (!counter) return null;

  const remove = async (d: Device) => {
    const ok = await confirm({ title: `Gỡ ${d.name}?`, description: 'Điện thoại này phải ghép lại mới dùng được.', confirmText: 'Gỡ', destructive: true });
    if (!ok) return;
    revoke.mutate(d.id, { onSuccess: () => toast.success(`Đã gỡ ${d.name}`), onError: (e) => toast.error(e.message) });
  };

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <SectionTitle>Thiết bị</SectionTitle>
            <p className="text-sm text-muted-foreground">Điện thoại trong nhà phải ghép một lần mới dùng được. Máy quầy này luôn dùng được.</p>
          </div>
          <Button type="button" className="h-11 text-base" onClick={() => setPairing(true)}>
            <Plus data-icon="inline-start" />
            Ghép điện thoại
          </Button>
        </div>
        {!list?.length ? (
          <p className="text-sm text-muted-foreground">Chưa có điện thoại nào được ghép.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {list.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{d.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Ghép {dmy(d.createdAt)} · Dùng lần cuối {seen(d.lastSeenOn)}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Thao tác với ${d.name}`}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setRenaming(d)}>
                      <Pencil />
                      Đổi tên
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onSelect={() => void remove(d)}>
                      <Trash2 />
                      Gỡ
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )}
        <PairDialog open={pairing} onOpenChange={setPairing} devices={list} />
        <RenameDeviceDialog device={renaming} onClose={() => setRenaming(null)} />
      </CardContent>
    </Card>
  );
}
