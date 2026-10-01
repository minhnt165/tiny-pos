import { Router } from 'express';
import { productReportQuerySchema, reportQuerySchema, type ProductReportQuery, type ReportQuery } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import { validateQuery } from '../middleware/validate.js';
import { exportDebtReportXlsx, exportProductReportXlsx, exportProfitReportXlsx } from '../services/report-exports.js';
import { debtReport, productReport, profitReport } from '../services/reports.js';
import { sendXlsx } from './send-xlsx.js';

/** Báo cáo chỉ đọc; khóa lạ trên query (tab của trang) bị schema bỏ qua. */
export function reportsRouter(db: Db): Router {
  const r = Router();
  const rq = (res: { locals: Record<string, unknown> }) => res.locals['query'] as ReportQuery;
  const pq = (res: { locals: Record<string, unknown> }) => res.locals['query'] as ProductReportQuery;
  r.get('/profit', validateQuery(reportQuerySchema), (_req, res) => res.json(profitReport(db, rq(res))));
  r.get('/profit/export.xlsx', validateQuery(reportQuerySchema), async (_req, res) => sendXlsx(res, await exportProfitReportXlsx(db, rq(res))));
  r.get('/products', validateQuery(productReportQuerySchema), (_req, res) => res.json(productReport(db, pq(res))));
  r.get('/products/export.xlsx', validateQuery(productReportQuerySchema), async (_req, res) =>
    sendXlsx(res, await exportProductReportXlsx(db, pq(res))),
  );
  r.get('/debt', validateQuery(reportQuerySchema), (_req, res) => res.json(debtReport(db, rq(res))));
  r.get('/debt/export.xlsx', validateQuery(reportQuerySchema), async (_req, res) => sendXlsx(res, await exportDebtReportXlsx(db, rq(res))));
  return r;
}
