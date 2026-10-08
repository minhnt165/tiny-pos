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
  it('expiryWarnDays: lưu số, DB giữ chuỗi, đọc lại ra số; chỉ có khóa này trong DB thì các khóa khác vẫn mặc định', () => {
    const db = createTestDb();
    saveSettings(db, settingsInputSchema.parse({ expiryWarnDays: 45 }));
    expect(db.select().from(settings).all()).toContainEqual({ key: 'expiryWarnDays', value: '45' });
    expect(getSettings(db).expiryWarnDays).toBe(45);
    const db2 = createTestDb();
    db2.insert(settings).values({ key: 'expiryWarnDays', value: '7' }).run();
    expect(getSettings(db2)).toEqual({ ...SETTINGS_DEFAULTS, expiryWarnDays: 7 });
  });
});
