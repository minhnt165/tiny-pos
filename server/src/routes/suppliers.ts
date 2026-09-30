import { Router } from 'express';
import { supplierInputSchema, supplierPaymentSchema, partyListQuerySchema, type PartyListQuery } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { intParam, validateBody, validateQuery } from '../middleware/validate.js';
import {
  createSupplier,
  deleteSupplier,
  listSupplierTransactions,
  listSuppliers,
  paySupplier,
  updateSupplier,
} from '../services/suppliers.js';

export function suppliersRouter(db: Db): Router {
  const r = Router();
  r.get('/', validateQuery(partyListQuerySchema), (_req, res) => {
    const { q, includeInactive } = res.locals['query'] as PartyListQuery;
    res.json(listSuppliers(db, q, includeInactive));
  });
  r.post('/', validateBody(supplierInputSchema), (req, res) => res.status(201).json(createSupplier(db, req.body)));
  r.put('/:id', validateBody(supplierInputSchema), (req, res) => res.json(updateSupplier(db, intParam(req, 'id'), req.body)));
  r.delete('/:id', (req, res) => {
    deleteSupplier(db, intParam(req, 'id'));
    res.status(204).end();
  });
  r.get('/:id/transactions', (req, res) => res.json(listSupplierTransactions(db, intParam(req, 'id'))));
  r.post('/:id/payments', validateBody(supplierPaymentSchema), (req, res) =>
    res.json(paySupplier(db, intParam(req, 'id'), req.body)),
  );
  return r;
}
