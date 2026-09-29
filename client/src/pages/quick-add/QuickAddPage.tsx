import { useState } from 'react';
import { History, Pencil, ScanBarcode } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney, type BarcodeLookup, type ProductWithUnits } from '@tiny-pos/shared';
import { ApiError } from '@/api/client';
import { lookupBarcode, useProduct } from '@/api/products';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useScanInput } from '@/hooks/useScanInput';
import { cn } from '@/lib/utils';
import { ProductFormDialog } from '../products/ProductFormDialog';

type Result = { kind: 'found'; data: BarcodeLookup } | { kind: 'new'; code: string } | null;
interface HistoryItem {
  code: string;
  name: string;
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="px-5 py-4">
      <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{label}</div>
      <div className={cn('mt-1 font-heading text-2xl font-semibold tabular-nums', accent && 'text-primary')}>{value}</div>
      {sub && <div className="text-sm text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function QuickAddPage() {
  const [result, setResult] = useState<Result>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newBarcode, setNewBarcode] = useState<string | null>(null);
  const { data: editing } = useProduct(editingId);
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
      } else toast.error((e as Error).message);
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

  const found = result?.kind === 'found' ? result.data : null;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader icon={ScanBarcode} title="Nhập nhanh" description="Quét mã: có rồi thì hiện thông tin, chưa có thì mở form thêm mới." />

      <div
        className={cn(
          'mb-5 rounded-2xl border-2 bg-card p-2 shadow-sm transition-all',
          dialogOpen ? 'border-border' : 'border-primary ring-4 ring-primary/15',
        )}
      >
        <div className="flex items-center gap-3 px-2">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
            <ScanBarcode className="size-7" />
          </span>
          <input
            ref={scan.ref}
            onKeyDown={scan.onKeyDown}
            placeholder="Quét mã vạch tại đây…"
            className="min-h-14 w-full bg-transparent text-2xl font-medium outline-none placeholder:text-muted-foreground/70"
            autoComplete="off"
          />
        </div>
      </div>

      {found && (
        <Card className="mb-5 animate-in py-0 fade-in-0 zoom-in-95">
          <div className="flex items-start gap-4 p-5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-heading text-xl font-semibold">{found.product.name}</h2>
                {!found.product.isActive && <Badge variant="secondary">Ngừng bán</Badge>}
                {found.unit && <Badge>Mã {found.unit.name}</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {found.product.categoryName ?? 'Không danh mục'}
                {found.product.barcode && (
                  <>
                    {' · '}
                    <code className="font-mono">{found.product.barcode}</code>
                  </>
                )}
              </p>
            </div>
            <Button variant="outline" className="h-10 px-4 text-base" onClick={() => setEditingId(found.product.id)}>
              <Pencil data-icon="inline-start" />
              Sửa
            </Button>
          </div>
          <div className="grid grid-cols-2 divide-x border-t bg-muted/40 md:grid-cols-3">
            <Stat label="Giá bán" value={formatMoney(found.product.sellPrice)} sub={`/ ${found.product.unit}`} accent />
            <Stat label="Tồn kho" value={String(found.product.stock)} sub={found.product.unit} />
            {found.unit && (
              <Stat label={`1 ${found.unit.name}`} value={formatMoney(found.unit.sellPrice)} sub={`= ${found.unit.factor} ${found.product.unit}`} />
            )}
          </div>
        </Card>
      )}

      {history.length > 0 && (
        <Card className="py-0">
          <div className="flex items-center gap-2 border-b px-4 py-3 text-sm font-medium text-muted-foreground">
            <History className="size-4" />
            Vừa quét
          </div>
          <ul className="divide-y">
            {history.map((h, i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-base">
                <span className="truncate font-medium">{h.name}</span>
                <code className="shrink-0 rounded-md bg-muted px-2 py-0.5 font-mono text-sm text-muted-foreground">{h.code}</code>
              </li>
            ))}
          </ul>
        </Card>
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
