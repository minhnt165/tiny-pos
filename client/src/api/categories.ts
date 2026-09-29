import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Category, CategoryInput } from '@tiny-pos/shared';
import { api } from './client';

export const useCategories = () => useQuery({ queryKey: ['categories'], queryFn: () => api<Category[]>('/categories') });

function useInvalidateAll() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['categories'] });
    void qc.invalidateQueries({ queryKey: ['products'] });
  };
}

export function useSaveCategory() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, ...input }: CategoryInput & { id?: number }) =>
      id ? api<Category>(`/categories/${id}`, { method: 'PUT', json: input }) : api<Category>('/categories', { json: input }),
    onSuccess: invalidate,
  });
}

export function useDeleteCategory() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/categories/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}
