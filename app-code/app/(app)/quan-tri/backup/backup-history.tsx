import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, AlertTriangle, Info, Clock4, CloudUpload, Settings as SettingsIcon, PlugZap, Trash2, User as UserIcon } from 'lucide-react';
import { getBackupHistory } from './actions';

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function relative(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'vừa xong';
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)} phút trước`;
  if (ms < 86400_000) return `${Math.floor(ms / 3600_000)} giờ trước`;
  if (ms < 30 * 86400_000) return `${Math.floor(ms / 86400_000)} ngày trước`;
  return new Date(iso).toLocaleDateString('vi-VN');
}

const SOURCE_LABEL: Record<string, { text: string; icon: any; cls: string }> = {
  manual: { text: 'Thủ công', icon: CloudUpload, cls: 'badge-info' },
  cron:   { text: 'Cron tự động', icon: Clock4, cls: 'badge-neutral' },
  config: { text: 'Lưu config', icon: SettingsIcon, cls: 'badge-neutral' },
  test:   { text: 'Test kết nối', icon: PlugZap, cls: 'badge-neutral' },
  clear:  { text: 'Xóa config', icon: Trash2, cls: 'badge-warning' },
  other:  { text: 'Khác', icon: Info, cls: 'badge-neutral' }
};

export async function BackupHistory({ limit = 50 }: { limit?: number }) {
  const entries = await getBackupHistory(limit);

  const stats = {
    runs: entries.filter((e) => e.source === 'manual' || e.source === 'cron').length,
    success: entries.filter((e) => (e.source === 'manual' || e.source === 'cron') && e.status === 'OK').length,
    fail: entries.filter((e) => (e.source === 'manual' || e.source === 'cron') && e.status === 'ERROR').length
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
          <span>Lịch sử backup ({entries.length})</span>
          {stats.runs > 0 && (
            <div className="flex items-center gap-2 text-xs font-normal">
              <span className="badge badge-success"><CheckCircle2 className="w-3 h-3" />{stats.success} thành công</span>
              {stats.fail > 0 && (
                <span className="badge badge-danger"><AlertTriangle className="w-3 h-3" />{stats.fail} lỗi</span>
              )}
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {entries.length === 0 ? (
          <div className="text-center py-10 px-4 text-sm text-muted-foreground">
            Chưa có lịch sử backup nào. Sau khi cấu hình + bấm "Backup ngay", lịch sử sẽ hiện ở đây.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Thời gian</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Kết quả</TableHead>
                  <TableHead>Người / IP</TableHead>
                  <TableHead>Chi tiết</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => {
                  const src = SOURCE_LABEL[e.source];
                  const Icon = src.icon;
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        <div className="font-mono">{fmtDateTime(e.at)}</div>
                        <div className="text-muted-foreground">{relative(e.at)}</div>
                      </TableCell>
                      <TableCell>
                        <span className={`badge ${src.cls}`}>
                          <Icon className="w-3 h-3" />{src.text}
                        </span>
                      </TableCell>
                      <TableCell>
                        {e.status === 'OK' && (
                          <span className="badge badge-success"><CheckCircle2 className="w-3 h-3" />OK</span>
                        )}
                        {e.status === 'ERROR' && (
                          <span className="badge badge-danger"><AlertTriangle className="w-3 h-3" />Lỗi</span>
                        )}
                        {e.status === 'INFO' && (
                          <span className="badge badge-neutral"><Info className="w-3 h-3" />—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {e.actor ? (
                          <div className="flex items-center gap-1.5">
                            <UserIcon className="w-3 h-3 text-muted-foreground" />
                            <span>{e.actor}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">Hệ thống (cron)</span>
                        )}
                        {e.ipAddress && (
                          <div className="font-mono text-muted-foreground mt-0.5">{e.ipAddress}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs max-w-md">
                        <div className={`${e.status === 'ERROR' ? 'text-danger-strong' : 'text-muted-foreground'} break-words`}>
                          {e.details || <span className="italic">—</span>}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        {entries.length >= 50 && (
          <div className="px-4 py-2 border-t text-xs text-muted-foreground">
            Hiển thị {entries.length} entries gần nhất. Xem toàn bộ tại <a href="/quan-tri/audit-log?entity=Backup" className="text-primary hover:underline">Audit log</a>.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
