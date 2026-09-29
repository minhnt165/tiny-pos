import { Dialog } from '../../components/ui/Dialog';

export function CsvDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} title="Nhập / Xuất CSV" onClose={onClose}>
      <p>Đang xây dựng.</p>
    </Dialog>
  );
}
