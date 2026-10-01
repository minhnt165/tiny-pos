export const LABEL_SIZES = ['40x30', '50x30', '35x22x2'] as const;
export type LabelSize = (typeof LABEL_SIZES)[number];

/** Khổ trang in (mm), khổ một tem và số tem trên một hàng của cuộn decal. */
export const LABEL_LAYOUT: Record<LabelSize, { pageW: number; pageH: number; labelW: number; labelH: number; cols: number; label: string }> = {
  '40x30': { pageW: 40, pageH: 30, labelW: 40, labelH: 30, cols: 1, label: '40 × 30 mm' },
  '50x30': { pageW: 50, pageH: 30, labelW: 50, labelH: 30, cols: 1, label: '50 × 30 mm' },
  '35x22x2': { pageW: 72, pageH: 22, labelW: 35, labelH: 22, cols: 2, label: '35 × 22 mm, 2 tem/hàng (cuộn 72 mm)' },
};

/** Tối đa số tem mỗi lần in. */
export const MAX_LABELS = 500;
/** Mã của tem mẫu (In thử) – mã nội bộ thứ 1. */
export const SAMPLE_LABEL_CODE = '2000000000015';

export interface LabelItemRef {
  productId: number;
  /** null = đơn vị gốc. */
  unitId: number | null;
  copies: number;
}

/** "12.0x3,15.4x10": sản phẩm.đơn vị (0 = gốc) x số tem; dùng cho ?i= của trang in và ?add= của trang In tem. */
export const formatLabelItems = (refs: LabelItemRef[]): string => refs.map((r) => `${r.productId}.${r.unitId ?? 0}x${r.copies}`).join(',');

export function parseLabelItems(s: string | null): LabelItemRef[] {
  if (!s) return [];
  const out: LabelItemRef[] = [];
  for (const part of s.split(',')) {
    const m = /^(\d+)\.(\d+)x(\d+)$/.exec(part.trim());
    if (!m) continue;
    const [productId, unitId, copies] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (productId < 1 || copies < 1 || copies > MAX_LABELS) continue;
    out.push({ productId, unitId: unitId || null, copies });
  }
  return out;
}

/** Tem cho các dòng phiếu nhập: quy về đơn vị gốc, cộng dòng cùng sản phẩm; số lẻ (hàng cân) thì 1 tem. */
export function importLabelRefs(items: { productId: number; qty: number; factor: number }[]): LabelItemRef[] {
  const total = new Map<number, number>();
  for (const it of items) total.set(it.productId, (total.get(it.productId) ?? 0) + it.qty * it.factor);
  return [...total].map(([productId, n]) => {
    const whole = Math.abs(n - Math.round(n)) < 1e-9;
    return { productId, unitId: null, copies: Math.min(MAX_LABELS, whole ? Math.max(1, Math.round(n)) : 1) };
  });
}
