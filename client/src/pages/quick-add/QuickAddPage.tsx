import { useState } from 'react';
import { formatMoney, type BarcodeLookup, type ProductWithUnits } from '@tiny-pos/shared';
import { ApiError } from '../../api/client';
import { lookupBarcode, useProduct } from '../../api/products';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { useScanInput } from '../../hooks/useScanInput';
import { ProductFormDialog } from '../products/ProductFormDialog';

type Result = { kind: 'found'; data: BarcodeLookup } | { kind: 'new'; code: string } | null;
interface HistoryItem {
  code: string;
  name: string;
}

export function QuickAddPage() {
  const [result, setResult] = useState<Result>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newBarcode, setNewBarcode] = useState<string | null>(null);
  const { data: editing } = useProduct(editingId);
  const toast = useToast();
  const dialogOpen = newBarcode !== null || (editingId !== null && !!editing);

  const pushHistory = (item: HistoryItem) => setHistory((h) => [item, ...h].slice(0, 10));

  const onScan = async (code: string) => {
    try {
      const data = await lookupBarcode(code);
      setResult({ kind: 'found', data });
      pushHistory({ code, name: data.product.name });
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setResult({ kind: 'new', code });
        setNewBarcode(code);
      } else toast((e as Error).message, 'error');
    }
  };
  const scan = useScanInput(onScan, dialogOpen);

  const closeDialog = () => {
    setNewBarcode(null);
    setEditingId(null);
    scan.focus();
  };
  const onSaved = (p: ProductWithUnits) => {
    setResult({ kind: 'found', data: { product: p, unit: null } });
    pushHistory({ code: p.barcode ?? '', name: p.name });
    closeDialog();
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 text-2xl font-bold">Nhập nhanh</h1>
      <p className="mb-3 text-gray-600">Quét mã vạch. Có rồi thì hiện thông tin, chưa có thì mở form thêm mới.</p>
      <input
        ref={scan.ref}
        onKeyDown={scan.onKeyDown}
        placeholder="Quét mã vạch tại đây…"
        className="mb-4 min-h-14 w-full rounded-xl border-2 border-green-600 px-4 text-2xl focus:outline-none focus:ring-4 focus:ring-green-200"
        autoComplete="off"
      />
      {result?.kind === 'found' && (
        <div className="mb-4 rounded-xl border bg-white p-4">
          <div className="text-xl font-bold">
            {result.data.product.name}
            {!result.data.product.isActive && (
              <span className="ml-2 text-base font-normal text-red-600">(ngừng bán)</span>
            )}
          </div>
          {result.data.unit && (
            <div className="text-green-700">
              Mã của {result.data.unit.name} (= {result.data.unit.factor} {result.data.product.unit}) ·{' '}
              {formatMoney(result.data.unit.sellPrice)}
            </div>
          )}
          <div className="mt-1 text-gray-700">
            Giá bán {formatMoney(result.data.product.sellPrice)} / {result.data.product.unit} · Tồn{' '}
            {result.data.product.stock} · {result.data.product.categoryName ?? 'Không danh mục'}
          </div>
          <Button variant="secondary" className="mt-3" onClick={() => setEditingId(result.data.product.id)}>
            Sửa
          </Button>
        </div>
      )}
      {history.length > 0 && (
        <div className="rounded-xl border bg-white">
          <div className="border-b px-4 py-2 font-medium text-gray-600">Vừa quét</div>
          <ul className="divide-y">
            {history.map((h, i) => (
              <li key={i} className="flex justify-between px-4 py-2">
                <span>{h.name}</span>
                <span className="font-mono text-sm text-gray-500">{h.code}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <ProductFormDialog
        open={dialogOpen}
        product={editing ?? null}
        initialBarcode={newBarcode ?? undefined}
        onClose={closeDialog}
        onSaved={onSaved}
      />
    </div>
  );
}
