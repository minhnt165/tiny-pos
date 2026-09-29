import { useEffect, useState } from 'react';
import { parseVnNumber, productInputSchema, type ProductInput, type ProductWithUnits } from '@tiny-pos/shared';
import { groupThousands } from '@/lib/money-input';

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

export type FormErrors = Partial<Record<keyof FormState, string>>;

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
  costPrice: groupThousands(String(p.costPrice)),
  sellPrice: groupThousands(String(p.sellPrice)),
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

/** Lỗi của một ô số: chữ, âm, hoặc tiền lẻ (đồng phải là số nguyên). */
export function numberError(s: string, integer: boolean): string | undefined {
  if (s.trim() === '') return undefined;
  const n = parseVnNumber(s);
  if (Number.isNaN(n)) return 'Phải là số';
  if (n < 0) return 'Không được âm';
  if (integer && !Number.isInteger(n)) return 'Phải là số nguyên (đồng)';
  return undefined;
}

const NUMBER_FIELDS: [keyof FormState, boolean][] = [
  ['sellPrice', true],
  ['costPrice', true],
  ['stock', false],
  ['minStock', false],
];

/** Kiểm tra phía client với thông báo thân thiện; cuối cùng chạy lại zod schema dùng chung để chắc chắn. */
export function validateForm(f: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!f.name.trim()) errors.name = 'Nhập tên sản phẩm';
  else if (f.name.trim().length > 200) errors.name = 'Tối đa 200 ký tự';
  if (f.barcode.trim().length > 50) errors.barcode = 'Tối đa 50 ký tự';
  if (f.unit.trim().length > 20) errors.unit = 'Tối đa 20 ký tự';
  for (const [key, integer] of NUMBER_FIELDS) {
    const e = numberError(f[key] as string, integer);
    if (e) errors[key] = e;
  }
  if (Object.keys(errors).length === 0) {
    const r = productInputSchema.safeParse(toInput(f));
    if (!r.success) for (const issue of r.error.issues) errors[String(issue.path[0]) as keyof FormState] ??= issue.message;
  }
  return errors;
}

/**
 * Reset state khi mở dialog với sản phẩm khác / barcode khác.
 * Chỉ phụ thuộc vào product.id (không phải object) để refetch sau khi thêm/xóa đơn vị
 * không xóa mất những gì người dùng đang gõ dở.
 */
export function useProductForm(open: boolean, product: ProductWithUnits | null | undefined, initialBarcode?: string) {
  const [form, setForm] = useState<FormState>(empty());
  const [errors, setErrors] = useState<FormErrors>({});
  const productId = product?.id ?? null;
  useEffect(() => {
    if (open) {
      setForm(product ? fromProduct(product) : empty(initialBarcode));
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, productId, initialBarcode]);
  /** Sửa ô nào thì xóa lỗi ô đó ngay, để người dùng thấy đã sửa đúng. */
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));
  };
  return { form, set, errors, setErrors };
}
