import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Printer, Tag, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney, MAX_LABELS, newLineKey, parseLabelItems, unitOptions, type Product, type ProductWithUnits } from '@tiny-pos/shared';
import { ApiError } from '@/api/client';
import { openLabelWindow, usePrintLabels } from '@/api/labels';
import { fetchProduct, lookupBarcode } from '@/api/products';
import { CommitInput } from '@/components/CommitInput';
import { EmptyState } from '@/components/EmptyState';
import { PageTitle } from '@/components/layout/PageTitle';
import { ListPanel } from '@/components/ListPanel';
import { ProductSearch } from '@/components/ProductSearch';
import { UnitSelect } from '@/components/UnitSelect';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useScanInput } from '@/hooks/useScanInput';

interface Row {
  key: string;
  product: ProductWithUnits;
  unitId: number | null;
  copies: number;
}

const noop = () => {};
const unitOf = (r: Row) => (r.unitId === null ? undefined : r.product.units.find((u) => u.id === r.unitId));
const clampCopies = (n: number) => Math.min(MAX_LABELS, Math.max(1, Math.round(n)));

export function LabelsPage() {
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState<Row[]>([]);
  const printLabels = usePrintLabels();
  const scan = useScanInput(noop);
  const total = rows.reduce((s, r) => s + r.copies, 0);

  const add = (product: ProductWithUnits, unitId: number | null, copies = 1) => {
    // Đơn vị không còn thuộc sản phẩm (đã xóa) thì về đơn vị gốc; hàng cân 1 tem
    const unit = unitId !== null && product.units.some((u) => u.id === unitId) ? unitId : null;
    const n = product.isWeighed ? 1 : copies;
    setRows((rs) => {
      const same = rs.find((r) => r.product.id === product.id && r.unitId === unit);
      if (same) return rs.map((r) => (r === same ? { ...r, copies: clampCopies(r.copies + n) } : r));
      return [...rs, { key: newLineKey(), product, unitId: unit, copies: clampCopies(n) }];
    });
  };

  // Vào từ Sản phẩm / phiếu nhập (?add=…): thêm sẵn các dòng rồi xóa khỏi URL để F5 không thêm lần nữa
  const consumed = useRef(false);
  useEffect(() => {
    if (consumed.current) return;
    consumed.current = true;
    const refs = parseLabelItems(params.get('add'));
    if (!refs.length) return;
    setParams({}, { replace: true });
    for (const r of refs) {
      fetchProduct(r.productId)
        .then((p) => add(p, r.unitId, r.copies))
        .catch((e: Error) => toast.error(e.message));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
  const patch = (key: string, v: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...v } : r)));

  const print = () => {
    if (!rows.length || total > MAX_LABELS || printLabels.isPending) return;
    printLabels.mutate(
      { items: rows.map((r) => ({ productId: r.product.id, unitId: r.unitId, copies: r.copies })) },
      {
        onSuccess: async (res) => {
          openLabelWindow(res);
          // Tải lại để hiện mã vừa cấp (dòng "Sẽ cấp mã mới" đổi thành mã thật)
          const fresh = await Promise.all(rows.map((r) => fetchProduct(r.product.id).catch(() => r.product)));
          setRows((rs) => rs.map((r, i) => ({ ...r, product: fresh[i] ?? r.product })));
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <div className="space-y-3 pb-4">
      <PageTitle
        title="In tem"
        actions={[{ label: `In ${total} tem`, icon: Printer, onClick: print, primary: true, disabled: !rows.length || total > MAX_LABELS || printLabels.isPending }]}
      />
      <p className="text-sm text-muted-foreground">
        Quét hoặc tìm hàng cần in tem. Hàng chưa có mã vạch sẽ được cấp mã nội bộ (bắt đầu bằng 20) khi in.
        {total > MAX_LABELS && <span className="text-destructive"> Tối đa {MAX_LABELS} tem mỗi lần.</span>}
      </p>
      <ProductSearch inputRef={scan.ref} includeInactive onScan={(c) => void onScan(c)} onPick={(p) => void onPick(p)} />
      <ListPanel>
        {!rows.length ? (
          <EmptyState icon={Tag} title="Chưa chọn hàng nào" description="Quét mã hoặc gõ tên để thêm; từ Sản phẩm hay phiếu nhập cũng mở được trang này." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="px-4">Sản phẩm</TableHead>
                <TableHead className="w-40 px-2">Đơn vị</TableHead>
                <TableHead className="px-2">Mã vạch</TableHead>
                <TableHead className="w-28 px-2 text-right">Giá</TableHead>
                <TableHead className="w-24 px-2">Số tem</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const u = unitOf(r);
                const code = u ? u.barcode : r.product.barcode;
                return (
                  <TableRow key={r.key}>
                    <TableCell className="px-4 py-2 font-medium whitespace-normal">{r.product.name}</TableCell>
                    <TableCell className="px-2 py-2">
                      <UnitSelect options={unitOptions(r.product)} value={r.unitId} onChange={(unitId) => patch(r.key, { unitId })} />
                    </TableCell>
                    <TableCell className="px-2 py-2 font-mono">{code ?? <Badge variant="secondary">Sẽ cấp mã mới</Badge>}</TableCell>
                    <TableCell className="px-2 py-2 text-right tabular-nums">{formatMoney(u?.sellPrice ?? r.product.sellPrice)}</TableCell>
                    <TableCell className="px-2 py-2">
                      <CommitInput aria-label="Số tem" value={r.copies} onCommit={(n) => patch(r.key, { copies: clampCopies(n) })} onEnter={scan.focus} className="w-20 text-center" />
                    </TableCell>
                    <TableCell className="py-2 pr-2">
                      <Button variant="ghost" size="icon-lg" className="size-11" aria-label="Xóa dòng" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </ListPanel>
    </div>
  );
}
