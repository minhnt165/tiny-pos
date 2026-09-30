import { Router } from 'express';
import { currentTzOffset, importInputSchema, localDate, orderListQuerySchema, type OrderListQuery } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { intParam, validateBody, validateQuery } from '../middleware/validate.js';
import { cancelImport, createImport, getImport, listImports } from '../services/imports.js';

export function importsRouter(db: Db): Router {
  const r = Router();
  // Cùng quy tắc ngày với hóa đơn: YYYY-MM-DD có thật, mặc định hôm nay (giờ địa phương)
  r.get('/', validateQuery(orderListQuerySchema), (_req, res) => {
    const { date } = res.locals['query'] as OrderListQuery;
    res.json(listImports(db, date ?? localDate(new Date(), currentTzOffset())));
  });
  r.get('/:id', (req, res) => res.json(getImport(db, intParam(req, 'id'))));
  r.post('/', validateBody(importInputSchema), (req, res) => res.status(201).json(createImport(db, req.body)));
  r.post('/:id/cancel', (req, res) => res.json(cancelImport(db, intParam(req, 'id'))));
  return r;
}
