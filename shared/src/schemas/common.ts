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
  items: 'Giỏ hàng',
  qty: 'Số lượng',
  price: 'Đơn giá',
  discount: 'Giảm giá',
  paid: 'Tiền khách đưa',
  paymentMethod: 'Phương thức thanh toán',
  productId: 'Sản phẩm',
  unitId: 'Đơn vị',
  date: 'Ngày',
  storeName: 'Tên cửa hàng',
  storeAddress: 'Địa chỉ',
  storePhone: 'Số điện thoại',
  receiptFooter: 'Lời chào cuối hóa đơn',
  bankBin: 'Ngân hàng',
  bankAccount: 'Số tài khoản',
  bankAccountName: 'Tên chủ tài khoản',
  autoPrint: 'Tự in',
};
