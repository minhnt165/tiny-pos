import { useEffect, useMemo, useReducer } from 'react';
import { cartReducer, cartTotals, parseStoredCart, stockShortages } from '@tiny-pos/shared';
import { readStorage, writeStorage } from '@/lib/storage';

const KEY = 'tiny-pos.cart';

/** Giỏ đang bán; tự lưu localStorage để lỡ F5 không mất. */
export function useCart() {
  const [cart, dispatch] = useReducer(cartReducer, undefined, () => parseStoredCart(readStorage(KEY)));
  useEffect(() => writeStorage(KEY, JSON.stringify(cart)), [cart]);
  const totals = useMemo(() => cartTotals(cart.lines, cart.discount), [cart]);
  const shortages = useMemo(() => stockShortages(cart.lines), [cart.lines]);
  return { cart, dispatch, totals, shortages };
}
