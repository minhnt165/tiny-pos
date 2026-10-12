import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { newLineKey, parseVnNumber, type ProductUnitInput, type ProductWithUnits } from '@tiny-pos/shared';
import { useDeleteUnit, useSaveUnit } from '@/api/products';
import { numberError } from './useProductForm';

/** Dòng đang gõ (chuỗi) của ô thêm thùng/lốc. */
export interface UnitDraft {
  name: string;
  barcode: string;
  factor: string;
  sellPrice: string;
}
export const BLANK_UNIT_DRAFT: UnitDraft = { name: '', barcode: '', factor: '', sellPrice: '' };

/** Đơn vị hiện trong danh sách: đã lưu (`key` = id) hoặc đang giữ tạm khi thêm sản phẩm mới. */
export interface UnitRow extends ProductUnitInput {
  key: string;
}

export const unitDraftEmpty = (d: UnitDraft): boolean => !d.name.trim() && !d.barcode.trim() && !d.factor.trim() && !d.sellPrice.trim();

/** Kiểm tra dòng đơn vị trước khi gửi; trả về thông báo lỗi đầu tiên. */
export function validateUnitDraft(d: UnitDraft): string | undefined {
  if (!d.name.trim()) return 'Nhập tên đơn vị (thùng, lốc…)';
  if (d.name.trim().length > 20) return 'Tên đơn vị tối đa 20 ký tự';
  if (!d.factor.trim()) return 'Nhập hệ số quy đổi, ví dụ 1 thùng = 24';
  const f = parseVnNumber(d.factor);
  if (Number.isNaN(f) || f <= 0) return 'Hệ số quy đổi phải là số lớn hơn 0';
  const p = numberError(d.sellPrice, true);
  if (p) return `Giá bán: ${p.toLowerCase()}`;
  return undefined;
}

const toUnitInput = (d: UnitDraft): ProductUnitInput => ({
  name: d.name.trim(),
  barcode: d.barcode.trim() || null,
  factor: parseVnNumber(d.factor),
  sellPrice: parseVnNumber(d.sellPrice || '0'),
});

const message = (e: unknown) => (e instanceof Error ? e.message : 'Lỗi');

/**
 * Đơn vị quy đổi trong form sản phẩm. Đang sửa: Thêm/Xóa gửi ngay (giống ảnh). Đang thêm: giữ tạm, `flush` sau khi tạo xong.
 * Bấm Lưu của form mà dòng thùng/lốc còn đang điền thì `commitIfFilled` gửi hoặc giữ tạm dòng đó trước, không để mất.
 */
export function useProductUnits(open: boolean, product: ProductWithUnits | null | undefined) {
  const save = useSaveUnit();
  const remove = useDeleteUnit();
  const [draft, setDraft] = useState<UnitDraft>(BLANK_UNIT_DRAFT);
  const [error, setError] = useState<string | undefined>();
  const [pending, setPendingState] = useState<UnitRow[]>([]);
  // flush chạy trong onSuccess của mutation tạo sản phẩm, closure cũ: đọc qua ref để thấy dòng vừa giữ tạm lúc bấm Lưu
  const pendingRef = useRef<UnitRow[]>([]);
  const [flushing, setFlushing] = useState(false);
  const productId = product?.id ?? null;

  const setPending = (rows: UnitRow[]) => {
    pendingRef.current = rows;
    setPendingState(rows);
  };
  useEffect(() => {
    if (open) {
      setDraft(BLANK_UNIT_DRAFT);
      setError(undefined);
      setPending([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, productId]);

  const update = (patch: Partial<UnitDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setError(undefined);
  };

  /** Gửi dòng đang gõ: đang sửa → lưu ngay; đang thêm → giữ tạm. false = không hợp lệ hoặc lưu lỗi (lỗi hiện dưới dòng). */
  const commitDraft = async (): Promise<boolean> => {
    const err = validateUnitDraft(draft);
    if (err) {
      setError(err);
      return false;
    }
    const input = toUnitInput(draft);
    if (productId) {
      try {
        await save.mutateAsync({ productId, ...input });
      } catch (e) {
        setError(message(e));
        return false;
      }
    } else setPending([...pendingRef.current, { ...input, key: newLineKey() }]);
    setDraft(BLANK_UNIT_DRAFT);
    setError(undefined);
    return true;
  };

  /** Lúc bấm Lưu form: dòng trống thì bỏ qua, có chữ thì phải gửi được mới cho lưu sản phẩm. */
  const commitIfFilled = (): Promise<boolean> => (unitDraftEmpty(draft) ? Promise.resolve(true) : commitDraft());

  const removeRow = async (key: string) => {
    if (!productId) return setPending(pendingRef.current.filter((r) => r.key !== key));
    try {
      await remove.mutateAsync({ productId, unitId: Number(key) });
    } catch (e) {
      setError(message(e));
    }
  };

  /** Sau khi tạo sản phẩm mới: gửi từng đơn vị giữ tạm. Lỗi thì sản phẩm vẫn đã tạo, báo riêng từng dòng. */
  const flush = async (created: ProductWithUnits): Promise<ProductWithUnits> => {
    if (!pendingRef.current.length) return created;
    setFlushing(true);
    const units = [...created.units];
    try {
      for (const { key: _key, ...input } of pendingRef.current) {
        try {
          units.push(await save.mutateAsync({ productId: created.id, ...input }));
        } catch (e) {
          toast.error(`Đã thêm sản phẩm nhưng chưa lưu được đơn vị "${input.name}": ${message(e)}`);
        }
      }
    } finally {
      setFlushing(false);
    }
    return { ...created, units };
  };

  const rows: UnitRow[] = product
    ? product.units.map((u) => ({ key: String(u.id), name: u.name, barcode: u.barcode, factor: u.factor, sellPrice: u.sellPrice }))
    : pending;

  return { draft, update, error, rows, commitDraft, commitIfFilled, removeRow, flush, busy: save.isPending || remove.isPending || flushing };
}

export type ProductUnitsState = ReturnType<typeof useProductUnits>;
