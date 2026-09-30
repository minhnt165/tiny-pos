import { useState } from 'react';
import { ClipboardList, CheckCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney, type Product, type StocktakeDetail, type StocktakeItem } from '@tiny-pos/shared';
import { ApiError } from '@/api/client';
import { fetchProduct, lookupBarcode } from '@/api/products';
import { useCancelStocktake, useCountItem, useFinishStocktake, useRemoveCountItem } from '@/api/stocktakes';
import { useConfirm, type ConfirmOptions } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { ProductSearch } from '@/components/ProductSearch';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useScanInput } from '@/hooks/useScanInput';
import { CountDialog, type CountTarget } from './CountDialog';
import { StocktakeItemsTable } from './StocktakeItemsTable';

const noop = () => {};

export function StocktakeSession({ session }: { session: StocktakeDetail }) {
  const [target, setTarget] = useState<CountTarget | null>(null);
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const count = useCountItem();
  const remove = useRemoveCountItem();
  const finish = useFinishStocktake();
  const cancel = useCancelStocktake();
  const confirm = useConfirm();
  const scan = useScanInput(noop, target !== null || confirming);

  const openFor = (p: Product) =>
    setTarget({ productId: p.id, name: p.name, unit: p.unit, stock: p.stock, counted: session.items.find((i) => i.productId === p.id)?.counted });
  const onScan = async (code: string) => {
    try {
      openFor((await lookupBarcode(code)).product);
    } catch (e) {
      toast.error(e instanceof ApiError && e.status === 404 ? `Không có mã ${code}` : (e as Error).message);
    }
  };
  /** Sửa dòng đã đếm: lấy tồn hiện tại (server ghi lại tồn khi đếm lại), không dùng tồn lúc đếm trước. */
  const onEdit = async (i: StocktakeItem) => {
    try {
      openFor(await fetchProduct(i.productId));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const save = (counted: number) => {
    if (!target) return;
    count.mutate(
      { id: session.id, productId: target.productId, counted },
      {
        onSuccess: () => {
          toast.success(`Đã đếm ${target.name}`);
          setTarget(null);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };
  const ask = async (opts: ConfirmOptions) => {
    setConfirming(true);
    try {
      return await confirm(opts);
    } finally {
      setConfirming(false);
    }
  };
  const onFinish = async () => {
    const ok = await ask({
      title: `Chốt ${session.code}?`,
      description: `${session.itemCount} món đã đếm, ${session.diffCount} món lệch, giá trị lệch ${formatMoney(session.diffValue)} (theo giá vốn). Tồn kho các món lệch sẽ được điều chỉnh.`,
      confirmText: 'Chốt kiểm kê',
    });
    if (ok) finish.mutate(session.id, { onSuccess: () => toast.success(`Đã chốt ${session.code}`), onError: (e) => toast.error(e.message) });
  };
  const onCancel = async () => {
    const ok = await ask({ title: 'Hủy phiên kiểm kê?', description: 'Số đã đếm sẽ bỏ, tồn kho không đổi.', confirmText: 'Hủy phiên', destructive: true });
    if (ok) cancel.mutate(session.id, { onSuccess: () => toast.success('Đã hủy phiên'), onError: (e) => toast.error(e.message) });
  };

  const items = onlyDiff ? session.items.filter((i) => Math.abs(i.diff) > 1e-9) : session.items;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Kiểm kê"
        description={`${session.code} · ${session.itemCount} món đã đếm · ${session.diffCount} món lệch${session.note ? ` · ${session.note}` : ''}`}
        icon={ClipboardList}
        actions={
          <>
            <Button variant="outline" className="h-11 text-base text-destructive" onClick={() => void onCancel()}>
              <X data-icon="inline-start" />
              Hủy phiên
            </Button>
            <Button className="h-11 text-base" disabled={!session.itemCount || finish.isPending} onClick={() => void onFinish()}>
              <CheckCheck data-icon="inline-start" />
              Chốt kiểm kê
            </Button>
          </>
        }
      />
      <ProductSearch inputRef={scan.ref} onScan={(c) => void onScan(c)} onPick={openFor} />
      <label className="flex min-h-11 items-center gap-3">
        <Switch checked={onlyDiff} onCheckedChange={setOnlyDiff} />
        <span>Chỉ món lệch</span>
      </label>
      <Card className="gap-0 overflow-hidden py-0">
        {items.length ? (
          <StocktakeItemsTable
            items={items}
            onEdit={(i) => void onEdit(i)}
            onRemove={(i) => remove.mutate({ id: session.id, productId: i.productId }, { onError: (e) => toast.error(e.message) })}
          />
        ) : (
          <EmptyState icon={ClipboardList} title={onlyDiff ? 'Không có món lệch' : 'Chưa đếm món nào'} description="Quét mã hoặc gõ tên để đếm." />
        )}
      </Card>
      <CountDialog target={target} saving={count.isPending} onClose={() => setTarget(null)} onSave={save} />
    </div>
  );
}
