import { useState } from 'react';
import { Plus, Search, Users, Wallet } from 'lucide-react';
import { formatMoney, stripDiacritics } from '@tiny-pos/shared';
import { useCustomers } from '@/api/customers';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
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
  const customers = (data?.customers ?? []).filter((c) => !t || fold(c.name).includes(t) || (c.phone?.includes(t) ?? false));

  return (
    <>
      <PageHeader
        title="Khách hàng"
        description="Sổ nợ khách mua chịu"
        icon={Users}
        actions={
          <Button className="h-11 px-5 text-base" onClick={() => setAdding(true)}>
            <Plus data-icon="inline-start" />
            Thêm khách
          </Button>
        }
      />
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <StatCard icon={Wallet} label="Tổng nợ phải thu" value={formatMoney(data?.totalDebt ?? 0)} tone="danger" />
        <InputGroup className="h-11 self-center">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput type="search" placeholder="Tìm tên hoặc số điện thoại…" className="text-base" value={q} onChange={(e) => setQ(e.target.value)} />
        </InputGroup>
      </div>
      <Card className="gap-0 overflow-hidden py-0">
        {!isLoading && !customers.length ? (
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
      </Card>
      <CustomerFormDialog open={adding} onClose={() => setAdding(false)} onSaved={() => setAdding(false)} />
      <CustomerDetailDialog id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}
