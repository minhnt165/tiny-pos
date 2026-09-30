import { useState } from 'react';
import { Plus, Search, Users } from 'lucide-react';
import { formatMoney, stripDiacritics } from '@tiny-pos/shared';
import { useCustomers } from '@/api/customers';
import { EmptyState } from '@/components/EmptyState';
import { PageTitle } from '@/components/layout/PageTitle';
import { ListPanel } from '@/components/ListPanel';
import { SearchInput } from '@/components/SearchInput';
import { Stat, StatStrip } from '@/components/StatStrip';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { CustomerDetailDialog } from './CustomerDetailDialog';
import { CustomerFormDialog } from './CustomerFormDialog';

export function CustomersPage() {
  const { data, isLoading } = useCustomers();
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  // Lọc giống server: tên không phân biệt hoa/thường và dấu tiếng Việt, hoặc SĐT
  const fold = (s: string) => stripDiacritics(s).toLowerCase();
  const t = fold(q.trim());
  const all = data?.customers ?? [];
  const customers = all.filter((c) => !t || fold(c.name).includes(t) || (c.phone?.includes(t) ?? false));

  return (
    <>
      <PageTitle title="Khách hàng" count={`${all.length} khách`} actions={[{ label: 'Thêm khách', icon: Plus, onClick: () => setAdding(true), primary: true }]} />
      <StatStrip cols={3}>
        <Stat label="Tổng nợ phải thu" value={formatMoney(data?.totalDebt ?? 0)} tone={data?.totalDebt ? 'danger' : 'default'} />
        <Stat label="Khách hàng" value={String(all.length)} />
        <Stat label="Đang nợ" value={String(all.filter((c) => c.debt > 0).length)} hint="Số khách còn nợ tiệm" />
      </StatStrip>
      <ListPanel toolbar={<SearchInput value={q} onChange={setQ} placeholder="Tìm tên hoặc số điện thoại…" className="md:max-w-sm" />}>
        {isLoading ? (
          <TableSkeleton />
        ) : !customers.length ? (
          t ? (
            <EmptyState icon={Search} title="Không tìm thấy" description={`Không có khách nào khớp "${q.trim()}".`} />
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
                <TableRow key={c.id} className="cursor-pointer" onClick={() => setOpenId(c.id)}>
                  <TableCell className="px-4 py-3 font-medium">{c.name}</TableCell>
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
