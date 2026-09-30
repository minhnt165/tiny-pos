import { useState } from 'react';
import { Ban, History, MoreHorizontal, Pencil, RotateCcw } from 'lucide-react';
import { formatMoney, type Product } from '@tiny-pos/shared';
import { ProductAvatar } from '@/components/ProductAvatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { StockHistoryDialog } from './StockHistoryDialog';

interface Props {
  products: Product[];
  onEdit: (p: Product) => void;
  onToggle: (p: Product) => void;
}

export function StockCell({ p }: { p: Product }) {
  const low = p.stock < p.minStock;
  return (
    <div className="flex items-center justify-end gap-2 tabular-nums">
      <span className={cn('font-semibold', low && 'text-destructive')}>{p.stock}</span>
      <span className="text-sm text-muted-foreground">{p.unit}</span>
      {low && <Badge variant="destructive">Sắp hết</Badge>}
    </div>
  );
}

/** Menu thao tác của một sản phẩm (Sửa / Lịch sử tồn / Ngừng bán / Bán lại). */
export function ProductMenu({ p, onEdit, onToggle }: { p: Product; onEdit: () => void; onToggle: () => void }) {
  const [history, setHistory] = useState(false);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-lg" aria-label="Thao tác" title="Thao tác" onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil />
          Sửa sản phẩm
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setHistory(true)}>
          <History />
          Lịch sử tồn
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant={p.isActive ? 'destructive' : 'default'} onSelect={onToggle}>
          {p.isActive ? <Ban /> : <RotateCcw />}
          {p.isActive ? 'Ngừng bán' : 'Bán lại'}
        </DropdownMenuItem>
      </DropdownMenuContent>
      <StockHistoryDialog product={history ? p : null} onClose={() => setHistory(false)} />
    </DropdownMenu>
  );
}

/** Bảng sản phẩm cho màn hình rộng; bấm vào hàng để sửa. */
export function ProductTable({ products, onEdit, onToggle }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <TableHead className="px-4">Sản phẩm</TableHead>
          <TableHead className="px-4">Mã vạch</TableHead>
          <TableHead className="px-4 text-right">Giá bán</TableHead>
          <TableHead className="px-4 text-right">Tồn kho</TableHead>
          <TableHead className="w-px px-2" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((p) => (
          <TableRow
            key={p.id}
            className={cn('cursor-pointer text-base', !p.isActive && 'opacity-60')}
            onClick={() => onEdit(p)}
            title="Bấm để sửa"
          >
            <TableCell className="px-4 py-3">
              <div className="flex items-center gap-3">
                <ProductAvatar name={p.name} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 font-medium">
                    <span className="truncate">{p.name}</span>
                    {!p.isActive && <Badge variant="secondary">Ngừng bán</Badge>}
                    {p.isWeighed && <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">Hàng cân</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {p.categoryName ?? 'Không danh mục'} · {p.unit}
                  </div>
                </div>
              </div>
            </TableCell>
            <TableCell className="px-4 py-3">
              {p.barcode ? (
                <code className="rounded-md bg-muted px-2 py-1 font-mono text-sm">{p.barcode}</code>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="px-4 py-3 text-right font-semibold tabular-nums">{formatMoney(p.sellPrice)}</TableCell>
            <TableCell className="px-4 py-3">
              <StockCell p={p} />
            </TableCell>
            <TableCell className="px-2 py-2">
              <ProductMenu p={p} onEdit={() => onEdit(p)} onToggle={() => onToggle(p)} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
