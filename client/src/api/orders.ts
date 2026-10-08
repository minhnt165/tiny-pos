import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DocStatus, OrderDetail, OrderInputBody, OrderList, PayMethod } from '@tiny-pos/shared';
import { api, queryString } from './client';

export interface OrderListParams {
  from: string;
  to: string;
  q?: string;
  pay?: PayMethod[];
  status?: DocStatus[];
  customerId?: number;
  page?: number;
}

export const useOrders = (p: OrderListParams) =>
  useQuery({ queryKey: ['orders', 'list', p], queryFn: () => api<OrderList>(`/orders${queryString({ ...p })}`), placeholderData: (prev) => prev });

export const useOrder = (id: number | null) =>
  useQuery({
    queryKey: ['orders', 'detail', id],
    queryFn: () => api<OrderDetail>(`/orders/${id}`),
    enabled: id !== null,
  });

/** Bán/hủy đổi tồn kho nên làm mới cả hóa đơn lẫn sản phẩm. */
function useInvalidateSales() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['orders'] });
    void qc.invalidateQueries({ queryKey: ['products'] });
    void qc.invalidateQueries({ queryKey: ['customers'] }); // đơn ghi nợ / hủy đơn đổi nợ khách
    void qc.invalidateQueries({ queryKey: ['reports'] });
    void qc.invalidateQueries({ queryKey: ['lots'] });
  };
}

export function useCreateOrder() {
  const invalidate = useInvalidateSales();
  return useMutation({
    mutationFn: (input: OrderInputBody) => api<OrderDetail>('/orders', { json: input }),
    onSuccess: invalidate,
  });
}

export function useCancelOrder() {
  const invalidate = useInvalidateSales();
  return useMutation({
    mutationFn: (id: number) => api<OrderDetail>(`/orders/${id}/cancel`, { method: 'POST' }),
    onSuccess: invalidate,
  });
}
