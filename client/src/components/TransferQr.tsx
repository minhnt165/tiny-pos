import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Link } from 'react-router';
import { BANKS, vietQrFromSettings } from '@tiny-pos/shared';
import { useSettings } from '@/api/settings';

/** Mã VietQR đúng số tiền + tài khoản nhận; thiếu cài đặt ngân hàng thì nhắc mở Cài đặt. */
export function TransferQr({ amount }: { amount: number }) {
  const { data: settings } = useSettings();
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);
  const qrPayload = settings ? vietQrFromSettings(settings, amount) : null;
  const bank = BANKS.find((b) => b.bin === settings?.bankBin);
  // Nhắc theo trường còn thiếu trong Cài đặt (không dựa vào qrUrl để tránh chớp trong lúc QR đang sinh)
  const missing = !settings ? null : !settings.bankBin ? 'Chưa chọn ngân hàng' : !settings.bankAccount ? 'Chưa nhập số tài khoản' : null;

  useEffect(() => {
    setQrError(false);
    if (!qrPayload) {
      setQrUrl(null);
      return;
    }
    let alive = true;
    QRCode.toDataURL(qrPayload, { margin: 1, width: 320 })
      .then((u) => alive && setQrUrl(u))
      .catch(() => alive && setQrError(true));
    return () => {
      alive = false;
    };
  }, [qrPayload]);

  return (
    <>
      {qrUrl ? (
        <img src={qrUrl} alt="Mã VietQR" className="mx-auto size-64 rounded-xl border bg-white p-2" />
      ) : missing || qrError ? (
        <p className="rounded-xl bg-muted px-4 py-6 text-muted-foreground">
          {missing ?? 'Không tạo được mã QR'}.{' '}
          <Link to="/settings" className="font-medium text-primary underline">
            Mở Cài đặt
          </Link>
        </p>
      ) : (
        <div className="mx-auto size-64 animate-pulse rounded-xl bg-muted" />
      )}
      {!missing && settings?.bankAccount && (
        <div className="text-sm">
          <div className="font-medium">{bank?.shortName ?? settings.bankBin}</div>
          <div className="font-mono text-base">{settings.bankAccount}</div>
          <div className="text-muted-foreground">{settings.bankAccountName}</div>
        </div>
      )}
    </>
  );
}
