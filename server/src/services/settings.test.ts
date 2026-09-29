import { describe, expect, it } from 'vitest';
import { SETTINGS_DEFAULTS, settingsInputSchema } from '@tiny-pos/shared';
import { settings } from '../db/schema.js';
import { createTestDb } from '../db/test-db.js';
import { getSettings, saveSettings } from './settings.js';

describe('settings', () => {
  it('chưa lưu gì → mặc định', () => {
    expect(getSettings(createTestDb())).toEqual(SETTINGS_DEFAULTS);
  });
  it('lưu rồi đọc lại; autoPrint lưu "0"/"1"; lưu lần hai ghi đè', () => {
    const db = createTestDb();
    const input = settingsInputSchema.parse({ storeName: 'Tạp hóa Cô Ba', bankBin: '970436', bankAccount: '0123', bankAccountName: 'lê thị ba', autoPrint: false });
    expect(saveSettings(db, input)).toMatchObject({ storeName: 'Tạp hóa Cô Ba', bankAccountName: 'LE THI BA', autoPrint: false });
    expect(db.select().from(settings).all()).toContainEqual({ key: 'autoPrint', value: '0' });
    saveSettings(db, { ...input, autoPrint: true });
    expect(getSettings(db).autoPrint).toBe(true);
  });
});
