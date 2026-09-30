import express, { Router } from 'express';
import {
  movementListQuerySchema,
  productInputSchema,
  productListQuerySchema,
  productUnitInputSchema,
  type MovementListQuery,
  type ProductListQuery,
} from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { intParam, validateBody, validateQuery } from '../middleware/validate.js';
import { exportProductsCsv, importProductsCsv } from '../services/product-csv.js';
import { createUnit, deleteUnit, updateUnit } from '../services/product-units.js';
import { listMovements } from '../services/movements.js';
import {
  createProduct,
  findProductByBarcode,
  getProduct,
  listProducts,
  setProductActive,
  updateProduct,
} from '../services/products.js';

export function productsRouter(db: Db): Router {
  const r = Router();

  // Các route tĩnh phải đứng trước /:id
  r.get('/csv', (_req, res) => {
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="san-pham-${date}.csv"`);
    res.send(exportProductsCsv(db));
  });
  r.post('/csv', express.text({ type: ['text/csv', 'text/plain'], limit: '10mb' }), (req, res) => {
    res.json(importProductsCsv(db, typeof req.body === 'string' ? req.body : ''));
  });
  r.get('/by-barcode/:code', (req, res) => res.json(findProductByBarcode(db, String(req.params['code']))));

  r.get('/', validateQuery(productListQuerySchema), (_req, res) =>
    res.json(listProducts(db, res.locals['query'] as ProductListQuery)),
  );
  r.get('/:id', (req, res) => res.json(getProduct(db, intParam(req, 'id'))));
  r.get('/:id/movements', validateQuery(movementListQuerySchema), (req, res) =>
    res.json(listMovements(db, intParam(req, 'id'), (res.locals['query'] as MovementListQuery).limit)),
  );
  r.post('/', validateBody(productInputSchema), (req, res) => res.status(201).json(createProduct(db, req.body)));
  r.put('/:id', validateBody(productInputSchema), (req, res) =>
    res.json(updateProduct(db, intParam(req, 'id'), req.body)),
  );
  r.delete('/:id', (req, res) => {
    setProductActive(db, intParam(req, 'id'), false);
    res.status(204).end();
  });
  r.post('/:id/restore', (req, res) => res.json(setProductActive(db, intParam(req, 'id'), true)));

  r.post('/:id/units', validateBody(productUnitInputSchema), (req, res) =>
    res.status(201).json(createUnit(db, intParam(req, 'id'), req.body)),
  );
  r.put('/:id/units/:unitId', validateBody(productUnitInputSchema), (req, res) =>
    res.json(updateUnit(db, intParam(req, 'id'), intParam(req, 'unitId'), req.body)),
  );
  r.delete('/:id/units/:unitId', (req, res) => {
    deleteUnit(db, intParam(req, 'id'), intParam(req, 'unitId'));
    res.status(204).end();
  });
  return r;
}
