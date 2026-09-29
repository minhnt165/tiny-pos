import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { SETTINGS_DEFAULTS } from '@tiny-pos/shared';
import { useSettings } from '@/api/settings';
import { Receipt } from './Receipt';
import type { ReceiptData } from './receipt-data';

type PrintFn = (data: ReceiptData) => Promise<void>;
const Ctx = createContext<PrintFn>(() => Promise.resolve());

interface Job {
  data: ReceiptData;
  qrUrl: string | null;
}

/**
 * In hóa đơn: render Receipt vào #print-root rồi gọi window.print().
 * Chrome mở với --kiosk-printing sẽ in thẳng ra máy in mặc định, không hỏi.
 */
export function PrintProvider({ children }: { children: ReactNode }) {
  const { data: settings } = useSettings();
  const [job, setJob] = useState<Job | null>(null);
  const done = useRef<(() => void) | null>(null);

  const print = useCallback<PrintFn>(async (data) => {
    const qrUrl = data.qrPayload ? await QRCode.toDataURL(data.qrPayload, { margin: 1, width: 320 }) : null;
    await new Promise<void>((resolve) => {
      done.current = resolve;
      setJob({ data, qrUrl });
    });
  }, []);

  useEffect(() => {
    if (!job) return;
    let inner = 0;
    // Chờ 2 khung hình để DOM hóa đơn (và ảnh QR) vẽ xong rồi mới in
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        window.print();
        setJob(null);
        done.current?.();
        done.current = null;
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [job]);

  const root = document.getElementById('print-root');
  return (
    <Ctx.Provider value={print}>
      {children}
      {root && job && createPortal(<Receipt data={job.data} settings={settings ?? SETTINGS_DEFAULTS} qrUrl={job.qrUrl} />, root)}
    </Ctx.Provider>
  );
}

export const usePrint = () => useContext(Ctx);
