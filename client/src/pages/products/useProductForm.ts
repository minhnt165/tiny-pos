import { useEffect, useState } from 'react';
import { parseVnNumber, type ProductInput, type ProductWithUnits } from '@tiny-pos/shared';

/** State form giữ dạng chuỗi để người dùng gõ tự do; chỉ đổi sang số khi gửi. */
export interface FormState {
  barcode: string;
  name: string;
  unit: string;
  costPrice: string;
  sellPrice: string;
  stock: string;
  isWeighed: boolean;
  categoryId: string;
  minStock: string;
}

const empty = (barcode = ''): FormState => ({
  barcode,
  name: '',
  unit: 'cái',
  costPrice: '0',
  sellPrice: '0',
  stock: '0',
  isWeighed: false,
  categoryId: '',
  minStock: '0',
});

const fromProduct = (p: ProductWithUnits): FormState => ({
  barcode: p.barcode ?? '',
  name: p.name,
  unit: p.unit,
  costPrice: String(p.costPrice),
  sellPrice: String(p.sellPrice),
  stock: String(p.stock),
  isWeighed: p.isWeighed,
  categoryId: p.categoryId ? String(p.categoryId) : '',
  minStock: String(p.minStock),
});

const num = (s: string) => (s.trim() === '' ? 0 : parseVnNumber(s));

export function toInput(f: FormState): ProductInput {
  return {
    barcode: f.barcode.trim() || null,
    name: f.name,
    unit: f.unit || 'cái',
    costPrice: num(f.costPrice),
    sellPrice: num(f.sellPrice),
    stock: num(f.stock),
    isWeighed: f.isWeighed,
    categoryId: f.categoryId ? Number(f.categoryId) : null,
    minStock: num(f.minStock),
  };
}

/**
 * Reset state khi mở dialog với sản phẩm khác / barcode khác.
 * Chỉ phụ thuộc vào product.id (không phải object) để refetch sau khi thêm/xóa đơn vị
 * không xóa mất những gì người dùng đang gõ dở.
 */
export function useProductForm(open: boolean, product: ProductWithUnits | null | undefined, initialBarcode?: string) {
  const [form, setForm] = useState<FormState>(empty());
  const productId = product?.id ?? null;
  useEffect(() => {
    if (open) setForm(product ? fromProduct(product) : empty(initialBarcode));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, productId, initialBarcode]);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  return { form, set };
}
