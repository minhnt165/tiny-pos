import { formatDateVn, type ProductReportQuery, type ReportQuery } from '@tiny-pos/shared';
import type { Db } from '../db/connection.js';
import type { XlsxValue } from '../xlsx/workbook.js';
import { resolveClock, type Clock } from './daily-code.js';
import { build, col, rangeName, type XlsxFile } from './exports.js';
import { debtReport, productReport, profitReport } from './reports.js';

const TOTAL = 'Tổng';
/** Kỳ ghi chữ (không phải ô ngày) vì một ô có thể là tháng: "dd/mm/yyyy" hoặc "mm/yyyy". */
const periodLabel = (p: string) => (p.length === 7 ? `${p.slice(5, 7)}/${p.slice(0, 4)}` : formatDateVn(p));

const PROFIT_COLUMNS = [
  col('Kỳ', 12),
  col('Số đơn', 8, 'qty'),
  col('Doanh thu', 14, 'money'),
  col('Trả hàng', 14, 'money'),
  col('Giá vốn', 14, 'money'),
  col('Lãi gộp', 14, 'money'),
  col('Tiền mặt', 14, 'money'),
  col('Chuyển khoản', 14, 'money'),
  col('Ghi nợ', 14, 'money'),
  col('Thu nợ TM', 14, 'money'),
  col('Thu nợ CK', 14, 'money'),
];

export async function exportProfitReportXlsx(db: Db, q: ReportQuery, clock?: Clock): Promise<XlsxFile> {
  const { now, tz } = resolveClock(clock);
  const r = profitReport(db, q, { now, tzOffsetMin: tz });
  const row = (label: string, x: typeof r.total): XlsxValue[] => [label, x.orders, x.revenue, x.returns, x.cost, x.profit, x.cash, x.transfer, x.debt,
    x.debtCollected.cash, x.debtCollected.transfer];
  const rows = [...r.rows.map((x) => row(periodLabel(x.period), x)), row(TOTAL, r.total)];
  return build(rangeName('bao-cao-lai-lo', r.range.from, r.range.to), [{ name: 'Lãi lỗ', columns: PROFIT_COLUMNS, rows }], tz);
}

const TOP_COLUMNS = [col('Mặt hàng', 32), col('Đơn vị', 10), col('Số lượng', 12, 'qty'), col('Doanh thu', 14, 'money'), col('Lãi', 14, 'money')];
const SLOW_COLUMNS = [col('Mặt hàng', 32), col('Đơn vị', 10), col('Tồn', 12, 'qty'), col('Giá trị tồn', 14, 'money')];
const STOCK_COLUMNS = [col('Chỉ tiêu', 28), col('Giá trị', 16, 'money')];

export async function exportProductReportXlsx(db: Db, q: ProductReportQuery, clock?: Clock): Promise<XlsxFile> {
  const { now, tz } = resolveClock(clock);
  const r = productReport(db, q, { now, tzOffsetMin: tz }, Infinity); // file xuất đủ, không cắt 50
  return build(
    rangeName('bao-cao-mat-hang', r.range.from, r.range.to),
    [
      { name: 'Bán chạy', columns: TOP_COLUMNS, rows: r.topSelling.map((x) => [x.name, x.unit, x.qty, x.revenue, x.profit]) },
      { name: 'Không bán được', columns: SLOW_COLUMNS, rows: r.slow.map((x) => [x.name, x.unit, x.stock, x.value]) },
      {
        name: 'Tồn kho',
        columns: STOCK_COLUMNS,
        rows: [
          ['Tồn kho theo giá vốn', r.stock.costValue],
          ['Tồn kho theo giá bán', r.stock.sellValue],
          ['Số mặt hàng sắp hết', r.stock.lowCount],
          ['Số mặt hàng hết hàng', r.stock.outCount],
        ],
      },
    ],
    tz,
  );
}

const partyColumns = (debtHeader: string) => [col('Tên', 28), col('SĐT', 14, 'code'), col(debtHeader, 14, 'money')];
const partyRows = (p: { total: number; top: { name: string; phone: string | null; debt: number }[] }): XlsxValue[][] => [
  ...p.top.map((x) => [x.name, x.phone, x.debt]),
  [TOTAL, null, p.total],
];

export async function exportDebtReportXlsx(db: Db, q: ReportQuery, clock?: Clock): Promise<XlsxFile> {
  const { now, tz } = resolveClock(clock);
  const r = debtReport(db, q, { now, tzOffsetMin: tz }, Infinity); // đủ mọi người đang nợ
  return build(
    rangeName('bao-cao-cong-no', r.range.from, r.range.to),
    [
      { name: 'Khách nợ', columns: partyColumns('Đang nợ'), rows: partyRows(r.customers) },
      { name: 'Nợ NCC', columns: partyColumns('Còn nợ'), rows: partyRows(r.suppliers) },
    ],
    tz,
  );
}
