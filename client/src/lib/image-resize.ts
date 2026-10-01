const FAIL = 'Không đọc được ảnh';

/**
 * Thu nhỏ ảnh về JPEG cạnh dài ≤ `max`, giữ chiều xoay theo EXIF (ảnh chụp dọc không bị nằm ngang).
 * Luôn vẽ lại kể cả ảnh đã nhỏ: chuẩn hóa JPEG và bỏ EXIF/GPS. Trình duyệt không hỗ trợ `imageOrientation` thì bỏ qua option.
 */
export async function resizeImage(file: Blob, max = 512, quality = 0.82): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(FAIL);
  }
  try {
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error(FAIL);
    // PNG trong suốt → nền trắng (JPEG không có trong suốt, mặc định sẽ ra đen)
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) throw new Error(FAIL);
    return blob;
  } finally {
    bitmap.close();
  }
}
