import { useState, type KeyboardEvent } from 'react';
import { Plus, Tag, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney, parseVnNumber, type ProductWithUnits } from '@tiny-pos/shared';
import { useDeleteUnit, useSaveUnit } from '@/api/products';
import { SectionTitle } from '@/components/TextField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';

const blank = { name: '', barcode: '', factor: '', sellPrice: '' };

/** Danh sách thùng/lốc của 1 sản phẩm; chỉ có thêm và xóa (ít dòng, không cần sửa inline). */
export function ProductUnitsEditor({ product }: { product: ProductWithUnits }) {
  const save = useSaveUnit();
  const remove = useDeleteUnit();
  const [draft, setDraft] = useState(blank);
  const onError = (e: Error) => toast.error(e.message);

  const canAdd = !!draft.name && !!draft.factor && !save.isPending;

  /** Enter (kể cả Enter do máy quét gửi) chỉ thêm đơn vị, không submit form sản phẩm bên ngoài. */
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (canAdd) add();
  };

  const add = () => {
    save.mutate(
      {
        productId: product.id,
        name: draft.name,
        barcode: draft.barcode || null,
        factor: parseVnNumber(draft.factor),
        sellPrice: parseVnNumber(draft.sellPrice || '0'),
      },
      { onSuccess: () => setDraft(blank), onError },
    );
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
          <Input
            className="h-11 bg-card text-base"
            placeholder="Tên (thùng)"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            onKeyDown={onKeyDown}
          />
          <Input
            className="h-11 bg-card text-base"
            placeholder="Mã vạch thùng"
            value={draft.barcode}
            onChange={(e) => setDraft({ ...draft, barcode: e.target.value })}
            onKeyDown={onKeyDown}
          />
          <InputGroup className="h-11 bg-card">
            <InputGroupInput
              className="h-11 text-base"
              placeholder="= ?"
              inputMode="decimal"
              value={draft.factor}
              onChange={(e) => setDraft({ ...draft, factor: e.target.value })}
              onKeyDown={onKeyDown}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText>{product.unit}</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
          <InputGroup className="h-11 bg-card">
            <InputGroupInput
              className="h-11 text-base"
              placeholder="Giá bán"
              inputMode="numeric"
              value={draft.sellPrice}
              onChange={(e) => setDraft({ ...draft, sellPrice: e.target.value })}
              onKeyDown={onKeyDown}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText>đ</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
          <Button type="button" variant="outline" className="col-span-2 h-11 text-base md:col-span-1" onClick={add} disabled={!canAdd}>
            <Plus data-icon="inline-start" />
            Thêm
          </Button>
        </div>
      </div>
    </section>
  );
}
