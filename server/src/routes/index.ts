import { Router } from 'express';
import type { Db } from '../db/connection.js';
import { categoriesRouter } from './categories.js';
import { productsRouter } from './products.js';
import { ordersRouter } from './orders.js';
import { settingsRouter } from './settings.js';

export function apiRouter(db: Db): Router {
  const r = Router();
  r.use('/categories', categoriesRouter(db));
  r.use('/products', productsRouter(db));
  r.use('/orders', ordersRouter(db));
  r.use('/settings', settingsRouter(db));
  r.use((_req, res) => res.status(404).json({ error: 'Không tìm thấy' }));
  return r;
}
