import { useState } from 'react';
import type { CsvImportResult } from '@tiny-pos/shared';
import { CSV_EXPORT_URL, useImportCsv } from '../../api/products';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { useToast } from '../../components/ui/Toast';

export function CsvDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const importCsv = useImportCsv();
  const toast = useToast();
  const [result, setResult] = useState<CsvImportResult | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    importCsv.mutate(text, { onSuccess: setResult, onError: (e) => toast(e.message, 'error') });
  };

  const close = () => {
    setResult(null);
    onClose();
  };

  return (
    <Dialog open={open} title="Nhập / Xuất CSV" onClose={close}>
      <section className="mb-4">
        <h3 className="font-semibold">Xuất</h3>
        <p className="mb-2 text-sm text-gray-600">Tải toàn bộ sản phẩm đang bán ra file CSV (mở được bằng Excel).</p>
        <a
          href={CSV_EXPORT_URL}
          download
          className="inline-flex min-h-11 items-center rounded-lg border border-gray-300 bg-white px-4 font-medium hover:bg-gray-100"
        >
          Tải file CSV
        </a>
      </section>
      <section>
        <h3 className="font-semibold">Nhập</h3>
        <p className="mb-2 text-sm text-gray-600">
          Cột: Mã vạch, Tên, Đơn vị, Giá nhập, Giá bán, Tồn, Hàng cân, Danh mục, Tồn tối thiểu. Trùng mã vạch thì cập
          nhật (không đổi tồn), chưa có thì tạo mới.
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          className="block"
          disabled={importCsv.isPending}
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        {importCsv.isPending && <p className="mt-2">Đang nhập…</p>}
        {result && (
          <div className="mt-3 rounded-lg bg-gray-50 p-3">
            <p>
              Đã tạo <b>{result.created}</b>, cập nhật <b>{result.updated}</b>, lỗi <b>{result.errors.length}</b>.
            </p>
            {result.errors.length > 0 && (
              <ul className="mt-2 max-h-48 overflow-y-auto text-sm text-red-700">
                {result.errors.map((e) => (
                  <li key={e.line}>
                    Dòng {e.line}: {e.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
      <div className="mt-4 flex justify-end">
        <Button variant="secondary" onClick={close}>
          Đóng
        </Button>
      </div>
    </Dialog>
  );
}
