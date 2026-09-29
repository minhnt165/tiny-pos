import { useState } from 'react';
import { formatMoney, parseVnNumber, type ProductWithUnits } from '@tiny-pos/shared';
import { useDeleteUnit, useSaveUnit } from '../../api/products';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toast';

const blank = { name: '', barcode: '', factor: '', sellPrice: '' };

/** Danh sách thùng/lốc của 1 sản phẩm; chỉ có thêm và xóa (ít dòng, không cần sửa inline). */
export function ProductUnitsEditor({ product }: { product: ProductWithUnits }) {
  const save = useSaveUnit();
  const remove = useDeleteUnit();
  const toast = useToast();
  const [draft, setDraft] = useState(blank);
  const onError = (e: Error) => toast(e.message, 'error');

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
    <fieldset className="rounded-lg border p-3">
      <legend className="px-1 font-medium">Đơn vị quy đổi (thùng, lốc…)</legend>
      {product.units.length === 0 && (
        <p className="mb-2 text-sm text-gray-500">Chưa có. Ví dụ: 1 thùng = 24 {product.unit}.</p>
      )}
      <ul className="mb-2 divide-y">
        {product.units.map((u) => (
          <li key={u.id} className="flex items-center gap-2 py-1">
            <span className="flex-1">
              1 {u.name} = {u.factor} {product.unit} · {formatMoney(u.sellPrice)}
              {u.barcode && <span className="text-sm text-gray-500"> · {u.barcode}</span>}
            </span>
            <Button
              variant="ghost"
              className="text-red-600"
              onClick={() => remove.mutate({ productId: product.id, unitId: u.id }, { onError })}
            >
              Xóa
            </Button>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <Input placeholder="Tên (thùng)" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <Input
          placeholder="Mã vạch"
          value={draft.barcode}
          onChange={(e) => setDraft({ ...draft, barcode: e.target.value })}
        />
        <Input
          placeholder={`= ? ${product.unit}`}
          inputMode="decimal"
          value={draft.factor}
          onChange={(e) => setDraft({ ...draft, factor: e.target.value })}
        />
        <Input
          placeholder="Giá bán"
          inputMode="numeric"
          value={draft.sellPrice}
          onChange={(e) => setDraft({ ...draft, sellPrice: e.target.value })}
        />
        <Button variant="secondary" onClick={add} disabled={!draft.name || !draft.factor || save.isPending}>
          Thêm
        </Button>
      </div>
    </fieldset>
  );
}
