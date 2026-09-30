import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { z } from 'zod';

type Values<F extends Record<string, z.ZodType>> = { [K in keyof F]: z.output<F[K]> };

/** Giá trị mặc định = parse(undefined) của từng trường (optional → undefined, default → giá trị đó). */
const defaultsOf = <F extends Record<string, z.ZodType>>(fields: F) =>
  Object.fromEntries(Object.entries(fields).map(([k, s]) => [k, s.parse(undefined)])) as Values<F>;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Bộ lọc lưu trên URL: đọc từng khóa bằng schema zod (sai thì dùng mặc định, không báo lỗi),
 * ghi bằng replace. Đổi lọc khác trang thì về trang 1. `fields` phải là hằng số của module.
 */
export function useUrlFilters<F extends Record<string, z.ZodType>>(fields: F) {
  const [params, setParams] = useSearchParams();
  const defaults = useMemo(() => defaultsOf(fields), [fields]);
  const filters = useMemo(() => {
    const out = { ...defaults };
    for (const k of Object.keys(fields) as (keyof F)[]) {
      const raw = params.get(k as string);
      if (raw === null) continue;
      const r = fields[k]!.safeParse(raw);
      if (r.success) out[k] = r.data as Values<F>[keyof F];
    }
    return out;
  }, [params, fields, defaults]);

  const set = (patch: Partial<Values<F>>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v === undefined || v === null || v === '' || v === false || (Array.isArray(v) && !v.length) || same(v, defaults[k])) next.delete(k);
          else next.set(k, v === true ? '1' : Array.isArray(v) ? v.join(',') : String(v));
        }
        if (!('page' in patch)) next.delete('page');
        return next;
      },
      { replace: true },
    );

  const clear = () =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const k of Object.keys(fields)) next.delete(k);
        return next;
      },
      { replace: true },
    );

  return { filters, set, clear };
}
