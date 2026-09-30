import { Router } from 'express';
import { stocktakeCountSchema, stocktakeInputSchema, stocktakeListQuerySchema, type StocktakeListQuery } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { intParam, validateBody, validateQuery } from '../middleware/validate.js';
import {
  cancelStocktake,
  countItem,
  finishStocktake,
  getCurrentStocktake,
  getStocktake,
  listStocktakes,
  openStocktake,
  removeItem,
} from '../services/stocktakes.js';

export function stocktakesRouter(db: Db): Router {
  const r = Router();
  // Route tĩnh trước /:id
  r.get('/current', (_req, res) => res.json(getCurrentStocktake(db)));
  r.get('/', validateQuery(stocktakeListQuerySchema), (_req, res) =>
    res.json(listStocktakes(db, (res.locals['query'] as StocktakeListQuery).limit)),
  );
  r.get('/:id', (req, res) => res.json(getStocktake(db, intParam(req, 'id'))));
  r.post('/', validateBody(stocktakeInputSchema), (req, res) => res.status(201).json(openStocktake(db, req.body)));
  r.put('/:id/items/:productId', validateBody(stocktakeCountSchema), (req, res) =>
    res.json(countItem(db, intParam(req, 'id'), intParam(req, 'productId'), req.body)),
  );
  r.delete('/:id/items/:productId', (req, res) => res.json(removeItem(db, intParam(req, 'id'), intParam(req, 'productId'))));
  r.post('/:id/finish', (req, res) => res.json(finishStocktake(db, intParam(req, 'id'))));
  r.post('/:id/cancel', (req, res) => res.json(cancelStocktake(db, intParam(req, 'id'))));
  return r;
}
