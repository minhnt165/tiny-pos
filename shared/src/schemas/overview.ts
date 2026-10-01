// Trang Tổng quan (0.10.0): chỉ hằng số, API không có query.

/** Khách còn nợ mà giao dịch sổ nợ gần nhất cách hôm nay từ số ngày này trở lên thì coi là nợ lâu. */
export const DEBT_OVERDUE_DAYS = 30;
/** Số hóa đơn hôm nay hiện trên Tổng quan. */
export const OVERVIEW_RECENT_ORDERS = 5;
/** Số mặt hàng sắp hết hiện trên Tổng quan. */
export const OVERVIEW_LOW_STOCK_ROWS = 10;
/** Số khách / nhà cung cấp nợ nhiều nhất hiện trên Tổng quan. */
export const OVERVIEW_TOP_PARTIES = 5;
/** Quá số ngày này chưa có bản sao lưu nào thì cảnh báo. */
export const BACKUP_STALE_DAYS = 2;
