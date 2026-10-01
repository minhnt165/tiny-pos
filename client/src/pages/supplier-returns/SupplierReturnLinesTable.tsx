import type { Dispatch } from 'react';
import { PackageMinus, Trash2 } from 'lucide-react';
import { formatMoney, formatQty, importLineAmount, overStock, type SupplierReturnAction, type SupplierReturnLine } from '@tiny-pos/shared';
import { CommitInput } from '@/components/CommitInput';
import { EmptyState } from '@/components/EmptyState';
import { UnitSelect } from '@/components/UnitSelect';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Props {
  lines: SupplierReturnLine[];
  dispatch: Dispatch<SupplierReturnAction>;
  onDone: () => void;
}

function LineRow({ line, dispatch, onDone }: { line: SupplierReturnLine; dispatch: Dispatch<SupplierReturnAction>; onDone: () => void }) {
  const update = (patch: Partial<Pick<SupplierReturnLine, 'qty' | 'unitPrice'>>) => dispatch({ type: 'update', key: line.key, patch });
  return (
    <TableRow>
      <TableCell className="px-4 py-2 whitespace-normal">
        <div className="font-medium">{line.name}</div>
        {!line.isActive && <Badge variant="secondary">Ngừng bán</Badge>}
        {overStock(line) && (
          <div className="text-sm text-warning">
            Tồn hiện có {formatQty(line.stock)} {line.baseUnit}
          </div>
        )}
      </TableCell>
      <TableCell className="px-2 py-2">
        <UnitSelect options={line.options} value={line.unitId} onChange={(unitId) => dispatch({ type: 'setUnit', key: line.key, unitId })} />
      </TableCell>
      <TableCell className="px-2 py-2">
        <CommitInput aria-label="Số lượng" value={line.qty} onCommit={(qty) => update({ qty })} onEnter={onDone} className="w-20 text-center" />
      </TableCell>
      <TableCell className="px-2 py-2">
        <CommitInput aria-label="Giá trả" money value={line.unitPrice} onCommit={(unitPrice) => update({ unitPrice })} onEnter={onDone} className="w-32" />
      </TableCell>
      <TableCell className="px-2 py-2 text-right font-semibold tabular-nums">{formatMoney(importLineAmount(line.qty, line.unitPrice))}</TableCell>
      <TableCell className="py-2 pr-2">
        <Button variant="ghost" size="icon-lg" className="size-11" aria-label="Xóa dòng" onClick={() => dispatch({ type: 'remove', key: line.key })}>
          <Trash2 />
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function SupplierReturnLinesTable({ lines, dispatch, onDone }: Props) {
  if (!lines.length)
    return <EmptyState icon={PackageMinus} title="Phiếu trả trống" description="Quét mã vạch hoặc gõ tên hàng cần trả để thêm dòng." />;
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <TableHead className="px-4">Sản phẩm</TableHead>
          <TableHead className="w-40 px-2">Đơn vị</TableHead>
          <TableHead className="w-24 px-2">Số lượng</TableHead>
          <TableHead className="w-36 px-2 text-right">Giá trả</TableHead>
          <TableHead className="w-32 px-2 text-right">Thành tiền</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((l) => (
          <LineRow key={l.key} line={l} dispatch={dispatch} onDone={onDone} />
        ))}
      </TableBody>
    </Table>
  );
}
