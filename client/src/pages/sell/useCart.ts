import { useEffect, useMemo, useReducer } from 'react';
import { cartReducer, cartTotals, parseStoredCart, stockShortages, type ProductWithUnits } from '@tiny-pos/shared';
import { useCartProducts } from '@/api/products';
import { readStorage, writeStorage } from '@/lib/storage';

const KEY = 'tiny-pos.cart';
const NO_PRODUCTS: ReadonlyMap<number, ProductWithUnits> = new Map();

/** Giỏ đang bán; tự lưu localStorage để lỡ F5 không mất. Tồn và đơn vị quy đổi của hàng trong giỏ lấy mới từ server. */
export function useCart() {
  const [cart, dispatch] = useReducer(cartReducer, undefined, () => parseStoredCart(readStorage(KEY)));
  useEffect(() => writeStorage(KEY, JSON.stringify(cart)), [cart]);
  const totals = useMemo(() => cartTotals(cart.lines, cart.discount), [cart]);
  const ids = useMemo(
    () => [...new Set(cart.lines.flatMap((l) => (l.productId === null ? [] : [l.productId])))].sort((a, b) => a - b),
    [cart.lines],
  );
  const { data } = useCartProducts(ids);
  const products = ids.length ? (data ?? NO_PRODUCTS) : NO_PRODUCTS;
  const shortages = useMemo(() => stockShortages(cart.lines, products), [cart.lines, products]);
  return { cart, dispatch, totals, shortages, products };
}
