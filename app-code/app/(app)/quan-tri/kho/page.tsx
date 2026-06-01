import Link from 'next/link';
import { redirect } from 'next/navigation';
import { validateRequest } from '@/lib/auth/lucia';
import { prisma } from '@/lib/db/prisma';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, ChevronLeft, Pencil } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminWarehousesPage() {
  const { user } = await validateRequest();
  if (!user || user.role !== 'ADMIN') redirect('/tong-quan');

  const warehouses = await prisma.warehouse.findMany({
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { receipts: true, userLinks: true } } }
  });

  return (
    <div className="p-4 md:p-6 space-y-4">
      <Link href="/quan-tri" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="w-4 h-4" />Quay lại quản trị
      </Link>
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Quản lý kho</h1>
          <p className="text-sm text-muted-foreground mt-1">{warehouses.length} kho</p>
        </div>
        <Button asChild>
          <Link href="/quan-tri/kho/them"><Plus className="w-4 h-4" />Thêm kho</Link>
        </Button>
      </div>

      <Card>
        <Table>
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
      </Card>
    </div>
  );
}
