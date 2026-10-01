import express, { Router } from 'express';
import { backupExtraDirSchema } from '@tiny-pos/shared';
import { validateBody } from '../middleware/validate.js';
import type { BackupService } from '../services/backups.js';

export function backupsRouter(backups: BackupService): Router {
  const r = Router();
  r.get('/', (_req, res) => res.json(backups.status()));
  r.post('/', async (_req, res) => res.status(201).json(await backups.create('manual')));
  // Route tĩnh trước /:name
  r.put('/extra-dir', validateBody(backupExtraDirSchema), (req, res) => {
    backups.setExtraDir((req.body as { extraDir: string }).extraDir);
    res.json(backups.status());
  });
  // File .db thô; client gửi application/octet-stream
  r.post('/restore-upload', express.raw({ type: () => true, limit: '200mb' }), async (req, res) =>
    res.json(await backups.restoreUpload(Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0))),
  );
  r.get('/:name/download', (req, res) => {
    const name = String(req.params['name']);
    res.download(backups.filePath(name), name);
  });
  r.post('/:name/restore', async (req, res) => res.json(await backups.restore(String(req.params['name']))));
  r.delete('/:name', (req, res) => {
    backups.remove(String(req.params['name']));
    res.status(204).end();
  });
  return r;
}
