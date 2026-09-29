import type { Dispatch } from 'react';
import { ShoppingCart } from 'lucide-react';
import type { Cart, CartAction, CartLine as Line } from '@tiny-pos/shared';
import { EmptyState } from '@/components/EmptyState';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CartLine } from './CartLine';

interface Props {
  cart: Cart;
  shortages: Map<number, number>;
  dispatch: Dispatch<CartAction>;
  onEditWeight: (line: Line) => void;
  onDone: () => void;
}

export function CartTable({ cart, shortages, dispatch, onEditWeight, onDone }: Props) {
  if (!cart.lines.length)
    return <EmptyState icon={ShoppingCart} title="Giỏ hàng trống" description="Quét mã vạch hoặc gõ tên sản phẩm để thêm." />;
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <TableHead className="px-4">Món</TableHead>
          <TableHead className="px-2">Số lượng</TableHead>
          <TableHead className="px-2">Đơn giá</TableHead>
          <TableHead className="px-4 text-right">Thành tiền</TableHead>
          <TableHead className="w-12" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {cart.lines.map((l) => (
          <CartLine
            key={l.key}
            line={l}
            shortStock={l.productId !== null ? shortages.get(l.productId) : undefined}
            onQty={(qty) => dispatch({ type: 'update', key: l.key, patch: { qty } })}
            onPrice={(price) => dispatch({ type: 'update', key: l.key, patch: { price } })}
            onRemove={() => dispatch({ type: 'remove', key: l.key })}
            onEditWeight={() => onEditWeight(l)}
            onDone={onDone}
          />
        ))}
      </TableBody>
    </Table>
  );
}
