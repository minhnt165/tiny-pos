import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from '../db/test-db.js';
import { createBackupService, type BackupService } from './backups.js';
import { createBackupScheduler } from './backup-scheduler.js';

let root: string;
let svc: BackupService;
let dbFile: string;
const DAY = 86_400_000;
const touch = (file: string, at: Date) => fs.utimesSync(file, at, at);

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'tiny-pos-sched-'));
  dbFile = path.join(root, 'grocery.db');
  fs.writeFileSync(dbFile, '');
  svc = createBackupService(createTestDb(), { dir: path.join(root, 'backups'), tmpDir: path.join(root, 'tmp') });
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

const autos = () => svc.status().items.filter((i) => i.kind === 'auto');

describe('backup scheduler', () => {
  it('tick đầu tạo bản auto; cùng ngày không tạo thêm', async () => {
    const s = createBackupScheduler({ service: svc, dbFile, log: () => undefined });
    const now = new Date();
    await s.tick(now);
    expect(autos()).toHaveLength(1);
    await s.tick(new Date(now.getTime() + 60_000));
    expect(autos()).toHaveLength(1);
    expect(svc.status().lastError).toBeNull();
  });

  it('sang ngày: DB không đổi → bỏ qua; DB hoặc WAL đổi → tạo', async () => {
    const s = createBackupScheduler({ service: svc, dbFile, log: () => undefined });
    const now = new Date();
    await s.tick(now);
    const last = new Date(svc.lastAutoAt()!);
    touch(dbFile, new Date(last.getTime() - 60_000));
    await s.tick(new Date(now.getTime() + DAY));
    expect(autos()).toHaveLength(1);

    fs.writeFileSync(`${dbFile}-wal`, '');
    touch(`${dbFile}-wal`, new Date(last.getTime() + 60_000));
    await s.tick(new Date(now.getTime() + DAY));
    expect(autos()).toHaveLength(2);
  });

  it('create lỗi → lastError; lần sau thành công → hết lỗi', async () => {
    let fail = true;
    const flaky: BackupService = { ...svc, create: (k) => (fail ? Promise.reject(new Error('đĩa đầy')) : svc.create(k)) };
    const logs: string[] = [];
    const s = createBackupScheduler({ service: flaky, dbFile, log: (m) => logs.push(m) });
    await s.tick(new Date());
    expect(svc.status().lastError).toBe('đĩa đầy');
    expect(logs[0]).toContain('đĩa đầy');
    fail = false;
    await s.tick(new Date());
    expect(svc.status().lastError).toBeNull();
    expect(autos()).toHaveLength(1);
  });

  it('start chạy tick ngay và stop dọn timer', async () => {
    const s = createBackupScheduler({ service: svc, dbFile, intervalMs: 60_000, log: () => undefined });
    s.start();
    await new Promise((r) => setTimeout(r, 300));
    expect(autos()).toHaveLength(1);
    s.stop();
  });
});
