import { formatQty, type MovementType, type Product } from '@tiny-pos/shared';
import { useMovements } from '@/api/products';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const TYPE_LABEL: Record<MovementType, string> = { sale: 'Bán', return: 'Trả', import: 'Nhập', adjust: 'Điều chỉnh' };
const pad = (n: number) => String(n).padStart(2, '0');
const when = (iso: string) => {
  const d = new Date(iso);
  // Bỏ năm nếu là năm nay để bảng gọn trên điện thoại.
  const year = d.getFullYear() === new Date().getFullYear() ? '' : `/${d.getFullYear()}`;
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}${year}`;
};

/** Ghi chú bỏ mã chứng từ (đã hiện riêng) và chữ "Nhập" thừa: "Hủy PN-…" → "Hủy". */
const extraNote = (note: string | null, refCode: string | null) => {
  const rest = (refCode && note ? note.replace(refCode, '') : note ?? '').trim();
  return rest === 'Nhập' ? '' : rest;
};

/** 100 lần thay đổi tồn gần nhất của một sản phẩm. */
export function StockHistoryDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { data = [], isLoading } = useMovements(product?.id ?? null);
  // Dialog render qua portal nhưng sự kiện React (bấm nền mờ, nút X, nội dung) vẫn nổi bọt lên dòng/thẻ sản phẩm (onClick = mở form sửa);
  // DialogContent không bao được lớp nền mờ (anh em trong portal) nên chặn ở phần tử bọc ngoài.
  return (
    <span className="contents" onClick={(e) => e.stopPropagation()}>
      <Dialog open={product !== null} onOpenChange={(o) => !o && onClose()}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle className="pr-8 text-xl">Lịch sử tồn – {product?.name}</DialogTitle>
            <DialogDescription className="text-base">
              Tồn hiện tại: {product && `${formatQty(product.stock)} ${product.unit}`}
            </DialogDescription>
          </DialogHeader>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : data.length ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="px-2">Thời gian</TableHead>
                  <TableHead className="px-2 text-right">Số lượng</TableHead>
                  <TableHead className="px-2">Chi tiết</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="px-2 py-2 tabular-nums">{when(m.createdAt)}</TableCell>
                    <TableCell className={cn('px-2 py-2 text-right font-semibold tabular-nums', m.qty > 0 ? 'text-success' : 'text-destructive')}>
                      {m.qty > 0 ? '+' : ''}
                      {formatQty(m.qty)}
                    </TableCell>
                    <TableCell className="px-2 py-2 whitespace-normal">
                      <Badge variant="secondary" className="mr-2">{TYPE_LABEL[m.type]}</Badge>
                      {m.refCode && <span className="mr-2 font-mono break-all">{m.refCode}</span>}
                      <span className="text-muted-foreground">{extraNote(m.note, m.refCode)}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground">Chưa có thay đổi tồn nào.</p>
          )}
        </DialogContent>
      </Dialog>
    </span>
  );
}
