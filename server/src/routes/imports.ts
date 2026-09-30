import { Router } from 'express';
import { importInputSchema, importListQuerySchema, type ImportListQuery } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { intParam, validateBody, validateQuery } from '../middleware/validate.js';
import { exportImportsXlsx } from '../services/exports.js';
import { cancelImport, createImport, getImport, listImports } from '../services/imports.js';
import { sendXlsx } from './send-xlsx.js';

export function importsRouter(db: Db): Router {
  const r = Router();
  // Cùng quy tắc khoảng ngày với hóa đơn: YYYY-MM-DD có thật, mặc định hôm nay (giờ địa phương)
  r.get('/', validateQuery(importListQuerySchema), (_req, res) => {
    res.json(listImports(db, res.locals['query'] as ImportListQuery));
  });
  r.get('/export.xlsx', validateQuery(importListQuerySchema), async (_req, res) =>
    sendXlsx(res, await exportImportsXlsx(db, res.locals['query'] as ImportListQuery)),
  );
  r.get('/:id', (req, res) => res.json(getImport(db, intParam(req, 'id'))));
  r.post('/', validateBody(importInputSchema), (req, res) => res.status(201).json(createImport(db, req.body)));
  r.post('/:id/cancel', (req, res) => res.json(cancelImport(db, intParam(req, 'id'))));
  return r;
}
