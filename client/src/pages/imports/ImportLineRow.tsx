import type { Dispatch } from 'react';
import { Trash2 } from 'lucide-react';
import { currentOption, formatMoney, formatQty, importLineAmount, marginPercent, type DraftAction, type DraftLine } from '@tiny-pos/shared';
import { CommitInput } from '@/components/CommitInput';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

/** Radix không cho SelectItem value rỗng: đơn vị gốc dùng giá trị thay thế. */
const BASE = '__base__';

interface Props {
  line: DraftLine;
  dispatch: Dispatch<DraftAction>;
  onDone: () => void;
}

export function ImportLineRow({ line, dispatch, onDone }: Props) {
  const opt = currentOption(line);
  const margin = marginPercent(line.sellPrice, line.unitCost);
  const update = (patch: Partial<Pick<DraftLine, 'qty' | 'unitCost' | 'sellPrice'>>) => dispatch({ type: 'update', key: line.key, patch });

  return (
    <TableRow>
      <TableCell className="px-4 py-2 whitespace-normal">
        <div className="font-medium">{line.name}</div>
        {!line.isActive && <Badge variant="secondary">Ngừng bán</Badge>}
      </TableCell>
      <TableCell className="px-2 py-2">
        {line.options.length > 1 ? (
          <Select
            value={line.unitId === null ? BASE : String(line.unitId)}
            onValueChange={(v) => dispatch({ type: 'setUnit', key: line.key, unitId: v === BASE ? null : Number(v) })}
          >
            <SelectTrigger aria-label="Đơn vị" className="h-11 w-36 text-base data-[size=default]:h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {line.options.map((o) => (
                <SelectItem key={o.id ?? BASE} value={o.id === null ? BASE : String(o.id)} className="py-2 text-base">
                  {o.name}
                  {o.factor !== 1 && ` (${formatQty(o.factor)})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="px-2">{opt.name}</span>
        )}
      </TableCell>
      <TableCell className="px-2 py-2">
        <CommitInput aria-label="Số lượng" value={line.qty} onCommit={(qty) => update({ qty })} onEnter={onDone} className="w-20 text-center" />
      </TableCell>
      <TableCell className="px-2 py-2">
        <CommitInput aria-label="Giá nhập" money value={line.unitCost} onCommit={(unitCost) => update({ unitCost })} onEnter={onDone} className="w-32" />
      </TableCell>
      <TableCell className="px-2 py-2 text-right font-semibold tabular-nums">{formatMoney(importLineAmount(line.qty, line.unitCost))}</TableCell>
      <TableCell className="px-2 py-2">
        <CommitInput aria-label="Giá bán" money value={line.sellPrice} onCommit={(sellPrice) => update({ sellPrice })} onEnter={onDone} className="w-32" />
        <div className={cn('mt-0.5 text-right text-xs tabular-nums', margin !== null && margin < 0 ? 'text-destructive' : 'text-muted-foreground')}>
          {margin === null ? 'chưa có giá nhập' : `lãi ${String(margin).replace('.', ',')}%`}
          {line.sellPrice !== opt.sellPrice && ' · giá mới'}
        </div>
      </TableCell>
      <TableCell className="py-2 pr-2">
        <Button variant="ghost" size="icon-lg" className="size-11" aria-label="Xóa dòng" onClick={() => dispatch({ type: 'remove', key: line.key })}>
          <Trash2 />
        </Button>
      </TableCell>
    </TableRow>
  );
}
