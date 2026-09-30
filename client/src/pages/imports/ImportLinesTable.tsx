import type { Dispatch } from 'react';
import { PackageOpen } from 'lucide-react';
import type { DraftAction, DraftLine } from '@tiny-pos/shared';
import { EmptyState } from '@/components/EmptyState';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ImportLineRow } from './ImportLineRow';

interface Props {
  lines: DraftLine[];
  dispatch: Dispatch<DraftAction>;
  onDone: () => void;
}

export function ImportLinesTable({ lines, dispatch, onDone }: Props) {
  if (!lines.length)
    return <EmptyState icon={PackageOpen} title="Phiếu nhập trống" description="Quét mã vạch hoặc gõ tên sản phẩm để thêm dòng." />;
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <TableHead className="px-4">Sản phẩm</TableHead>
          <TableHead className="px-2">Đơn vị</TableHead>
          <TableHead className="px-2">Số lượng</TableHead>
          <TableHead className="px-2 text-right">Giá nhập</TableHead>
          <TableHead className="px-2 text-right">Thành tiền</TableHead>
          <TableHead className="px-2 text-right">Giá bán</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {lines.map((l) => (
          <ImportLineRow key={l.key} line={l} dispatch={dispatch} onDone={onDone} />
        ))}
      </TableBody>
    </Table>
  );
}
