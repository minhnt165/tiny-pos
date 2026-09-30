import { Router } from 'express';
import { orderInputSchema, orderListQuerySchema, type OrderListQuery } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { intParam, validateBody, validateQuery } from '../middleware/validate.js';
import { exportOrdersXlsx } from '../services/exports.js';
import { cancelOrder, createOrder, getOrder, listOrders } from '../services/orders.js';
import { sendXlsx } from './send-xlsx.js';

export function ordersRouter(db: Db): Router {
  const r = Router();
  r.get('/', validateQuery(orderListQuerySchema), (_req, res) => {
    res.json(listOrders(db, res.locals['query'] as OrderListQuery));
  });
  r.get('/export.xlsx', validateQuery(orderListQuerySchema), async (_req, res) =>
    sendXlsx(res, await exportOrdersXlsx(db, res.locals['query'] as OrderListQuery)),
  );
  r.get('/:id', (req, res) => res.json(getOrder(db, intParam(req, 'id'))));
  r.post('/', validateBody(orderInputSchema), (req, res) => res.status(201).json(createOrder(db, req.body)));
  r.post('/:id/cancel', (req, res) => res.json(cancelOrder(db, intParam(req, 'id'))));
  return r;
}
