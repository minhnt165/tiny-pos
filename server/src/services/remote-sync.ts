import fs from 'node:fs';
import { inArray } from 'drizzle-orm';
import { localDate, type RemoteConfigInput, type RemoteOverviewDoc, type RemoteStatus } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { settings } from '../db/schema.js';
import { BadRequestError, HttpError } from '../errors.js';
import type { BackupService } from './backups.js';
import { resolveClock, type Clock } from './daily-code.js';
import { backupSummary, overview } from './overview.js';
import { getSettings } from './settings.js';

/** Phần ghi Firestore, tách ra để test tiêm bản giả; bản thật ở remote-writer.ts. */
export interface RemoteWriter {
  setOverview(doc: RemoteOverviewDoc): Promise<void>;
  deleteOverview(): Promise<void>;
  setAccess(emails: string[]): Promise<void>;
  /** Đóng kết nối khi đổi file khóa. */
  close?(): Promise<void>;
}
export type RemoteWriterFactory = (keyFile: string) => Promise<RemoteWriter>;

export interface RemoteSyncOpts {
  db: Db;
  /** data/remote/service-account.json */
  keyFile: string;
  /** grocery.db, để so mtime (kèm -wal). */
  dbFile: string;
  backups?: BackupService;
  appVersion: string;
  writer: RemoteWriterFactory;
  /** Mặc định 60 s. */
  intervalMs?: number;
  /** Mỗi lệnh Firestore; mặc định 30 s. SDK offline có thể treo rất lâu thay vì lỗi. */
  timeoutMs?: number;
  clock?: Clock;
  log?: (s: string) => void;
}

export interface RemoteSync {
  status(): RemoteStatus;
  /** Lưu cấu hình; bật → ghi access + đẩy ngay; tắt → xóa tài liệu. Lỗi Firebase vào lastError, không ném. */
  save(input: RemoteConfigInput): Promise<RemoteStatus>;
  /** Đẩy ngay (nút Gửi ngay), bỏ qua điều kiện mtime/ngày. 400 nếu tắt/chưa có khóa, 502 nếu Firebase lỗi. */
  push(): Promise<RemoteStatus>;
  /** Vòng lặp: kiểm điều kiện rồi đẩy; nuốt mọi lỗi vào lastError. */
  tick(now?: Date): Promise<void>;
  start(): void;
  stop(): void;
}

const ENABLED_KEY = 'remoteEnabled';
const EMAILS_KEY = 'remoteEmails';
const NO_KEY = 'Chưa có file khóa Firebase';

const mtime = (file: string): number => {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return 0;
  }
};

interface KeyInfo {
  projectId: string | null;
  error: string | null;
  mtime: number;
}
/** Đọc project_id từ file khóa; không có file → không lỗi (chỉ là chưa cài). */
function readKey(keyFile: string): KeyInfo {
  const at = mtime(keyFile);
  if (!at) return { projectId: null, error: null, mtime: 0 };
  try {
    const json = JSON.parse(fs.readFileSync(keyFile, 'utf8')) as { project_id?: unknown };
    if (typeof json.project_id !== 'string' || !json.project_id)
      return { projectId: null, error: 'File khóa Firebase không đúng định dạng (thiếu project_id)', mtime: at };
    return { projectId: json.project_id, error: null, mtime: at };
  } catch {
    return { projectId: null, error: 'File khóa Firebase không đọc được', mtime: at };
  }
}

interface Config {
  enabled: boolean;
  emails: string[];
}
function readConfig(db: Db): Config {
  const rows = db.select().from(settings).where(inArray(settings.key, [ENABLED_KEY, EMAILS_KEY])).all();
  const raw = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  let emails: string[] = [];
  try {
    const parsed: unknown = JSON.parse(raw[EMAILS_KEY] ?? '[]');
    if (Array.isArray(parsed)) emails = parsed.filter((e): e is string => typeof e === 'string');
  } catch {
    /* giá trị hỏng coi như rỗng */
  }
  return { enabled: raw[ENABLED_KEY] === '1', emails };
}
function writeConfig(db: Db, c: Config): void {
  db.transaction((tx) => {
    for (const [key, value] of [
      [ENABLED_KEY, c.enabled ? '1' : '0'],
      [EMAILS_KEY, JSON.stringify(c.emails)],
    ] as const) {
      tx.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } }).run();
    }
  });
}

class TimeoutError extends Error {}
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new TimeoutError(`Không kết nối được Firebase (quá ${Math.round(ms / 1000)} giây)`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** Lỗi mạng (gRPC UNAVAILABLE/DEADLINE, DNS, TCP) thành một câu tiếng Việt; còn lại giữ message SDK để biết đường sửa. */
function describeError(e: unknown): string {
  if (e instanceof TimeoutError) return e.message;
  const message = e instanceof Error ? e.message : String(e);
  if (/UNAVAILABLE|DEADLINE_EXCEEDED|ENOTFOUND|ECONN|EAI_AGAIN|ETIMEDOUT|getaddrinfo/i.test(message)) return 'Không kết nối được Firebase';
  return `Lỗi Firebase: ${message}`;
}

export function createRemoteSync(o: RemoteSyncOpts): RemoteSync {
  const log = o.log ?? console.log;
  const timeoutMs = o.timeoutMs ?? 30_000;
  let lastPushAt: string | null = null;
  let lastError: string | null = null;
  let busy = false;
  let writer: RemoteWriter | null = null;
  let writerMtime = 0;
  /** JSON danh sách email đã ghi lên remote/access bằng writer hiện tại; null = chưa ghi. */
  let syncedAccess: string | null = null;

  const getWriter = async (): Promise<RemoteWriter> => {
    const key = readKey(o.keyFile);
    if (!key.projectId) throw new Error(key.error ?? NO_KEY);
    if (writer && writerMtime === key.mtime) return writer;
    if (writer) await writer.close?.().catch(() => undefined);
    writer = await o.writer(o.keyFile);
    writerMtime = key.mtime;
    syncedAccess = null;
    return writer;
  };

  const buildDoc = (at: Date): RemoteOverviewDoc => {
    const clock: Clock = { ...o.clock, now: at };
    const data = { ...overview(o.db, clock), backup: o.backups ? backupSummary(o.backups) : null };
    // Firestore không nhận undefined; Overview hiện chỉ có null nhưng chặn cho chắc
    return { storeName: getSettings(o.db).storeName, updatedAt: at.toISOString(), appVersion: o.appVersion, data: JSON.parse(JSON.stringify(data)) };
  };

  /** Đẩy thật: access (nếu đổi) rồi overview. Ném lỗi để nơi gọi quyết định. */
  const doPush = async (at: Date): Promise<void> => {
    busy = true;
    try {
      const w = await getWriter();
      const emails = readConfig(o.db).emails;
      const accessJson = JSON.stringify(emails);
      if (accessJson !== syncedAccess) {
        await withTimeout(w.setAccess(emails), timeoutMs);
        syncedAccess = accessJson;
      }
      await withTimeout(w.setOverview(buildDoc(at)), timeoutMs);
      lastPushAt = at.toISOString();
      lastError = null;
    } finally {
      busy = false;
    }
  };

  const status = (): RemoteStatus => {
    const key = readKey(o.keyFile);
    const c = readConfig(o.db);
    return {
      configured: key.projectId !== null,
      projectId: key.projectId,
      url: key.projectId ? `https://${key.projectId}.web.app` : null,
      enabled: c.enabled,
      emails: c.emails,
      lastPushAt,
      lastError: lastError ?? key.error,
    };
  };

  const tick = async (now?: Date): Promise<void> => {
    // Mọi lỗi bắt ở đây: tick chạy trong setInterval, reject sẽ thành unhandled rejection làm chết server
    try {
      if (busy) return;
      if (!readConfig(o.db).enabled) return;
      if (!readKey(o.keyFile).projectId) return; // status() đã báo lỗi file; không log mỗi phút
      const { now: at, tz } = resolveClock({ ...o.clock, ...(now ? { now } : {}) });
      if (lastPushAt !== null) {
        const lastMs = Date.parse(lastPushAt);
        const changed = mtime(o.dbFile) > lastMs || mtime(`${o.dbFile}-wal`) > lastMs;
        if (!changed && localDate(new Date(lastPushAt), tz) === localDate(at, tz)) return;
      }
      await doPush(at);
    } catch (e) {
      lastError = describeError(e);
      log(`Xem từ xa lỗi: ${lastError}`);
    }
  };

  let timer: NodeJS.Timeout | undefined;
  return {
    status,
    tick,
    async save(input) {
      const key = readKey(o.keyFile);
      if (input.enabled && !key.projectId) throw new BadRequestError(key.error ?? NO_KEY);
      writeConfig(o.db, { enabled: input.enabled, emails: input.emails });
      const { now } = resolveClock(o.clock);
      try {
        if (input.enabled) await doPush(now);
        else if (key.projectId) {
          const w = await getWriter();
          await withTimeout(w.deleteOverview(), timeoutMs);
          lastError = null;
        }
      } catch (e) {
        lastError = describeError(e);
      }
      return status();
    },
    async push() {
      if (!readConfig(o.db).enabled) throw new BadRequestError('Xem từ xa đang tắt');
      const key = readKey(o.keyFile);
      if (!key.projectId) throw new BadRequestError(key.error ?? NO_KEY);
      if (busy) throw new HttpError(409, 'Đang gửi, thử lại sau ít giây');
      try {
        await doPush(resolveClock(o.clock).now);
      } catch (e) {
        lastError = describeError(e);
        throw new HttpError(502, `Không gửi được: ${lastError}`);
      }
      return status();
    },
    start() {
      void tick();
      timer = setInterval(() => void tick(), o.intervalMs ?? 60_000);
      timer.unref();
    },
    stop() {
      clearInterval(timer);
    },
  };
}
