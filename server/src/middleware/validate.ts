import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { HttpError } from '../errors.js';
import { formatZodError } from './error.js';

/** Parse `req.body` bằng schema; thay body bằng dữ liệu đã chuẩn hóa (default, trim...). */
export function validateBody(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const r = schema.safeParse(req.body);
    if (!r.success) return next(new HttpError(400, formatZodError(r.error)));
    req.body = r.data;
    next();
  };
}

/** Parse `req.query`; kết quả đặt vào `res.locals.query` (Express 5 không cho ghi đè req.query). */
export function validateQuery(schema: ZodType): RequestHandler {
  return (req, res, next) => {
    const r = schema.safeParse(req.query);
    if (!r.success) return next(new HttpError(400, formatZodError(r.error)));
    res.locals['query'] = r.data;
    next();
  };
}

/** Đọc tham số :id dạng số nguyên dương, 400 nếu sai. */
export function intParam(req: { params: Record<string, unknown> }, name: string): number {
  const raw = req.params[name];
  const n = typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `Tham số ${name} không hợp lệ`);
  return n;
}
