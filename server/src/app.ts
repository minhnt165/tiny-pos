import express, { type Express } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import type { Db } from './db/connection.js';
import { errorHandler } from './middleware/error.js';
import { apiRouter } from './routes/index.js';
import type { BackupService } from './services/backups.js';
import type { LabelDeps } from './services/labels.js';

/** Tạo app Express; tách khỏi listen() để test bằng cổng ngẫu nhiên. */
export function createApp(db: Db, opts: { clientDist?: string; backups?: BackupService; labels?: LabelDeps } = {}): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', apiRouter(db, { backups: opts.backups, labels: opts.labels }));

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
