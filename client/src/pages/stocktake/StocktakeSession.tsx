import { useState } from 'react';
import { ClipboardList, CheckCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney, formatQty, type Product, type ProductUnit, type StocktakeDetail, type StocktakeItem } from '@tiny-pos/shared';
import { ApiError } from '@/api/client';
import { fetchProduct, lookupBarcode } from '@/api/products';
import { useCancelStocktake, useCountItem, useFinishStocktake, useRemoveCountItem } from '@/api/stocktakes';
import { useConfirm, type ConfirmOptions } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { PageTitle } from '@/components/layout/PageTitle';
import { ListPanel } from '@/components/ListPanel';
import { ProductSearch } from '@/components/ProductSearch';
import { Button } from '@/components/ui/button';
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

  const openFor = (p: Product, u?: ProductUnit | null) =>
    setTarget({
      productId: p.id,
      name: p.name,
      unit: p.unit,
      stock: p.stock,
      counted: session.items.find((i) => i.productId === p.id)?.counted,
      // Quét mã thùng/lốc: đếm theo đơn vị đó, lưu quy về đơn vị gốc
      ...(u ? { unitLabel: `${u.name} (${formatQty(u.factor)} ${p.unit})`, unitName: u.name, factor: u.factor } : {}),
    });
  const onScan = async (code: string) => {
    try {
      const r = await lookupBarcode(code);
      openFor(r.product, r.unit);
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
    <div className="space-y-3">
      <PageTitle
        title="Kiểm kê"
        count={session.code}
        actions={[
          { label: 'Hủy phiên', icon: X, onClick: () => void onCancel(), danger: true, disabled: cancel.isPending },
          { label: 'Chốt kiểm kê', icon: CheckCheck, onClick: () => void onFinish(), primary: true, disabled: !session.itemCount || finish.isPending },
        ]}
      />
      {/* Tiến độ để trong thân trang (không chỉ trên topbar) để điện thoại luôn đọc đủ */}
      <p className="text-sm text-muted-foreground">
        {session.itemCount} món đã đếm · {session.diffCount} món lệch{session.note ? ` · Ghi chú: ${session.note}` : ''}
      </p>
      <ProductSearch inputRef={scan.ref} includeInactive onScan={(c) => void onScan(c)} onPick={(p) => openFor(p)} />
      <ListPanel
        toolbar={
          <label className="flex min-h-11 items-center gap-3 md:min-h-10">
            <Switch checked={onlyDiff} onCheckedChange={setOnlyDiff} />
            <span>Chỉ món lệch</span>
          </label>
        }
      >
        {items.length ? (
          <StocktakeItemsTable
            items={items}
            onEdit={(i) => void onEdit(i)}
            onRemove={(i) => remove.mutate({ id: session.id, productId: i.productId }, { onError: (e) => toast.error(e.message) })}
          />
        ) : (
          <EmptyState icon={ClipboardList} title={onlyDiff ? 'Không có món lệch' : 'Chưa đếm món nào'} description="Quét mã hoặc gõ tên để đếm." />
        )}
      </ListPanel>
      <CountDialog target={target} saving={count.isPending} onClose={() => setTarget(null)} onSave={save} />
    </div>
  );
}
