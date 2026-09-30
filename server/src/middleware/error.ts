import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { FIELD_LABELS } from '@tiny-pos/shared';
import { HttpError } from '../errors.js';

/** "Giá bán: Invalid input: expected number, received string; Tên: ..." */
export function formatZodError(err: ZodError): string {
  return err.issues
    .map((i) => {
      const field = i.path.map(String).join('.');
      // "items.0.qty" không có nhãn riêng → dùng nhãn của trường cuối ("Số lượng")
      const label = FIELD_LABELS[field] ?? FIELD_LABELS[String(i.path.at(-1) ?? '')] ?? field;
      return label ? `${label}: ${i.message}` : i.message;
    })
    .join('; ');
}

/** Middleware cuối cùng: mọi lỗi đều thành { error } với mã HTTP phù hợp. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) return void res.status(err.status).json({ error: err.message });
  if (err instanceof ZodError) return void res.status(400).json({ error: formatZodError(err) });
  const code = (err as { code?: string } | null)?.code;
  if (code === 'SQLITE_CONSTRAINT_UNIQUE') return void res.status(409).json({ error: 'Mã vạch đã tồn tại' });
  if (code === 'SQLITE_CONSTRAINT_FOREIGNKEY')
    return void res.status(409).json({ error: 'Dữ liệu đang được sử dụng, không thể xóa' });
  // body-parser: thân request vượt `limit` (byte), ví dụ file nhập > 10 MB
  if ((err as { type?: string } | null)?.type === 'entity.too.large') {
    const mb = Math.round(((err as { limit?: number }).limit ?? 0) / 1024 / 1024);
    return void res.status(413).json({ error: `Dữ liệu gửi lên quá lớn (tối đa ${mb} MB)` });
  }
  if (err instanceof SyntaxError && 'body' in err) return void res.status(400).json({ error: 'JSON không hợp lệ' });
  console.error(err);
  res.status(500).json({ error: 'Lỗi hệ thống' });
};
