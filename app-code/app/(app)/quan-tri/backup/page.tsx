import { redirect } from 'next/navigation';
import { validateRequest } from '@/lib/auth/lucia';
import { getBackupConfig } from './actions';
import { BackupForm } from './backup-form';
import { BackupHistory } from './backup-history';

export const dynamic = 'force-dynamic';

export default async function BackupPage() {
  const { user } = await validateRequest();
  if (!user || user.role !== 'ADMIN') redirect('/tong-quan');

  const cfg = await getBackupConfig();
  const isConfigured = !!cfg.saJson && !!cfg.spreadsheetId;

  return (
    <div className="p-4 md:p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Backup lên Google Sheets</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Đẩy snapshot toàn bộ dữ liệu (sản phẩm, kho, phiếu, tồn kho) lên 1 Google Spreadsheet làm bản sao lưu ngoài server.
        </p>
      </div>

      <BackupForm
        initial={{
          spreadsheetId: cfg.spreadsheetId,
          schedule: cfg.schedule as 'manual' | 'hourly' | 'daily' | 'weekly',
          hasSaJson: !!cfg.saJson,
          isConfigured,
          lastRun: cfg.lastRun,
          lastStatus: cfg.lastStatus,
          lastDetails: cfg.lastDetails
        }}
      />

      <BackupHistory limit={50} />

      <details className="text-sm text-muted-foreground border rounded-lg p-4 bg-muted/30">
        <summary className="cursor-pointer font-medium text-foreground">Hướng dẫn cấu hình lần đầu</summary>
        <ol className="list-decimal pl-5 mt-3 space-y-2">
          <li>Vào <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer noopener" className="text-primary underline">Google Cloud Console</a> → tạo Project mới.</li>
          <li>Vào <strong>APIs & Services → Library</strong> → tìm <code className="bg-card px-1 rounded">Google Sheets API</code> → Enable.</li>
          <li>Vào <strong>APIs & Services → Credentials</strong> → <em>Create Credentials → Service Account</em>. Đặt tên (vd: <code className="bg-card px-1 rounded">ql-kho-backup</code>). Bỏ qua các bước role (không cần grant gì).</li>
          <li>Mở service account vừa tạo → tab <strong>Keys → Add Key → Create new key → JSON</strong> → tải file <code className="bg-card px-1 rounded">.json</code> về.</li>
          <li>Tạo Google Sheet mới (sheet trống). Copy <strong>Spreadsheet ID</strong> từ URL: <code className="bg-card px-1 rounded">https://docs.google.com/spreadsheets/d/<u>SPREADSHEET_ID</u>/edit</code>.</li>
          <li>Trong sheet, bấm <strong>Share</strong> → paste email service account (vd <code className="bg-card px-1 rounded">ql-kho-backup@xxx.iam.gserviceaccount.com</code>) → quyền <strong>Editor</strong>.</li>
          <li>Quay lại đây → dán nội dung file JSON + Spreadsheet ID → Lưu cấu hình → Test kết nối → Backup ngay.</li>
        </ol>
        <p className="mt-3 text-xs">
          💡 <strong>Schedule tự động</strong>: chọn "Hàng ngày" / "Hàng tuần" sẽ ghi lại lựa chọn, nhưng phải có OS cron gọi <code className="bg-card px-1 rounded">/api/cron/backup?token=...</code> (xem DEPLOY.md mục Cron để cấu hình).
        </p>
      </details>
    </div>
  );
}
