import { useState } from 'react';
import { Play } from 'lucide-react';
import { toast } from 'sonner';
import { useOpenStocktake } from '@/api/stocktakes';
import { PageTitle } from '@/components/layout/PageTitle';
import { TextField } from '@/components/TextField';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StocktakeHistory } from './StocktakeHistory';

export function StocktakeStart() {
  const [note, setNote] = useState('');
  const open = useOpenStocktake();
  const start = () =>
    open.mutate({ note: note.trim() || null }, { onSuccess: (s) => toast.success(`Đã mở ${s.code}`), onError: (e) => toast.error(e.message) });

  return (
    <>
      <PageTitle title="Kiểm kê" />
      <Card>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Có thể đếm từng phần (ví dụ chỉ quầy nước) và vẫn bán hàng trong lúc đếm; món không đếm giữ nguyên tồn.
          </p>
          <TextField id="st-note" label="Ghi chú (tùy chọn)" placeholder="Quầy nước, kho sau…" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
          <Button className="h-12 w-full text-base sm:w-auto sm:px-8" disabled={open.isPending} onClick={start}>
            <Play data-icon="inline-start" />
            Bắt đầu kiểm kê
          </Button>
        </CardContent>
      </Card>
      <StocktakeHistory />
    </>
  );
}
