import { Router } from 'express';
import { lotDisposeSchema, lotListQuerySchema, type LotListQuery } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { intParam, validateBody, validateQuery } from '../middleware/validate.js';
import { disposeLot, listLots } from '../services/lots.js';

export function lotsRouter(db: Db): Router {
  const r = Router();
  r.get('/', validateQuery(lotListQuerySchema), (_req, res) => res.json(listLots(db, res.locals['query'] as LotListQuery)));
  r.post('/:id/dispose', validateBody(lotDisposeSchema), (req, res) => res.json(disposeLot(db, intParam(req, 'id'), req.body)));
  return r;
}
