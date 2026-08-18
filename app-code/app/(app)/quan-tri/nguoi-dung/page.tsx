import Link from 'next/link';
import { redirect } from 'next/navigation';
import { validateRequest } from '@/lib/auth/lucia';
import { prisma } from '@/lib/db/prisma';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, ChevronLeft, Pencil } from 'lucide-react';
import { Pagination } from '@/components/ui/pagination';
import { parsePaging, pageMeta } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

type SearchParams = { page?: string; pageSize?: string };

export default async function AdminUsersPage({ searchParams }: { searchParams: SearchParams }) {
  const { user } = await validateRequest();
  if (!user || user.role !== 'ADMIN') redirect('/tong-quan');

  const paging = parsePaging(searchParams);
  const total = await prisma.user.count();
  const meta = pageMeta(total, paging);

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    skip: (meta.page - 1) * meta.pageSize,
    take: meta.pageSize,
    include: { warehouseLinks: { include: { warehouse: { select: { code: true } } } } }
  });

  return (
    <div className="h-full min-h-0 flex flex-col gap-4 overflow-y-auto p-4 md:p-6">
      <Link href="/quan-tri" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="w-4 h-4" />Quay lại
      </Link>
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Quản lý người dùng</h1>
          <p className="text-sm text-muted-foreground mt-1">{total} tài khoản</p>
        </div>
        <Button asChild>
          <Link href="/quan-tri/nguoi-dung/them"><Plus className="w-4 h-4" />Thêm người dùng</Link>
        </Button>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden min-h-[260px]">
        <Table containerClassName="flex-1 min-h-0">
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

        <Pagination
          basePath="/quan-tri/nguoi-dung"
          page={meta.page}
          pageCount={meta.pageCount}
          pageSize={meta.pageSize}
          total={meta.total}
          from={meta.from}
          to={meta.to}
          itemLabel="tài khoản"
        />
      </Card>
    </div>
  );
}
