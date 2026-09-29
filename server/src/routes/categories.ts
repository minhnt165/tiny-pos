import { Router } from 'express';
import { categoryInputSchema } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { intParam, validateBody } from '../middleware/validate.js';
import { createCategory, deleteCategory, listCategories, updateCategory } from '../services/categories.js';

export function categoriesRouter(db: Db): Router {
  const r = Router();
  r.get('/', (_req, res) => res.json(listCategories(db)));
  r.post('/', validateBody(categoryInputSchema), (req, res) => res.status(201).json(createCategory(db, req.body)));
  r.put('/:id', validateBody(categoryInputSchema), (req, res) =>
    res.json(updateCategory(db, intParam(req, 'id'), req.body)),
  );
  r.delete('/:id', (req, res) => {
    deleteCategory(db, intParam(req, 'id'));
    res.status(204).end();
  });
  return r;
}
