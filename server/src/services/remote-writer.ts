import fs from 'node:fs';
import type { ServiceAccount } from 'firebase-admin/app';
import type { RemoteWriter } from './remote-sync.js';

/**
 * Writer thật bằng firebase-admin, import động để máy không bật tính năng không tải SDK lúc khởi động.
 * Mỗi lần gọi tạo app riêng (tên theo thời gian) nên đổi file khóa không đụng app cũ; close() xóa app.
 */
export async function createFirebaseWriter(keyFile: string): Promise<RemoteWriter> {
  const { initializeApp, cert, deleteApp } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const key = JSON.parse(fs.readFileSync(keyFile, 'utf8')) as ServiceAccount;
  const app = initializeApp({ credential: cert(key) }, `remote-${Date.now()}`);
  const store = getFirestore(app);
  const overviewRef = store.doc('remote/overview');
  const accessRef = store.doc('remote/access');
  return {
    async setOverview(doc) {
      await overviewRef.set(doc);
    },
    async deleteOverview() {
      await overviewRef.delete();
    },
    async setAccess(emails) {
      await accessRef.set({ emails });
    },
    close: () => deleteApp(app),
  };
}
