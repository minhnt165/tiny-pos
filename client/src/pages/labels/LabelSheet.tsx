import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import JsBarcode from 'jsbarcode';
import { barcodeFormat, formatMoney, LABEL_LAYOUT, type LabelSize } from '@tiny-pos/shared';

export interface LabelData {
  name: string;
  /** Đơn vị in sau giá: "/lon", "/kg". */
  unit: string;
  price: number;
  code: string;
}

/**
 * Mã vạch SVG. Mã không vẽ được vạch (có chữ có dấu) hoặc jsbarcode từ chối thì in dãy chữ thay cho vạch:
 * một tem lỗi không được làm trắng cả cửa sổ in.
 */
function Barcode({ code }: { code: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const format = barcodeFormat(code);
  const [failed, setFailed] = useState(false);
  useLayoutEffect(() => {
    if (!ref.current || !format) return;
    try {
      JsBarcode(ref.current, code, { height: 40, width: 2, margin: 0, fontSize: 14, textMargin: 1, background: '#fff', lineColor: '#000', format });
    } catch {
      setFailed(true);
    }
  }, [code, format]);
  if (!format || failed) return <div style={{ fontFamily: 'monospace', fontSize: '9pt', overflowWrap: 'anywhere' }}>{code}</div>;
  // jsbarcode đặt viewBox nên co giãn theo khung tem
  return <svg ref={ref} style={{ width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid meet" />;
}

const nameStyle: CSSProperties = {
  fontSize: '8.5pt',
  lineHeight: 1.15,
  fontWeight: 600,
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

function Label({ data, w, h, showPrice }: { data: LabelData; w: number; h: number; showPrice: boolean }) {
  return (
    <div
      style={{
        width: `${w}mm`,
        height: `${h}mm`,
        padding: '1.2mm 1.5mm',
        boxSizing: 'border-box',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5mm',
        fontFamily: 'Arial, Helvetica, sans-serif',
        color: '#000',
        background: '#fff',
      }}
    >
      <div style={nameStyle}>{data.name}</div>
      {showPrice && (
        <div style={{ fontSize: '11pt', fontWeight: 700, lineHeight: 1.1 }}>
          {formatMoney(data.price)}
          <span style={{ fontSize: '7pt', fontWeight: 400 }}>/{data.unit}</span>
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        <Barcode code={data.code} />
      </div>
    </div>
  );
}

/** Các trang tem theo khổ đã chọn: mỗi trang 1 tem, hoặc 1 hàng 2 tem với cuộn 72 mm. */
export function LabelSheets({ labels, size, showPrice }: { labels: LabelData[]; size: LabelSize; showPrice: boolean }) {
  const l = LABEL_LAYOUT[size];
  const pages: LabelData[][] = [];
  for (let i = 0; i < labels.length; i += l.cols) pages.push(labels.slice(i, i + l.cols));
  return (
    <>
      {/* Trang tên "label" riêng: không đụng @page 80mm của hóa đơn trong index.css */}
      <style>{`@page label { size: ${l.pageW}mm ${l.pageH}mm; margin: 0; } .label-page { page: label; break-after: page; }`}</style>
      {pages.map((row, i) => (
        <div key={i} className="label-page" style={{ width: `${l.pageW}mm`, height: `${l.pageH}mm`, display: 'flex', justifyContent: 'space-between', background: '#fff' }}>
          {row.map((d, j) => (
            <Label key={j} data={d} w={l.labelW} h={l.labelH} showPrice={showPrice} />
          ))}
        </div>
      ))}
    </>
  );
}
