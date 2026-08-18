import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus } from 'lucide-react';
import { formatDate, formatNumber } from '@/lib/utils';
import { validateRequest, getUserWarehouses } from '@/lib/auth/lucia';
import { Pagination } from '@/components/ui/pagination';
import { parsePaging, pageMeta } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

type SearchParams = { page?: string; pageSize?: string };

export default async function TransferListPage({ searchParams }: { searchParams: SearchParams }) {
  const { user } = await validateRequest();
  if (!user) redirect('/login');
  const myWhIds = user.role === 'ADMIN'
    ? (await prisma.warehouse.findMany({ select: { id: true } })).map((w) => w.id)
    : (await getUserWarehouses(user.id)).map((w) => w.id);

  const where = {
    type: 'TRANSFER',
    OR: [
      { fromWarehouseId: { in: myWhIds } },
      { toWarehouseId: { in: myWhIds } }
    ]
  };
  const paging = parsePaging(searchParams);
  const total = await prisma.receipt.count({ where });
  const meta = pageMeta(total, paging);

  const receipts = await prisma.receipt.findMany({
    where,
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    skip: (meta.page - 1) * meta.pageSize,
    take: meta.pageSize,
    include: {
      fromWarehouse: { select: { code: true, name: true } },
      toWarehouse: { select: { code: true, name: true } },
      lines: { select: { quantity: true } },
      createdBy: { select: { fullName: true } }
    }
  });

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 md:h-full md:min-h-0 md:overflow-y-auto">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Phiếu Chuyển kho</h1>
          <p className="text-sm text-muted-foreground mt-1">{total} phiếu chuyển</p>
        </div>
        <Button asChild>
          <Link href="/chuyen-kho/tao"><Plus className="w-4 h-4" />Tạo phiếu chuyển</Link>
        </Button>
      </div>
      <Card className="flex flex-col md:flex-1 md:overflow-hidden md:min-h-[320px]">
        {receipts.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">Chưa có phiếu chuyển kho nào.</div>
        ) : (
          <Table containerClassName="md:flex-1 md:min-h-0">
            <TableHeader>
              <TableRow>
                <TableHead>Mã phiếu</TableHead>
                <TableHead>Ngày</TableHead>
                <TableHead>Từ kho</TableHead>
                <TableHead>Đến kho</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="text-right">Tổng SL</TableHead>
                <TableHead>Người tạo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts.map((r) => {
                const total = r.lines.reduce((s, l) => s + l.quantity, 0);
                return (
                  <TableRow key={r.id}>
                    <TableCell><Link href={`/chuyen-kho/${r.id}`} className="font-mono font-medium text-primary hover:underline">{r.code}</Link></TableCell>
                    <TableCell>{formatDate(r.date)}</TableCell>
                    <TableCell>{r.fromWarehouse?.name ?? '—'}</TableCell>
                    <TableCell>{r.toWarehouse?.name ?? '—'}</TableCell>
                    <TableCell>
                      {r.status === 'IN_TRANSIT' ? (
                        <span className="badge badge-warning">Đang đi</span>
                      ) : r.status === 'CONFIRMED' ? (
                        <span className="badge badge-success">Hoàn tất</span>
                      ) : (
                        <span className="badge badge-neutral">{r.status}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatNumber(total)}</TableCell>
                    <TableCell>{r.createdBy.fullName}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        <Pagination
          basePath="/chuyen-kho"
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
