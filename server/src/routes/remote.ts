import { Router } from 'express';
import { remoteConfigInputSchema, type RemoteConfigInput, type RemoteStatus } from '@tiny-pos/shared';
import { HttpError } from '../errors.js';
import { validateBody } from '../middleware/validate.js';
import type { RemoteSync } from '../services/remote-sync.js';

const NOT_CONFIGURED: RemoteStatus = { configured: false, projectId: null, url: null, enabled: false, emails: [], lastPushAt: null, lastError: null };

/** Xem từ xa; `remote` là phụ thuộc tùy chọn (test createApp không truyền) → GET báo chưa cấu hình, ghi 503. */
export function remoteRouter(remote?: RemoteSync): Router {
  const r = Router();
  r.get('/', (_req, res) => res.json(remote ? remote.status() : NOT_CONFIGURED));
  r.use((_req, _res, next) => next(remote ? undefined : new HttpError(503, 'Chưa cấu hình xem từ xa')));
  r.put('/', validateBody(remoteConfigInputSchema), async (req, res) => res.json(await remote!.save(req.body as RemoteConfigInput)));
  r.post('/push', async (_req, res) => res.json(await remote!.push()));
  return r;
}
