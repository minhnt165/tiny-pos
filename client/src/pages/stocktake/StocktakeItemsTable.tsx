import { Pencil, Trash2 } from 'lucide-react';
import { formatQty, type StocktakeItem } from '@tiny-pos/shared';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface Props {
  items: StocktakeItem[];
  onEdit?: (i: StocktakeItem) => void;
  onRemove?: (i: StocktakeItem) => void;
}

export function DiffText({ diff, unit }: { diff: number; unit: string }) {
  return (
    <span className={cn('font-semibold tabular-nums', diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-destructive' : 'text-muted-foreground')}>
      {diff > 0 ? '+' : ''}
      {formatQty(diff)} {unit}
    </span>
  );
}

/** Bảng món đã đếm; không truyền onEdit/onRemove thì chỉ đọc. */
export function StocktakeItemsTable({ items, onEdit, onRemove }: Props) {
  const editable = !!onEdit || !!onRemove;
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <TableHead className="px-4">Sản phẩm</TableHead>
          <TableHead className="px-4 text-right">Tồn máy</TableHead>
          <TableHead className="px-4 text-right">Đếm được</TableHead>
          <TableHead className="px-4 text-right">Lệch</TableHead>
          {editable && <TableHead className="w-28" />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((i) => (
          <TableRow key={i.productId}>
            <TableCell className="px-4 py-2 font-medium whitespace-normal">{i.productName}</TableCell>
            <TableCell className="px-4 py-2 text-right tabular-nums">{formatQty(i.expected)}</TableCell>
            <TableCell className="px-4 py-2 text-right tabular-nums">{formatQty(i.counted)}</TableCell>
            <TableCell className="px-4 py-2 text-right">
              <DiffText diff={i.diff} unit={i.unit} />
            </TableCell>
            {editable && (
              <TableCell className="py-2 pr-2 text-right">
                {onEdit && (
                  <Button variant="ghost" size="icon-lg" className="size-11" aria-label="Sửa số đếm" onClick={() => onEdit(i)}>
                    <Pencil />
                  </Button>
                )}
                {onRemove && (
                  <Button variant="ghost" size="icon-lg" className="size-11" aria-label="Bỏ món" onClick={() => onRemove(i)}>
                    <Trash2 />
                  </Button>
                )}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
