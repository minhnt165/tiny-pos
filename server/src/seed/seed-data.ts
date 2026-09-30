/** Dữ liệu mẫu cho tiệm tạp hóa: danh mục, sản phẩm, đơn vị quy đổi. Giá tính bằng đồng. */

export interface SeedUnit {
  name: string;
  factor: number;
  sellPrice: number;
}

export interface SeedProduct {
  name: string;
  category: string;
  unit: string;
  costPrice: number;
  sellPrice: number;
  stock: number;
  minStock?: number;
  isWeighed?: boolean;
  /** Không có mã vạch (rau củ, hàng lẻ) */
  noBarcode?: boolean;
  inactive?: boolean;
  units?: SeedUnit[];
}

export const SEED_CATEGORIES = [
  'Đồ uống',
  'Sữa & trứng',
  'Bánh kẹo',
  'Mì & đồ khô',
  'Gia vị & nước chấm',
  'Dầu ăn & đường',
  'Hóa mỹ phẩm',
  'Đồ dùng gia đình',
  'Rau củ & thịt',
  'Thuốc lá & khác',
];

const p = (
  name: string,
  category: string,
  unit: string,
  costPrice: number,
  sellPrice: number,
  stock: number,
  extra: Partial<SeedProduct> = {},
): SeedProduct => ({ name, category, unit, costPrice, sellPrice, stock, minStock: 5, ...extra });

export const SEED_PRODUCTS: SeedProduct[] = [
  // Đồ uống
  p('Coca-Cola lon 330ml', 'Đồ uống', 'lon', 8500, 10000, 48, { units: [{ name: 'Lốc', factor: 6, sellPrice: 58000 }, { name: 'Thùng', factor: 24, sellPrice: 225000 }] }),
  p('Pepsi lon 330ml', 'Đồ uống', 'lon', 8300, 10000, 36, { units: [{ name: 'Thùng', factor: 24, sellPrice: 220000 }] }),
  p('7Up lon 330ml', 'Đồ uống', 'lon', 8300, 10000, 12, { minStock: 24 }),
  p('Sting dâu 330ml', 'Đồ uống', 'chai', 9000, 11000, 30),
  p('Red Bull 250ml', 'Đồ uống', 'lon', 11500, 14000, 20),
  p('Trà xanh 0 độ 455ml', 'Đồ uống', 'chai', 8800, 10000, 24, { units: [{ name: 'Thùng', factor: 24, sellPrice: 230000 }] }),
  p('Nước suối Aquafina 500ml', 'Đồ uống', 'chai', 3800, 5000, 60, { units: [{ name: 'Thùng', factor: 24, sellPrice: 110000 }] }),
  p('Nước suối Lavie 500ml', 'Đồ uống', 'chai', 3500, 5000, 4, { minStock: 12 }),
  p('Bia Tiger lon 330ml', 'Đồ uống', 'lon', 15500, 18000, 48, { units: [{ name: 'Thùng', factor: 24, sellPrice: 420000 }] }),
  p('Bia Saigon Special lon', 'Đồ uống', 'lon', 13000, 15000, 24, { units: [{ name: 'Thùng', factor: 24, sellPrice: 350000 }] }),
  p('Bia Heineken lon 330ml', 'Đồ uống', 'lon', 18500, 21000, 24),
  p('Cà phê sữa đá Highlands lon', 'Đồ uống', 'lon', 12500, 15000, 18),
  p('Nước yến Nunest lọ', 'Đồ uống', 'lọ', 14000, 18000, 10),
  // Sữa & trứng
  p('Sữa tươi Vinamilk 1L', 'Sữa & trứng', 'hộp', 27000, 32000, 15),
  p('Sữa tươi TH true MILK 180ml', 'Sữa & trứng', 'hộp', 7200, 8500, 40, { units: [{ name: 'Lốc', factor: 4, sellPrice: 33000 }, { name: 'Thùng', factor: 48, sellPrice: 390000 }] }),
  p('Sữa đặc Ông Thọ 380g', 'Sữa & trứng', 'lon', 22000, 26000, 20),
  p('Sữa chua Vinamilk có đường', 'Sữa & trứng', 'hộp', 5500, 7000, 24, { units: [{ name: 'Lốc', factor: 4, sellPrice: 27000 }] }),
  p('Sữa Milo hộp 180ml', 'Sữa & trứng', 'hộp', 7500, 9000, 3, { minStock: 12, units: [{ name: 'Lốc', factor: 4, sellPrice: 35000 }] }),
  p('Trứng gà (vỉ 10)', 'Sữa & trứng', 'vỉ', 28000, 33000, 8),
  p('Trứng vịt (vỉ 10)', 'Sữa & trứng', 'vỉ', 32000, 38000, 5),
  // Bánh kẹo
  p('Bánh Oreo 133g', 'Bánh kẹo', 'gói', 9500, 12000, 18),
  p('Bánh Chocopie hộp 12', 'Bánh kẹo', 'hộp', 42000, 48000, 10),
  p('Bánh gạo One One 150g', 'Bánh kẹo', 'gói', 13000, 16000, 12),
  p('Kẹo Alpenliebe gói', 'Bánh kẹo', 'gói', 15000, 18000, 20),
  p('Snack Oishi tôm cay', 'Bánh kẹo', 'gói', 4200, 5000, 30, { units: [{ name: 'Lốc', factor: 10, sellPrice: 47000 }] }),
  p('Snack khoai tây Lay\'s 52g', 'Bánh kẹo', 'gói', 8000, 10000, 15),
  p('Kẹo cao su Doublemint', 'Bánh kẹo', 'thanh', 4500, 6000, 25),
  p('Bánh mì sandwich Kinh Đô', 'Bánh kẹo', 'ổ', 17000, 20000, 6),
  p('Bánh AFC rau cải 200g', 'Bánh kẹo', 'hộp', 19000, 23000, 2, { minStock: 6 }),
  // Mì & đồ khô
  p('Mì Hảo Hảo tôm chua cay', 'Mì & đồ khô', 'gói', 3800, 4500, 90, { units: [{ name: 'Thùng', factor: 30, sellPrice: 125000 }] }),
  p('Mì Omachi sườn hầm', 'Mì & đồ khô', 'gói', 6500, 8000, 40, { units: [{ name: 'Thùng', factor: 30, sellPrice: 225000 }] }),
  p('Mì 3 Miền tôm chua cay', 'Mì & đồ khô', 'gói', 3200, 4000, 60, { units: [{ name: 'Thùng', factor: 30, sellPrice: 110000 }] }),
  p('Phở bò Vifon ly', 'Mì & đồ khô', 'ly', 9000, 11000, 20),
  p('Cháo gói Gấu Đỏ', 'Mì & đồ khô', 'gói', 3500, 4500, 25),
  p('Gạo ST25 túi 5kg', 'Mì & đồ khô', 'túi', 145000, 165000, 6),
  p('Gạo thơm Lài túi 10kg', 'Mì & đồ khô', 'túi', 190000, 215000, 3, { minStock: 4 }),
  p('Bún khô 500g', 'Mì & đồ khô', 'gói', 17000, 21000, 10),
  p('Đậu phộng rang 200g', 'Mì & đồ khô', 'gói', 18000, 22000, 8),
  // Gia vị & nước chấm
  p('Nước mắm Nam Ngư 900ml', 'Gia vị & nước chấm', 'chai', 34000, 40000, 12),
  p('Nước mắm Chinsu 500ml', 'Gia vị & nước chấm', 'chai', 27000, 32000, 10),
  p('Nước tương Maggi 700ml', 'Gia vị & nước chấm', 'chai', 25000, 30000, 8),
  p('Tương ớt Chinsu 250g', 'Gia vị & nước chấm', 'chai', 12000, 15000, 15),
  p('Hạt nêm Knorr 900g', 'Gia vị & nước chấm', 'gói', 52000, 60000, 6),
  p('Bột ngọt Ajinomoto 454g', 'Gia vị & nước chấm', 'gói', 32000, 37000, 9),
  p('Muối I-ốt 1kg', 'Gia vị & nước chấm', 'gói', 5000, 7000, 12),
  p('Tiêu xay Dh Foods 40g', 'Gia vị & nước chấm', 'hũ', 16000, 20000, 7),
  // Dầu ăn & đường
  p('Dầu ăn Simply 1L', 'Dầu ăn & đường', 'chai', 52000, 58000, 10),
  p('Dầu ăn Tường An 2L', 'Dầu ăn & đường', 'chai', 98000, 110000, 5),
  p('Đường Biên Hòa 1kg', 'Dầu ăn & đường', 'kg', 22000, 26000, 20),
  p('Bột mì đa dụng 1kg', 'Dầu ăn & đường', 'gói', 19000, 23000, 6),
  // Hóa mỹ phẩm
  p('Bột giặt OMO 3kg', 'Hóa mỹ phẩm', 'túi', 125000, 140000, 6),
  p('Nước giặt Ariel 3.2kg', 'Hóa mỹ phẩm', 'túi', 175000, 195000, 3, { minStock: 4 }),
  p('Nước rửa chén Sunlight 750g', 'Hóa mỹ phẩm', 'chai', 24000, 28000, 15),
  p('Dầu gội Clear 630g', 'Hóa mỹ phẩm', 'chai', 135000, 150000, 4),
  p('Sữa tắm Lifebuoy 850g', 'Hóa mỹ phẩm', 'chai', 110000, 125000, 5),
  p('Kem đánh răng P/S 180g', 'Hóa mỹ phẩm', 'tuýp', 28000, 33000, 12),
  p('Bàn chải đánh răng Colgate', 'Hóa mỹ phẩm', 'cái', 12000, 15000, 20),
  p('Giấy vệ sinh Pulppy (lốc 10)', 'Hóa mỹ phẩm', 'lốc', 45000, 52000, 8),
  p('Băng vệ sinh Diana ban ngày', 'Hóa mỹ phẩm', 'gói', 19000, 23000, 10),
  p('Nước lau sàn Sunlight 1L', 'Hóa mỹ phẩm', 'chai', 32000, 38000, 0, { minStock: 3 }),
  // Đồ dùng gia đình
  p('Pin Con Ó AA (vỉ 2)', 'Đồ dùng gia đình', 'vỉ', 8000, 10000, 30),
  p('Bật lửa ga', 'Đồ dùng gia đình', 'cái', 2500, 4000, 50, { noBarcode: true }),
  p('Túi rác đen (cuộn)', 'Đồ dùng gia đình', 'cuộn', 12000, 15000, 15, { noBarcode: true }),
  p('Bóng đèn LED Rạng Đông 9W', 'Đồ dùng gia đình', 'cái', 32000, 40000, 6),
  p('Nhang muỗi Jumbo', 'Đồ dùng gia đình', 'hộp', 14000, 17000, 12),
  p('Khăn giấy Tempo gói', 'Đồ dùng gia đình', 'gói', 9500, 12000, 18),
  // Rau củ & thịt (hàng cân, không mã vạch)
  p('Thịt heo ba rọi', 'Rau củ & thịt', 'kg', 120000, 145000, 4.5, { isWeighed: true, noBarcode: true, minStock: 2 }),
  p('Thịt bò thăn', 'Rau củ & thịt', 'kg', 260000, 300000, 1.2, { isWeighed: true, noBarcode: true, minStock: 2 }),
  p('Cá diêu hồng', 'Rau củ & thịt', 'kg', 55000, 70000, 3, { isWeighed: true, noBarcode: true }),
  p('Cà chua', 'Rau củ & thịt', 'kg', 18000, 25000, 6, { isWeighed: true, noBarcode: true }),
  p('Khoai tây', 'Rau củ & thịt', 'kg', 20000, 28000, 8, { isWeighed: true, noBarcode: true }),
  p('Hành tím', 'Rau củ & thịt', 'kg', 35000, 45000, 2.5, { isWeighed: true, noBarcode: true }),
  p('Tỏi', 'Rau củ & thịt', 'kg', 40000, 55000, 1.5, { isWeighed: true, noBarcode: true, minStock: 2 }),
  p('Rau muống', 'Rau củ & thịt', 'bó', 5000, 8000, 10, { noBarcode: true, minStock: 0 }),
  // Thuốc lá & khác
  p('Thuốc lá Vinataba', 'Thuốc lá & khác', 'gói', 24000, 27000, 30, { units: [{ name: 'Cây', factor: 10, sellPrice: 265000 }] }),
  p('Thuốc lá Thăng Long', 'Thuốc lá & khác', 'gói', 14000, 16000, 20),
  p('Thẻ cào Viettel 50.000đ', 'Thuốc lá & khác', 'thẻ', 48500, 50000, 20, { noBarcode: true, minStock: 5 }),
  p('Mì Kokomi (mẫu cũ)', 'Mì & đồ khô', 'gói', 3000, 3500, 0, { inactive: true, minStock: 0 }),
  p('Nước ngọt Mirinda cam (hết bán)', 'Đồ uống', 'lon', 8000, 9500, 0, { inactive: true, minStock: 0 }),
];

export interface SeedSupplier {
  name: string;
  phone: string | null;
  note: string | null;
}

export const SEED_SUPPLIERS: SeedSupplier[] = [
  { name: 'Đại lý nước giải khát Hòa Phát', phone: '0912345678', note: 'Giao thứ 2 và thứ 5' },
  { name: 'Nhà phân phối Vinamilk Bắc Giang', phone: '0983111222', note: 'Sữa, sữa chua, trứng' },
  { name: 'Tổng kho bánh kẹo Minh Anh', phone: '0977654321', note: null },
  { name: 'Công ty Hóa phẩm Thành Công', phone: '0904777888', note: 'Chiết khấu 3% khi trả đủ' },
  { name: 'Chợ đầu mối Lạng Giang', phone: null, note: 'Rau củ, thịt – trả tiền mặt' },
];

export interface SeedImportItem {
  /** Tên sản phẩm trong SEED_PRODUCTS */
  product: string;
  /** Tên đơn vị quy đổi (Thùng, Lốc…); bỏ trống = đơn vị gốc */
  unit?: string;
  qty: number;
  /** Giá nhập theo đơn vị của dòng */
  unitCost: number;
}

export interface SeedImport {
  daysAgo: number;
  /** Giờ trong ngày (giờ máy chạy seed) */
  hour: number;
  /** Tên trong SEED_SUPPLIERS; null = không ghi NCC (phải trả đủ) */
  supplier: string | null;
  /** 'all' = trả đủ */
  paid: number | 'all';
  /** Ghi chú khác nhau giữa các phiếu: seed dùng để nhận ra phiếu đã nạp */
  note: string;
  /** Hủy phiếu sau khi nhập (giờ hủy = giờ nhập + 2 tiếng) */
  cancelled?: boolean;
  items: SeedImportItem[];
}

/** Phiếu nhập mẫu, theo thứ tự thời gian (giá vốn lấy theo lần nhập sau cùng). */
export const SEED_IMPORTS: SeedImport[] = [
  {
    daysAgo: 12, hour: 8, supplier: 'Đại lý nước giải khát Hòa Phát', paid: 'all', note: 'Nhập hàng đầu kỳ',
    items: [
      { product: 'Bia Tiger lon 330ml', unit: 'Thùng', qty: 2, unitCost: 372000 },
      { product: 'Coca-Cola lon 330ml', unit: 'Thùng', qty: 2, unitCost: 204000 },
      { product: 'Nước suối Aquafina 500ml', unit: 'Thùng', qty: 3, unitCost: 91200 },
    ],
  },
  {
    daysAgo: 10, hour: 9, supplier: 'Nhà phân phối Vinamilk Bắc Giang', paid: 0, note: 'Sữa giao định kỳ, ghi nợ',
    items: [
      { product: 'Sữa tươi Vinamilk 1L', qty: 12, unitCost: 27000 },
      { product: 'Sữa chua Vinamilk có đường', unit: 'Lốc', qty: 10, unitCost: 22000 },
      { product: 'Sữa tươi TH true MILK 180ml', unit: 'Lốc', qty: 6, unitCost: 28800 },
    ],
  },
  {
    daysAgo: 8, hour: 15, supplier: 'Tổng kho bánh kẹo Minh Anh', paid: 300000, note: 'Bánh kẹo, trả trước một phần',
    items: [
      { product: 'Bánh Oreo 133g', qty: 24, unitCost: 9500 },
      { product: 'Bánh Chocopie hộp 12', qty: 10, unitCost: 42000 },
      { product: 'Snack Oishi tôm cay', unit: 'Lốc', qty: 5, unitCost: 42000 },
      { product: 'Bánh gạo One One 150g', qty: 12, unitCost: 13000 },
    ],
  },
  {
    daysAgo: 7, hour: 6, supplier: 'Chợ đầu mối Lạng Giang', paid: 'all', note: 'Đi chợ sáng',
    items: [
      { product: 'Thịt heo ba rọi', qty: 5, unitCost: 118000 },
      { product: 'Cà chua', qty: 4, unitCost: 17000 },
      { product: 'Hành tím', qty: 2, unitCost: 34000 },
    ],
  },
  {
    daysAgo: 6, hour: 10, supplier: null, paid: 'all', note: 'Mua lẻ, không lấy hóa đơn',
    items: [{ product: 'Muối I-ốt 1kg', qty: 10, unitCost: 5000 }],
  },
  {
    daysAgo: 5, hour: 14, supplier: 'Công ty Hóa phẩm Thành Công', paid: 1000000, note: 'Hóa phẩm tháng này',
    items: [
      { product: 'Bột giặt OMO 3kg', qty: 6, unitCost: 125000 },
      { product: 'Nước giặt Ariel 3.2kg', qty: 6, unitCost: 172000 },
      { product: 'Nước rửa chén Sunlight 750g', qty: 12, unitCost: 24000 },
      { product: 'Kem đánh răng P/S 180g', qty: 12, unitCost: 28000 },
    ],
  },
  {
    daysAgo: 4, hour: 9, supplier: 'Đại lý nước giải khát Hòa Phát', paid: 0, note: 'Nhập nhầm, đã trả lại hàng', cancelled: true,
    items: [{ product: 'Pepsi lon 330ml', unit: 'Thùng', qty: 2, unitCost: 199200 }],
  },
  {
    daysAgo: 3, hour: 8, supplier: 'Đại lý nước giải khát Hòa Phát', paid: 0, note: 'Bia nước ngọt, giá bia tăng',
    items: [
      { product: 'Bia Tiger lon 330ml', unit: 'Thùng', qty: 3, unitCost: 379200 },
      { product: 'Bia Heineken lon 330ml', qty: 24, unitCost: 18500 },
      { product: 'Sting dâu 330ml', qty: 24, unitCost: 9000 },
      { product: 'Red Bull 250ml', qty: 24, unitCost: 11500 },
    ],
  },
  {
    daysAgo: 2, hour: 16, supplier: 'Tổng kho bánh kẹo Minh Anh', paid: 'all', note: 'Mì gói',
    items: [
      { product: 'Mì Hảo Hảo tôm chua cay', unit: 'Thùng', qty: 3, unitCost: 114000 },
      { product: 'Mì Omachi sườn hầm', unit: 'Thùng', qty: 2, unitCost: 195000 },
    ],
  },
  {
    daysAgo: 1, hour: 9, supplier: 'Nhà phân phối Vinamilk Bắc Giang', paid: 200000, note: 'Sữa đặc, trứng',
    items: [
      { product: 'Sữa đặc Ông Thọ 380g', qty: 12, unitCost: 22000 },
      { product: 'Trứng gà (vỉ 10)', qty: 10, unitCost: 28000 },
    ],
  },
];

export interface SeedSupplierPayment {
  daysAgo: number;
  hour: number;
  supplier: string;
  amount: number;
  /** Ghi chú khác nhau giữa các lần trả: seed dùng để nhận ra lần đã nạp */
  note: string;
}

/** Trả nợ NCC, xen giữa các phiếu nhập (số trả không vượt số đang nợ lúc đó). */
export const SEED_SUPPLIER_PAYMENTS: SeedSupplierPayment[] = [
  { daysAgo: 5, hour: 17, supplier: 'Nhà phân phối Vinamilk Bắc Giang', amount: 500000, note: 'Trả nợ tiền mặt' },
  { daysAgo: 1, hour: 18, supplier: 'Tổng kho bánh kẹo Minh Anh', amount: 400000, note: 'Chuyển khoản trả nợ' },
];

/** Sinh mã EAN-13 hợp lệ, cố định theo chỉ số để chạy lại vẫn ra cùng mã. */
export function ean13(index: number): string {
  const body = `893${String(1000000 + index * 7919).padStart(9, '0')}`.slice(0, 12);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(body[i]) * (i % 2 === 0 ? 1 : 3);
  return body + String((10 - (sum % 10)) % 10);
}
