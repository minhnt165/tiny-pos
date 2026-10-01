import { useQuery } from '@tanstack/react-query';
import type { DebtReport, ProductReport, ProductReportSort, ProfitReport } from '@tiny-pos/shared';
import { api, queryString } from './client';

export interface ReportRangeParams {
  from: string;
  to: string;
}

// Giữ dữ liệu cũ khi đổi khoảng ngày để số không nháy về 0
export const useProfitReport = (p: ReportRangeParams) =>
  useQuery({ queryKey: ['reports', 'profit', p], queryFn: () => api<ProfitReport>(`/reports/profit${queryString({ ...p })}`), placeholderData: (prev) => prev });

export const useProductReport = (p: ReportRangeParams & { sort: ProductReportSort }) =>
  useQuery({ queryKey: ['reports', 'products', p], queryFn: () => api<ProductReport>(`/reports/products${queryString({ ...p })}`), placeholderData: (prev) => prev });

export const useDebtReport = (p: ReportRangeParams) =>
  useQuery({ queryKey: ['reports', 'debt', p], queryFn: () => api<DebtReport>(`/reports/debt${queryString({ ...p })}`), placeholderData: (prev) => prev });
