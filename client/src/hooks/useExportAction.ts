import { useState } from 'react';
import { useLocation } from 'react-router';
import { FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { downloadFile } from '@/api/client';
import type { PageAction } from '@/components/layout/PageTitle';

/** Nút "Xuất Excel" cho PageTitle: tải `path` kèm đúng bộ lọc đang có trên URL. */
export function useExportAction(path: string): PageAction {
  const { search } = useLocation();
  const [pending, setPending] = useState(false);
  const run = async () => {
    setPending(true);
    try {
      await downloadFile(path + search);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không xuất được file');
    } finally {
      setPending(false);
    }
  };
  return { label: pending ? 'Đang xuất…' : 'Xuất Excel', icon: FileSpreadsheet, onClick: () => void run(), disabled: pending };
}
