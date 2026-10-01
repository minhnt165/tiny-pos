import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BackupItem, BackupStatus, RestoreResult } from '@tiny-pos/shared';
import { api } from './client';

const KEY = ['backups'];

/** Tải lại mỗi phút để thấy bản tự động mới khi thẻ đang mở. */
export const useBackups = () => useQuery({ queryKey: KEY, queryFn: () => api<BackupStatus>('/backups'), refetchInterval: 60_000 });

export function useCreateBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<BackupItem>('/backups', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useSaveExtraDir() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (extraDir: string) => api<BackupStatus>('/backups/extra-dir', { method: 'PUT', json: { extraDir } }),
    onSuccess: (s) => qc.setQueryData(KEY, s),
  });
}

export function useDeleteBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api<void>(`/backups/${name}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Khôi phục xong thì mọi dữ liệu trên màn hình đã cũ → vô hiệu toàn bộ cache. */
export function useRestoreBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api<RestoreResult>(`/backups/${name}/restore`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useRestoreUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => api<RestoreResult>('/backups/restore-upload', { body: file }),
    onSuccess: () => qc.invalidateQueries(),
  });
}
