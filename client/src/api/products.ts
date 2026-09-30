import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BarcodeLookup,
  CsvImportResult,
  Product,
  ProductInput,
  ProductUnit,
  ProductUnitInput,
  ProductWithUnits,
  StockMovement,
} from '@tiny-pos/shared';
import { api } from './client';

export interface ProductFilter {
  q?: string;
  categoryId?: number;
  includeInactive?: boolean;
}

function qs(f: ProductFilter): string {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.categoryId) p.set('categoryId', String(f.categoryId));
  if (f.includeInactive) p.set('includeInactive', '1');
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const useProducts = (f: ProductFilter) =>
  useQuery({ queryKey: ['products', f], queryFn: () => api<Product[]>(`/products${qs(f)}`) });

export const useProduct = (id: number | null) =>
  useQuery({
    queryKey: ['products', 'detail', id],
    queryFn: () => api<ProductWithUnits>(`/products/${id}`),
    enabled: id !== null,
  });

export const lookupBarcode = (code: string) => api<BarcodeLookup>(`/products/by-barcode/${encodeURIComponent(code)}`);

export const CSV_EXPORT_URL = '/api/products/csv';

function useInvalidateProducts() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['products'] });
    void qc.invalidateQueries({ queryKey: ['categories'] });
  };
}

export function useSaveProduct() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: ({ id, ...input }: ProductInput & { id?: number }) =>
      id
        ? api<ProductWithUnits>(`/products/${id}`, { method: 'PUT', json: input })
        : api<ProductWithUnits>('/products', { json: input }),
    onSuccess: invalidate,
  });
}

export function useSetProductActive() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }): Promise<void> => {
      if (active) await api<Product>(`/products/${id}/restore`, { method: 'POST' });
      else await api<void>(`/products/${id}`, { method: 'DELETE' });
    },
    onSuccess: invalidate,
  });
}

export function useSaveUnit() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: ({ productId, unitId, ...input }: ProductUnitInput & { productId: number; unitId?: number }) =>
      unitId
        ? api<ProductUnit>(`/products/${productId}/units/${unitId}`, { method: 'PUT', json: input })
        : api<ProductUnit>(`/products/${productId}/units`, { json: input }),
    onSuccess: invalidate,
  });
}

export function useDeleteUnit() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: ({ productId, unitId }: { productId: number; unitId: number }) =>
      api<void>(`/products/${productId}/units/${unitId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useImportCsv() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: (text: string) => api<CsvImportResult>('/products/csv', { text }),
    onSuccess: invalidate,
  });
}

/** Gợi ý ở màn Bán hàng: chỉ hàng đang bán, chỉ gọi khi có chữ để tìm. */
export const useProductSuggestions = (q: string) =>
  useQuery({ queryKey: ['products', { q }], queryFn: () => api<Product[]>(`/products${qs({ q })}`), enabled: q.length > 0 });

/** Sản phẩm kèm đơn vị quy đổi (màn Nhập hàng cần danh sách đơn vị để chọn). */
export const fetchProduct = (id: number) => api<ProductWithUnits>(`/products/${id}`);

export const useMovements = (id: number | null) =>
  useQuery({
    queryKey: ['products', 'movements', id],
    queryFn: () => api<StockMovement[]>(`/products/${id}/movements`),
    enabled: id !== null,
  });
