import { useState } from 'react';
import { Plus, Search, Truck } from 'lucide-react';
import { filterParties, formatMoney, partyViewFields, sortParties } from '@tiny-pos/shared';
import { useSuppliers } from '@/api/suppliers';
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
import { SupplierDetailDialog } from './SupplierDetailDialog';
import { SupplierFormDialog } from './SupplierFormDialog';

export function SuppliersPage() {
  const { filters: view, set, clear } = useUrlFilters(partyViewFields);
  const { data: raw = [], isLoading } = useSuppliers(view.includeInactive);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  // Số liệu tính trên NCC đang hoạt động; danh sách lọc/sắp xếp trên trình duyệt
  const activeList = raw.filter((x) => x.isActive);
  const suppliers = sortParties(filterParties(raw, view), view.sort);
  const filtered = !!view.q || view.debtOnly || view.includeInactive;
  const totalDebt = activeList.reduce((s, x) => s + Math.max(0, x.debt), 0);

  return (
    <>
      <PageTitle
        title="Nhà cung cấp"
        count={`${activeList.length} nhà cung cấp`}
        actions={[{ label: 'Thêm nhà cung cấp', icon: Plus, onClick: () => setAdding(true), primary: true }]}
      />
      <StatStrip cols={3}>
        <Stat label="Tổng đang nợ" value={formatMoney(totalDebt)} tone={totalDebt ? 'danger' : 'default'} />
        <Stat label="Nhà cung cấp" value={String(activeList.length)} />
        <Stat label="Đang nợ" value={String(activeList.filter((x) => x.debt > 0).length)} hint="Số nhà cung cấp tiệm còn nợ" />
      </StatStrip>
      <ListPanel
        toolbar={<PartyFilters view={view} set={set} clear={clear} placeholder="Tìm tên hoặc số điện thoại…" resultLabel={`Xem ${suppliers.length} nhà cung cấp`} />}
      >
        {isLoading ? (
          <TableSkeleton />
        ) : !suppliers.length ? (
          filtered ? (
            <EmptyState
              icon={Search}
              title="Không có nhà cung cấp khớp bộ lọc"
              description="Thử từ khóa khác hoặc bỏ bớt lọc."
              action={
                <Button variant="outline" onClick={clear}>
                  Xóa lọc
                </Button>
              }
            />
          ) : (
            <EmptyState icon={Truck} title="Chưa có nhà cung cấp" description="Thêm nhà cung cấp để ghi nợ khi nhập hàng." />
          )
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="px-4">Tên</TableHead>
                <TableHead className="px-4">Số điện thoại</TableHead>
                <TableHead className="px-4 text-right">Đang nợ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s) => (
                <TableRow key={s.id} className={cn('cursor-pointer', !s.isActive && 'opacity-60')} onClick={() => setOpenId(s.id)}>
                  <TableCell className="px-4 py-3 font-medium">
                    {s.name}
                    {!s.isActive && (
                      <Badge variant="secondary" className="ml-2">
                        Đã xóa
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground">{s.phone ?? '—'}</TableCell>
                  <TableCell className={cn('px-4 py-3 text-right font-semibold tabular-nums', s.debt > 0 && 'text-destructive')}>
                    {formatMoney(s.debt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ListPanel>
      <SupplierFormDialog open={adding} onClose={() => setAdding(false)} onSaved={() => setAdding(false)} />
      <SupplierDetailDialog id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
