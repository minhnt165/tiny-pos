import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RemoteConfigInput, RemoteStatus } from '@tiny-pos/shared';
import { api } from './client';

const KEY = ['remote'];

/** Tải lại mỗi 30 giây khi thẻ đang mở để thấy "Gửi lần cuối" chạy. */
export const useRemoteStatus = () => useQuery({ queryKey: KEY, queryFn: () => api<RemoteStatus>('/remote'), refetchInterval: 30_000 });

export function useSaveRemote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RemoteConfigInput) => api<RemoteStatus>('/remote', { method: 'PUT', json: input }),
    onSuccess: (s) => qc.setQueryData(KEY, s),
  });
}

export function usePushRemote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<RemoteStatus>('/remote/push', { method: 'POST' }),
    onSuccess: (s) => qc.setQueryData(KEY, s),
  });
}
