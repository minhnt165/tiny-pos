import { useEffect, useState } from 'react';
import { doc, getFirestore, onSnapshot } from 'firebase/firestore';
import type { RemoteOverviewDoc } from '@tiny-pos/shared';
import { initFirebase } from './firebase';

export type RemoteState =
  | { status: 'loading'; doc: null; fromCache: false }
  | { status: 'denied'; doc: null; fromCache: false }
  | { status: 'missing'; doc: null; fromCache: boolean }
  | { status: 'ok'; doc: RemoteOverviewDoc; fromCache: boolean };

/**
 * Lắng nghe remote/overview. Chỉ gọi khi đã đăng nhập (rules cần auth). permission-denied → 'denied' (email không trong danh sách,
 * kể cả khi bị xóa giữa chừng); tài liệu chưa có → 'missing' (máy quầy chưa đẩy). fromCache = điện thoại đang ngoại tuyến.
 */
export function useRemoteOverview(uid: string): RemoteState {
  const [state, setState] = useState<RemoteState>({ status: 'loading', doc: null, fromCache: false });
  useEffect(() => {
    setState({ status: 'loading', doc: null, fromCache: false });
    let off = () => undefined as void;
    void initFirebase().then((app) => {
      off = onSnapshot(
        doc(getFirestore(app), 'remote/overview'),
        { includeMetadataChanges: true },
        (snap) => {
          const fromCache = snap.metadata.fromCache;
          if (!snap.exists()) return setState({ status: 'missing', doc: null, fromCache });
          setState({ status: 'ok', doc: snap.data() as RemoteOverviewDoc, fromCache });
        },
        (err) => {
          if (err.code === 'permission-denied') setState({ status: 'denied', doc: null, fromCache: false });
          else console.error(err);
        },
      );
    });
    return () => off();
  }, [uid]);
  return state;
}
