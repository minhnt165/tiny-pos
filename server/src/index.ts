import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { createDb } from './db/connection.js';
import { createBackupScheduler } from './services/backup-scheduler.js';
import { createBackupService } from './services/backups.js';
import { createLabelOpener } from './label-window.js';
import { createFirebaseWriter } from './services/remote-writer.js';
import { createRemoteSync } from './services/remote-sync.js';

// server/src → ../.. = gốc repo ; server/dist → ../.. = gốc repo
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dbFile = process.env['DB_FILE'] ?? path.join(repoRoot, 'data', 'grocery.db');
const port = Number(process.env['PORT'] ?? 3000);

const db = createDb(dbFile);
const dataDir = path.dirname(dbFile);
const imagesDir = path.join(dataDir, 'images');
fs.mkdirSync(imagesDir, { recursive: true });
const backups = createBackupService(db, { dir: path.join(dataDir, 'backups'), tmpDir: path.join(dataDir, 'tmp'), imagesDir });
// Version duy nhất ở package.json gốc (client cũng đọc từ đó lúc build); ghi vào tài liệu xem từ xa
const { version: appVersion } = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as { version: string };
const remoteDir = path.join(dataDir, 'remote');
fs.mkdirSync(remoteDir, { recursive: true }); // để người cài biết chép file khóa vào đâu
const remote = createRemoteSync({ db, keyFile: path.join(remoteDir, 'service-account.json'), dbFile, backups, appVersion, writer: createFirebaseWriter });
// Chỉ bản build trên Windows (máy quầy) mới tự mở cửa sổ in tem; dev (tsx chạy src/) để trình duyệt mở tab mới
const built = path.basename(path.dirname(fileURLToPath(import.meta.url))) === 'dist';
const labels =
  process.platform === 'win32' && built
    ? { open: createLabelOpener(path.join(dataDir, 'label-browser')), origin: `http://localhost:${port}` }
    : undefined;
const app = createApp(db, { clientDist: path.join(repoRoot, 'client', 'dist'), backups, labels, imagesDir, remote });

app.listen(port, '0.0.0.0', () => {
  const lan = Object.values(os.networkInterfaces())
    .flat()
    .find((i) => i && i.family === 'IPv4' && !i.internal)?.address;
  console.log(`Tiny POS chạy tại http://localhost:${port}` + (lan ? ` (LAN: http://${lan}:${port})` : ''));
  console.log(`DB: ${dbFile}`);
  console.log(`Sao lưu: ${path.join(dataDir, 'backups')}`);
  createBackupScheduler({ service: backups, dbFile }).start();
  remote.start();
});
