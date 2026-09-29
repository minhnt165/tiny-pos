import { useEffect, useState } from 'react';
import { MAX_HELD_CARTS, newLineKey, parseHeldCarts, type Cart, type HeldCart } from '@tiny-pos/shared';
import { readStorage, writeStorage } from '@/lib/storage';

const KEY = 'tiny-pos.held-carts';

/** Đơn chờ (tối đa 5) lưu trên máy quầy. */
export function useHeldCarts() {
  const [held, setHeld] = useState<HeldCart[]>(() => parseHeldCarts(readStorage(KEY)));
  useEffect(() => writeStorage(KEY, JSON.stringify(held)), [held]);

  const hold = (cart: Cart) =>
    setHeld((h) => (h.length >= MAX_HELD_CARTS ? h : [...h, { id: newLineKey(), at: new Date().toISOString(), cart }]));
  const take = (id: string): Cart | null => {
    const found = held.find((h) => h.id === id);
    setHeld((h) => h.filter((x) => x.id !== id));
    return found?.cart ?? null;
  };
  const drop = (id: string) => setHeld((h) => h.filter((x) => x.id !== id));

  return { held, full: held.length >= MAX_HELD_CARTS, hold, take, drop };
}
