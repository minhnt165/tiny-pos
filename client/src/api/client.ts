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
