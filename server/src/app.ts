import express, { type Express } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import type { Db } from './db/connection.js';
import { errorHandler } from './middleware/error.js';
import { deviceGate, isCounterRequest, type IsCounter } from './middleware/device-gate.js';
import { apiRouter } from './routes/index.js';
import type { BackupService } from './services/backups.js';
import { createDevicesService, type DevicesService } from './services/devices.js';
import type { LabelDeps } from './services/labels.js';
import type { RemoteSync } from './services/remote-sync.js';

/** Tạo app Express; tách khỏi listen() để test bằng cổng ngẫu nhiên. */
export function createApp(
  db: Db,
  opts: { clientDist?: string; backups?: BackupService; labels?: LabelDeps; imagesDir?: string; remote?: RemoteSync; devices?: DevicesService; isCounter?: IsCounter } = {},
): Express {
  const app = express();
  app.disable('x-powered-by');
  // Ghép thiết bị: test/không truyền thì tự tạo để gate luôn bật; máy quầy (localhost) luôn qua
  const devices = opts.devices ?? createDevicesService(db, { lanUrl: () => 'http://localhost:3000' });
  app.use(['/api', '/images'], deviceGate(devices, opts.isCounter ?? isCounterRequest));
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', apiRouter(db, { backups: opts.backups, labels: opts.labels, images: opts.imagesDir ? { dir: opts.imagesDir } : undefined, remote: opts.remote, devices }));

  // Ảnh sản phẩm: tên file đổi mỗi lần thay ảnh nên cache được vĩnh viễn; tên lạ → 404, không rơi xuống SPA fallback
  if (opts.imagesDir) {
    app.use('/images', express.static(opts.imagesDir, { immutable: true, maxAge: '1y', index: false }));
    app.use('/images', (_req, res) => res.status(404).end());
  }

  const dist = opts.clientDist;
  if (dist && fs.existsSync(dist)) {
    app.use(express.static(dist));
    // SPA fallback: mọi GET không phải /api trả index.html để react-router xử lý
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
