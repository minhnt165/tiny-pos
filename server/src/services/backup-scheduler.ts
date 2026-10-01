import fs from 'node:fs';
import { localDate } from '@tiny-pos/shared';
import type { BackupService } from './backups.js';
import { resolveClock, type Clock } from './daily-code.js';

export interface SchedulerOpts {
  service: BackupService;
  /** Đường dẫn grocery.db để so mtime (kèm file -wal). */
  dbFile: string;
  /** Mặc định 15 phút. */
  intervalMs?: number;
  clock?: Clock;
  log?: (s: string) => void;
}

const mtime = (file: string): number => {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return 0;
  }
};

/**
 * Sao lưu tự động: mỗi ngày địa phương tối đa một bản `auto`, và chỉ khi DB có thay đổi
 * (mtime của .db hoặc .db-wal mới hơn bản auto gần nhất). Chỉ index.ts gọi start().
 */
export function createBackupScheduler(o: SchedulerOpts) {
  const log = o.log ?? console.log;
  const tick = async (now?: Date): Promise<void> => {
    const { now: at, tz } = resolveClock({ ...o.clock, ...(now ? { now } : {}) });
    const last = o.service.lastAutoAt();
    if (last) {
      if (localDate(new Date(last), tz) === localDate(at, tz)) return;
      const lastMs = Date.parse(last);
      if (mtime(o.dbFile) <= lastMs && mtime(`${o.dbFile}-wal`) <= lastMs) return;
    }
    try {
      const item = await o.service.create('auto');
      o.service.noteAutoError(null);
      log(`Sao lưu tự động: ${item.name}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      o.service.noteAutoError(message);
      log(`Sao lưu tự động lỗi: ${message}`);
    }
  };
  let timer: NodeJS.Timeout | undefined;
  return {
    tick,
    start: () => {
      void tick();
      timer = setInterval(() => void tick(), o.intervalMs ?? 15 * 60_000);
      timer.unref();
    },
    stop: () => clearInterval(timer),
  };
}
