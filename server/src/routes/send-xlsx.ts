import type { Response } from 'express';
import type { XlsxFile } from '../services/exports.js';

/** Trả file .xlsx để trình duyệt tải về; tên file chỉ có ký tự ASCII. */
export function sendXlsx(res: Response, file: XlsxFile): void {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  res.send(file.buffer);
}
