import { Router } from 'express';
import type { Db } from '../db/connection.js';
import { categoriesRouter } from './categories.js';
import { productsRouter } from './products.js';
import { ordersRouter } from './orders.js';
import { settingsRouter } from './settings.js';
import { importsRouter } from './imports.js';
import { stocktakesRouter } from './stocktakes.js';
import { suppliersRouter } from './suppliers.js';
import { customersRouter } from './customers.js';

export function apiRouter(db: Db): Router {
  const r = Router();
  r.use('/categories', categoriesRouter(db));
  r.use('/products', productsRouter(db));
  r.use('/orders', ordersRouter(db));
  r.use('/settings', settingsRouter(db));
  r.use('/suppliers', suppliersRouter(db));
  r.use('/customers', customersRouter(db));
  r.use('/imports', importsRouter(db));
  r.use('/stocktakes', stocktakesRouter(db));
  r.use((_req, res) => res.status(404).json({ error: 'Không tìm thấy' }));
  return r;
}
