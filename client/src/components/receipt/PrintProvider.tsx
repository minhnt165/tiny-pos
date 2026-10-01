import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { SETTINGS_DEFAULTS } from '@tiny-pos/shared';
import { useSettings } from '@/api/settings';
import { DebtReceipt, Receipt, ReturnReceipt, SupplierReturnReceipt } from './Receipt';
import type { PrintData } from './receipt-data';

type PrintFn = (data: PrintData) => Promise<void>;
const Ctx = createContext<PrintFn>(() => Promise.resolve());

interface Job {
  data: PrintData;
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
    const qrPayload = 'kind' in data ? null : data.qrPayload;
    const qrUrl = qrPayload ? await QRCode.toDataURL(qrPayload, { margin: 1, width: 320 }) : null;
    await new Promise<void>((resolve) => {
      done.current?.(); // lệnh in trước còn treo thì trả về trước, không để await treo mãi
      done.current = resolve;
      setJob({ data, qrUrl });
    });
  }, []);

  useEffect(() => {
    if (!job) return;
    let cancelled = false;
    let inner = 0;
    let timer = 0;
    // Chỉ dọn hóa đơn khi in xong (afterprint); có trình duyệt trả về từ print() trước khi chụp trang
    const finish = () => {
      window.removeEventListener('afterprint', finish);
      clearTimeout(timer);
      setJob(null);
      done.current?.();
      done.current = null;
    };
    const printNow = async () => {
      // Chờ ảnh QR giải mã xong, nếu không phiếu có thể in thiếu QR
      const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('#print-root img'));
      await Promise.all(imgs.map((img) => img.decode().catch(() => undefined)));
      if (cancelled) return;
      window.addEventListener('afterprint', finish);
      timer = window.setTimeout(finish, 60_000); // dự phòng nếu afterprint không bao giờ đến
      window.print();
    };
    // Chờ 2 khung hình để DOM hóa đơn vẽ xong rồi mới in
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => void printNow());
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
      window.removeEventListener('afterprint', finish);
      clearTimeout(timer);
    };
  }, [job]);

  const root = document.getElementById('print-root');
  return (
    <Ctx.Provider value={print}>
      {children}
      {root &&
        job &&
        createPortal(
          'kind' in job.data ? (
            job.data.kind === 'supplier-return' ? (
              <SupplierReturnReceipt data={job.data} settings={settings ?? SETTINGS_DEFAULTS} />
            ) : job.data.kind === 'return' ? (
              <ReturnReceipt data={job.data} settings={settings ?? SETTINGS_DEFAULTS} />
            ) : (
              <DebtReceipt data={job.data} settings={settings ?? SETTINGS_DEFAULTS} />
            )
          ) : (
            <Receipt data={job.data} settings={settings ?? SETTINGS_DEFAULTS} qrUrl={job.qrUrl} />
          ),
          root,
        )}
    </Ctx.Provider>
  );
}

export const usePrint = () => useContext(Ctx);
