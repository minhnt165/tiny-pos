import { Router } from 'express';
import type { OverviewBackup } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import type { BackupService } from '../services/backups.js';
import { overview } from '../services/overview.js';

/** Phần sao lưu của Tổng quan: bản mới nhất bất kỳ loại nào + lỗi gần nhất. */
function backupSummary(backups: BackupService): OverviewBackup {
  const s = backups.status();
  return { lastBackupAt: s.items[0]?.createdAt ?? null, lastAutoAt: s.lastAutoAt, lastError: s.lastError, extraError: s.extraError };
}

/** Tổng quan chỉ đọc, không query; `backup` null khi server không cấu hình sao lưu (test). */
export function overviewRouter(db: Db, backups?: BackupService): Router {
  const r = Router();
  r.get('/', (_req, res) => res.json({ ...overview(db), backup: backups ? backupSummary(backups) : null }));
  return r;
}
