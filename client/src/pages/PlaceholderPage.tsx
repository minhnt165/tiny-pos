import { CircleAlert } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';

export function PlaceholderPage({ title }: { title: string }) {
  return <EmptyState icon={CircleAlert} title={title} description="Trang này chưa có hoặc đường dẫn không đúng." />;
}
