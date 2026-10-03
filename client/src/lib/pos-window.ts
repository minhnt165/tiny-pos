/** Tên cửa sổ quầy: mở lại thì trình duyệt đưa cửa sổ cũ lên thay vì tạo thêm. */
const POS_WINDOW = 'tiny-pos-quay';

/**
 * Mở Bán hàng toàn màn hình (/pos) trong cửa sổ riêng. Mở từ cửa sổ ứng dụng của máy quầy thì cửa sổ mới cùng hồ sơ trình duyệt:
 * vẫn in hóa đơn không hỏi (--kiosk-printing), dùng chung giỏ và đơn chờ. Trả về false nếu trình duyệt chặn cửa sổ mới.
 */
export function openPosWindow(): boolean {
  const { availWidth: w, availHeight: h } = window.screen;
  const win = window.open('/pos', POS_WINDOW, `popup,left=0,top=0,width=${w},height=${h}`);
  win?.focus();
  return !!win;
}
