import type { FormEvent } from 'react';
import { Check, ScanBarcode } from 'lucide-react';
import { toast } from 'sonner';
import type { ProductWithUnits } from '@tiny-pos/shared';
import { useCategories } from '@/api/categories';
import { useSaveProduct } from '@/api/products';
import { SectionTitle, TextField } from '@/components/TextField';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const unit = form.unit || 'cái';
  // Có mã sẵn (quét ở Nhập nhanh) hoặc đang sửa → vào thẳng ô Tên; tạo mới tay → ô Mã vạch để máy quét gõ vào
  const firstFocusId = product || initialBarcode ? 'pf-name' : 'pf-barcode';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(
      { ...toInput(form), id: product?.id },
      {
        onSuccess: (p) => {
          toast.success(product ? 'Đã lưu' : `Đã thêm "${p.name}"`);
          onSaved(p);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-h-[95vh] gap-0 overflow-y-auto p-0 sm:max-w-3xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          document.getElementById(firstFocusId)?.focus();
        }}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="text-xl">{product ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}</DialogTitle>
          <DialogDescription>{product ? product.name : 'Quét mã vạch hoặc nhập tay'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="px-6 py-5">
          <section className="mb-6">
            <SectionTitle>Thông tin</SectionTitle>
            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                id="pf-barcode"
                label="Mã vạch"
                hint="Để trống nếu hàng không có mã"
                leading={<ScanBarcode />}
                value={form.barcode}
                onChange={(e) => set('barcode', e.target.value)}
                onKeyDown={(e) => {
                  // Máy quét gõ mã rồi Enter: chuyển sang ô Tên thay vì submit
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    document.getElementById('pf-name')?.focus();
                  }
                }}
              />
              <TextField
                id="pf-name"
                label="Tên sản phẩm"
                required
                placeholder="Ví dụ: Sữa tươi Vinamilk 1L"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
              <TextField id="pf-unit" label="Đơn vị tính" placeholder="cái, kg, lốc…" value={form.unit} onChange={(e) => set('unit', e.target.value)} />
              <Field>
                <FieldLabel htmlFor="pf-category">Danh mục</FieldLabel>
                <Select value={form.categoryId || 'none'} onValueChange={(v) => set('categoryId', v === 'none' ? '' : v)}>
                  <SelectTrigger id="pf-category" className="h-11 w-full text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Không danh mục</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </section>

          <section className="mb-6">
            <SectionTitle>Giá & tồn kho</SectionTitle>
            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                id="pf-sell"
                label="Giá bán"
                suffix="đ"
                inputMode="numeric"
                className="font-semibold"
                value={form.sellPrice}
                onChange={(e) => set('sellPrice', e.target.value)}
                onFocus={selectAll}
              />
              <TextField
                id="pf-cost"
                label="Giá nhập"
                suffix="đ"
                inputMode="numeric"
                value={form.costPrice}
                onChange={(e) => set('costPrice', e.target.value)}
                onFocus={selectAll}
              />
              <TextField
                id="pf-stock"
                label={product ? 'Tồn kho' : 'Tồn đầu'}
                hint={product ? 'Sửa sẽ ghi phiếu điều chỉnh kho' : undefined}
                suffix={unit}
                inputMode="decimal"
                value={form.stock}
                onChange={(e) => set('stock', e.target.value)}
                onFocus={selectAll}
              />
              <TextField
                id="pf-min"
                label="Tồn tối thiểu"
                hint="Dưới mức này sẽ cảnh báo đỏ"
                suffix={unit}
                inputMode="decimal"
                value={form.minStock}
                onChange={(e) => set('minStock', e.target.value)}
                onFocus={selectAll}
              />
            </div>
            <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 has-data-checked:border-primary/40 has-data-checked:bg-accent">
              <Checkbox className="size-5" checked={form.isWeighed} onCheckedChange={(v) => set('isWeighed', v === true)} />
              <span>
                <span className="block font-medium">Hàng cân</span>
                <span className="block text-sm text-muted-foreground">Bán theo kg: khi bán nhập số cân hoặc số tiền</span>
              </span>
            </label>
          </section>

          {product && <ProductUnitsEditor product={product} />}

          <div className="-mx-6 -mb-5 mt-6 flex justify-end gap-2 rounded-b-xl border-t bg-muted/50 px-6 py-4">
            <Button type="button" variant="outline" className="h-11 px-4 text-base" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" className="h-11 px-5 text-base" disabled={save.isPending}>
              <Check data-icon="inline-start" />
              {save.isPending ? 'Đang lưu…' : 'Lưu'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
