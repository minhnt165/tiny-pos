import type { ChangeEvent } from 'react';

/** Chỉ giữ chữ số, bỏ số 0 thừa ở đầu rồi chia nhóm nghìn bằng dấu chấm: "1500000" → "1.500.000". */
export function groupThousands(s: string): string {
  const digits = s.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * onChange cho ô nhập tiền: định dạng ngay khi gõ và giữ con trỏ sau đúng chữ số vừa gõ
 * (không nhảy về cuối khi sửa ở giữa). parseVnNumber đọc lại được chuỗi "1.500.000".
 */
export function moneyChange(set: (v: string) => void) {
  return (e: ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const caret = el.selectionStart ?? el.value.length;
    const digitsBefore = el.value.slice(0, caret).replace(/\D/g, '').length;
    const formatted = groupThousands(el.value);
    set(formatted);
    requestAnimationFrame(() => {
      let pos = 0;
      for (let seen = 0; pos < formatted.length && seen < digitsBefore; pos++) if (/\d/.test(formatted[pos]!)) seen++;
      el.setSelectionRange(pos, pos);
    });
  };
}
