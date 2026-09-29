import { useState, type KeyboardEvent } from 'react';
import { Plus, Tag, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney, parseVnNumber, type ProductWithUnits } from '@tiny-pos/shared';
import { useDeleteUnit, useSaveUnit } from '@/api/products';
import { SectionTitle } from '@/components/TextField';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { moneyChange } from '@/lib/money-input';
import { numberError } from './useProductForm';

const blank = { name: '', barcode: '', factor: '', sellPrice: '' };

/** Kiểm tra dòng đơn vị trước khi gửi; trả về thông báo lỗi đầu tiên. */
function validateDraft(d: typeof blank): string | undefined {
  if (!d.name.trim()) return 'Nhập tên đơn vị (thùng, lốc…)';
  if (d.name.trim().length > 20) return 'Tên đơn vị tối đa 20 ký tự';
  if (!d.factor.trim()) return 'Nhập hệ số quy đổi, ví dụ 1 thùng = 24';
  const f = parseVnNumber(d.factor);
  if (Number.isNaN(f) || f <= 0) return 'Hệ số quy đổi phải là số lớn hơn 0';
  const p = numberError(d.sellPrice, true);
  if (p) return `Giá bán: ${p.toLowerCase()}`;
  return undefined;
}

/** Danh sách thùng/lốc của 1 sản phẩm; chỉ có thêm và xóa (ít dòng, không cần sửa inline). */
export function ProductUnitsEditor({ product }: { product: ProductWithUnits }) {
  const save = useSaveUnit();
  const remove = useDeleteUnit();
  const [draft, setDraft] = useState(blank);
  const [error, setError] = useState<string | undefined>();
  const onError = (e: Error) => toast.error(e.message);

  const update = (patch: Partial<typeof blank>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setError(undefined);
  };

  const add = () => {
    const err = validateDraft(draft);
    if (err) return setError(err);
    save.mutate(
      {
        productId: product.id,
        name: draft.name.trim(),
        barcode: draft.barcode.trim() || null,
        factor: parseVnNumber(draft.factor),
        sellPrice: parseVnNumber(draft.sellPrice || '0'),
      },
      { onSuccess: () => setDraft(blank), onError },
    );
  };

  /** Enter (kể cả Enter do máy quét gửi) chỉ thêm đơn vị, không submit form sản phẩm bên ngoài. */
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    add();
  };

  return (
    <section>
      <SectionTitle>Đơn vị quy đổi (thùng, lốc…)</SectionTitle>
      <div className="rounded-xl border bg-muted/40 p-3 md:p-4">
        {product.units.length === 0 ? (
          <p className="mb-3 text-sm text-muted-foreground">
            Chưa có. Ví dụ: 1 thùng = 24 {product.unit}. Quét mã thùng khi bán sẽ tính đúng giá thùng.
          </p>
        ) : (
          <ul className="mb-3 space-y-2">
            {product.units.map((u) => (
              <li key={u.id} className="flex items-center gap-3 rounded-lg bg-card px-3 py-2 ring-1 ring-foreground/10">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Tag className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    1 {u.name} = {u.factor} {product.unit}
                  </div>
                  <div className="truncate text-sm text-muted-foreground">
                    {formatMoney(u.sellPrice)}
                    {u.barcode && (
                      <>
                        {' · '}
                        <code className="font-mono">{u.barcode}</code>
                      </>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-lg"
                  aria-label="Xóa đơn vị"
                  title="Xóa đơn vị"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => remove.mutate({ productId: product.id, unitId: u.id }, { onError })}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-[1.1fr_1.4fr_1fr_1.2fr_auto]">
          <Input className="h-11 bg-card text-base" placeholder="Tên (thùng)" value={draft.name} onChange={(e) => update({ name: e.target.value })} onKeyDown={onKeyDown} />
          <Input className="h-11 bg-card text-base" placeholder="Mã vạch thùng" value={draft.barcode} onChange={(e) => update({ barcode: e.target.value })} onKeyDown={onKeyDown} />
          <InputGroup className="h-11 bg-card">
            <InputGroupInput className="h-11 text-base" placeholder="= ?" inputMode="decimal" value={draft.factor} onChange={(e) => update({ factor: e.target.value })} onKeyDown={onKeyDown} />
            <InputGroupAddon align="inline-end">
              <InputGroupText>{product.unit}</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
          <InputGroup className="h-11 bg-card">
            <InputGroupInput className="h-11 text-base tabular-nums" placeholder="Giá bán" inputMode="numeric" value={draft.sellPrice} onChange={moneyChange((v) => update({ sellPrice: v }))} onKeyDown={onKeyDown} />
            <InputGroupAddon align="inline-end">
              <InputGroupText>đ</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
          <Button type="button" variant="outline" className="col-span-2 h-11 text-base md:col-span-1" onClick={add} disabled={save.isPending}>
            <Plus data-icon="inline-start" />
            Thêm
          </Button>
        </div>
        {error && <FieldError className="mt-2">{error}</FieldError>}
      </div>
    </section>
  );
}
