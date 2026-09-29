import { useRef, type FormEvent } from 'react';
import type { ProductWithUnits } from '@tiny-pos/shared';
import { useCategories } from '../../api/categories';
import { useSaveProduct } from '../../api/products';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Checkbox, Field, Input, Select } from '../../components/ui/Field';
import { useToast } from '../../components/ui/Toast';
import { ProductUnitsEditor } from './ProductUnitsEditor';
import { toInput, useProductForm } from './useProductForm';

interface Props {
  open: boolean;
  product?: ProductWithUnits | null;
  initialBarcode?: string;
  onClose: () => void;
  onSaved: (p: ProductWithUnits) => void;
}

const selectAll = (e: { target: HTMLInputElement }) => e.target.select();

export function ProductFormDialog({ open, product, initialBarcode, onClose, onSaved }: Props) {
  const { form, set } = useProductForm(open, product, initialBarcode);
  const { data: categories = [] } = useCategories();
  const save = useSaveProduct();
  const toast = useToast();
  const nameRef = useRef<HTMLInputElement>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(
      { ...toInput(form), id: product?.id },
      {
        onSuccess: (p) => {
          toast(product ? 'Đã lưu' : `Đã thêm "${p.name}"`);
          onSaved(p);
        },
        onError: (err) => toast(err.message, 'error'),
      },
    );
  };

  return (
    <Dialog open={open} title={product ? 'Sửa sản phẩm' : 'Thêm sản phẩm'} onClose={onClose} wide>
      <form onSubmit={submit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Mã vạch" hint="Quét hoặc để trống nếu hàng không có mã">
          <Input
            value={form.barcode}
            onChange={(e) => set('barcode', e.target.value)}
            onKeyDown={(e) => {
              // Máy quét gõ mã rồi Enter: chuyển sang ô Tên thay vì submit
              if (e.key === 'Enter') {
                e.preventDefault();
                nameRef.current?.focus();
              }
            }}
          />
        </Field>
        <Field label="Tên sản phẩm">
          <Input
            ref={nameRef}
            autoFocus={!initialBarcode}
            required
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </Field>
        <Field label="Đơn vị">
          <Input value={form.unit} onChange={(e) => set('unit', e.target.value)} placeholder="cái, kg, lốc…" />
        </Field>
        <Field label="Danh mục">
          <Select value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
            <option value="">Không danh mục</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Giá nhập (đ)">
          <Input
            inputMode="numeric"
            value={form.costPrice}
            onChange={(e) => set('costPrice', e.target.value)}
            onFocus={selectAll}
          />
        </Field>
        <Field label="Giá bán (đ)">
          <Input
            inputMode="numeric"
            value={form.sellPrice}
            onChange={(e) => set('sellPrice', e.target.value)}
            onFocus={selectAll}
          />
        </Field>
        <Field label={product ? 'Tồn kho' : 'Tồn đầu'} hint={product ? 'Sửa sẽ ghi phiếu điều chỉnh' : undefined}>
          <Input inputMode="decimal" value={form.stock} onChange={(e) => set('stock', e.target.value)} onFocus={selectAll} />
        </Field>
        <Field label="Tồn tối thiểu (cảnh báo)">
          <Input
            inputMode="decimal"
            value={form.minStock}
            onChange={(e) => set('minStock', e.target.value)}
            onFocus={selectAll}
          />
        </Field>
        <div className="md:col-span-2">
          <Checkbox
            label="Hàng cân (bán theo kg)"
            checked={form.isWeighed}
            onChange={(e) => set('isWeighed', e.target.checked)}
          />
        </div>
        {product && (
          <div className="md:col-span-2">
            <ProductUnitsEditor product={product} />
          </div>
        )}
        <div className="flex justify-end gap-2 md:col-span-2">
          <Button variant="secondary" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" disabled={save.isPending}>
            Lưu
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
