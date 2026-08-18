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

export default async function AdminWarehousesPage({ searchParams }: { searchParams: SearchParams }) {
  const { user } = await validateRequest();
  if (!user || user.role !== 'ADMIN') redirect('/tong-quan');

  const paging = parsePaging(searchParams);
  const total = await prisma.warehouse.count();
  const meta = pageMeta(total, paging);

  const warehouses = await prisma.warehouse.findMany({
    orderBy: { createdAt: 'asc' },
    skip: (meta.page - 1) * meta.pageSize,
    take: meta.pageSize,
    include: { _count: { select: { receipts: true, userLinks: true } } }
  });

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 md:h-full md:min-h-0 md:overflow-y-auto">
      <Link href="/quan-tri" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="w-4 h-4" />Quay lại quản trị
      </Link>
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Quản lý kho</h1>
          <p className="text-sm text-muted-foreground mt-1">{total} kho</p>
        </div>
        <Button asChild>
          <Link href="/quan-tri/kho/them"><Plus className="w-4 h-4" />Thêm kho</Link>
        </Button>
      </div>

      <Card className="flex flex-col md:flex-1 md:overflow-hidden md:min-h-[320px]">
        <Table containerClassName="md:flex-1 md:min-h-0">
          <TableHeader>
            <TableRow>
              <TableHead>Mã kho</TableHead>
              <TableHead>Tên</TableHead>
              <TableHead>Địa chỉ</TableHead>
              <TableHead className="text-right">Số phiếu</TableHead>
              <TableHead className="text-right">Người dùng</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {warehouses.map((w) => (
              <TableRow key={w.id}>
                <TableCell className="font-mono font-medium">{w.code}</TableCell>
                <TableCell>{w.name}</TableCell>
                <TableCell className="text-muted-foreground">{w.address || '—'}</TableCell>
                <TableCell className="text-right font-mono">{w._count.receipts}</TableCell>
                <TableCell className="text-right font-mono">{w._count.userLinks}</TableCell>
                <TableCell>
                  {w.active ? <span className="badge badge-success">Hoạt động</span> : <span className="badge badge-neutral">Lưu trữ</span>}
                </TableCell>
                <TableCell>
                  <Link href={`/quan-tri/kho/${w.id}`} aria-label="Sửa kho" className="inline-flex p-1.5 rounded-md hover:bg-muted">
                    <Pencil className="w-4 h-4" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Pagination
          basePath="/quan-tri/kho"
          page={meta.page}
          pageCount={meta.pageCount}
          pageSize={meta.pageSize}
          total={meta.total}
          from={meta.from}
          to={meta.to}
          itemLabel="kho"
        />
      </Card>
    </div>
  );
}
