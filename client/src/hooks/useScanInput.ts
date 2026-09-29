import { useCallback, useEffect, useRef, type KeyboardEvent } from 'react';

/**
 * Ô quét mã: luôn giữ focus (trừ khi `paused`, ví dụ dialog đang mở),
 * chỉ xử lý khi Enter (máy quét gõ mã rồi Enter), không bắt từng phím.
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
    document.addEventListener('mouseup', onPointerUp);
    return () => document.removeEventListener('mouseup', onPointerUp);
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
