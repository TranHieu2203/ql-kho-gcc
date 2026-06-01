import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="text-6xl font-bold text-muted-foreground mb-4">404</div>
        <h1 className="text-xl font-semibold mb-2">Không tìm thấy trang</h1>
        <p className="text-sm text-muted-foreground mb-6">Đường dẫn không tồn tại hoặc đã bị xoá.</p>
        <Button asChild>
          <Link href="/">Quay về trang chủ</Link>
        </Button>
      </div>
    </div>
  );
}
