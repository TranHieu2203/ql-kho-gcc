import Link from 'next/link';
import { redirect } from 'next/navigation';
import { validateRequest } from '@/lib/auth/lucia';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Warehouse, FileClock, Settings as SettingsIcon, CloudUpload } from 'lucide-react';

const items = [
  { href: '/quan-tri/nguoi-dung', label: 'Người dùng', icon: Users, desc: 'Quản lý tài khoản và phân quyền theo kho' },
  { href: '/quan-tri/kho', label: 'Kho', icon: Warehouse, desc: 'Tạo và quản lý các kho' },
  { href: '/quan-tri/backup', label: 'Backup Google Sheets', icon: CloudUpload, desc: 'Đồng bộ snapshot DB lên Google Spreadsheet (thủ công + lịch tự động)' },
  { href: '/quan-tri/audit-log', label: 'Audit log', icon: FileClock, desc: 'Lịch sử thao tác trong hệ thống' },
  { href: '/quan-tri/cau-hinh', label: 'Cấu hình', icon: SettingsIcon, desc: 'Chính sách xuất quá tồn, ngưỡng tồn thấp...' }
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
          return (
            <Link key={it.href} href={it.href}>
              <Card className="hover:border-primary transition-colors h-full">
                <CardHeader>
                  <Icon className="w-6 h-6 text-primary mb-2" strokeWidth={1.5} />
                  <CardTitle>{it.label}</CardTitle>
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
