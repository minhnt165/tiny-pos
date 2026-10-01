import { useRef, type FormEvent } from 'react';
import { Camera, Check, ScanBarcode, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ProductWithUnits } from '@tiny-pos/shared';
import { useCategories } from '@/api/categories';
import { useSaveProduct } from '@/api/products';
import { ProductAvatar } from '@/components/ProductAvatar';
import { SelectField } from '@/components/SelectField';
import { SectionTitle, TextField } from '@/components/TextField';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { moneyChange } from '@/lib/money-input';
import { cn } from '@/lib/utils';
import { ProductUnitsEditor } from './ProductUnitsEditor';
import { toInput, useProductForm, validateForm, type FormState } from './useProductForm';
import { useProductImage } from './useProductImage';

interface Props {
  open: boolean;
  product?: ProductWithUnits | null;
  initialBarcode?: string;
  onClose: () => void;
  onSaved: (p: ProductWithUnits) => void;
}

const selectAll = (e: { target: HTMLInputElement }) => e.target.select();
const fieldId = (k: keyof FormState) => `pf-${k}`;

export function ProductFormDialog({ open, product, initialBarcode, onClose, onSaved }: Props) {
  const { form, set, errors, setErrors } = useProductForm(open, product, initialBarcode);
  const { data: categories = [] } = useCategories();
  const save = useSaveProduct();
  const image = useProductImage(open, product);
  const fileRef = useRef<HTMLInputElement>(null);
  const unit = form.unit || 'cái';
  // Có mã sẵn (quét ở Nhập nhanh) hoặc đang sửa → vào thẳng ô Tên; tạo mới tay → ô Mã vạch để máy quét gõ vào
  const firstFocusId = product || initialBarcode ? fieldId('name') : fieldId('barcode');

  const saving = save.isPending || image.busy;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (saving) return; // Enter trong lúc đang gửi ảnh tạm: không tạo thêm sản phẩm
    const errs = validateForm(form);
    const firstBad = (Object.keys(errs) as (keyof FormState)[]).find((k) => errs[k]);
    if (firstBad) {
      setErrors(errs);
      document.getElementById(fieldId(firstBad))?.focus();
      toast.error('Vui lòng kiểm tra lại các ô được đánh dấu đỏ');
      return;
    }
    save.mutate(
      { ...toInput(form), id: product?.id },
      {
        onSuccess: async (p) => {
          // Thêm mới: sản phẩm có id rồi mới gửi được ảnh đang giữ tạm
          const final = product ? p : await image.flush(p);
          toast.success(product ? 'Đã lưu' : `Đã thêm "${final.name}"`);
          onSaved(final);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  const numberField = (k: 'sellPrice' | 'costPrice' | 'stock' | 'minStock', label: string, suffix: string, hint?: string) => {
    const money = suffix === 'đ';
    return (
      <TextField
        id={fieldId(k)}
        label={label}
        suffix={suffix}
        hint={hint}
        error={errors[k]}
        inputMode={money ? 'numeric' : 'decimal'}
        className={cn('tabular-nums', k === 'sellPrice' && 'font-semibold')}
        value={form[k]}
        onChange={money ? moneyChange((v) => set(k, v)) : (e) => set(k, e.target.value)}
        onFocus={selectAll}
      />
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        size="xl"
        className="gap-0 p-0"
        onPointerDownOutside={(e) => e.preventDefault()}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          document.getElementById(firstFocusId)?.focus();
        }}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="border-b bg-muted/30 px-6 py-4">
          <DialogTitle className="text-xl">{product ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}</DialogTitle>
          <DialogDescription>{product ? product.name : 'Quét mã vạch hoặc nhập tay'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="px-6 py-5">
          <section className="mb-6">
            <SectionTitle>Thông tin</SectionTitle>
            <div className="mb-4 flex items-center gap-4">
              {image.pendingUrl ? (
                <img src={image.pendingUrl} alt="" className="size-28 shrink-0 rounded-xl border object-cover" />
              ) : (
                // Ảnh đã lưu (hoặc chữ cái khi chưa có / file ảnh không còn)
                <ProductAvatar name={form.name || '?'} image={product?.image} className="size-28 rounded-xl text-3xl" />
              )}
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="h-11 text-base" disabled={image.busy} onClick={() => fileRef.current?.click()}>
                    <Camera data-icon="inline-start" />
                    {image.busy ? 'Đang xử lý…' : image.hasImage ? 'Đổi ảnh' : 'Chọn ảnh'}
                  </Button>
                  {image.hasImage && (
                    <Button type="button" variant="ghost" className="h-11 text-base" disabled={image.busy} onClick={() => void image.remove()}>
                      <Trash2 data-icon="inline-start" />
                      Xóa ảnh
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">Chụp bằng điện thoại hoặc chọn file; ảnh được thu nhỏ trước khi lưu.</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = ''; // chọn lại cùng file vẫn kích onChange
                    if (f) void image.pick(f);
                  }}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                id={fieldId('barcode')}
                label="Mã vạch"
                hint="Để trống nếu hàng không có mã"
                error={errors.barcode}
                leading={<ScanBarcode />}
                value={form.barcode}
                onChange={(e) => set('barcode', e.target.value)}
                onKeyDown={(e) => {
                  // Máy quét gõ mã rồi Enter: chuyển sang ô Tên thay vì submit
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    document.getElementById(fieldId('name'))?.focus();
                  }
                }}
              />
              <TextField
                id={fieldId('name')}
                label="Tên sản phẩm"
                error={errors.name}
                placeholder="Ví dụ: Sữa tươi Vinamilk 1L"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
              <TextField
                id={fieldId('unit')}
                label="Đơn vị tính"
                error={errors.unit}
                placeholder="cái, kg, lốc…"
                value={form.unit}
                onChange={(e) => set('unit', e.target.value)}
              />
              <SelectField
                id={fieldId('categoryId')}
                label="Danh mục"
                value={form.categoryId}
                onChange={(v) => set('categoryId', v)}
                emptyLabel="Không danh mục"
                options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
                hint={categories.length === 0 ? 'Chưa có danh mục nào, tạo ở trang Danh mục' : undefined}
              />
            </div>
          </section>

          <section className="mb-6">
            <SectionTitle>Giá & tồn kho</SectionTitle>
            <div className="grid gap-4 md:grid-cols-2">
              {numberField('sellPrice', 'Giá bán', 'đ')}
              {numberField('costPrice', 'Giá nhập', 'đ')}
              {numberField('stock', product ? 'Tồn kho' : 'Tồn đầu', unit, product ? 'Sửa sẽ ghi phiếu điều chỉnh kho' : undefined)}
              {numberField('minStock', 'Tồn tối thiểu', unit, 'Dưới mức này sẽ cảnh báo đỏ')}
            </div>
            <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/50 has-data-checked:border-primary/40 has-data-checked:bg-accent">
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
            <Button type="submit" className="h-11 px-5 text-base" disabled={saving}>
              <Check data-icon="inline-start" />
              {saving ? 'Đang lưu…' : 'Lưu'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
