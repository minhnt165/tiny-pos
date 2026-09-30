import { Router } from 'express';
import { customerAdjustmentSchema, customerCreateSchema, customerInputSchema, customerPaymentSchema } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { intParam, validateBody } from '../middleware/validate.js';
import {
  addManualDebt,
  collectDebt,
  createCustomer,
  deleteCustomer,
  listCustomerTransactions,
  listCustomers,
  updateCustomer,
} from '../services/customers.js';

export function customersRouter(db: Db): Router {
  const r = Router();
  r.get('/', (req, res) => res.json(listCustomers(db, typeof req.query['q'] === 'string' ? req.query['q'] : undefined)));
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
