import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { Device } from '@tiny-pos/shared';
import { useRenameDevice } from '@/api/device';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/** Đổi tên thiết bị. Không dùng <form> vì thẻ nằm trong form cài đặt chung: Enter ở ô tên chỉ lưu tên. */
export function RenameDeviceDialog({ device, onClose }: { device: Device | null; onClose: () => void }) {
  const rename = useRenameDevice();
  const [name, setName] = useState('');
  useEffect(() => {
    if (device) setName(device.name);
  }, [device]);

  const save = () => {
    if (!device || !name.trim()) return;
    rename.mutate(
      { id: device.id, name: name.trim() },
      {
        onSuccess: () => {
          toast.success('Đã đổi tên');
          onClose();
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <Dialog open={!!device} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Đổi tên thiết bị</DialogTitle>
        </DialogHeader>
        <TextField
          id="device-name"
          label="Tên"
          maxLength={50}
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            save();
          }}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button type="button" disabled={!name.trim() || rename.isPending} onClick={save}>
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
