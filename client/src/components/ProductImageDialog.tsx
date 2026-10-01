import { productImageUrl } from '@/api/products';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Props {
  product: { name: string; image: string | null } | null;
  onClose: () => void;
}

/** Xem ảnh sản phẩm cỡ lớn (ảnh gốc 512px). Đặt ngoài hàng/thẻ: click trong portal vẫn lan theo cây React. */
export function ProductImageDialog({ product, onClose }: Props) {
  const src = productImageUrl(product?.image);
  return (
    <Dialog open={!!product && !!src} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{product?.name}</DialogTitle>
          <DialogDescription>Ảnh sản phẩm</DialogDescription>
        </DialogHeader>
        {src && <img src={src} alt={product?.name} className="mx-auto max-h-[70vh] rounded-lg object-contain" />}
      </DialogContent>
    </Dialog>
  );
}
