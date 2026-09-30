import { useEffect, useState } from 'react';
import { ArrowLeft, PackagePlus } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { toImportInput, type Product, type ProductWithUnits } from '@tiny-pos/shared';
import { ApiError } from '@/api/client';
import { useCreateImport } from '@/api/imports';
import { fetchProduct, lookupBarcode } from '@/api/products';
import { PageHeader } from '@/components/PageHeader';
import { ProductSearch } from '@/components/ProductSearch';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
      onError: (err) => toast.error(err.message),
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'F9' || newBarcode !== null) return;
      e.preventDefault();
      save();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="space-y-4 pb-4">
      <PageHeader
        title="Tạo phiếu nhập"
        description="Quét mã hàng về; mã lạ sẽ mở form thêm sản phẩm"
        icon={PackagePlus}
        actions={
          <Button variant="outline" className="h-11 text-base" asChild>
            <Link to="/imports">
              <ArrowLeft data-icon="inline-start" />
              Danh sách phiếu
            </Link>
          </Button>
        }
      />
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
      <ProductSearch inputRef={scan.ref} onScan={(c) => void onScan(c)} onPick={(p) => void onPick(p)} />
      <Card className="gap-0 overflow-hidden py-0">
        <ImportLinesTable lines={draft.lines} dispatch={dispatch} onDone={scan.focus} />
      </Card>
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
