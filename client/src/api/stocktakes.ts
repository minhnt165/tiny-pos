import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { StocktakeDetail, StocktakeSummary } from '@tiny-pos/shared';
import { api } from './client';

export const useCurrentStocktake = () =>
  useQuery({ queryKey: ['stocktakes', 'current'], queryFn: () => api<StocktakeDetail | null>('/stocktakes/current') });

export const useStocktakes = () => useQuery({ queryKey: ['stocktakes', 'list'], queryFn: () => api<StocktakeSummary[]>('/stocktakes') });

export const useStocktake = (id: number | null) =>
  useQuery({ queryKey: ['stocktakes', 'detail', id], queryFn: () => api<StocktakeDetail>(`/stocktakes/${id}`), enabled: id !== null });

/** Chốt kiểm kê đổi tồn nên làm mới cả sản phẩm. */
function useInvalidateStocktakes() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['stocktakes'] });
    void qc.invalidateQueries({ queryKey: ['products'] });
  };
}

export function useOpenStocktake() {
  const invalidate = useInvalidateStocktakes();
  return useMutation({
    mutationFn: (body: { note: string | null }) => api<StocktakeDetail>('/stocktakes', { json: body }),
    onSuccess: invalidate,
  });
}

export function useCountItem() {
  const invalidate = useInvalidateStocktakes();
  return useMutation({
    mutationFn: ({ id, productId, counted }: { id: number; productId: number; counted: number }) =>
      api<StocktakeDetail>(`/stocktakes/${id}/items/${productId}`, { method: 'PUT', json: { counted } }),
    onSuccess: invalidate,
  });
}

export function useRemoveCountItem() {
  const invalidate = useInvalidateStocktakes();
  return useMutation({
    mutationFn: ({ id, productId }: { id: number; productId: number }) =>
      api<StocktakeDetail>(`/stocktakes/${id}/items/${productId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useFinishStocktake() {
  const invalidate = useInvalidateStocktakes();
  return useMutation({ mutationFn: (id: number) => api<StocktakeDetail>(`/stocktakes/${id}/finish`, { method: 'POST' }), onSuccess: invalidate });
}

export function useCancelStocktake() {
  const invalidate = useInvalidateStocktakes();
  return useMutation({ mutationFn: (id: number) => api<StocktakeDetail>(`/stocktakes/${id}/cancel`, { method: 'POST' }), onSuccess: invalidate });
}
