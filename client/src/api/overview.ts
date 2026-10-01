import { useQuery } from '@tanstack/react-query';
import type { Overview } from '@tiny-pos/shared';
import { api } from './client';

/**
 * Tổng quan: dưới khóa ['reports'] để mọi mutation bán/hủy/nhập/thu nợ/kiểm kê đã invalidate ['reports'] làm tươi luôn.
 * Tự làm mới mỗi phút khi tab đang mở (TanStack mặc định không refetch khi tab ẩn); giữ số cũ khi tải lại để không nháy.
 */
export const useOverview = () =>
  useQuery({ queryKey: ['reports', 'overview'], queryFn: () => api<Overview>('/overview'), refetchInterval: 60_000, placeholderData: (prev) => prev });
