import Link from 'next/link';
import { redirect } from 'next/navigation';
import { validateRequest } from '@/lib/auth/lucia';
import { prisma } from '@/lib/db/prisma';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, ChevronLeft, Pencil } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const { user } = await validateRequest();
  if (!user || user.role !== 'ADMIN') redirect('/tong-quan');

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    include: { warehouseLinks: { include: { warehouse: { select: { code: true } } } } }
  });

  return (
    <div className="p-4 md:p-6 space-y-4">
      <Link href="/quan-tri" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="w-4 h-4" />Quay lại
      </Link>
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Quản lý người dùng</h1>
          <p className="text-sm text-muted-foreground mt-1">{users.length} tài khoản</p>
        </div>
        <Button asChild>
          <Link href="/quan-tri/nguoi-dung/them"><Plus className="w-4 h-4" />Thêm người dùng</Link>
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên đăng nhập</TableHead>
              <TableHead>Họ tên</TableHead>
              <TableHead>Vai trò</TableHead>
              <TableHead>Kho được phép</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-mono">{u.username}</TableCell>
                <TableCell>{u.fullName}</TableCell>
                <TableCell>
                  {u.role === 'ADMIN' ? (
                    <span className="badge badge-info">Quản trị</span>
                  ) : (
                    <span className="badge badge-neutral">Thủ kho</span>
                  )}
                </TableCell>
                <TableCell className="text-sm font-mono">
                  {u.role === 'ADMIN' ? 'Tất cả' : u.warehouseLinks.map((l) => l.warehouse.code).join(', ') || '—'}
                </TableCell>
                <TableCell>
                  {u.active ? <span className="badge badge-success">Hoạt động</span> : <span className="badge badge-neutral">Vô hiệu</span>}
                </TableCell>
                <TableCell>
                  <Link href={`/quan-tri/nguoi-dung/${u.id}`} aria-label="Sửa user" className="inline-flex p-1.5 rounded-md hover:bg-muted">
                    <Pencil className="w-4 h-4" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
