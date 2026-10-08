import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DocStatus, SupplierReturnDetail, SupplierReturnInputBody, SupplierReturnList } from '@tiny-pos/shared';
import { api, queryString } from './client';

export interface SupplierReturnListParams {
  from: string;
  to: string;
  q?: string;
  status?: DocStatus[];
  supplierId?: number;
  page?: number;
}

export const useSupplierReturns = (p: SupplierReturnListParams) =>
  useQuery({
    queryKey: ['supplier-returns', 'list', p],
    queryFn: () => api<SupplierReturnList>(`/supplier-returns${queryString({ ...p })}`),
    placeholderData: (prev) => prev,
  });

export const useSupplierReturn = (id: number | null) =>
  useQuery({ queryKey: ['supplier-returns', 'detail', id], queryFn: () => api<SupplierReturnDetail>(`/supplier-returns/${id}`), enabled: id !== null });

/** Phiếu trả NCC đổi tồn và nợ NCC; Tổng quan đọc tồn thấp và nợ NCC. */
function useInvalidateSupplierReturns() {
  const qc = useQueryClient();
  return () => {
    for (const key of ['supplier-returns', 'products', 'suppliers', 'reports', 'overview', 'lots']) void qc.invalidateQueries({ queryKey: [key] });
  };
}

export function useCreateSupplierReturn() {
  const invalidate = useInvalidateSupplierReturns();
  return useMutation({
    mutationFn: (input: SupplierReturnInputBody) => api<SupplierReturnDetail>('/supplier-returns', { json: input }),
    onSuccess: invalidate,
  });
}

export function useCancelSupplierReturn() {
  const invalidate = useInvalidateSupplierReturns();
  return useMutation({
    mutationFn: (id: number) => api<SupplierReturnDetail>(`/supplier-returns/${id}/cancel`, { method: 'POST' }),
    onSuccess: invalidate,
  });
}
