import { z } from 'zod';
import { newLineKey } from './cart.js';
import { unitOptions, type UnitOption } from './import-draft.js';
import { importLineAmount } from './inventory-math.js';
import type { SupplierReturnInputBody } from './schemas/supplier-return.js';
import { splitSupplierRefund } from './supplier-return-math.js';
import type { ProductWithUnits } from './types.js';

const optionSchema = z.object({
  id: z.number().int().nullable(),
  name: z.string(),
  factor: z.number().positive(),
  sellPrice: z.number().int().min(0),
});
const lineSchema = z.object({
  key: z.string(),
  productId: z.number().int(),
  name: z.string(),
  isActive: z.boolean(),
  /** Tồn (đơn vị gốc) lúc thêm dòng, để cảnh báo trả quá tồn. */
  stock: z.number(),
  baseUnit: z.string(),
  /** Giá vốn 1 đơn vị gốc lúc thêm dòng, để điền lại giá trả khi đổi đơn vị. */
  baseCost: z.number().int().min(0),
  options: z.array(optionSchema).min(1),
  unitId: z.number().int().nullable(),
  qty: z.number().positive(),
  unitPrice: z.number().int().min(0),
});
const draftSchema = z.object({ supplierId: z.number().int().nullable(), note: z.string(), lines: z.array(lineSchema) });

export type SupplierReturnLine = z.infer<typeof lineSchema>;
export type SupplierReturnDraft = z.infer<typeof draftSchema>;

export const EMPTY_SUPPLIER_RETURN_DRAFT: SupplierReturnDraft = { supplierId: null, note: '', lines: [] };

export type SupplierReturnAction =
  | { type: 'add'; product: ProductWithUnits; unitId: number | null }
  | { type: 'update'; key: string; patch: Partial<Pick<SupplierReturnLine, 'qty' | 'unitPrice'>> }
  | { type: 'setUnit'; key: string; unitId: number | null }
  | { type: 'remove'; key: string }
  | { type: 'setSupplier'; supplierId: number | null }
  | { type: 'setNote'; note: string }
  | { type: 'clear' };

export const lineOption = (l: SupplierReturnLine): UnitOption => l.options.find((o) => o.id === l.unitId) ?? l.options[0]!;

/** Trả nhiều hơn tồn lúc thêm dòng (quy về đơn vị gốc): chỉ cảnh báo, vẫn lưu được. */
export const overStock = (l: SupplierReturnLine): boolean => l.qty * lineOption(l).factor > l.stock + 1e-9;

/** Đặt đơn vị; giá trả điền lại = giá vốn gốc × hệ số. unitId lạ → đơn vị gốc. */
function withUnit(l: SupplierReturnLine, unitId: number | null): SupplierReturnLine {
  const opt = l.options.find((o) => o.id === unitId) ?? l.options[0]!;
  return { ...l, unitId: opt.id, unitPrice: Math.round(l.baseCost * opt.factor) };
}

const money = (n: number) => Math.max(0, Math.round(n));

export function supplierReturnDraftReducer(d: SupplierReturnDraft, a: SupplierReturnAction): SupplierReturnDraft {
  switch (a.type) {
    case 'add': {
      const p = a.product;
      const base: SupplierReturnLine = {
        key: newLineKey(),
        productId: p.id,
        name: p.name,
        isActive: p.isActive,
        stock: p.stock,
        baseUnit: p.unit,
        baseCost: p.costPrice,
        options: unitOptions(p),
        unitId: null,
        qty: 1,
        unitPrice: p.costPrice,
      };
      const line = withUnit(base, a.unitId);
      const same = d.lines.find((l) => l.productId === p.id && l.unitId === line.unitId);
      if (same) return { ...d, lines: d.lines.map((l) => (l === same ? { ...l, qty: l.qty + 1 } : l)) };
      return { ...d, lines: [...d.lines, line] };
    }
    case 'update': {
      if (a.patch.qty !== undefined && a.patch.qty <= 0) return supplierReturnDraftReducer(d, { type: 'remove', key: a.key });
      const patch = { ...a.patch };
      if (patch.unitPrice !== undefined) patch.unitPrice = money(patch.unitPrice);
      return { ...d, lines: d.lines.map((l) => (l.key === a.key ? { ...l, ...patch } : l)) };
    }
    case 'setUnit':
      return { ...d, lines: d.lines.map((l) => (l.key === a.key && l.unitId !== a.unitId ? withUnit(l, a.unitId) : l)) };
    case 'remove':
      return { ...d, lines: d.lines.filter((l) => l.key !== a.key) };
    case 'setSupplier':
      return { ...d, supplierId: a.supplierId };
    case 'setNote':
      return { ...d, note: a.note };
    case 'clear':
      return EMPTY_SUPPLIER_RETURN_DRAFT;
  }
}

/**
 * Mở màn lập phiếu từ chi tiết NCC (?supplierId=): chọn sẵn NCC đó, trừ khi nháp đang có dòng của NCC khác –
 * khi ấy giữ nguyên nháp và báo xung đột, để không lặng lẽ chuyển hàng của NCC này sang NCC kia.
 */
export function presetSupplier(d: SupplierReturnDraft, supplierId: number): { draft: SupplierReturnDraft; conflict: boolean } {
  if (d.lines.length && d.supplierId !== null && d.supplierId !== supplierId) return { draft: d, conflict: true };
  return { draft: { ...d, supplierId }, conflict: false };
}

export function supplierReturnTotals(d: SupplierReturnDraft, supplierDebt: number): { total: number; debtReduced: number; cashReceived: number } {
  const total = d.lines.reduce((s, l) => s + importLineAmount(l.qty, l.unitPrice), 0);
  return { total, ...splitSupplierRefund(total, supplierDebt) };
}

/** Body gửi POST /api/supplier-returns. */
export function toSupplierReturnInput(d: SupplierReturnDraft, supplierId: number): SupplierReturnInputBody {
  return {
    supplierId,
    note: d.note.trim() || null,
    items: d.lines.map((l) => ({ productId: l.productId, unitId: l.unitId, qty: l.qty, unitPrice: l.unitPrice })),
  };
}

/** Đọc nháp từ localStorage; hỏng hoặc sai cấu trúc thì trả phiếu trống. */
export function parseSupplierReturnDraft(raw: string | null): SupplierReturnDraft {
  if (!raw) return EMPTY_SUPPLIER_RETURN_DRAFT;
  try {
    const r = draftSchema.safeParse(JSON.parse(raw));
    return r.success ? r.data : EMPTY_SUPPLIER_RETURN_DRAFT;
  } catch {
    return EMPTY_SUPPLIER_RETURN_DRAFT;
  }
}
