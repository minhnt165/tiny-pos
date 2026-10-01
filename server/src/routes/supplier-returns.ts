import { Router } from 'express';
import { supplierReturnInputSchema, supplierReturnListQuerySchema, type SupplierReturnListQuery } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { intParam, validateBody, validateQuery } from '../middleware/validate.js';
import { exportSupplierReturnsXlsx } from '../services/exports.js';
import { cancelSupplierReturn, createSupplierReturn, getSupplierReturn, listSupplierReturns } from '../services/supplier-returns.js';
import { sendXlsx } from './send-xlsx.js';

export function supplierReturnsRouter(db: Db): Router {
  const r = Router();
  r.get('/', validateQuery(supplierReturnListQuerySchema), (_req, res) => {
    res.json(listSupplierReturns(db, res.locals['query'] as SupplierReturnListQuery));
  });
  r.get('/export.xlsx', validateQuery(supplierReturnListQuerySchema), async (_req, res) =>
    sendXlsx(res, await exportSupplierReturnsXlsx(db, res.locals['query'] as SupplierReturnListQuery)),
  );
  r.get('/:id', (req, res) => res.json(getSupplierReturn(db, intParam(req, 'id'))));
  r.post('/', validateBody(supplierReturnInputSchema), (req, res) => res.status(201).json(createSupplierReturn(db, req.body)));
  r.post('/:id/cancel', (req, res) => res.json(cancelSupplierReturn(db, intParam(req, 'id'))));
  return r;
}
