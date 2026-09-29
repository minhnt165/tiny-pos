import type { CSSProperties, ReactNode } from 'react';
import { formatMoney, formatQty, type Settings } from '@tiny-pos/shared';
import type { ReceiptData } from './receipt-data';

const METHOD_LABEL = { cash: 'Tiền mặt', transfer: 'Chuyển khoản', debt: 'Ghi nợ' } as const;

// Dùng px/mm cố định: html đặt font-size 18px nên rem của Tailwind sẽ quá to trên giấy 80mm
const page: CSSProperties = {
  width: '72mm',
  margin: '0 auto',
  padding: '3mm 0 6mm',
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontSize: '12px',
  lineHeight: 1.35,
  color: '#000',
  background: '#fff',
};
const center: CSSProperties = { textAlign: 'center' };
const rule: CSSProperties = { borderTop: '1px dashed #000', margin: '4px 0' };

function Row({ label, value, strong }: { label: ReactNode; value: ReactNode; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontWeight: strong ? 700 : 400, fontSize: strong ? '14px' : undefined }}>
      <span>{label}</span>
      <span style={{ whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });

/** Hóa đơn nhiệt 80mm (vùng in 72mm), đen trắng. */
export function Receipt({ data, settings, qrUrl }: { data: ReceiptData; settings: Settings; qrUrl: string | null }) {
  const paidOrder = data.code !== null;
  return (
    <div style={page}>
      <div style={{ ...center, fontSize: '16px', fontWeight: 700 }}>{settings.storeName}</div>
      {settings.storeAddress && <div style={center}>{settings.storeAddress}</div>}
      {settings.storePhone && <div style={center}>ĐT: {settings.storePhone}</div>}
      <div style={rule} />
      <div style={{ ...center, fontWeight: 700 }}>{paidOrder ? 'HÓA ĐƠN BÁN HÀNG' : 'TẠM TÍNH – chưa thanh toán'}</div>
      {paidOrder && <div style={center}>{data.code}</div>}
      <div style={center}>{timeLabel(data.createdAt)}</div>
      <div style={rule} />
      {data.items.map((it, i) => (
        <div key={i} style={{ marginBottom: '3px' }}>
          <div>{it.name}</div>
          <Row label={`${formatQty(it.qty)} ${it.unit} × ${formatMoney(it.price)}`} value={formatMoney(it.amount)} />
        </div>
      ))}
      <div style={rule} />
      <Row label="Tổng tiền" value={formatMoney(data.total)} />
      {data.discount > 0 && <Row label="Giảm giá" value={`-${formatMoney(data.discount)}`} />}
      <Row label="Phải trả" value={formatMoney(data.payable)} strong />
      {paidOrder && data.paymentMethod === 'cash' && (
        <>
          <Row label="Khách đưa" value={formatMoney(data.paid)} />
          <Row label="Tiền thối" value={formatMoney(data.paid - data.payable)} />
        </>
      )}
      {paidOrder && <Row label="Thanh toán" value={METHOD_LABEL[data.paymentMethod]} />}
      {qrUrl && (
        <div style={{ ...center, marginTop: '6px' }}>
          <img src={qrUrl} alt="" style={{ width: '42mm', height: '42mm' }} />
          <div>Quét mã để chuyển khoản</div>
        </div>
      )}
      <div style={rule} />
      {settings.receiptFooter && <div style={center}>{settings.receiptFooter}</div>}
    </div>
  );
}
