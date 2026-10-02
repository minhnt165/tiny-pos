import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';

let app: Promise<FirebaseApp> | null = null;

/**
 * Trên Firebase Hosting, /__/firebase/init.json là web config của chính project đang host → một bản build dùng cho mọi tiệm.
 * Dev local không có file này → đọc VITE_FIREBASE_CONFIG (remote/.env.local).
 */
export function initFirebase(): Promise<FirebaseApp> {
  app ??= (async () => {
    let options: FirebaseOptions | null = null;
    try {
      const res = await fetch('/__/firebase/init.json');
      if (res.ok && res.headers.get('content-type')?.includes('json')) options = (await res.json()) as FirebaseOptions;
    } catch {
      /* không phải Hosting */
    }
    if (!options) {
      const raw = import.meta.env['VITE_FIREBASE_CONFIG'] as string | undefined;
      if (!raw) throw new Error('Thiếu cấu hình Firebase: trang phải chạy trên Firebase Hosting hoặc có VITE_FIREBASE_CONFIG');
      options = JSON.parse(raw) as FirebaseOptions;
    }
    return initializeApp(options);
  })();
  return app;
}
