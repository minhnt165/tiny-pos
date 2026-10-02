import { Router } from 'express';
import type { Db } from '../db/connection.js';
import type { BackupService } from '../services/backups.js';
import { backupSummary, overview } from '../services/overview.js';

/** Tổng quan chỉ đọc, không query; `backup` null khi server không cấu hình sao lưu (test). */
export function overviewRouter(db: Db, backups?: BackupService): Router {
  const r = Router();
  r.get('/', (_req, res) => res.json({ ...overview(db), backup: backups ? backupSummary(backups) : null }));
  return r;
}
