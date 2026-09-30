import { useState } from 'react';
import { PackagePlus, PackageOpen, Wallet, HandCoins } from 'lucide-react';
import { Link } from 'react-router';
import { formatMoney } from '@tiny-pos/shared';
import { useImports } from '@/api/imports';
import { DayPicker, today } from '@/components/DayPicker';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ImportDetailDialog } from './ImportDetailDialog';
import { ImportTable } from './ImportTable';

export function ImportsPage() {
  const [date, setDate] = useState(today);
  const [openId, setOpenId] = useState<number | null>(null);
  const { data, isLoading } = useImports(date);
  const s = data?.summary;

  return (
    <>
      <PageHeader
        title="Nhập hàng"
        description="Phiếu nhập theo ngày; hủy phiếu sẽ trừ lại kho"
        icon={PackageOpen}
        actions={
          <>
            <DayPicker value={date} onChange={setDate} />
            <Button className="h-11 px-5 text-base" asChild>
              <Link to="/imports/new">
                <PackagePlus data-icon="inline-start" />
                Tạo phiếu nhập
              </Link>
            </Button>
          </>
        }
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard icon={PackageOpen} label="Số phiếu" value={String(s?.count ?? 0)} hint="Không tính phiếu đã hủy" />
        <StatCard icon={Wallet} label="Tổng nhập" value={formatMoney(s?.total ?? 0)} tone="info" />
        <StatCard icon={HandCoins} label="Đã trả" value={formatMoney(s?.paid ?? 0)} tone="warn" />
      </div>
      <Card className="gap-0 overflow-hidden py-0">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : data?.imports.length ? (
          <ImportTable imports={data.imports} onOpen={setOpenId} />
        ) : (
          <EmptyState icon={PackageOpen} title="Chưa có phiếu nhập" description="Ngày này chưa nhập hàng." />
        )}
      </Card>
      <ImportDetailDialog id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
