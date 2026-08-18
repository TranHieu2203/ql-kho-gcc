import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus } from 'lucide-react';
import { formatDate, formatNumber } from '@/lib/utils';
import { validateRequest, getUserWarehouses } from '@/lib/auth/lucia';
import { redirect } from 'next/navigation';
import { Pagination } from '@/components/ui/pagination';
import { parsePaging, pageMeta } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

type SearchParams = { page?: string; pageSize?: string };

export default async function InboundListPage({ searchParams }: { searchParams: SearchParams }) {
  const { user } = await validateRequest();
  if (!user) redirect('/login');
  const myWh = user.role === 'ADMIN'
    ? await prisma.warehouse.findMany({ select: { id: true } })
    : (await getUserWarehouses(user.id)).map((w) => ({ id: w.id }));

  const where = { type: 'INBOUND', warehouseId: { in: myWh.map((w) => w.id) } };
  const paging = parsePaging(searchParams);
  const total = await prisma.receipt.count({ where });
  const meta = pageMeta(total, paging);

  const receipts = await prisma.receipt.findMany({
    where,
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    skip: (meta.page - 1) * meta.pageSize,
    take: meta.pageSize,
    include: {
      warehouse: { select: { name: true, code: true } },
      lines: { select: { quantity: true } },
      createdBy: { select: { fullName: true } }
    }
  });

  return (
    <div className="h-full min-h-0 flex flex-col gap-4 overflow-y-auto p-4 md:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Phiếu Nhập kho</h1>
          <p className="text-sm text-muted-foreground mt-1">{total} phiếu nhập</p>
        </div>
        <Button asChild>
          <Link href="/nhap-kho/tao"><Plus className="w-4 h-4" />Tạo phiếu nhập</Link>
        </Button>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden min-h-[260px]">
        {receipts.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-sm text-muted-foreground mb-4">Chưa có phiếu nhập nào.</p>
            <Button asChild>
              <Link href="/nhap-kho/tao">Tạo phiếu nhập đầu tiên</Link>
            </Button>
          </div>
        ) : (
          <Table containerClassName="flex-1 min-h-0">
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

        <Pagination
          basePath="/nhap-kho"
          page={meta.page}
          pageCount={meta.pageCount}
          pageSize={meta.pageSize}
          total={meta.total}
          from={meta.from}
          to={meta.to}
          itemLabel="phiếu"
        />
      </Card>
    </div>
  );
}
