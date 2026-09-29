import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { createDb } from './db/connection.js';

// server/src → ../.. = gốc repo ; server/dist → ../.. = gốc repo
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dbFile = process.env['DB_FILE'] ?? path.join(repoRoot, 'data', 'grocery.db');
const port = Number(process.env['PORT'] ?? 3000);

const db = createDb(dbFile);
const app = createApp(db, { clientDist: path.join(repoRoot, 'client', 'dist') });

app.listen(port, '0.0.0.0', () => {
  const lan = Object.values(os.networkInterfaces())
    .flat()
    .find((i) => i && i.family === 'IPv4' && !i.internal)?.address;
  console.log(`Tiny POS chạy tại http://localhost:${port}` + (lan ? ` (LAN: http://${lan}:${port})` : ''));
  console.log(`DB: ${dbFile}`);
});
