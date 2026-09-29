const MINUTE = 60_000;
const DAY = 86_400_000;

/** Ngày địa phương "YYYY-MM-DD" của thời điểm `at`; `tzOffsetMin` là số phút lệch so với UTC (VN = 420). */
export function localDate(at: Date, tzOffsetMin: number): string {
  return new Date(at.getTime() + tzOffsetMin * MINUTE).toISOString().slice(0, 10);
}

/** Khoảng UTC [start, end) của một ngày địa phương, dạng ISO để so chuỗi với created_at. */
export function localDayRange(date: string, tzOffsetMin: number): { start: string; end: string } {
  const start = Date.parse(`${date}T00:00:00.000Z`) - tzOffsetMin * MINUTE;
  return { start: new Date(start).toISOString(), end: new Date(start + DAY).toISOString() };
}

/** Cộng/trừ số ngày trên chuỗi "YYYY-MM-DD". */
export function shiftDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * DAY).toISOString().slice(0, 10);
}

/** Độ lệch múi giờ của máy đang chạy, tính bằng phút (VN = 420). */
export function currentTzOffset(at: Date = new Date()): number {
  return -at.getTimezoneOffset();
}
