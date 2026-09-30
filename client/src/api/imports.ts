import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ImportDetail, ImportInputBody, ImportList } from '@tiny-pos/shared';
import { api } from './client';

export const useImports = (date: string) =>
  useQuery({ queryKey: ['imports', 'day', date], queryFn: () => api<ImportList>(`/imports?date=${date}`) });

export const useImport = (id: number | null) =>
  useQuery({ queryKey: ['imports', 'detail', id], queryFn: () => api<ImportDetail>(`/imports/${id}`), enabled: id !== null });

/** Nhập/hủy phiếu đổi tồn, giá và nợ NCC. */
function useInvalidateImports() {
  const qc = useQueryClient();
  return () => {
    for (const key of ['imports', 'products', 'suppliers']) void qc.invalidateQueries({ queryKey: [key] });
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
