import { SETTINGS_DEFAULTS, settingsInputSchema, type Settings } from '@tiny-pos/shared';
import type { Db, DbOrTx } from '../db/connection.js';
import { settings } from '../db/schema.js';

/** Đọc bảng key/value; key chưa có nhận mặc định, key lạ bị bỏ qua. */
export function getSettings(db: DbOrTx): Settings {
  const raw: Record<string, unknown> = {};
  for (const row of db.select().from(settings).all()) raw[row.key] = row.value;
  if (typeof raw['autoPrint'] === 'string') raw['autoPrint'] = raw['autoPrint'] === '1';
  const r = settingsInputSchema.safeParse(raw);
  return r.success ? r.data : SETTINGS_DEFAULTS;
}

export function saveSettings(db: Db, input: Settings): Settings {
  db.transaction((tx) => {
    for (const [key, v] of Object.entries(input)) {
      const value = typeof v === 'boolean' ? (v ? '1' : '0') : String(v);
      tx.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } }).run();
    }
  });
  return getSettings(db);
}
