import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** Mã QR của một địa chỉ để quét bằng điện thoại thay vì gõ. */
export function UrlQr({ url, alt = 'Mã QR' }: { url: string; alt?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { margin: 1, width: 240 })
      .then((u) => alive && setSrc(u))
      .catch(() => alive && setSrc(null));
    return () => {
      alive = false;
    };
  }, [url]);
  return src ? <img src={src} alt={alt} className="size-40 rounded-lg border bg-white p-1" /> : <div className="size-40 animate-pulse rounded-lg bg-muted" />;
}
