import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Supplier, SupplierInputBody, SupplierPaymentBody, SupplierTransaction } from '@tiny-pos/shared';
import { api } from './client';

export const useSuppliers = () => useQuery({ queryKey: ['suppliers'], queryFn: () => api<Supplier[]>('/suppliers') });

export const useSupplierTransactions = (id: number | null) =>
  useQuery({
    queryKey: ['suppliers', 'tx', id],
    queryFn: () => api<SupplierTransaction[]>(`/suppliers/${id}/transactions`),
    enabled: id !== null,
  });

function useInvalidateSuppliers() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: ['suppliers'] });
}

export function useSaveSupplier() {
  const invalidate = useInvalidateSuppliers();
  return useMutation({
    mutationFn: ({ id, ...input }: SupplierInputBody & { id?: number }) =>
      id ? api<Supplier>(`/suppliers/${id}`, { method: 'PUT', json: input }) : api<Supplier>('/suppliers', { json: input }),
    onSuccess: invalidate,
  });
}

export function useDeleteSupplier() {
  const invalidate = useInvalidateSuppliers();
  return useMutation({ mutationFn: (id: number) => api<void>(`/suppliers/${id}`, { method: 'DELETE' }), onSuccess: invalidate });
}

export function usePaySupplier() {
  const invalidate = useInvalidateSuppliers();
  return useMutation({
    mutationFn: ({ id, ...body }: SupplierPaymentBody & { id: number }) => api<Supplier>(`/suppliers/${id}/payments`, { json: body }),
    onSuccess: invalidate,
  });
}
