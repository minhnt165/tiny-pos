import { useState } from 'react';
import { PackagePlus, PackageOpen } from 'lucide-react';
import { formatMoney } from '@tiny-pos/shared';
import { useImports } from '@/api/imports';
import { DayPicker, today } from '@/components/DayPicker';
import { EmptyState } from '@/components/EmptyState';
import { PageTitle } from '@/components/layout/PageTitle';
import { ListPanel } from '@/components/ListPanel';
import { Stat, StatStrip } from '@/components/StatStrip';
import { TableSkeleton } from '@/components/TableSkeleton';
import { ImportDetailDialog } from './ImportDetailDialog';
import { ImportTable } from './ImportTable';

export function ImportsPage() {
  const [date, setDate] = useState(today);
  const [openId, setOpenId] = useState<number | null>(null);
  const { data, isLoading } = useImports(date);
  const s = data?.summary;

  return (
    <>
      <PageTitle
        title="Nhập hàng"
        count={s ? `${s.count} phiếu` : undefined}
        actions={[{ label: 'Tạo phiếu nhập', icon: PackagePlus, to: '/imports/new', primary: true }]}
      />
      <StatStrip cols={3}>
        <Stat label="Số phiếu" value={String(s?.count ?? 0)} hint="Không tính phiếu đã hủy" />
        <Stat label="Tổng nhập" value={formatMoney(s?.total ?? 0)} />
        <Stat label="Đã trả" value={formatMoney(s?.paid ?? 0)} />
      </StatStrip>
      <ListPanel toolbar={<DayPicker value={date} onChange={setDate} />}>
        {isLoading ? (
          <TableSkeleton rows={3} />
        ) : data?.imports.length ? (
          <ImportTable imports={data.imports} onOpen={setOpenId} />
        ) : (
          <EmptyState icon={PackageOpen} title="Chưa có phiếu nhập" description="Ngày này chưa nhập hàng. Hủy phiếu sẽ trừ lại kho." />
        )}
      </ListPanel>
      <ImportDetailDialog id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
