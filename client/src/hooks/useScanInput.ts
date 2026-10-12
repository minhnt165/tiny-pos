import { useCallback, useEffect, useRef, type KeyboardEvent } from 'react';

/** Hai ký tự cách nhau dưới mức này là máy quét gõ (máy quét ~5–30ms, người gõ nhanh cũng ~80ms trở lên). */
const SCAN_GAP_MS = 40;

/** Đặt giá trị cho ô nhập do React quản lý: gọi setter gốc (qua mặt value tracker) rồi bắn `input` để React nhận onChange. */
function setInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Ô quét mã: luôn giữ focus (trừ khi `paused`, ví dụ dialog đang mở),
 * chỉ xử lý khi Enter (máy quét gõ mã rồi Enter), không bắt từng phím.
 * Máy quét bắn khi focus đang ở ô khác (số lượng, giá, nút vừa bấm) thì kéo chuỗi về ô quét.
 */
export function useScanInput(onScan: (code: string) => void, paused = false) {
  const ref = useRef<HTMLInputElement>(null);
  const focus = useCallback(() => ref.current?.focus(), []);

  useEffect(() => {
    if (paused) return;
    focus();
    const onPointerUp = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      // Click vào ô nhập / nút / dialog thì để yên, còn lại kéo focus về ô quét
      if (t.closest('input, textarea, select, button, a, [role="dialog"]')) return;
      focus();
    };
    // Hai ký tự liền nhau quá nhanh ở ngoài ô quét là máy quét: rút ký tự đã lọt vào ô kia (ô trống thì blur sẽ trả giá trị cũ),
    // đưa cả hai ký tự sang ô quét rồi chuyển focus để phần còn lại của mã và Enter đi vào ô quét như bình thường
    let lastAt = 0;
    let lastKey = '';
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      const prev = lastKey;
      const gap = e.timeStamp - lastAt;
      const ch = e.key.length === 1 && !e.repeat && !e.ctrlKey && !e.altKey && !e.metaKey && !e.isComposing ? e.key : '';
      lastKey = ch;
      lastAt = e.timeStamp;
      const el = ref.current;
      const t = e.target;
      if (!ch || !prev || gap > SCAN_GAP_MS || !el || t === el) return;
      e.preventDefault();
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) {
        const pos = t.selectionStart ?? t.value.length;
        setInputValue(t, t.value.slice(0, pos - 1) + t.value.slice(pos));
      }
      setInputValue(el, prev + ch);
      el.focus();
      lastKey = '';
    };
    document.addEventListener('mouseup', onPointerUp);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('mouseup', onPointerUp);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [paused, focus]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || paused) return;
    e.preventDefault();
    const code = e.currentTarget.value.trim();
    e.currentTarget.value = '';
    if (code) onScan(code);
  };

  return { ref, onKeyDown, focus };
}
