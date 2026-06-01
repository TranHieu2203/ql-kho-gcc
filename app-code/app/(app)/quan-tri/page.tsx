import Link from 'next/link';
import { redirect } from 'next/navigation';
import { validateRequest } from '@/lib/auth/lucia';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Warehouse, FileClock, Settings as SettingsIcon, CloudUpload, ClipboardEdit, Trash2 } from 'lucide-react';

const items = [
  { href: '/quan-tri/nguoi-dung', label: 'Người dùng', icon: Users, desc: 'Quản lý tài khoản và phân quyền theo kho' },
  { href: '/quan-tri/kho', label: 'Kho', icon: Warehouse, desc: 'Tạo và quản lý các kho' },
  { href: '/quan-tri/sua-ton', label: 'Sửa tồn cuối', icon: ClipboardEdit, desc: 'Điều chỉnh tồn kho sau kiểm kê (tạo phiếu ADJ-* tự động)' },
  { href: '/quan-tri/backup', label: 'Backup Google Sheets', icon: CloudUpload, desc: 'Đồng bộ snapshot DB lên Google Spreadsheet (thủ công + lịch tự động)' },
  { href: '/quan-tri/audit-log', label: 'Audit log', icon: FileClock, desc: 'Lịch sử thao tác trong hệ thống' },
  { href: '/quan-tri/cau-hinh', label: 'Cấu hình', icon: SettingsIcon, desc: 'Chính sách xuất quá tồn, ngưỡng tồn thấp...' },
  { href: '/quan-tri/xoa-du-lieu', label: 'Xoá dữ liệu', icon: Trash2, desc: 'Reset phiếu / sản phẩm / kho / toàn hệ thống (cực kỳ nguy hiểm)', danger: true }
];

export default async function AdminPage() {
  const { user } = await validateRequest();
  if (!user) redirect('/login');
  if (user.role !== 'ADMIN') redirect('/tong-quan');

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Quản trị hệ thống</h1>
        <p className="text-sm text-muted-foreground mt-1">Chỉ tài khoản quản trị mới truy cập được khu vực này.</p>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((it) => {
          const Icon = it.icon;
          const danger = (it as any).danger;
          return (
            <Link key={it.href} href={it.href}>
              <Card className={`transition-colors h-full ${danger ? 'hover:border-danger border-danger/30' : 'hover:border-primary'}`}>
                <CardHeader>
                  <Icon className={`w-6 h-6 mb-2 ${danger ? 'text-danger' : 'text-primary'}`} strokeWidth={1.5} />
                  <CardTitle className={danger ? 'text-danger-strong' : ''}>{it.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{it.desc}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
