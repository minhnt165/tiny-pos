import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { ProductWithUnits } from '@tiny-pos/shared';
import { useDeleteProductImage, useSaveProductImage } from '@/api/products';
import { resizeImage } from '@/lib/image-resize';

/**
 * Ảnh trong form sản phẩm. Đang sửa: chọn là gửi ngay (giống đơn vị quy đổi). Đang thêm: giữ tạm, `flush` sau khi tạo xong.
 * `product` khi sửa lấy từ useProduct(id) nên sau khi lưu/xóa ảnh (invalidate) tự cập nhật.
 */
export function useProductImage(open: boolean, product: ProductWithUnits | null | undefined) {
  const [pending, setPending] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Đang gửi ảnh tạm sau khi tạo sản phẩm: form phải khóa nút Lưu, không thì bấm lần hai tạo trùng sản phẩm
  const [flushing, setFlushing] = useState(false);
  const save = useSaveProductImage();
  const del = useDeleteProductImage();
  const productId = product?.id ?? null;

  const clearPending = () => {
    setPending(null);
    setPreview((u) => {
      if (u) URL.revokeObjectURL(u);
      return null;
    });
  };
  useEffect(() => {
    clearPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, productId]);

  const pick = async (file: File) => {
    setBusy(true);
    try {
      const blob = await resizeImage(file);
      if (productId) {
        await save.mutateAsync({ id: productId, file: blob });
        toast.success('Đã lưu ảnh');
      } else {
        clearPending();
        setPending(blob);
        setPreview(URL.createObjectURL(blob));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không đọc được ảnh');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!productId) return clearPending();
    setBusy(true);
    try {
      await del.mutateAsync({ id: productId });
      toast.success('Đã xóa ảnh');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lỗi');
    } finally {
      setBusy(false);
    }
  };

  /** Sau khi tạo sản phẩm mới: gửi ảnh đang giữ tạm. Lỗi thì sản phẩm vẫn đã tạo, báo riêng. */
  const flush = async (created: ProductWithUnits): Promise<ProductWithUnits> => {
    if (!pending) return created;
    setFlushing(true);
    try {
      return await save.mutateAsync({ id: created.id, file: pending });
    } catch (e) {
      toast.error(`Đã thêm sản phẩm nhưng chưa lưu được ảnh: ${e instanceof Error ? e.message : 'lỗi'}`);
      return created;
    } finally {
      setFlushing(false);
    }
  };

  /** `pendingUrl`: object URL của ảnh đang giữ tạm (thêm mới); đang sửa thì form vẽ `ProductAvatar` từ `product.image`. */
  return { pendingUrl: preview, hasImage: !!(preview ?? product?.image), busy: busy || flushing, pick, remove, flush };
}
