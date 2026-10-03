import { Router } from 'express';
import type { Db } from '../db/connection.js';
import { categoriesRouter } from './categories.js';
import { productsRouter } from './products.js';
import { ordersRouter } from './orders.js';
import { returnsRouter } from './returns.js';
import { supplierReturnsRouter } from './supplier-returns.js';
import { labelsRouter } from './labels.js';
import { settingsRouter } from './settings.js';
import { importsRouter } from './imports.js';
import { stocktakesRouter } from './stocktakes.js';
import { suppliersRouter } from './suppliers.js';
import { customersRouter } from './customers.js';
import { reportsRouter } from './reports.js';
import { backupsRouter } from './backups.js';
import { overviewRouter } from './overview.js';
import { remoteRouter } from './remote.js';
import { deviceRouter, devicesRouter } from './devices.js';
import type { BackupService } from '../services/backups.js';
import { NO_LABEL_WINDOW, type LabelDeps } from '../services/labels.js';
import { NO_IMAGES, type ImageDeps } from '../services/product-images.js';
import type { RemoteSync } from '../services/remote-sync.js';
import type { DevicesService } from '../services/devices.js';

export function apiRouter(db: Db, deps: { backups?: BackupService; labels?: LabelDeps; images?: ImageDeps; remote?: RemoteSync; devices?: DevicesService } = {}): Router {
  const r = Router();
  r.use('/categories', categoriesRouter(db));
  r.use('/products', productsRouter(db, deps.images ?? NO_IMAGES));
  r.use('/orders', ordersRouter(db));
  r.use('/returns', returnsRouter(db));
  r.use('/settings', settingsRouter(db));
  r.use('/suppliers', suppliersRouter(db));
  r.use('/customers', customersRouter(db));
  r.use('/imports', importsRouter(db));
  r.use('/supplier-returns', supplierReturnsRouter(db));
  r.use('/labels', labelsRouter(db, deps.labels ?? NO_LABEL_WINDOW));
  r.use('/stocktakes', stocktakesRouter(db));
  r.use('/reports', reportsRouter(db));
  r.use('/overview', overviewRouter(db, deps.backups));
  r.use('/remote', remoteRouter(deps.remote));
  if (deps.devices) {
    r.use('/device', deviceRouter(deps.devices));
    r.use('/devices', devicesRouter(deps.devices));
  }
  if (deps.backups) r.use('/backups', backupsRouter(deps.backups));
  r.use((_req, res) => res.status(404).json({ error: 'Không tìm thấy' }));
  return r;
}
