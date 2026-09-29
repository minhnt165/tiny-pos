import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OrderDetail, OrderInputBody, OrderList } from '@tiny-pos/shared';
import { api } from './client';

export const useOrders = (date: string) =>
  useQuery({ queryKey: ['orders', 'day', date], queryFn: () => api<OrderList>(`/orders?date=${date}`) });

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
