import { redirect } from 'next/navigation';
import { validateRequest } from '@/lib/auth/lucia';
import { getCountsServer } from './actions';
import { ClearDataForm } from './clear-form';
import { AlertTriangle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ClearDataPage() {
  const { user } = await validateRequest();
  if (!user) redirect('/login');
  if (user.role !== 'ADMIN') redirect('/tong-quan');

  const counts = await getCountsServer();

  return (
    <div className="p-4 md:p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-danger-strong">Xóa dữ liệu hệ thống</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Khu vực CỰC KỲ NGUY HIỂM — chỉ admin truy cập. Hãy chắc chắn đã backup trước khi xoá.
        </p>
      </div>

      <div className="rounded-lg border-2 border-danger bg-danger-soft p-4 text-sm space-y-2">
        <div className="flex items-center gap-2 font-semibold text-danger-strong">
          <AlertTriangle className="w-5 h-5" />
          Cảnh báo
        </div>
        <ul className="list-disc pl-5 space-y-1 text-foreground/90">
          <li>Thao tác xoá <strong>KHÔNG THỂ HOÀN TÁC</strong>. Chỉ có cách khôi phục là restore từ file backup hoặc Google Sheets.</li>
          <li>Hãy chạy <strong>Backup → Backup ngay</strong> trước khi xoá để có bản sao trên Google Sheets.</li>
          <li>Để xác nhận, bạn phải gõ chính xác cụm <code className="bg-card px-1.5 py-0.5 rounded">XOA DU LIEU</code> + nhập lại mật khẩu admin.</li>
          <li>Audit log sẽ ghi lại thao tác xoá (mức "all" sẽ vẫn giữ audit log để có dấu vết).</li>
        </ul>
      </div>

      <ClearDataForm counts={counts} adminUsername={user.username} />
    </div>
  );
}
