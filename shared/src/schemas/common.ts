import { z } from 'zod';

/** Chuỗi tùy chọn: trim, rỗng → null. */
export const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

/** Nhãn tiếng Việt cho thông báo lỗi validate. */
export const FIELD_LABELS: Record<string, string> = {
  name: 'Tên',
  barcode: 'Mã vạch',
  unit: 'Đơn vị',
  costPrice: 'Giá nhập',
  sellPrice: 'Giá bán',
  stock: 'Tồn',
  isWeighed: 'Hàng cân',
  categoryId: 'Danh mục',
  minStock: 'Tồn tối thiểu',
  sortOrder: 'Thứ tự',
  factor: 'Hệ số quy đổi',
};
