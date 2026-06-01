'use client';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="text-6xl font-bold text-danger mb-4">500</div>
        <h1 className="text-xl font-semibold mb-2">Đã xảy ra lỗi</h1>
        <p className="text-sm text-muted-foreground mb-6">Vui lòng thử lại hoặc liên hệ quản trị viên nếu lỗi lặp lại.</p>
        <div className="flex gap-2 justify-center">
          <Button onClick={() => reset()}>Thử lại</Button>
          <Button variant="ghost" asChild>
            <a href="/">Về trang chủ</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
