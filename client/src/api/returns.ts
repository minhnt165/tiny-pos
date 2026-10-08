import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DocStatus, ReturnDetail, ReturnInputBody, ReturnList } from '@tiny-pos/shared';
import { api, queryString } from './client';

export interface ReturnListParams {
  from: string;
  to: string;
  q?: string;
  status?: DocStatus[];
  page?: number;
}

export const useReturns = (p: ReturnListParams) =>
  useQuery({ queryKey: ['returns', 'list', p], queryFn: () => api<ReturnList>(`/returns${queryString({ ...p })}`), placeholderData: (prev) => prev });

export const useReturn = (id: number | null) =>
  useQuery({ queryKey: ['returns', 'detail', id], queryFn: () => api<ReturnDetail>(`/returns/${id}`), enabled: id !== null });

/** Phiếu trả đổi tồn, nợ khách, số đã trả của hóa đơn gốc và số liệu báo cáo. */
function useInvalidateReturns() {
  const qc = useQueryClient();
  return () => {
    for (const key of ['returns', 'orders', 'products', 'customers', 'reports', 'lots']) void qc.invalidateQueries({ queryKey: [key] });
  };
}

export function useCreateReturn() {
  const invalidate = useInvalidateReturns();
  return useMutation({ mutationFn: (input: ReturnInputBody) => api<ReturnDetail>('/returns', { json: input }), onSuccess: invalidate });
}

export function useCancelReturn() {
  const invalidate = useInvalidateReturns();
  return useMutation({ mutationFn: (id: number) => api<ReturnDetail>(`/returns/${id}/cancel`, { method: 'POST' }), onSuccess: invalidate });
}
