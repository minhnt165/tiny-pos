import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Device, DeviceStatus, PairingInfo } from '@tiny-pos/shared';
import { api } from './client';

export const DEVICE_KEY = ['device'];
const LIST_KEY = ['devices'];

/** Máy này là máy quầy / đã ghép / chưa ghép. Hỏi một lần; 401 ở bất kỳ đâu đặt lại thành chưa ghép (main.tsx). */
export const useDevice = () => useQuery({ queryKey: DEVICE_KEY, queryFn: () => api<DeviceStatus>('/device'), staleTime: Infinity, retry: false });

/** Danh sách thiết bị (chỉ máy quầy mới gọi được); `poll` = ms hỏi lại khi đang mở hộp thoại ghép. */
export const useDevices = (enabled: boolean, poll: number | false = false) =>
  useQuery({ queryKey: LIST_KEY, queryFn: () => api<Device[]>('/devices'), enabled, refetchInterval: poll });

/** Gửi mã ghép; thành công thì máy này thành "đã ghép" và tải lại mọi dữ liệu đang lỗi 401. */
export function usePair() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api<{ device: Device }>('/device/pair', { json: { code } }),
    onSuccess: ({ device }) => {
      const status: DeviceStatus = { kind: 'paired', device: { id: device.id, name: device.name } };
      qc.setQueryData(DEVICE_KEY, status);
      void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== DEVICE_KEY[0] });
    },
  });
}

export const useStartPairing = () => useMutation({ mutationFn: () => api<PairingInfo>('/devices/pairing', { method: 'POST' }) });

export function useRenameDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => api<Device>(`/devices/${id}`, { method: 'PATCH', json: { name } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST_KEY }),
  });
}

export function useRevokeDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api<void>(`/devices/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST_KEY }),
  });
}
