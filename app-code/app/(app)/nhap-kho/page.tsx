import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus } from 'lucide-react';
import { formatDate, formatNumber } from '@/lib/utils';
import { validateRequest, getUserWarehouses } from '@/lib/auth/lucia';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function InboundListPage() {
  const { user } = await validateRequest();
  if (!user) redirect('/login');
  const myWh = user.role === 'ADMIN'
    ? await prisma.warehouse.findMany({ select: { id: true } })
    : (await getUserWarehouses(user.id)).map((w) => ({ id: w.id }));

  const receipts = await prisma.receipt.findMany({
    where: { type: 'INBOUND', warehouseId: { in: myWh.map((w) => w.id) } },
    orderBy: { date: 'desc' },
    take: 100,
    include: {
      warehouse: { select: { name: true, code: true } },
      lines: { select: { quantity: true } },
      createdBy: { select: { fullName: true } }
    }
  });

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Phiếu Nhập kho</h1>
          <p className="text-sm text-muted-foreground mt-1">{receipts.length} phiếu gần nhất</p>
        </div>
        <Button asChild>
          <Link href="/nhap-kho/tao"><Plus className="w-4 h-4" />Tạo phiếu nhập</Link>
        </Button>
      </div>

      <Card>
        {receipts.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-sm text-muted-foreground mb-4">Chưa có phiếu nhập nào.</p>
            <Button asChild>
              <Link href="/nhap-kho/tao">Tạo phiếu nhập đầu tiên</Link>
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã phiếu</TableHead>
                <TableHead>Ngày</TableHead>
                <TableHead>Kho</TableHead>
                <TableHead className="text-right">Tổng SL</TableHead>
                <TableHead className="text-right">Số dòng</TableHead>
                <TableHead>Người tạo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts.map((r) => {
                const totalQty = r.lines.reduce((s, l) => s + l.quantity, 0);
                return (
                  <TableRow key={r.id}>
                    <TableCell><Link href={`/nhap-kho/${r.id}`} className="font-mono font-medium text-primary hover:underline">{r.code}</Link></TableCell>
                    <TableCell>{formatDate(r.date)}</TableCell>
                    <TableCell>{r.warehouse.name}</TableCell>
                    <TableCell className="text-right font-mono">{formatNumber(totalQty)}</TableCell>
                    <TableCell className="text-right font-mono">{r.lines.length}</TableCell>
                    <TableCell>{r.createdBy.fullName}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
