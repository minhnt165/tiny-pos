import { z } from 'zod';

/** Tên file bản sao: grocery-YYYYMMDD-HHMMSS-<loại>[-n].db; không khớp thì không nhận (chặn đường dẫn lạ). */
export const BACKUP_NAME_RE = /^grocery-\d{8}-\d{6}-(auto|manual|before-restore)(-\d+)?\.db$/;

/** Thư mục chép thêm bản sao (USB, OneDrive…); rỗng = không chép. */
export const backupExtraDirSchema = z.object({ extraDir: z.string().trim().max(260) });
export type BackupExtraDirInput = z.output<typeof backupExtraDirSchema>;
