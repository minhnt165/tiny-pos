import { Router } from 'express';
import {
  customerAdjustmentSchema,
  customerCreateSchema,
  customerInputSchema,
  customerPaymentSchema,
  partyListQuerySchema,
  partyViewQuerySchema,
  type PartyListQuery,
  type PartyView,
} from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { intParam, validateBody, validateQuery } from '../middleware/validate.js';
import {
  addManualDebt,
  collectDebt,
  createCustomer,
  deleteCustomer,
  listCustomerTransactions,
  listCustomers,
  updateCustomer,
} from '../services/customers.js';
import { exportCustomersXlsx } from '../services/exports.js';
import { sendXlsx } from './send-xlsx.js';

export function customersRouter(db: Db): Router {
  const r = Router();
  r.get('/', validateQuery(partyListQuerySchema), (_req, res) => {
    const { q, includeInactive } = res.locals['query'] as PartyListQuery;
    res.json(listCustomers(db, q, includeInactive));
  });
  r.get('/export.xlsx', validateQuery(partyViewQuerySchema), async (_req, res) =>
    sendXlsx(res, await exportCustomersXlsx(db, res.locals['query'] as PartyView)),
  );
  r.post('/', validateBody(customerCreateSchema), (req, res) => res.status(201).json(createCustomer(db, req.body)));
  r.put('/:id', validateBody(customerInputSchema), (req, res) => res.json(updateCustomer(db, intParam(req, 'id'), req.body)));
  r.delete('/:id', (req, res) => {
    deleteCustomer(db, intParam(req, 'id'));
    res.status(204).end();
  });
  r.get('/:id/transactions', (req, res) => res.json(listCustomerTransactions(db, intParam(req, 'id'))));
  r.post('/:id/payments', validateBody(customerPaymentSchema), (req, res) => res.json(collectDebt(db, intParam(req, 'id'), req.body)));
  r.post('/:id/adjustments', validateBody(customerAdjustmentSchema), (req, res) =>
    res.json(addManualDebt(db, intParam(req, 'id'), req.body)),
  );
  return r;
}
