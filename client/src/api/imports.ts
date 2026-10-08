import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DocStatus, ImportDetail, ImportInputBody, ImportList } from '@tiny-pos/shared';
import { api, queryString } from './client';

export interface ImportListParams {
  from: string;
  to: string;
  q?: string;
  status?: DocStatus[];
  supplierId?: number | 'none';
  unpaid?: boolean;
  page?: number;
}

export const useImports = (p: ImportListParams) =>
  useQuery({ queryKey: ['imports', 'list', p], queryFn: () => api<ImportList>(`/imports${queryString({ ...p })}`), placeholderData: (prev) => prev });

export const useImport = (id: number | null) =>
  useQuery({ queryKey: ['imports', 'detail', id], queryFn: () => api<ImportDetail>(`/imports/${id}`), enabled: id !== null });

/** Nhập/hủy phiếu đổi tồn, giá và nợ NCC. */
function useInvalidateImports() {
  const qc = useQueryClient();
  return () => {
    for (const key of ['imports', 'products', 'suppliers', 'lots']) void qc.invalidateQueries({ queryKey: [key] });
    void qc.invalidateQueries({ queryKey: ['reports'] });
  };
}

export function useCreateImport() {
  const invalidate = useInvalidateImports();
  return useMutation({ mutationFn: (input: ImportInputBody) => api<ImportDetail>('/imports', { json: input }), onSuccess: invalidate });
}

export function useCancelImport() {
  const invalidate = useInvalidateImports();
  return useMutation({ mutationFn: (id: number) => api<ImportDetail>(`/imports/${id}/cancel`, { method: 'POST' }), onSuccess: invalidate });
}
