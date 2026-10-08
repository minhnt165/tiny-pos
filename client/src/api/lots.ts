import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LotList, LotRow, LotState, ProductLot } from '@tiny-pos/shared';
import { api, queryString } from './client';

export interface LotListParams {
  q?: string;
  productId?: number;
  state?: LotState[];
  page?: number;
}

export const useLots = (p: LotListParams) =>
  useQuery({ queryKey: ['lots', 'list', p], queryFn: () => api<LotList>(`/lots${queryString({ ...p })}`), placeholderData: (prev) => prev });

/** Lô còn hàng của một sản phẩm (ô chọn lô khi trả NCC). */
export const useProductLots = (productId: number | null) =>
  useQuery({ queryKey: ['lots', 'product', productId], queryFn: () => api<ProductLot[]>(`/products/${productId}/lots`), enabled: productId !== null });

/** Bỏ hàng đổi tồn; Tổng quan nằm dưới ['reports']. */
export function useDisposeLot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: number; note?: string }) => api<LotRow>(`/lots/${id}/dispose`, { json: { note: note ?? null } }),
    onSuccess: () => {
      for (const key of ['lots', 'products', 'reports']) void qc.invalidateQueries({ queryKey: [key] });
    },
  });
}
