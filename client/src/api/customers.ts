import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Customer,
  CustomerAdjustmentBody,
  CustomerCreateBody,
  CustomerInputBody,
  CustomerList,
  CustomerPaymentBody,
  CustomerPaymentResult,
  CustomerTransaction,
} from '@tiny-pos/shared';
import { api } from './client';

export const useCustomers = (includeInactive = false) =>
  useQuery({ queryKey: ['customers', { includeInactive }], queryFn: () => api<CustomerList>(`/customers${includeInactive ? '?includeInactive=1' : ''}`) });

export const useCustomerTransactions = (id: number | null) =>
  useQuery({
    queryKey: ['customers', 'tx', id],
    queryFn: () => api<CustomerTransaction[]>(`/customers/${id}/transactions`),
    enabled: id !== null,
  });

/** Nợ khách đổi thì tổng kết ngày (thu nợ) cũng đổi. */
function useInvalidateCustomers() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['customers'] });
    void qc.invalidateQueries({ queryKey: ['orders'] });
  };
}

export function useCreateCustomer() {
  const invalidate = useInvalidateCustomers();
  return useMutation({ mutationFn: (input: CustomerCreateBody) => api<Customer>('/customers', { json: input }), onSuccess: invalidate });
}

export function useUpdateCustomer() {
  const invalidate = useInvalidateCustomers();
  return useMutation({
    mutationFn: ({ id, ...input }: CustomerInputBody & { id: number }) => api<Customer>(`/customers/${id}`, { method: 'PUT', json: input }),
    onSuccess: invalidate,
  });
}

export function useDeleteCustomer() {
  const invalidate = useInvalidateCustomers();
  return useMutation({ mutationFn: (id: number) => api<void>(`/customers/${id}`, { method: 'DELETE' }), onSuccess: invalidate });
}

export function useCollectDebt() {
  const invalidate = useInvalidateCustomers();
  return useMutation({
    mutationFn: ({ id, ...body }: CustomerPaymentBody & { id: number }) =>
      api<CustomerPaymentResult>(`/customers/${id}/payments`, { json: body }),
    onSuccess: invalidate,
  });
}

export function useAddManualDebt() {
  const invalidate = useInvalidateCustomers();
  return useMutation({
    mutationFn: ({ id, ...body }: CustomerAdjustmentBody & { id: number }) => api<Customer>(`/customers/${id}/adjustments`, { json: body }),
    onSuccess: invalidate,
  });
}
