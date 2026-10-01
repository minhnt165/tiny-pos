import { Package } from 'lucide-react';
import { Link } from 'react-router';
import { formatMoney, formatQty, PRODUCT_REPORT_SORTS, type ProductReportSort, type ProductSalesRow, type SlowProductRow } from '@tiny-pos/shared';
import { useProductReport, type ReportRangeParams } from '@/api/reports';
import { EmptyState } from '@/components/EmptyState';
import { ChoiceChips } from '@/components/filters/ChoiceChips';
import { ListPanel } from '@/components/ListPanel';
import { Stat, StatStrip } from '@/components/StatStrip';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const SORT_LABEL: Record<ProductReportSort, string> = { revenue: 'Doanh thu', qty: 'Số lượng', profit: 'Lãi' };
const SORT_OPTIONS = PRODUCT_REPORT_SORTS.map((s) => ({ value: s, label: SORT_LABEL[s] }));
// Điện thoại hẹp: đệm ô nhỏ hơn, tên hàng dài bị cắt '…' để 4 cột vẫn nằm trong màn hình
const NUM = 'px-3 py-3 text-right tabular-nums whitespace-nowrap md:px-4';
const NAME = 'max-w-40 truncate px-3 py-3 font-medium md:max-w-none md:px-4';
const MOBILE_HIDDEN = 'hidden md:table-cell';
const HEAD_CELL = 'px-3 md:px-4';
const HEAD = 'bg-muted/40 hover:bg-muted/40';
/** Ô số liệu bấm được: bọc Stat bằng Link, vòng focus như nút. */
const LINK = 'block rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50';

function TopSellingTable({
  rows,
  total,
  sort,
}: {
  rows: ProductSalesRow[];
  total: { count: number; qty: number; revenue: number; profit: number };
  sort: ProductReportSort;
}) {
  // Điện thoại chỉ đủ 3 cột: tên, số lượng và cột tiền đang xếp theo (Lãi khi xếp theo Lãi, còn lại Doanh thu)
  const revenueCls = sort === 'profit' ? MOBILE_HIDDEN : '';
  const profitCls = sort === 'profit' ? '' : MOBILE_HIDDEN;
  return (
    <Table>
      <TableHeader>
        <TableRow className={HEAD}>
          <TableHead className={HEAD_CELL}>Mặt hàng</TableHead>
          <TableHead className={`${HEAD_CELL} text-right`}>Số lượng</TableHead>
          <TableHead className={`${HEAD_CELL} text-right ${revenueCls}`}>Doanh thu</TableHead>
          <TableHead className={`${HEAD_CELL} text-right ${profitCls}`}>Lãi</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.productId ?? 'custom'}>
            <TableCell className={NAME} title={r.name}>{r.name}</TableCell>
            <TableCell className={NUM}>
              {formatQty(r.qty)} <span className="text-muted-foreground">{r.unit}</span>
            </TableCell>
            <TableCell className={`${NUM} ${revenueCls}`}>{formatMoney(r.revenue)}</TableCell>
            <TableCell className={`${NUM} ${profitCls} ${r.profit < 0 ? 'text-destructive' : ''}`}>{formatMoney(r.profit)}</TableCell>
          </TableRow>
        ))}
        <TableRow className={`${HEAD} font-semibold`}>
          <TableCell className="px-3 py-3 md:px-4">Tổng {total.count} mặt hàng</TableCell>
          <TableCell className={NUM}>{formatQty(total.qty)}</TableCell>
          <TableCell className={`${NUM} ${revenueCls}`}>{formatMoney(total.revenue)}</TableCell>
          <TableCell className={`${NUM} ${profitCls}`}>{formatMoney(total.profit)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

function SlowTable({ rows }: { rows: SlowProductRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className={HEAD}>
          <TableHead className={HEAD_CELL}>Mặt hàng</TableHead>
          <TableHead className={`${HEAD_CELL} text-right`}>Tồn</TableHead>
          <TableHead className={`${HEAD_CELL} text-right`}>Giá trị tồn</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.productId}>
            <TableCell className={NAME} title={r.name}>{r.name}</TableCell>
            <TableCell className={NUM}>
              {formatQty(r.stock)} <span className="text-muted-foreground">{r.unit}</span>
            </TableCell>
            <TableCell className={NUM}>{formatMoney(r.value)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function ProductsTab({ range, sort, onSort }: { range: ReportRangeParams; sort: ProductReportSort; onSort: (s: ProductReportSort) => void }) {
  const { data, isLoading } = useProductReport({ ...range, sort });
  const st = data?.stock;
  const loading = isLoading || !data;
  return (
    <>
      <StatStrip>
        <Stat label="Tồn kho theo giá vốn" value={formatMoney(st?.costValue ?? 0)} hint="Hiện tại, hàng đang bán" />
        <Stat label="Tồn kho theo giá bán" value={formatMoney(st?.sellValue ?? 0)} hint="Hiện tại, hàng đang bán" />
        <Link to="/products?stock=low" className={LINK} aria-label="Xem hàng sắp hết">
          <Stat label="Sắp hết" value={String(st?.lowCount ?? 0)} hint="Mặt hàng · bấm để xem" tone={st?.lowCount ? 'warning' : 'default'} />
        </Link>
        <Link to="/products?stock=out" className={LINK} aria-label="Xem hàng hết">
          <Stat label="Hết hàng" value={String(st?.outCount ?? 0)} hint="Mặt hàng · bấm để xem" tone={st?.outCount ? 'danger' : 'default'} />
        </Link>
      </StatStrip>
      <ListPanel
        className="mb-(--gap)"
        toolbar={
          <>
            <h2 className="text-sm font-semibold">Bán chạy</h2>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Xếp theo</span>
              <ChoiceChips<ProductReportSort> label="Xếp theo" options={SORT_OPTIONS} value={sort} onChange={(v) => v && onSort(v)} />
            </div>
          </>
        }
        footer={data && data.topSelling.length > 0 && <p className="border-t px-4 py-2 text-xs text-muted-foreground">Lãi theo mặt hàng chưa trừ giảm giá của đơn.</p>}
      >
        {loading ? (
          <TableSkeleton />
        ) : data.topSelling.length ? (
          <TopSellingTable rows={data.topSelling} total={data.topSellingTotal} sort={sort} />
        ) : (
          <EmptyState icon={Package} title="Chưa có hóa đơn trong khoảng này" />
        )}
      </ListPanel>
      <ListPanel toolbar={<h2 className="text-sm font-semibold">Không bán được trong kỳ {data ? `(${data.slowCount} mặt hàng)` : ''}</h2>}>
        {loading ? (
          <TableSkeleton />
        ) : data.slow.length ? (
          <SlowTable rows={data.slow} />
        ) : (
          <EmptyState icon={Package} title="Mọi mặt hàng còn tồn đều đã bán trong khoảng này" />
        )}
      </ListPanel>
    </>
  );
}
