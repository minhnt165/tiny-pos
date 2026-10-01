import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { LabelPrintInputBody, LabelPrintResult } from '@tiny-pos/shared';
import { api } from './client';

/** In tem: server cấp mã cho hàng chưa có mã nên danh sách sản phẩm phải tải lại. */
export function usePrintLabels() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LabelPrintInputBody) => api<LabelPrintResult>('/labels/print', { json: input }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export const useSampleLabel = () => useMutation({ mutationFn: () => api<LabelPrintResult>('/labels/sample', { method: 'POST' }) });

/** Máy quầy: server đã mở cửa sổ in tem riêng. Còn lại (dev, không tìm thấy trình duyệt): mở trang in ở tab mới. */
export function openLabelWindow(r: LabelPrintResult): void {
  if (r.opened) toast.success('Đã mở cửa sổ in tem trên máy quầy');
  else window.open(r.url, '_blank');
}
