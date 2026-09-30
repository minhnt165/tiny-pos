import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const migrationsFolder = path.resolve(here, '../../drizzle');

/** Bản sao thư mục migration chỉ giữ `count` migration đầu, giả lập DB của giai đoạn trước. */
export function partialMigrations(count: number): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tiny-pos-mig-'));
  fs.cpSync(migrationsFolder, dir, { recursive: true });
  const journalPath = path.join(dir, 'meta', '_journal.json');
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')) as { entries: unknown[] };
  journal.entries = journal.entries.slice(0, count);
  fs.writeFileSync(journalPath, JSON.stringify(journal));
  return dir;
}
