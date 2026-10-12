import type { KeyboardEvent } from 'react';
import { Plus, Tag, Trash2 } from 'lucide-react';
import { formatMoney } from '@tiny-pos/shared';
import { SectionTitle } from '@/components/TextField';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { moneyChange } from '@/lib/money-input';
import type { ProductUnitsState } from './useProductUnits';

/** id ô Tên đơn vị, để form đưa focus tới khi bấm Lưu mà dòng này chưa hợp lệ. */
export const UNIT_NAME_ID = 'pu-name';

interface Props {
  /** Đơn vị gốc của sản phẩm (đang thêm mới thì lấy từ ô Đơn vị tính). */
  baseUnit: string;
  units: ProductUnitsState;
}

/** Danh sách thùng/lốc của 1 sản phẩm; chỉ có thêm và xóa (ít dòng, không cần sửa inline). Đang thêm sản phẩm thì giữ tạm. */
export function ProductUnitsEditor({ baseUnit, units }: Props) {
  const { draft, update, error, rows } = units;

  /** Enter (kể cả Enter do máy quét gửi) chỉ thêm đơn vị, không submit form sản phẩm bên ngoài. */
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    void units.commitDraft();
  };

  return (
    <section>
      <SectionTitle>Đơn vị quy đổi (thùng, lốc…)</SectionTitle>
      <div className="rounded-xl border bg-muted/40 p-3 md:p-4">
        {rows.length === 0 ? (
          <p className="mb-3 text-sm text-muted-foreground">
            Chưa có. Ví dụ: 1 thùng = 24 {baseUnit}. Quét mã thùng hoặc chọn đơn vị trên giỏ khi bán sẽ tính đúng giá thùng.
          </p>
        ) : (
          <ul className="mb-3 space-y-2">
            {rows.map((u) => (
              <li key={u.key} className="flex items-center gap-3 rounded-lg bg-card px-3 py-2 ring-1 ring-foreground/10">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Tag className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    1 {u.name} = {u.factor} {baseUnit}
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
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  aria-label="Xóa đơn vị"
                  title="Xóa đơn vị"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={units.busy}
                  onClick={() => void units.removeRow(u.key)}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-[1.1fr_1.4fr_1fr_1.2fr_auto]">
          <Input id={UNIT_NAME_ID} className="h-11 bg-card text-base" placeholder="Tên (thùng)" value={draft.name} onChange={(e) => update({ name: e.target.value })} onKeyDown={onKeyDown} />
          <Input className="h-11 bg-card text-base" placeholder="Mã vạch thùng" value={draft.barcode} onChange={(e) => update({ barcode: e.target.value })} onKeyDown={onKeyDown} />
          <InputGroup className="h-11 bg-card">
            <InputGroupInput className="h-11 text-base" placeholder="= ?" inputMode="decimal" value={draft.factor} onChange={(e) => update({ factor: e.target.value })} onKeyDown={onKeyDown} />
            <InputGroupAddon align="inline-end">
              <InputGroupText>{baseUnit}</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
          <InputGroup className="h-11 bg-card">
            <InputGroupInput className="h-11 text-base tabular-nums" placeholder="Giá bán" inputMode="numeric" value={draft.sellPrice} onChange={moneyChange((v) => update({ sellPrice: v }))} onKeyDown={onKeyDown} />
            <InputGroupAddon align="inline-end">
              <InputGroupText>đ</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
          <Button type="button" variant="outline" className="col-span-2 h-11 text-base md:col-span-1" onClick={() => void units.commitDraft()} disabled={units.busy}>
            <Plus data-icon="inline-start" />
            Thêm
          </Button>
        </div>
        {error && <FieldError className="mt-2">{error}</FieldError>}
      </div>
    </section>
  );
}
