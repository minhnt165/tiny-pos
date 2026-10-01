import { useRef, useState, type KeyboardEvent } from 'react';
import { DatabaseBackup, Download, History, MoreHorizontal, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { BackupItem, BackupKind } from '@tiny-pos/shared';
import { useBackups, useCreateBackup, useDeleteBackup, useRestoreBackup, useRestoreUpload, useSaveExtraDir } from '@/api/backups';
import { downloadFile } from '@/api/client';
import { useConfirm } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { SectionTitle, TextField } from '@/components/TextField';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const KIND_LABEL: Record<BackupKind, string> = { auto: 'Tự động', manual: 'Thủ công', 'before-restore': 'Trước khôi phục' };
const SHOW = 8;
const RESTORE_DESC =
  'Toàn bộ dữ liệu hiện tại (hóa đơn, tồn kho, công nợ, cài đặt…) sẽ bị thay bằng dữ liệu trong bản sao. Bản hiện tại được tự sao lưu trước khi thay.';
const RESTORED = 'Đã khôi phục. Bản trước khi khôi phục được giữ trong danh sách.';

const when = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;

function BackupMenu({ onDownload, onRestore, onDelete }: { onDownload: () => void; onRestore: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon-lg" aria-label="Thao tác" title="Thao tác">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem onSelect={onDownload}>
          <Download />
          Tải về
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onRestore}>
          <History />
          Khôi phục
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
          <Trash2 />
          Xóa
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Thẻ Sao lưu trong Cài đặt. Nằm trong form cài đặt nên mọi nút là type="button"; Enter ở ô thư mục chỉ lưu thư mục. */
export function BackupCard() {
  const { data, isLoading } = useBackups();
  const create = useCreateBackup();
  const saveDir = useSaveExtraDir();
  const del = useDeleteBackup();
  const restore = useRestoreBackup();
  const upload = useRestoreUpload();
  const confirm = useConfirm();
  // null = chưa sửa, hiện giá trị từ server
  const [dir, setDir] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const busy = restore.isPending || upload.isPending;
  const items = data?.items ?? [];
  const shown = showAll ? items : items.slice(0, SHOW);
  const dirValue = dir ?? data?.extraDir ?? '';
  const fail = (e: Error) => toast.error(e.message);

  const saveExtraDir = () => {
    if (dir === null) return;
    saveDir.mutate(dirValue, {
      onSuccess: () => {
        setDir(null);
        toast.success('Đã lưu thư mục');
      },
      onError: fail,
    });
  };
  const onDirKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    saveExtraDir();
  };

  const onRestore = async (b: BackupItem) => {
    const ok = await confirm({ title: `Khôi phục dữ liệu từ bản lúc ${when(b.createdAt)}?`, description: RESTORE_DESC, confirmText: 'Khôi phục', destructive: true });
    if (!ok) return;
    restore.mutate(b.name, { onSuccess: () => toast.success(RESTORED), onError: fail });
  };
  const onUpload = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    const ok = await confirm({ title: `Khôi phục dữ liệu từ file "${file.name}"?`, description: RESTORE_DESC, confirmText: 'Khôi phục', destructive: true });
    if (!ok) return;
    upload.mutate(file, { onSuccess: () => toast.success(RESTORED), onError: fail });
  };
  const onDelete = async (b: BackupItem) => {
    const ok = await confirm({ title: `Xóa bản sao lúc ${when(b.createdAt)}?`, confirmText: 'Xóa', destructive: true });
    if (ok) del.mutate(b.name, { onError: fail });
  };
  const onDownload = (b: BackupItem) => downloadFile(`/backups/${b.name}/download`).catch(fail);

  return (
    <Card>
      <CardContent>
        <fieldset disabled={busy} aria-busy={busy} className="space-y-4">
          <div>
            <SectionTitle>Sao lưu dữ liệu</SectionTitle>
            <p className="text-sm text-muted-foreground">
              Tự sao lưu khi mở phần mềm và mỗi ngày một lần vào thư mục <span className="font-mono break-all">{data?.dir ?? '…'}</span>. Giữ 30
              bản tự động gần nhất.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ảnh sản phẩm nằm ở thư mục <span className="font-mono">data\images</span>, không có trong file <span className="font-mono">.db</span>; thư mục
              chép thêm được chép cả ảnh.
            </p>
          </div>
          <div className="space-y-1 text-sm">
            <p>
              Bản tự động gần nhất: <span className="font-medium">{data?.lastAutoAt ? when(data.lastAutoAt) : 'chưa có'}</span>
            </p>
            {data?.lastError && <p className="text-destructive">Sao lưu tự động lỗi: {data.lastError}</p>}
            {data?.extraError && <p className="text-warning">{data.extraError} (USB chưa cắm?)</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="h-11 text-base"
              disabled={create.isPending}
              onClick={() => create.mutate(undefined, { onSuccess: () => toast.success('Đã sao lưu'), onError: fail })}
            >
              <DatabaseBackup data-icon="inline-start" />
              {create.isPending ? 'Đang sao lưu…' : 'Sao lưu ngay'}
            </Button>
            <Button type="button" variant="outline" className="h-11 text-base" onClick={() => fileRef.current?.click()}>
              <Upload data-icon="inline-start" />
              Khôi phục từ file…
            </Button>
            <input ref={fileRef} type="file" accept=".db" className="hidden" onChange={(e) => void onUpload(e.target.files?.[0])} />
          </div>
          <div className="space-y-2">
            <TextField
              id="st-backup-dir"
              label="Thư mục chép thêm"
              placeholder="D:\sao-luu"
              hint="Để trống nếu không chép thêm. Nên là USB hoặc thư mục OneDrive/Google Drive để máy hỏng vẫn còn dữ liệu."
              value={dirValue}
              onChange={(e) => setDir(e.target.value)}
              onKeyDown={onDirKey}
            />
            <Button type="button" variant="outline" disabled={dir === null || saveDir.isPending} onClick={saveExtraDir}>
              Lưu thư mục
            </Button>
          </div>
          {!isLoading && items.length === 0 ? (
            <EmptyState icon={DatabaseBackup} title="Chưa có bản sao lưu" />
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="px-4">Thời điểm</TableHead>
                    <TableHead>Loại</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Dung lượng</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((b) => (
                    <TableRow key={b.name}>
                      <TableCell className="px-4 font-medium tabular-nums">{when(b.createdAt)}</TableCell>
                      <TableCell>
                        <Badge variant={b.kind === 'auto' ? 'secondary' : 'default'}>{KIND_LABEL[b.kind]}</Badge>
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">{fmtSize(b.size)}</TableCell>
                      <TableCell className="text-right">
                        <BackupMenu onDownload={() => void onDownload(b)} onRestore={() => void onRestore(b)} onDelete={() => void onDelete(b)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {items.length > SHOW && !showAll && (
            <Button type="button" variant="ghost" onClick={() => setShowAll(true)}>
              Hiện tất cả ({items.length})
            </Button>
          )}
        </fieldset>
      </CardContent>
    </Card>
  );
}
