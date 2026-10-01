import { useState } from 'react';
import { useLocation } from 'react-router';
import { FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { downloadFile } from '@/api/client';
import type { PageAction } from '@/components/layout/PageTitle';

/**
 * Nút "Xuất Excel" cho PageTitle: tải `path` kèm đúng bộ lọc đang có trên URL.
 * Trang tự sửa URL sai thành giá trị mặc định (Báo cáo) thì truyền `query` đã chuẩn hóa thay vì dùng URL thô.
 */
export function useExportAction(path: string, query?: string): PageAction {
  const { search } = useLocation();
  const [pending, setPending] = useState(false);
  const run = async () => {
    setPending(true);
    try {
      await downloadFile(path + (query ?? search));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không xuất được file');
    } finally {
      setPending(false);
    }
  };
  return { label: pending ? 'Đang xuất…' : 'Xuất Excel', icon: FileSpreadsheet, onClick: () => void run(), disabled: pending };
}
