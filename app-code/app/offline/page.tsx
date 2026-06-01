import { CloudOff } from 'lucide-react';
import { OfflineRetryButton } from './retry-button';

export const metadata = { title: 'Đang offline — QL Kho Lốp' };

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <CloudOff className="w-16 h-16 mx-auto mb-4 text-warning" strokeWidth={1.5} />
        <h1 className="text-xl font-semibold mb-2">Đang offline</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Bạn cần kết nối internet để mở trang này. Khi có mạng, hãy thử lại.
        </p>
        <OfflineRetryButton />
      </div>
    </div>
  );
}
