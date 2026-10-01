import { describe, expect, it } from 'vitest';
import { BACKUP_NAME_RE, backupExtraDirSchema } from './backups.js';

describe('backups schema', () => {
  it('tên bản sao hợp lệ', () => {
    for (const n of ['grocery-20261001-093000-auto.db', 'grocery-20261001-093000-manual-2.db', 'grocery-20261001-093000-before-restore.db'])
      expect(BACKUP_NAME_RE.test(n)).toBe(true);
  });
  it('tên bản sao sai', () => {
    for (const n of ['../grocery-20261001-093000-auto.db', 'grocery-20261001-093000-auto.db.part', 'grocery-20261001-093000-upload.db', 'x.db', ''])
      expect(BACKUP_NAME_RE.test(n)).toBe(false);
  });
  it('extraDir trim, tối đa 260', () => {
    expect(backupExtraDirSchema.parse({ extraDir: '  D:\sao-luu ' })).toEqual({ extraDir: 'D:\sao-luu' });
    expect(backupExtraDirSchema.safeParse({ extraDir: 'a'.repeat(261) }).success).toBe(false);
  });
});
