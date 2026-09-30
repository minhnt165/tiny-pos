import { useState } from 'react';
import { Plus, Truck } from 'lucide-react';
import { formatMoney } from '@tiny-pos/shared';
import { useSuppliers } from '@/api/suppliers';
import { EmptyState } from '@/components/EmptyState';
import { PageTitle } from '@/components/layout/PageTitle';
import { ListPanel } from '@/components/ListPanel';
import { Stat, StatStrip } from '@/components/StatStrip';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { SupplierDetailDialog } from './SupplierDetailDialog';
import { SupplierFormDialog } from './SupplierFormDialog';

export function SuppliersPage() {
  const { data: suppliers = [], isLoading } = useSuppliers();
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const totalDebt = suppliers.reduce((s, x) => s + Math.max(0, x.debt), 0);

  return (
    <>
      <PageTitle
        title="Nhà cung cấp"
        count={`${suppliers.length} nhà cung cấp`}
        actions={[{ label: 'Thêm nhà cung cấp', icon: Plus, onClick: () => setAdding(true), primary: true }]}
      />
      <StatStrip cols={3}>
        <Stat label="Tổng đang nợ" value={formatMoney(totalDebt)} tone={totalDebt ? 'danger' : 'default'} />
        <Stat label="Nhà cung cấp" value={String(suppliers.length)} />
        <Stat label="Đang nợ" value={String(suppliers.filter((x) => x.debt > 0).length)} hint="Số nhà cung cấp tiệm còn nợ" />
      </StatStrip>
      <ListPanel>
        {isLoading ? (
          <TableSkeleton />
        ) : !suppliers.length ? (
          <EmptyState icon={Truck} title="Chưa có nhà cung cấp" description="Thêm nhà cung cấp để ghi nợ khi nhập hàng." />
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
                <TableRow key={s.id} className="cursor-pointer" onClick={() => setOpenId(s.id)}>
                  <TableCell className="px-4 py-3 font-medium">{s.name}</TableCell>
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
