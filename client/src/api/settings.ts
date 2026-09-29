import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Settings } from '@tiny-pos/shared';
import { api } from './client';

export const useSettings = () =>
  useQuery({ queryKey: ['settings'], queryFn: () => api<Settings>('/settings'), staleTime: 60_000 });

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: Settings) => api<Settings>('/settings', { method: 'PUT', json: s }),
    onSuccess: (s) => qc.setQueryData(['settings'], s),
  });
}
