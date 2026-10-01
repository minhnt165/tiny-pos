import { Router } from 'express';
import { returnInputSchema, returnListQuerySchema, type ReturnListQuery } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { intParam, validateBody, validateQuery } from '../middleware/validate.js';
import { exportReturnsXlsx } from '../services/exports.js';
import { cancelReturn, createReturn, getReturn, listReturns } from '../services/returns.js';
import { sendXlsx } from './send-xlsx.js';

export function returnsRouter(db: Db): Router {
  const r = Router();
  r.get('/', validateQuery(returnListQuerySchema), (_req, res) => {
    res.json(listReturns(db, res.locals['query'] as ReturnListQuery));
  });
  r.get('/export.xlsx', validateQuery(returnListQuerySchema), async (_req, res) =>
    sendXlsx(res, await exportReturnsXlsx(db, res.locals['query'] as ReturnListQuery)),
  );
  r.get('/:id', (req, res) => res.json(getReturn(db, intParam(req, 'id'))));
  r.post('/', validateBody(returnInputSchema), (req, res) => res.status(201).json(createReturn(db, req.body)));
  r.post('/:id/cancel', (req, res) => res.json(cancelReturn(db, intParam(req, 'id'))));
  return r;
}
