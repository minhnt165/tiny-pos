import { z } from 'zod';
import { newLineKey } from './cart.js';
import { importLineAmount } from './inventory-math.js';
import type { ImportInputBody } from './schemas/import.js';
import type { ProductWithUnits } from './types.js';

const unitOptionSchema = z.object({
  id: z.number().int().nullable(),
  name: z.string(),
  factor: z.number().positive(),
  sellPrice: z.number().int().min(0),
});
const draftLineSchema = z.object({
  key: z.string(),
  productId: z.number().int(),
  name: z.string(),
  isActive: z.boolean(),
  /** Giá vốn 1 đơn vị gốc lúc thêm dòng, để điền lại giá nhập khi đổi đơn vị. */
  baseCost: z.number().int().min(0),
  options: z.array(unitOptionSchema).min(1),
  unitId: z.number().int().nullable(),
  qty: z.number().positive(),
  unitCost: z.number().int().min(0),
  sellPrice: z.number().int().min(0),
  /** Hạn dùng của lô, "YYYY-MM-DD"; nháp cũ không có thì null. */
  expiresOn: z.string().nullable().default(null),
});
const draftSchema = z.object({
  supplierId: z.number().int().nullable(),
  note: z.string(),
  /** null = trả đủ (tự theo tổng tiền). */
  paid: z.number().int().min(0).nullable(),
  lines: z.array(draftLineSchema),
});

export type UnitOption = z.infer<typeof unitOptionSchema>;
export type DraftLine = z.infer<typeof draftLineSchema>;
export type ImportDraft = z.infer<typeof draftSchema>;

export const EMPTY_IMPORT_DRAFT: ImportDraft = { supplierId: null, note: '', paid: null, lines: [] };

export type DraftAction =
  | { type: 'add'; product: ProductWithUnits; unitId: number | null }
  | { type: 'update'; key: string; patch: Partial<Pick<DraftLine, 'qty' | 'unitCost' | 'sellPrice' | 'expiresOn'>> }
  | { type: 'setUnit'; key: string; unitId: number | null }
  | { type: 'remove'; key: string }
  | { type: 'setSupplier'; supplierId: number | null }
  | { type: 'setNote'; note: string }
  | { type: 'setPaid'; paid: number | null }
  | { type: 'clear' };

/** Đơn vị gốc + các đơn vị quy đổi của sản phẩm. */
export function unitOptions(p: ProductWithUnits): UnitOption[] {
  return [
    { id: null, name: p.unit, factor: 1, sellPrice: p.sellPrice },
    ...p.units.map((u) => ({ id: u.id, name: u.name, factor: u.factor, sellPrice: u.sellPrice })),
  ];
}

export function currentOption(l: DraftLine): UnitOption {
  return l.options.find((o) => o.id === l.unitId) ?? l.options[0]!;
}

/** Đặt đơn vị cho dòng; giá nhập và giá bán điền lại theo đơn vị đó. unitId lạ → đơn vị gốc. */
function withUnit(l: DraftLine, unitId: number | null): DraftLine {
  const opt = l.options.find((o) => o.id === unitId) ?? l.options[0]!;
  return { ...l, unitId: opt.id, unitCost: Math.round(l.baseCost * opt.factor), sellPrice: opt.sellPrice };
}

const money = (n: number) => Math.max(0, Math.round(n));

export function importDraftReducer(d: ImportDraft, a: DraftAction): ImportDraft {
  switch (a.type) {
    case 'add': {
      const p = a.product;
      const base: DraftLine = {
        key: newLineKey(),
        productId: p.id,
        name: p.name,
        isActive: p.isActive,
        baseCost: p.costPrice,
        options: unitOptions(p),
        unitId: null,
        qty: 1,
        unitCost: p.costPrice,
        sellPrice: p.sellPrice,
        expiresOn: null,
      };
      const line = withUnit(base, a.unitId);
      const same = d.lines.find((l) => l.productId === p.id && l.unitId === line.unitId);
      if (same) return { ...d, lines: d.lines.map((l) => (l === same ? { ...l, qty: l.qty + 1 } : l)) };
      return { ...d, lines: [...d.lines, line] };
    }
    case 'update': {
      if (a.patch.qty !== undefined && a.patch.qty <= 0) return importDraftReducer(d, { type: 'remove', key: a.key });
      const patch = { ...a.patch };
      if (patch.unitCost !== undefined) patch.unitCost = money(patch.unitCost);
      if (patch.sellPrice !== undefined) patch.sellPrice = money(patch.sellPrice);
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
    case 'setPaid':
      return { ...d, paid: a.paid === null ? null : money(a.paid) };
    case 'clear':
      return EMPTY_IMPORT_DRAFT;
  }
}

export function draftTotals(d: ImportDraft): { total: number; paid: number; debt: number } {
  const total = d.lines.reduce((s, l) => s + importLineAmount(l.qty, l.unitCost), 0);
  const paid = d.paid ?? total;
  return { total, paid, debt: total - paid };
}

/** Body gửi POST /api/imports; sellPrice chỉ gửi khi khác giá hiện tại của đơn vị. */
export function toImportInput(d: ImportDraft): ImportInputBody {
  return {
    supplierId: d.supplierId,
    note: d.note.trim() || null,
    paid: draftTotals(d).paid,
    items: d.lines.map((l) => ({
      productId: l.productId,
      unitId: l.unitId,
      qty: l.qty,
      unitCost: l.unitCost,
      sellPrice: l.sellPrice !== currentOption(l).sellPrice ? l.sellPrice : null,
      expiresOn: l.expiresOn,
    })),
  };
}

/** Đọc nháp từ localStorage; hỏng hoặc sai cấu trúc thì trả phiếu trống. */
export function parseImportDraft(raw: string | null): ImportDraft {
  if (!raw) return EMPTY_IMPORT_DRAFT;
  try {
    const r = draftSchema.safeParse(JSON.parse(raw));
    return r.success ? r.data : EMPTY_IMPORT_DRAFT;
  } catch {
    return EMPTY_IMPORT_DRAFT;
  }
}
