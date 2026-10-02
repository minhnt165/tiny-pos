import { useEffect, useState } from 'react';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut, type User } from 'firebase/auth';
import { initFirebase } from './firebase';

/** Người đang đăng nhập; ready=false khi Firebase chưa trả lời lần đầu (không hiện nút đăng nhập nháy). */
export function useUser(): { user: User | null; ready: boolean } {
  const [state, setState] = useState<{ user: User | null; ready: boolean }>({ user: null, ready: false });
  useEffect(() => {
    let off = () => undefined as void;
    void initFirebase().then((app) => {
      off = onAuthStateChanged(getAuth(app), (user) => setState({ user, ready: true }));
    });
    return () => off();
  }, []);
  return state;
}

/** Popup trước; điện thoại chặn popup thì chuyển sang redirect. */
export async function signIn(): Promise<void> {
  const auth = getAuth(await initFirebase());
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') await signInWithRedirect(auth, provider);
    else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') throw e;
  }
}

export async function signOutUser(): Promise<void> {
  await signOut(getAuth(await initFirebase()));
}
