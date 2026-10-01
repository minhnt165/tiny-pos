import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';
import { BACKUP_NAME_RE, type BackupItem, type BackupKind, type BackupStatus, type RestoreResult } from '@tiny-pos/shared';
import { registerFunctions, type Db } from '../db/connection.js';
import { settings } from '../db/schema.js';
import { BadRequestError, NotFoundError } from '../errors.js';
import { resolveClock, type Clock } from './daily-code.js';

export interface BackupOpts {
  /** Thư mục chứa bản sao (data/backups). */
  dir: string;
  /** Thư mục file tạm khi khôi phục từ file tải lên (data/tmp). */
  tmpDir: string;
  /** Số bản `auto` giữ lại, mặc định 30. */
  keepAuto?: number;
  clock?: Clock;
}

export interface BackupService {
  status(): BackupStatus;
  create(kind: BackupKind): Promise<BackupItem>;
  remove(name: string): void;
  /** Kiểm tên hợp lệ + tồn tại, trả đường dẫn tuyệt đối. */
  filePath(name: string): string;
  restore(name: string): Promise<RestoreResult>;
  restoreUpload(buf: Buffer): Promise<RestoreResult>;
  getExtraDir(): string;
  setExtraDir(dir: string): void;
  lastAutoAt(): string | null;
  /** Scheduler ghi lỗi sao lưu tự động để thẻ Cài đặt hiển thị; null = hết lỗi. */
  noteAutoError(message: string | null): void;
}

const EXTRA_DIR_KEY = 'backupExtraDir';
const WRITE_TEST = '.tiny-pos-write-test';

/** "YYYYMMDD-HHMMSS" theo giờ địa phương. */
function stamp(now: Date, tzOffsetMin: number): string {
  const d = new Date(now.getTime() + tzOffsetMin * 60_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

const kindOf = (name: string): BackupKind => BACKUP_NAME_RE.exec(name)![1] as BackupKind;

function listDir(dir: string): BackupItem[] {
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  return names
    .filter((n) => BACKUP_NAME_RE.test(n))
    .map((name) => {
      const st = fs.statSync(path.join(dir, name));
      return { name, kind: kindOf(name), createdAt: st.mtime.toISOString(), size: st.size };
    })
    .sort((a, b) => (a.createdAt === b.createdAt ? (a.name < b.name ? 1 : -1) : a.createdAt < b.createdAt ? 1 : -1));
}

/** Mở file SQLite tạm (kiểm tra / xác nhận), đăng ký hàm dùng chung rồi đóng sau khi dùng. */
function withSqlite<T>(file: string, options: Database.Options, fn: (d: Database.Database) => T): T {
  const d = new Database(file, options);
  try {
    registerFunctions(d);
    return fn(d);
  } finally {
    d.close();
  }
}

export function createBackupService(db: Db, opts: BackupOpts): BackupService {
  const keepAuto = opts.keepAuto ?? 30;
  const sqlite = db.$client;
  fs.mkdirSync(opts.dir, { recursive: true });
  fs.mkdirSync(opts.tmpDir, { recursive: true });

  let extraError: string | null = null;
  let lastError: string | null = null;
  let lastAuto: string | null = null;

  // Mutex: sao lưu và khôi phục nối đuôi nhau, không chạy chồng
  let queue: Promise<unknown> = Promise.resolve();
  const locked = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = queue.then(fn, fn);
    queue = run.catch(() => undefined);
    return run;
  };

  const pruneAuto = (dir: string) => {
    for (const i of listDir(dir).filter((x) => x.kind === 'auto').slice(keepAuto)) fs.rmSync(path.join(dir, i.name), { force: true });
  };

  const uniqueName = (kind: BackupKind): string => {
    const { now, tz } = resolveClock(opts.clock);
    const base = `grocery-${stamp(now, tz)}-${kind}`;
    let name = `${base}.db`;
    for (let n = 2; fs.existsSync(path.join(opts.dir, name)); n++) name = `${base}-${n}.db`;
    return name;
  };

  const getExtraDir = (): string => db.select().from(settings).where(eq(settings.key, EXTRA_DIR_KEY)).get()?.value ?? '';

  /** Chép bản vừa tạo sang thư mục thêm; lỗi chỉ ghi nhận (USB rút ra không được làm hỏng sao lưu chính). */
  const copyExtra = (name: string) => {
    const extra = getExtraDir();
    if (!extra) return;
    try {
      fs.copyFileSync(path.join(opts.dir, name), path.join(extra, name));
      pruneAuto(extra);
      extraError = null;
    } catch (e) {
      const code = (e as { code?: string } | null)?.code;
      extraError = `Không chép được sang ${extra}${code ? ` (${code})` : ''}`;
    }
  };

  const createUnlocked = async (kind: BackupKind): Promise<BackupItem> => {
    const name = uniqueName(kind);
    const final = path.join(opts.dir, name);
    const part = `${final}.part`;
    await sqlite.backup(part);
    let ok = false;
    try {
      // Về chế độ DELETE để bản sao là một file duy nhất, mở được ở bất cứ đâu
      ok = withSqlite(part, {}, (d) => {
        d.pragma('journal_mode = DELETE');
        return d.pragma('quick_check', { simple: true }) === 'ok';
      });
    } finally {
      if (!ok) fs.rmSync(part, { force: true });
    }
    if (!ok) throw new Error('Bản sao vừa tạo bị hỏng, chưa lưu');
    fs.renameSync(part, final);
    pruneAuto(opts.dir);
    copyExtra(name);
    const st = fs.statSync(final);
    const item: BackupItem = { name, kind, createdAt: st.mtime.toISOString(), size: st.size };
    if (kind === 'auto') lastAuto = item.createdAt;
    return item;
  };

  const filePath = (name: string): string => {
    if (!BACKUP_NAME_RE.test(name)) throw new BadRequestError('Tên bản sao không hợp lệ');
    const file = path.join(opts.dir, name);
    if (!fs.existsSync(file)) throw new NotFoundError('Không tìm thấy bản sao');
    return file;
  };

  const lastAutoAt = (): string | null => lastAuto ?? listDir(opts.dir).find((i) => i.kind === 'auto')?.createdAt ?? null;

  return {
    status: () => ({
      dir: opts.dir,
      extraDir: getExtraDir(),
      extraError,
      lastAutoAt: lastAutoAt(),
      lastError,
      items: listDir(opts.dir),
    }),
    create: (kind) => locked(() => createUnlocked(kind)),
    remove: (name) => {
      fs.rmSync(filePath(name));
      const extra = getExtraDir();
      if (extra) fs.rmSync(path.join(extra, name), { force: true });
    },
    filePath,
    restore: () => Promise.reject(new Error('chưa làm')),
    restoreUpload: () => Promise.reject(new Error('chưa làm')),
    getExtraDir,
    setExtraDir: (dir) => {
      const d = dir.trim();
      if (d) {
        let isDir = false;
        try {
          isDir = fs.statSync(d).isDirectory();
        } catch {
          /* không tồn tại */
        }
        if (!isDir) throw new BadRequestError('Thư mục không tồn tại');
        try {
          const probe = path.join(d, WRITE_TEST);
          fs.writeFileSync(probe, '');
          fs.rmSync(probe);
        } catch {
          throw new BadRequestError('Không ghi được vào thư mục');
        }
        db.insert(settings).values({ key: EXTRA_DIR_KEY, value: d }).onConflictDoUpdate({ target: settings.key, set: { value: d } }).run();
      } else {
        db.delete(settings).where(eq(settings.key, EXTRA_DIR_KEY)).run();
      }
      extraError = null;
    },
    lastAutoAt,
    noteAutoError: (m) => {
      lastError = m;
    },
  };
}
