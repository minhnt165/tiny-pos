import { DatabaseBackup } from 'lucide-react';
import type { OverviewBackup } from '@tiny-pos/shared';
import { Card, CardContent } from '@/components/ui/card';
import { localDay, shortDay, time } from './format';

/** Một dòng sao lưu; `backup` null (server không cấu hình) thì không hiện. */
export function BackupLine({ backup }: { backup: OverviewBackup | null }) {
  if (!backup) return null;
  const at = backup.lastBackupAt ? `${time(backup.lastBackupAt)} ${shortDay(localDay(backup.lastBackupAt))}` : 'chưa có';
  return (
    <Card className="py-0">
      <CardContent className="flex items-center gap-3 px-4 py-3 text-sm">
        <DatabaseBackup className="size-5 shrink-0 text-muted-foreground" />
        <span>
          Sao lưu gần nhất: <span className="font-medium">{at}</span>
        </span>
        {backup.lastError && <span className="ml-auto text-destructive">Lỗi: {backup.lastError}</span>}
      </CardContent>
    </Card>
  );
}
