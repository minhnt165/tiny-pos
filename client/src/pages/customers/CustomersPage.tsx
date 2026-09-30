import { useState } from 'react';
import { Plus, Search, Users } from 'lucide-react';
import { filterParties, formatMoney, partyViewFields, sortParties } from '@tiny-pos/shared';
import { useCustomers } from '@/api/customers';
import { EmptyState } from '@/components/EmptyState';
import { PartyFilters } from '@/components/filters/PartyFilters';
import { PageTitle } from '@/components/layout/PageTitle';
import { ListPanel } from '@/components/ListPanel';
import { Stat, StatStrip } from '@/components/StatStrip';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { cn } from '@/lib/utils';
import { CustomerDetailDialog } from './CustomerDetailDialog';
import { CustomerFormDialog } from './CustomerFormDialog';

export function CustomersPage() {
  const { filters: view, set, clear } = useUrlFilters(partyViewFields);
  const { data, isLoading } = useCustomers(view.includeInactive);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  // Số liệu tính trên khách đang theo dõi; danh sách lọc/sắp xếp trên trình duyệt
  const all = (data?.customers ?? []).filter((c) => c.isActive);
  const customers = sortParties(filterParties(data?.customers ?? [], view), view.sort);
  const filtered = !!view.q || view.debtOnly || view.includeInactive;

  return (
    <>
      <PageTitle title="Khách hàng" count={`${all.length} khách`} actions={[{ label: 'Thêm khách', icon: Plus, onClick: () => setAdding(true), primary: true }]} />
      <StatStrip cols={3}>
        <Stat label="Tổng nợ phải thu" value={formatMoney(data?.totalDebt ?? 0)} tone={data?.totalDebt ? 'danger' : 'default'} />
        <Stat label="Khách hàng" value={String(all.length)} />
        <Stat label="Đang nợ" value={String(all.filter((c) => c.debt > 0).length)} hint="Số khách còn nợ tiệm" />
      </StatStrip>
      <ListPanel toolbar={<PartyFilters view={view} set={set} clear={clear} placeholder="Tìm tên hoặc số điện thoại…" resultLabel={`Xem ${customers.length} khách`} />}>
        {isLoading ? (
          <TableSkeleton />
        ) : !customers.length ? (
          filtered ? (
            <EmptyState
              icon={Search}
              title="Không có khách khớp bộ lọc"
              description="Thử từ khóa khác hoặc bỏ bớt lọc."
              action={
                <Button variant="outline" onClick={clear}>
                  Xóa lọc
                </Button>
              }
            />
          ) : (
            <EmptyState icon={Users} title="Chưa có khách hàng" description="Thêm khách để ghi nợ khi bán chịu." />
          )
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="px-4">Tên</TableHead>
                <TableHead className="hidden px-4 sm:table-cell">Số điện thoại</TableHead>
                <TableHead className="px-4 text-right">Đang nợ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.id} className={cn('cursor-pointer', !c.isActive && 'opacity-60')} onClick={() => setOpenId(c.id)}>
                  <TableCell className="px-4 py-3 font-medium">
                    {c.name}
                    {!c.isActive && (
                      <Badge variant="secondary" className="ml-2">
                        Đã xóa
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{c.phone ?? '—'}</TableCell>
                  <TableCell className={cn('px-4 py-3 text-right font-semibold tabular-nums', c.debt > 0 && 'text-destructive')}>
                    {c.debt < 0 ? `Tiệm nợ ${formatMoney(-c.debt)}` : formatMoney(c.debt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ListPanel>
      <CustomerFormDialog open={adding} onClose={() => setAdding(false)} onSaved={() => setAdding(false)} />
      <CustomerDetailDialog id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
