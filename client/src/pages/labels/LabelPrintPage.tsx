import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { parseLabelItems, SAMPLE_LABEL_CODE, SETTINGS_DEFAULTS, type LabelItemRef, type ProductWithUnits } from '@tiny-pos/shared';
import { fetchProduct } from '@/api/products';
import { useSettings } from '@/api/settings';
import { Button } from '@/components/ui/button';
import { LabelSheets, type LabelData } from './LabelSheet';

const SAMPLE: LabelData = { name: 'Nước suối 500ml', unit: 'chai', price: 5000, code: SAMPLE_LABEL_CODE };

/** Trải danh sách tem theo số bản; tem thiếu mã (không nên có vì server đã cấp) thì bỏ. */
function expand(refs: LabelItemRef[], products: ProductWithUnits[]): LabelData[] {
  const out: LabelData[] = [];
  for (const r of refs) {
    const p = products.find((x) => x.id === r.productId);
    if (!p) continue;
    const u = r.unitId === null ? undefined : p.units.find((x) => x.id === r.unitId);
    const code = u ? u.barcode : p.barcode;
    if (!code) continue;
    const d = { name: p.name, unit: u?.name ?? p.unit, price: u?.sellPrice ?? p.sellPrice, code };
    for (let i = 0; i < r.copies; i++) out.push(d);
  }
  return out;
}

/**
 * Trang in tem, mở trong cửa sổ riêng (không --kiosk-printing) nên hộp in hiện ra và nhớ máy in tem.
 * Vẽ xong tự in, in xong tự đóng. Tem vẽ vào #print-root vì CSS in chỉ hiện phần tử đó.
 */
export function LabelPrintPage() {
  const [params] = useSearchParams();
  const sample = params.get('sample') === '1';
  const refs = useMemo(() => parseLabelItems(params.get('i')), [params]);
  const ids = [...new Set(refs.map((r) => r.productId))];
  const { data: settings } = useSettings();
  const { data: products, error } = useQuery({
    queryKey: ['products', 'labels', ids],
    queryFn: () => Promise.all(ids.map(fetchProduct)),
    enabled: !sample && ids.length > 0,
  });
  const labels = sample ? [SAMPLE] : products ? expand(refs, products) : [];
  const s = settings ?? SETTINGS_DEFAULTS;
  const ready = !!settings && labels.length > 0;
  const [printed, setPrinted] = useState(false);

  useEffect(() => {
    const close = () => window.close();
    window.addEventListener('afterprint', close);
    return () => window.removeEventListener('afterprint', close);
  }, []);
  useEffect(() => {
    if (!ready || printed) return;
    // Chờ 2 khung hình để SVG mã vạch vẽ xong rồi mới in
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        setPrinted(true);
        window.print();
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [ready, printed]);

  const root = document.getElementById('print-root');
  const sheets = <LabelSheets labels={labels} size={s.labelSize} showPrice={s.labelShowPrice} />;
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-heading text-xl font-semibold">{sample ? 'In thử tem' : `In ${labels.length} tem`}</h1>
        <Button className="h-11 text-base" disabled={!ready} onClick={() => window.print()}>
          <Printer data-icon="inline-start" />
          In lại
        </Button>
      </div>
      {error ? (
        <p className="text-destructive">Không tải được sản phẩm: {(error as Error).message}</p>
      ) : !sample && !refs.length ? (
        <p className="text-muted-foreground">Không có tem nào để in.</p>
      ) : (
        <div className="flex flex-wrap gap-2 rounded-xl border bg-muted/40 p-3">{sheets}</div>
      )}
      {root && ready && createPortal(sheets, root)}
    </div>
  );
}
