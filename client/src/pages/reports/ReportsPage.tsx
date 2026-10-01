import { REPORT_TABS, reportViewFields, resolveReportRange, validRange, type ReportTab } from '@tiny-pos/shared';
import { queryString } from '@/api/client';
import { DateRangeFilter, rangeChipLabel } from '@/components/filters/DateRangeFilter';
import { PageTitle } from '@/components/layout/PageTitle';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useExportAction } from '@/hooks/useExportAction';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { today as todayOf } from '@/lib/today';
import { DebtTab } from './DebtTab';
import { ProductsTab } from './ProductsTab';
import { ProfitTab } from './ProfitTab';

const TAB_LABEL: Record<ReportTab, string> = { profit: 'Lãi lỗ', products: 'Mặt hàng', debt: 'Công nợ' };

/** Báo cáo theo khoảng ngày (mặc định tháng này), ba thẻ; khoảng, thẻ và kiểu sắp xếp lưu trên URL. */
export function ReportsPage() {
  const { filters: f, set } = useUrlFilters(reportViewFields);
  const today = todayOf();
  const thisMonth = resolveReportRange({}, today);
  const picked = resolveReportRange(f, today);
  // Khoảng sai trên URL (sửa tay) thì về tháng này, không báo lỗi
  const range = validRange(picked.from, picked.to) ? picked : thisMonth;
  // Xuất đúng khoảng/sort màn hình đang dùng (URL sửa tay sai đã được thay bằng mặc định), không gửi URL thô
  const exportAction = useExportAction(`/reports/${f.tab}/export.xlsx`, queryString({ ...range, sort: f.sort }));
  return (
    <>
      <PageTitle title="Báo cáo" count={rangeChipLabel(range.from, range.to, today)} actions={[exportAction]} />
      <section className="mb-(--gap) rounded-lg border bg-card p-3">
        <DateRangeFilter
          from={range.from}
          to={range.to}
          today={today}
          // Tháng này không ghi vào URL: sang tháng sau mở lại vẫn là "tháng này"
          onChange={(r) => set(r.from === thisMonth.from && r.to === thisMonth.to ? { from: undefined, to: undefined } : r)}
        />
      </section>
      <Tabs value={f.tab} onValueChange={(v) => set({ tab: v as ReportTab })} className="mb-(--gap)">
        <TabsList className="h-11 w-full md:h-9 md:w-fit">
          {REPORT_TABS.map((t) => (
            <TabsTrigger key={t} value={t} className="px-4 text-base md:text-sm">
              {TAB_LABEL[t]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {f.tab === 'profit' && <ProfitTab range={range} />}
      {f.tab === 'products' && <ProductsTab range={range} sort={f.sort} onSort={(sort) => set({ sort })} />}
      {f.tab === 'debt' && <DebtTab range={range} />}
    </>
  );
}
