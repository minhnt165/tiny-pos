import { useEffect, type ReactNode } from 'react';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}

/** Hộp thoại đơn giản: overlay, Esc để đóng, không đóng khi click nền (tránh mất dữ liệu form). */
export function Dialog({ open, title, onClose, children, wide }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-2 md:items-center md:p-6"
    >
      <div className={`w-full rounded-xl bg-white p-4 shadow-xl md:p-6 ${wide ? 'max-w-3xl' : 'max-w-xl'}`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 min-w-11 rounded-lg text-2xl hover:bg-gray-100"
            aria-label="Đóng"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
