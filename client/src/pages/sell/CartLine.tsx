import { useEffect, useState, type FocusEvent, type KeyboardEvent } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { formatMoney, formatQty, lineAmount, parseVnNumber, type CartLine as Line } from '@tiny-pos/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TableCell, TableRow } from '@/components/ui/table';
import { groupThousands, moneyChange } from '@/lib/money-input';

interface Props {
  line: Line;
  /** Tồn hiện có nếu giỏ đang vượt tồn. */
  shortStock?: number;
  onQty: (qty: number) => void;
  onPrice: (price: number) => void;
  onRemove: () => void;
  onEditWeight: () => void;
  /** Gọi sau Enter để đưa focus về ô quét. */
  onDone: () => void;
}

/** Bản nháp của ô sửa nhanh; đồng bộ lại khi giá trị thật đổi (ví dụ bấm +). */
function useDraft(value: string) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return [draft, setDraft] as const;
}

const selectAll = (e: FocusEvent<HTMLInputElement>) => e.target.select();

export function CartLine({ line, shortStock, onQty, onPrice, onRemove, onEditWeight, onDone }: Props) {
  const [qty, setQty] = useDraft(formatQty(line.qty));
  const [price, setPrice] = useDraft(groupThousands(String(line.price)));

  // Blur chỉ ghi giá trị; Enter ghi rồi trả focus về ô quét (blur không kéo focus để còn bấm sang ô khác)
  // Ô trống (hoặc chỉ có khoảng trắng) = chưa nhập gì: trả lại giá trị cũ, không ghi 0 (qty 0 xóa dòng, giá 0 bán miễn phí)
  const commitQty = () => {
    if (!qty.trim()) return setQty(formatQty(line.qty));
    const n = parseVnNumber(qty);
    if (Number.isFinite(n) && n >= 0) onQty(n);
    else setQty(formatQty(line.qty));
  };
  const commitPrice = () => {
    if (!price.trim()) return setPrice(groupThousands(String(line.price)));
    const n = parseVnNumber(price);
    if (Number.isFinite(n) && n >= 0) onPrice(Math.round(n));
    else setPrice(groupThousands(String(line.price)));
  };
  const onEnter = (commit: () => void) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    commit();
    onDone();
  };

  return (
    <TableRow>
      <TableCell className="px-4 py-2 whitespace-normal">
        <div className="font-medium">{line.name}</div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {line.unitName}
          {line.factor !== 1 && ` (= ${formatQty(line.factor)})`}
          {shortStock !== undefined && (
            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
              Tồn còn {formatQty(shortStock)}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="px-2 py-2">
        {line.isWeighed ? (
          <Button variant="outline" className="h-11 min-w-28 tabular-nums" onClick={onEditWeight}>
            {formatQty(line.qty)} {line.unitName}
          </Button>
        ) : (
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-lg" className="size-11" aria-label="Bớt 1" onClick={() => onQty(line.qty - 1)}>
              <Minus />
            </Button>
            <Input
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              onBlur={commitQty}
              onKeyDown={onEnter(commitQty)}
              onFocus={selectAll}
              inputMode="decimal"
              className="h-11 w-16 text-center text-base tabular-nums"
              aria-label="Số lượng"
            />
            <Button variant="outline" size="icon-lg" className="size-11" aria-label="Thêm 1" onClick={() => onQty(line.qty + 1)}>
              <Plus />
            </Button>
          </div>
        )}
      </TableCell>
      <TableCell className="px-2 py-2">
        <Input
          value={price}
          onChange={moneyChange(setPrice)}
          onBlur={commitPrice}
          onKeyDown={onEnter(commitPrice)}
          onFocus={selectAll}
          inputMode="numeric"
          className="h-11 w-28 text-right text-base tabular-nums"
          aria-label="Đơn giá"
        />
      </TableCell>
      <TableCell className="px-4 py-2 text-right text-base font-semibold tabular-nums">{formatMoney(lineAmount(line))}</TableCell>
      <TableCell className="py-2 pr-2">
        <Button variant="ghost" size="icon-lg" className="size-11" aria-label="Xóa dòng" onClick={onRemove}>
          <Trash2 />
        </Button>
      </TableCell>
    </TableRow>
  );
}
