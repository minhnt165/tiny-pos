import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { toImportInput, type Product, type ProductWithUnits } from '@tiny-pos/shared';
import { ApiError } from '@/api/client';
import { useCreateImport } from '@/api/imports';
import { fetchProduct, lookupBarcode } from '@/api/products';
import { PageTitle } from '@/components/layout/PageTitle';
import { ListPanel } from '@/components/ListPanel';
import { ProductSearch } from '@/components/ProductSearch';
import { Input } from '@/components/ui/input';
import { useScanInput } from '@/hooks/useScanInput';
import { ProductFormDialog } from '../products/ProductFormDialog';
import { ImportFooter } from './ImportFooter';
import { ImportLinesTable } from './ImportLinesTable';
import { SupplierPicker } from './SupplierPicker';
import { useImportDraft } from './useImportDraft';

const noop = () => {};

export function ImportFormPage() {
  const { draft, dispatch, totals } = useImportDraft();
  const [newBarcode, setNewBarcode] = useState<string | null>(null);
  const create = useCreateImport();
  const navigate = useNavigate();
  const scan = useScanInput(noop, newBarcode !== null);

  const add = (product: ProductWithUnits, unitId: number | null) => dispatch({ type: 'add', product, unitId });
  const onScan = async (code: string) => {
    try {
      const r = await lookupBarcode(code);
      add(await fetchProduct(r.product.id), r.unit?.id ?? null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setNewBarcode(code);
      else toast.error((e as Error).message);
    }
  };
  const onPick = async (p: Product) => {
    try {
      add(await fetchProduct(p.id), null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const setSupplier = (supplierId: number | null) => {
    dispatch({ type: 'setSupplier', supplierId });
    // Không ghi NCC thì phải trả đủ
    if (supplierId === null) dispatch({ type: 'setPaid', paid: null });
  };

  const save = () => {
    if (!draft.lines.length || totals.paid > totals.total || create.isPending) return;
    create.mutate(toImportInput(draft), {
      onSuccess: (r) => {
        dispatch({ type: 'clear' });
        toast.success(`Đã lưu ${r.code}`);
        navigate('/imports');
      },
      // Lỗi: giữ nguyên phiếu nháp để sửa rồi lưu lại
      onError: (err) => {
        toast.error(err.message);
        scan.focus();
      },
    });
  };

  // Bản save mới nhất (sau khi React render lại) để F9 lưu đúng giá trị vừa chốt
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'F9' || newBarcode !== null) return;
      // Đang mở hộp thoại/popover (thêm sản phẩm, thêm NCC…) thì F9 không lưu phiếu phía sau
      if (document.querySelector('[role="dialog"],[role="alertdialog"]')) return;
      e.preventDefault();
      // Blur để ô đang gõ (CommitInput) ghi giá trị, rồi lưu sau khi React đã áp dụng
      (document.activeElement as HTMLElement | null)?.blur();
      setTimeout(() => saveRef.current(), 0);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="space-y-3 pb-4">
      <PageTitle title="Tạo phiếu nhập" back="/imports" />
      <p className="text-sm text-muted-foreground">Quét mã hàng về; mã lạ sẽ mở form thêm sản phẩm.</p>
      <div className="flex flex-wrap items-center gap-3">
        <SupplierPicker value={draft.supplierId} onChange={setSupplier} />
        <Input
          placeholder="Ghi chú phiếu (tùy chọn)"
          maxLength={200}
          value={draft.note}
          onChange={(e) => dispatch({ type: 'setNote', note: e.target.value })}
          className="h-11 min-w-0 flex-1 text-base"
        />
      </div>
      <ProductSearch inputRef={scan.ref} includeInactive onScan={(c) => void onScan(c)} onPick={(p) => void onPick(p)} />
      <ListPanel>
        <ImportLinesTable lines={draft.lines} dispatch={dispatch} onDone={scan.focus} />
      </ListPanel>
      <ImportFooter
        totals={totals}
        hasSupplier={draft.supplierId !== null}
        paidAuto={draft.paid === null}
        onPaid={(paid) => dispatch({ type: 'setPaid', paid })}
        onSave={save}
        saving={create.isPending}
        empty={!draft.lines.length}
      />
      <ProductFormDialog
        open={newBarcode !== null}
        initialBarcode={newBarcode ?? undefined}
        onClose={() => setNewBarcode(null)}
        onSaved={(p) => {
          setNewBarcode(null);
          add(p, null);
        }}
      />
    </div>
  );
}
