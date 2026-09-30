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
  /** File gửi nguyên dạng nhị phân (nhập sản phẩm từ .xlsx/.csv). */
  body?: Blob;
}

/** Lỗi server { error } thành ApiError để toast hiển thị nguyên văn. */
async function toApiError(res: Response): Promise<ApiError> {
  let message = `Lỗi ${res.status}`;
  try {
    message = ((await res.json()) as { error?: string }).error ?? message;
  } catch {
    /* không phải JSON */
  }
  return new ApiError(message, res.status);
}

/** Gọi /api/*; lỗi server { error } thành ApiError để toast hiển thị nguyên văn. */
export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const headers: Record<string, string> = {};
  let body: string | Blob | undefined;
  if (opts.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.json);
  }
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/octet-stream';
    body = opts.body;
  }
  const res = await fetch(`/api${path}`, { method: opts.method ?? (body === undefined ? 'GET' : 'POST'), headers, body });
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Tải file từ /api/* về máy; dùng fetch để lỗi 400 thành toast thay vì tải về một file JSON. */
export async function downloadFile(path: string): Promise<void> {
  const res = await fetch(`/api${path}`);
  if (!res.ok) throw await toApiError(res);
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'du-lieu.xlsx';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  // Thu hồi muộn: Safari trên iPhone hỏi "Tải về?" trước, thu hồi sớm thì bấm Tải về sẽ lỗi
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
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
