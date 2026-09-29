import { useState } from 'react';
import { Ban, FileSpreadsheet, Package, Pencil, Plus, RotateCcw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { formatMoney, type Product } from '@tiny-pos/shared';
import { useCategories } from '@/api/categories';
import { useProduct, useProducts, useSetProductActive } from '@/api/products';
import { EmptyState } from '@/components/EmptyState';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { CsvDialog } from './CsvDialog';
import { ProductFormDialog } from './ProductFormDialog';

export function ProductListPage() {
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const { data: products = [], isLoading } = useProducts({
    q,
    categoryId: categoryId ? Number(categoryId) : undefined,
    includeInactive,
  });
  const { data: categories = [] } = useCategories();
  const { data: editing } = useProduct(editingId);
  const setActive = useSetProductActive();

  const toggle = (p: Product) =>
    setActive.mutate({ id: p.id, active: !p.isActive }, { onError: (e) => toast.error(e.message) });
  const close = () => {
    setEditingId(null);
    setCreating(false);
  };
  const filtered = q !== '' || categoryId !== '';

  return (
    <div>
      <PageHeader
        icon={Package}
        title="Sản phẩm"
        description={isLoading ? 'Đang tải…' : `${products.length} mặt hàng đang hiển thị`}
        actions={
          <>
            <Button variant="outline" className="h-11 px-4 text-base" onClick={() => setCsvOpen(true)}>
              <FileSpreadsheet data-icon="inline-start" />
              Nhập / Xuất CSV
            </Button>
            <Button className="h-11 px-5 text-base" onClick={() => setCreating(true)}>
              <Plus data-icon="inline-start" />
              Thêm sản phẩm
            </Button>
          </>
        }
      />

      <Card size="sm" className="mb-4">
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-center">
          <InputGroup className="h-11 flex-1">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput className="h-11 text-base" placeholder="Tìm theo tên hoặc mã vạch…" value={q} onChange={(e) => setQ(e.target.value)} />
          </InputGroup>
          <Select value={categoryId || 'all'} onValueChange={(v) => setCategoryId(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-11 w-full text-base md:w-60">
              <SelectValue placeholder="Tất cả danh mục" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả danh mục</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex h-11 cursor-pointer items-center gap-2.5 rounded-lg border px-3 text-base transition-colors hover:bg-muted/50 has-data-checked:border-primary/40 has-data-checked:bg-accent">
            <Checkbox className="size-5" checked={includeInactive} onCheckedChange={(v) => setIncludeInactive(v === true)} />
            Hiện hàng ngừng bán
          </label>
        </CardContent>
      </Card>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="px-4">Mã vạch</TableHead>
              <TableHead className="px-4">Sản phẩm</TableHead>
              <TableHead className="px-4 text-right">Giá bán</TableHead>
              <TableHead className="px-4 text-right">Tồn</TableHead>
              <TableHead className="w-px px-2" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => (
              <TableRow key={p.id} className={cn('text-base', !p.isActive && 'opacity-60')}>
                <TableCell className="px-4 py-3">
                  {p.barcode ? (
                    <code className="rounded-md bg-muted px-2 py-1 font-mono text-sm">{p.barcode}</code>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2 font-medium">
                    {p.name}
                    {!p.isActive && <Badge variant="secondary">Ngừng bán</Badge>}
                    {p.isWeighed && <Badge className="bg-amber-100 text-amber-800">Hàng cân</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {p.categoryName ?? 'Không danh mục'} · {p.unit}
                  </div>
                </TableCell>
                <TableCell className="px-4 py-3 text-right font-semibold tabular-nums">{formatMoney(p.sellPrice)}</TableCell>
                <TableCell className="px-4 py-3 text-right tabular-nums">
                  {p.stock < p.minStock ? (
                    <Badge variant="destructive">
                      {p.stock} {p.unit}
                    </Badge>
                  ) : (
                    <>
                      {p.stock} <span className="text-sm text-muted-foreground">{p.unit}</span>
                    </>
                  )}
                </TableCell>
                <TableCell className="px-2 py-2 whitespace-nowrap">
                  <div className="flex justify-end">
                    <Button variant="ghost" size="icon-lg" aria-label="Sửa" title="Sửa" onClick={() => setEditingId(p.id)}>
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-lg"
                      aria-label={p.isActive ? 'Ngừng bán' : 'Bán lại'}
                      title={p.isActive ? 'Ngừng bán' : 'Bán lại'}
                      className={p.isActive ? 'text-destructive hover:bg-destructive/10 hover:text-destructive' : 'text-primary'}
                      onClick={() => toggle(p)}
                    >
                      {p.isActive ? <Ban /> : <RotateCcw />}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!isLoading && products.length === 0 && (
          <EmptyState
            icon={filtered ? Search : Package}
            title={filtered ? 'Không tìm thấy sản phẩm nào' : 'Chưa có sản phẩm'}
            description={filtered ? 'Thử từ khóa khác hoặc bỏ lọc danh mục.' : 'Thêm bằng tay, quét mã ở Nhập nhanh, hoặc nhập từ file CSV.'}
            action={
              !filtered && (
                <Button onClick={() => setCreating(true)}>
                  <Plus data-icon="inline-start" />
                  Thêm sản phẩm
                </Button>
              )
            }
          />
        )}
      </Card>

      <ProductFormDialog
        open={creating || (editingId !== null && !!editing)}
        product={creating ? null : (editing ?? null)}
        onClose={close}
        onSaved={close}
      />
      <CsvDialog open={csvOpen} onClose={() => setCsvOpen(false)} />
    </div>
  );
}
