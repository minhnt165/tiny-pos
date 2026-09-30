export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

interface Options {
  method?: string;
  json?: unknown;
  text?: string;
}

/** Gọi /api/*; lỗi server { error } thành ApiError để toast hiển thị nguyên văn. */
export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = {};
  let body: string | undefined;
  if (opts.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.json);
  }
  if (opts.text !== undefined) {
    headers['Content-Type'] = 'text/csv';
    body = opts.text;
  }
  const res = await fetch(`/api${path}`, { method: opts.method ?? (body === undefined ? 'GET' : 'POST'), headers, body });
  if (!res.ok) {
    let message = `Lỗi ${res.status}`;
    try {
      message = ((await res.json()) as { error?: string }).error ?? message;
    } catch {
      /* không phải JSON */
    }
    throw new ApiError(message, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Query string từ object: bỏ giá trị rỗng/false/mảng rỗng; mảng nối bằng dấu phẩy; true → '1'. */
export function queryString(params: Record<string, string | number | boolean | readonly string[] | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '' || v === false || (Array.isArray(v) && !v.length)) continue;
    p.set(k, v === true ? '1' : Array.isArray(v) ? v.join(',') : String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}
