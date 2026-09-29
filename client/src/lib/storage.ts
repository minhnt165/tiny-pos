/** localStorage có thể ném lỗi (ẩn danh, bị chặn, đầy): đọc/ghi hỏng thì bỏ qua. */
export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* bỏ qua */
  }
}
