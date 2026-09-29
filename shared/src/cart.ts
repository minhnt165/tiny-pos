import { z } from 'zod';
import type { OrderInputBody } from './schemas/order.js';
import type { Product, ProductUnit } from './types.js';

const lineSchema = z.object({
  key: z.string(),
  productId: z.number().int().nullable(),
  unitId: z.number().int().nullable(),
  name: z.string(),
  unitName: z.string(),
  factor: z.number().positive(),
  isWeighed: z.boolean(),
  stock: z.number(),
  qty: z.number().positive(),
  price: z.number().int().min(0),
});
const cartSchema = z.object({ lines: z.array(lineSchema), discount: z.number().int().min(0) });
const heldSchema = z.array(z.object({ id: z.string(), at: z.string(), cart: cartSchema }));

export type CartLine = z.infer<typeof lineSchema>;
export type NewCartLine = Omit<CartLine, 'key'>;
export type Cart = z.infer<typeof cartSchema>;
export type HeldCart = z.infer<typeof heldSchema>[number];

export const EMPTY_CART: Cart = { lines: [], discount: 0 };
export const MAX_HELD_CARTS = 5;
export const CUSTOM_ITEM_NAME = 'Hàng khác';

export type CartAction =
  | { type: 'add'; line: NewCartLine }
  | { type: 'update'; key: string; patch: Partial<Pick<CartLine, 'qty' | 'price'>> }
  | { type: 'remove'; key: string }
  | { type: 'setDiscount'; discount: number }
  | { type: 'replace'; cart: Cart }
  | { type: 'clear' };

let seq = 0;
/** Khóa dòng giỏ. Không dùng crypto.randomUUID: trang mở qua http://IP-LAN không phải secure context. */
export function newLineKey(): string {
  seq = (seq + 1) % 1_000_000;
  return `${Date.now().toString(36)}-${seq.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function cartReducer(cart: Cart, a: CartAction): Cart {
  switch (a.type) {
    case 'add': {
      const l = a.line;
      // Hàng cân (mỗi túi một dòng) và món ngoài không gộp
      const same =
        l.productId !== null && !l.isWeighed
          ? cart.lines.find((x) => x.productId === l.productId && x.unitId === l.unitId)
          : undefined;
      if (same) return { ...cart, lines: cart.lines.map((x) => (x === same ? { ...x, qty: x.qty + l.qty } : x)) };
      return { ...cart, lines: [...cart.lines, { ...l, key: newLineKey() }] };
    }
    case 'update':
      if (a.patch.qty !== undefined && a.patch.qty <= 0) return cartReducer(cart, { type: 'remove', key: a.key });
      return { ...cart, lines: cart.lines.map((x) => (x.key === a.key ? { ...x, ...a.patch } : x)) };
    case 'remove':
      return { ...cart, lines: cart.lines.filter((x) => x.key !== a.key) };
    case 'setDiscount':
      return { ...cart, discount: Math.max(0, Math.round(a.discount)) };
    case 'replace':
      return a.cart;
    case 'clear':
      return EMPTY_CART;
  }
}

/** Dòng giỏ từ kết quả quét/tìm; có đơn vị quy đổi thì dùng tên, hệ số, giá của đơn vị. */
export function lineFromProduct(p: Product, u: ProductUnit | null, qty = 1): NewCartLine {
  return {
    productId: p.id,
    unitId: u?.id ?? null,
    name: p.name,
    unitName: u?.name ?? p.unit,
    factor: u?.factor ?? 1,
    isWeighed: p.isWeighed && !u,
    stock: p.stock,
    qty,
    price: u?.sellPrice ?? p.sellPrice,
  };
}

/** Món ngoài (không có mã): không trừ kho. */
export function customLine(name: string, price: number, qty: number): NewCartLine {
  const n = name.trim() || CUSTOM_ITEM_NAME;
  return { productId: null, unitId: null, name: n, unitName: 'cái', factor: 1, isWeighed: false, stock: 0, qty, price };
}

/** Sản phẩm mà tổng qty×factor trong giỏ vượt tồn: productId → tồn hiện có. */
export function stockShortages(lines: CartLine[]): Map<number, number> {
  const need = new Map<number, { need: number; stock: number }>();
  for (const l of lines) {
    if (l.productId === null) continue;
    const e = need.get(l.productId) ?? { need: 0, stock: l.stock };
    e.need += l.qty * l.factor;
    need.set(l.productId, e);
  }
  const out = new Map<number, number>();
  for (const [id, e] of need) if (e.need > e.stock + 1e-9) out.set(id, e.stock);
  return out;
}

export function toOrderItems(lines: CartLine[]): OrderInputBody['items'] {
  return lines.map((l) =>
    l.productId === null
      ? { productId: null, name: l.name, qty: l.qty, price: l.price }
      : { productId: l.productId, unitId: l.unitId, qty: l.qty, price: l.price },
  );
}

function parseJson(raw: string | null): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** Đọc giỏ từ localStorage; hỏng hoặc sai cấu trúc thì trả giỏ trống. */
export function parseStoredCart(raw: string | null): Cart {
  const r = cartSchema.safeParse(parseJson(raw));
  return r.success ? r.data : EMPTY_CART;
}

export function parseHeldCarts(raw: string | null): HeldCart[] {
  const r = heldSchema.safeParse(parseJson(raw));
  return r.success ? r.data.slice(0, MAX_HELD_CARTS) : [];
}
