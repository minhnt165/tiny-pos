import { CircleAlert, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/EmptyState';
import { PageTitle } from '@/components/layout/PageTitle';
import { Button } from '@/components/ui/button';

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <>
      <PageTitle title={title} />
      <EmptyState
        icon={CircleAlert}
        title={title}
        description="Trang này chưa có hoặc đường dẫn không đúng."
        action={
          <Button asChild>
            <Link to="/sell">
              <ShoppingCart data-icon="inline-start" />
              Về Bán hàng
            </Link>
          </Button>
        }
      />
    </>
  );
}
