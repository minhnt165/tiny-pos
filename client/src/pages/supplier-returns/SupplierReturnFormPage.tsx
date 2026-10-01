import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { presetSupplier, supplierReturnTotals, toSupplierReturnInput, type Product, type ProductWithUnits } from '@tiny-pos/shared';
import { ApiError } from '@/api/client';
import { fetchProduct, lookupBarcode } from '@/api/products';
import { useCreateSupplierReturn } from '@/api/supplier-returns';
import { useSuppliers } from '@/api/suppliers';
import { PageTitle } from '@/components/layout/PageTitle';
import { ListPanel } from '@/components/ListPanel';
import { ProductSearch } from '@/components/ProductSearch';
import { usePrint } from '@/components/receipt/PrintProvider';
import { receiptFromSupplierReturn } from '@/components/receipt/receipt-data';
import { Input } from '@/components/ui/input';
import { useScanInput } from '@/hooks/useScanInput';
import { SupplierPicker } from '../imports/SupplierPicker';
import { SupplierReturnFooter } from './SupplierReturnFooter';
import { SupplierReturnLinesTable } from './SupplierReturnLinesTable';
import { useSupplierReturnDraft } from './useSupplierReturnDraft';

const noop = () => {};

export function SupplierReturnFormPage() {
  const [params] = useSearchParams();
  const { draft, dispatch } = useSupplierReturnDraft();
  const { data: suppliers = [] } = useSuppliers();
  const create = useCreateSupplierReturn();
  const navigate = useNavigate();
  const print = usePrint();
  const scan = useScanInput(noop);

  // Mở từ chi tiết NCC: chọn sẵn NCC đó, trừ khi nháp đang dở cho NCC khác
  const preset = Number(params.get('supplierId')) || null;
  useEffect(() => {
    if (!preset) return;
    if (presetSupplier(draft, preset).conflict) toast.warning('Đang có phiếu trả dở của nhà cung cấp khác: lưu hoặc xóa các dòng rồi mới đổi nhà cung cấp', { id: 'preset-supplier' });
    else dispatch({ type: 'setSupplier', supplierId: preset });
  }, [preset]); // eslint-disable-line react-hooks/exhaustive-deps

  const supplier = suppliers.find((s) => s.id === draft.supplierId) ?? null;
  const totals = supplierReturnTotals(draft, supplier?.debt ?? 0);

  const add = (product: ProductWithUnits, unitId: number | null) => dispatch({ type: 'add', product, unitId });
  const onScan = async (code: string) => {
    try {
      const r = await lookupBarcode(code);
      add(await fetchProduct(r.product.id), r.unit?.id ?? null);
    } catch (e) {
      toast.error(e instanceof ApiError && e.status === 404 ? `Không có hàng mã ${code}` : (e as Error).message);
    }
  };
  const onPick = async (p: Product) => {
    try {
      add(await fetchProduct(p.id), null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const save = () => {
    if (!supplier || !draft.lines.length || create.isPending) return;
    create.mutate(toSupplierReturnInput(draft, supplier.id), {
      onSuccess: (r) => {
        dispatch({ type: 'clear' });
        toast.success(`Đã lập ${r.code}`, { action: { label: 'In phiếu', onClick: () => void print(receiptFromSupplierReturn(r)) } });
        navigate('/supplier-returns');
      },
      // Lỗi: giữ nguyên phiếu nháp để sửa rồi lưu lại
      onError: (err) => {
        toast.error(err.message);
        scan.focus();
      },
    });
  };

  return (
    <div className="space-y-3 pb-4">
      <PageTitle title="Lập phiếu trả NCC" back="/supplier-returns" />
      <p className="text-sm text-muted-foreground">Quét hoặc tìm hàng cần trả; giá trả mặc định là giá nhập gần nhất, sửa được.</p>
      <div className="flex flex-wrap items-center gap-3">
        <SupplierPicker allowNone={false} value={draft.supplierId} onChange={(supplierId) => dispatch({ type: 'setSupplier', supplierId })} />
        <Input
          placeholder="Ghi chú phiếu (ví dụ: hết hạn, móp)"
          maxLength={200}
          value={draft.note}
          onChange={(e) => dispatch({ type: 'setNote', note: e.target.value })}
          className="h-11 min-w-0 flex-1 text-base"
        />
      </div>
      <ProductSearch inputRef={scan.ref} includeInactive onScan={(c) => void onScan(c)} onPick={(p) => void onPick(p)} />
      <ListPanel>
        <SupplierReturnLinesTable lines={draft.lines} dispatch={dispatch} onDone={scan.focus} />
      </ListPanel>
      <SupplierReturnFooter totals={totals} hasSupplier={supplier !== null} onSave={save} saving={create.isPending} empty={!draft.lines.length} />
    </div>
  );
}
