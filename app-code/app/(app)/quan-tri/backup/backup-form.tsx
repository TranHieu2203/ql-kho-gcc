'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { CheckCircle2, AlertTriangle, PlugZap, CloudUpload, Trash2 } from 'lucide-react';
import { saveBackupConfig, testConnection, runBackupNow, clearBackupConfig } from './actions';

export function BackupForm({ initial }: {
  initial: {
    spreadsheetId: string;
    schedule: 'manual' | 'hourly' | 'daily' | 'weekly';
    hasSaJson: boolean;
    isConfigured: boolean;
    lastRun: string;
    lastStatus: string;
    lastDetails: string;
  };
}) {
  const router = useRouter();
  const { push } = useToast();
  const [pending, startTransition] = useTransition();
  const [saJson, setSaJson] = useState('');
  const [spreadsheetId, setSpreadsheetId] = useState(initial.spreadsheetId);
  const [schedule, setSchedule] = useState(initial.schedule);

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!saJson.trim() && !initial.hasSaJson) {
      push({ variant: 'danger', message: 'Vui lòng dán nội dung Service Account JSON.' });
      return;
    }
    const fd = new FormData();
    fd.set('saJson', saJson.trim());   // empty = giữ giá trị cũ (server tự xử lý)
    fd.set('spreadsheetId', spreadsheetId);
    fd.set('schedule', schedule);
    startTransition(async () => {
      const r = await saveBackupConfig(fd);
      if (r.error) push({ variant: 'danger', message: r.error });
      else {
        push({ variant: 'success', message: 'Đã lưu cấu hình.' });
        setSaJson('');
        router.refresh();
      }
    });
  }

  function onTest() {
    startTransition(async () => {
      const r = await testConnection();
      if (r.error) push({ variant: 'danger', message: r.error });
      else push({ variant: 'success', message: `Kết nối OK — Spreadsheet: "${r.title}"` });
    });
  }

  function onRun() {
    if (!confirm('Chạy backup ngay — ghi đè toàn bộ tab Products / Warehouses / Receipts / ... trên Google Sheet. Tiếp tục?')) return;
    startTransition(async () => {
      const r = await runBackupNow();
      if (r.error) push({ variant: 'danger', message: r.error });
      else {
        push({ variant: 'success', message: `Backup OK trong ${(r as any).tookMs}ms. Đã ghi: ${Object.entries((r as any).rowCounts).map(([k, v]) => `${k}=${v}`).join(', ')}` });
        router.refresh();
      }
    });
  }

  function onClear() {
    if (!confirm('Xóa toàn bộ cấu hình backup (SA JSON + Spreadsheet ID + schedule)? Dữ liệu trên Google Sheet KHÔNG bị xóa.')) return;
    startTransition(async () => {
      await clearBackupConfig();
      push({ variant: 'success', message: 'Đã xóa cấu hình.' });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {initial.isConfigured && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {initial.lastStatus.startsWith('OK') ? (
                <CheckCircle2 className="w-5 h-5 text-success" />
              ) : initial.lastStatus.startsWith('ERROR') ? (
                <AlertTriangle className="w-5 h-5 text-danger" />
              ) : (
                <CloudUpload className="w-5 h-5 text-muted-foreground" />
              )}
              Trạng thái
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <div><span className="text-muted-foreground">Lần chạy gần nhất:</span> {initial.lastRun ? new Date(initial.lastRun).toLocaleString('vi-VN') : '— (chưa chạy)'}</div>
            <div><span className="text-muted-foreground">Kết quả:</span> {initial.lastStatus || '—'}</div>
            {initial.lastDetails && <div className="text-xs font-mono text-muted-foreground">{initial.lastDetails}</div>}
            <div className="pt-3 flex gap-2 flex-wrap">
              <Button variant="outline" onClick={onTest} disabled={pending}>
                <PlugZap className="w-4 h-4" />Test kết nối
              </Button>
              <Button onClick={onRun} disabled={pending}>
                <CloudUpload className="w-4 h-4" />{pending ? 'Đang chạy...' : 'Backup ngay'}
              </Button>
              <Button variant="ghost" onClick={onClear} disabled={pending} className="text-danger ml-auto">
                <Trash2 className="w-4 h-4" />Xóa cấu hình
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{initial.isConfigured ? 'Cập nhật cấu hình' : 'Cấu hình lần đầu'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSave} className="space-y-4">
            <div>
              <Label htmlFor="saJson">
                Service Account JSON <span className="text-danger">*</span>
                {initial.hasSaJson && <span className="text-xs text-success-strong ml-2">(đã lưu — paste lại để cập nhật)</span>}
              </Label>
              <textarea
                id="saJson"
                value={saJson}
                onChange={(e) => setSaJson(e.target.value)}
                rows={6}
                placeholder={initial.hasSaJson ? '(Giữ giá trị cũ — chỉ paste khi muốn đổi)' : '{ "type": "service_account", "project_id": "...", ... }'}
                className="w-full font-mono text-xs rounded-md border bg-background p-3 resize-y"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Lưu trong DB local SQLite (không gửi đi đâu). Chỉ admin xem được trang này.
              </p>
            </div>

            <div>
              <Label htmlFor="spreadsheetId">
                Spreadsheet ID <span className="text-danger">*</span>
              </Label>
              <input
                id="spreadsheetId"
                value={spreadsheetId}
                onChange={(e) => setSpreadsheetId(e.target.value)}
                placeholder="1a2B3c4D5eF6gH7iJ8kL9mN0pQ_aBcDeFgHiJkLmN"
                className="w-full h-9 px-3 rounded-md border bg-background text-sm font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Lấy từ URL: https://docs.google.com/spreadsheets/d/<strong className="text-foreground">{'{ID}'}</strong>/edit
              </p>
            </div>

            <div>
              <Label htmlFor="schedule">Lịch chạy tự động</Label>
              <select
                id="schedule"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value as any)}
                className="h-9 w-full max-w-xs rounded-md border bg-background px-3 text-sm"
              >
                <option value="manual">Thủ công (chỉ bấm nút)</option>
                <option value="hourly">Hàng giờ (mỗi 1 giờ)</option>
                <option value="daily">Hàng ngày</option>
                <option value="weekly">Hàng tuần</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Schedule chỉ là metadata. Phải có OS cron gọi <code>/api/cron/backup?token=...</code> để thực sự chạy theo lịch.
                {schedule === 'hourly' && (
                  <><br/><strong>Hàng giờ:</strong> cron cần gọi mỗi 15 phút (endpoint tự skip nếu chưa đến hạn).</>
                )}
              </p>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={pending}>{pending ? 'Đang lưu...' : 'Lưu cấu hình'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
