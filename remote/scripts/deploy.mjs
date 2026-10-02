// Deploy trang xem từ xa không cần `firebase login`: dùng chính file khóa service account của máy quầy
// (data/remote/service-account.json) làm thông tin xác thực, lấy project_id từ đó. Tự đặt CA của mạng công ty nếu có.
// Hosting đi qua firebase-tools; rules Firestore đưa lên bằng Admin SDK vì CLI cần quyền serviceusage mà khóa này không có.
// Cách dùng: npm run deploy -w remote            (hosting + rules)
//            npm run deploy -w remote -- --only hosting | --only rules
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cert, initializeApp } from 'firebase-admin/app';
import { getSecurityRules } from 'firebase-admin/security-rules';

const remoteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(remoteDir, '..');
const keyFile = process.env['GOOGLE_APPLICATION_CREDENTIALS'] ?? path.join(repoRoot, 'data', 'remote', 'service-account.json');
const caFile = path.join(repoRoot, '.certs', 'corp-root.pem');

if (!existsSync(keyFile)) {
  console.error(`Không thấy file khóa ${keyFile}.\nTải "private key" của service account từ Firebase console (Project settings → Service accounts) rồi chép vào đó.`);
  process.exit(1);
}
const key = JSON.parse(readFileSync(keyFile, 'utf8'));
const projectId = key.project_id;
if (!projectId) {
  console.error('File khóa không có project_id.');
  process.exit(1);
}
// Node chỉ đọc NODE_EXTRA_CA_CERTS lúc khởi động: chưa có mà máy có CA công ty thì chạy lại chính script này với biến đó
if (!process.env['NODE_EXTRA_CA_CERTS'] && existsSync(caFile)) {
  const r = spawnSync(process.execPath, process.argv.slice(1), { env: { ...process.env, NODE_EXTRA_CA_CERTS: caFile }, stdio: 'inherit' });
  process.exit(r.status ?? 1);
}

const onlyIdx = process.argv.indexOf('--only');
const only = onlyIdx >= 0 ? (process.argv[onlyIdx + 1] ?? '') : 'hosting,rules';
const want = (x) => only.split(',').includes(x);

if (want('hosting')) {
  console.log(`Hosting → project ${projectId} (khóa ${path.basename(keyFile)})…`);
  const r = spawnSync('npx', ['-y', 'firebase-tools@15', 'deploy', '--only', 'hosting', '--project', projectId, '--non-interactive'], {
    cwd: remoteDir,
    env: { ...process.env, GOOGLE_APPLICATION_CREDENTIALS: keyFile },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (want('rules')) {
  const source = readFileSync(path.join(remoteDir, 'firestore.rules'), 'utf8');
  const app = initializeApp({ credential: cert(key) });
  const rules = getSecurityRules(app);
  const current = await rules.getFirestoreRuleset().catch(() => null);
  if (current?.source[0]?.content === source) console.log('Rules Firestore: không đổi, bỏ qua.');
  else {
    const released = await rules.releaseFirestoreRulesetFromSource(source);
    console.log(`Rules Firestore: đã phát hành ${released.name}.`);
  }
}
console.log(`Xong. Trang xem: https://${projectId}.web.app`);
process.exit(0);
