import { Router } from 'express';
import { settingsInputSchema } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { validateBody } from '../middleware/validate.js';
import { getSettings, saveSettings } from '../services/settings.js';

export function settingsRouter(db: Db): Router {
  const r = Router();
  r.get('/', (_req, res) => res.json(getSettings(db)));
  r.put('/', validateBody(settingsInputSchema), (req, res) => res.json(saveSettings(db, req.body)));
  return r;
}
