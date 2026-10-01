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

/** "YYYY-MM-DD" → "dd/mm/yyyy" để hiển thị; chuỗi khác dạng trả nguyên. */
export function formatDateVn(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : date;
}

export type DatePreset = 'today' | 'yesterday' | 'last7' | 'thisMonth' | 'lastMonth';
export const DATE_PRESETS: readonly DatePreset[] = ['today', 'yesterday', 'last7', 'thisMonth', 'lastMonth'];

/** Ngày cuối tháng của "YYYY-MM". */
const monthEnd = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y!, m!, 0)).toISOString().slice(0, 10);
};

/** Khoảng [from, to] của một mốc thời gian, tính theo ngày địa phương `today`. */
export function datePresetRange(preset: DatePreset, today: string): { from: string; to: string } {
  const ym = today.slice(0, 7);
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const d = shiftDate(today, -1);
      return { from: d, to: d };
    }
    case 'last7':
      return { from: shiftDate(today, -6), to: today };
    case 'thisMonth':
      return { from: `${ym}-01`, to: today };
    case 'lastMonth': {
      const prev = shiftDate(`${ym}-01`, -1).slice(0, 7);
      return { from: `${prev}-01`, to: monthEnd(prev) };
    }
  }
}

/** Khoảng đang chọn có trùng một mốc sẵn không (để hiện tên mốc thay vì ngày). */
export function detectPreset(from: string, to: string, today: string): DatePreset | null {
  return (
    DATE_PRESETS.find((p) => {
      const r = datePresetRange(p, today);
      return r.from === from && r.to === to;
    }) ?? null
  );
}

/** Nhãn ngắn của khoảng ngày: "01/09 – 15/09"; khác năm hiện tại thì ghi đủ năm. */
export function formatRangeVn(from: string, to: string, today: string): string {
  const sameYear = from.slice(0, 4) === today.slice(0, 4) && to.slice(0, 4) === today.slice(0, 4);
  const f = (d: string) => (sameYear ? formatDateVn(d).slice(0, 5) : formatDateVn(d));
  return from === to ? f(from) : `${f(from)} – ${f(to)}`;
}

/** Các ngày "YYYY-MM-DD" từ `from` đến `to`, tính cả hai đầu. */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = shiftDate(d, 1)) out.push(d);
  return out;
}

/** Các tháng "YYYY-MM" từ tháng của `from` đến tháng của `to`. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const last = to.slice(0, 7);
  for (let ym = from.slice(0, 7); ym <= last; ym = shiftDate(monthEnd(ym), 1).slice(0, 7)) out.push(ym);
  return out;
}

/** "YYYY-MM" → "Tháng mm/yyyy"; chuỗi khác dạng trả nguyên. */
export function formatMonthVn(ym: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  return m ? `Tháng ${m[2]}/${m[1]}` : ym;
}
