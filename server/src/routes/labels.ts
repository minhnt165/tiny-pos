import { Router } from 'express';
import { labelPrintInputSchema } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { validateBody } from '../middleware/validate.js';
import { printLabels, printSampleLabel, type LabelDeps } from '../services/labels.js';

export function labelsRouter(db: Db, deps: LabelDeps): Router {
  const r = Router();
  r.post('/print', validateBody(labelPrintInputSchema), (req, res) => res.json(printLabels(db, req.body, deps)));
  r.post('/sample', (_req, res) => res.json(printSampleLabel(deps)));
  return r;
}
