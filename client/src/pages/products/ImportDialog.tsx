import { useState, type DragEvent } from 'react';
import { CircleCheck, FileSpreadsheet, TriangleAlert, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { CsvImportResult } from '@tiny-pos/shared';
import { useImportProducts } from '@/api/products';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const importProducts = useImportProducts();
  const [result, setResult] = useState<CsvImportResult | null>(null);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    importProducts.mutate(file, { onSuccess: setResult, onError: (e) => toast.error(e.message) });
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    onFile(e.dataTransfer.files[0]);
  };

  const close = () => {
    setResult(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent size="lg" className="gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="text-xl">Nhập sản phẩm từ Excel</DialogTitle>
          <DialogDescription>File .xlsx hoặc .csv, dòng đầu là tiêu đề cột</DialogDescription>
        </DialogHeader>
        <div className="px-6 py-5">
          <div className="rounded-xl border p-4">
            <div className="flex gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Upload className="size-5" />
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <h3 className="font-medium">Chọn file</h3>
                <p className="text-sm text-muted-foreground">
                  Cột: Mã vạch, Tên, Đơn vị, Giá nhập, Giá bán, Tồn, Hàng cân, Danh mục, Tồn tối thiểu. Trùng mã vạch thì cập nhật
                  (không đổi tồn), hàng không có mã vạch thì khớp theo tên, chưa có thì tạo mới.
                </p>
                <p className="text-sm text-muted-foreground">
                  Muốn sửa hàng loạt: bấm <b>Xuất Excel</b>, sửa trong Excel rồi nhập lại file đó.
                </p>
              </div>
            </div>
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors hover:border-primary/50 hover:bg-accent/60"
            >
              <FileSpreadsheet className="size-8 text-muted-foreground" />
              <span className="font-medium">{importProducts.isPending ? 'Đang nhập…' : 'Chọn file Excel hoặc CSV…'}</span>
              <span className="text-xs text-muted-foreground">hoặc kéo thả file vào đây</span>
              <input
                type="file"
                accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                className="sr-only"
                disabled={importProducts.isPending}
                onChange={(e) => {
                  onFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
            {result && (
              <div className={cn('mt-3 rounded-xl p-3 text-sm', result.errors.length ? 'bg-warning/10 text-foreground' : 'bg-accent text-accent-foreground')}>
                <p className="flex items-center gap-2 font-medium">
                  {result.errors.length ? <TriangleAlert className="size-5" /> : <CircleCheck className="size-5" />}
                  Đã tạo <b>{result.created}</b>, cập nhật <b>{result.updated}</b>, lỗi <b>{result.errors.length}</b>.
                </p>
                {result.errors.length > 0 && (
                  <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto text-destructive">
                    {result.errors.map((e) => (
                      <li key={e.line}>
                        Dòng {e.line}: {e.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end rounded-b-xl border-t bg-muted/50 px-6 py-4">
          <Button variant="outline" className="h-11 px-4 text-base" onClick={close}>
            Đóng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
