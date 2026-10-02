// Deploy trang xem từ xa không cần `firebase login`: dùng chính file khóa service account của máy quầy
// (data/remote/service-account.json) làm thông tin xác thực, lấy project_id từ đó. Tự đặt CA của mạng công ty nếu có.
// Cách dùng: npm run deploy -w remote [-- --only hosting]   (mặc định hosting + firestore:rules)
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const remoteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(remoteDir, '..');
const keyFile = process.env['GOOGLE_APPLICATION_CREDENTIALS'] ?? path.join(repoRoot, 'data', 'remote', 'service-account.json');
const caFile = path.join(repoRoot, '.certs', 'corp-root.pem');

if (!existsSync(keyFile)) {
  console.error(`Không thấy file khóa ${keyFile}.\nTải "private key" của service account từ Firebase console (Project settings → Service accounts) rồi chép vào đó.`);
  process.exit(1);
}
const { project_id: projectId } = JSON.parse(readFileSync(keyFile, 'utf8'));
if (!projectId) {
  console.error('File khóa không có project_id.');
  process.exit(1);
}

const env = { ...process.env, GOOGLE_APPLICATION_CREDENTIALS: keyFile };
if (!env['NODE_EXTRA_CA_CERTS'] && existsSync(caFile)) env['NODE_EXTRA_CA_CERTS'] = caFile;

const extra = process.argv.slice(2);
const only = extra.includes('--only') ? [] : ['--only', 'hosting,firestore:rules'];
console.log(`Deploy lên project ${projectId} bằng khóa ${path.basename(keyFile)}…`);
const r = spawnSync('npx', ['-y', 'firebase-tools@15', 'deploy', '--project', projectId, '--non-interactive', ...only, ...extra], {
  cwd: remoteDir,
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(r.status ?? 1);
