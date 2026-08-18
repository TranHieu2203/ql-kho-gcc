import Link from 'next/link';
import { redirect } from 'next/navigation';
import { validateRequest } from '@/lib/auth/lucia';
import { prisma } from '@/lib/db/prisma';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronLeft } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { Pagination } from '@/components/ui/pagination';
import { parsePaging, pageMeta } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

type SearchParams = { page?: string; pageSize?: string };

export default async function AuditLogPage({ searchParams }: { searchParams: SearchParams }) {
  const { user } = await validateRequest();
  if (!user || user.role !== 'ADMIN') redirect('/tong-quan');

  const paging = parsePaging(searchParams);
  const total = await prisma.auditLog.count();
  const meta = pageMeta(total, paging);

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    skip: (meta.page - 1) * meta.pageSize,
    take: meta.pageSize,
    include: { user: { select: { username: true, fullName: true } } }
  });

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 md:h-full md:min-h-0 md:overflow-y-auto">
      <Link href="/quan-tri" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="w-4 h-4" />Quay lại
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Audit log</h1>
        <p className="text-sm text-muted-foreground mt-1">{total} mục</p>
      </div>
      <Card className="flex flex-col md:flex-1 md:overflow-hidden md:min-h-[320px]">
        <Table containerClassName="md:flex-1 md:min-h-0">
          <TableHeader>
            <TableRow>
              <TableHead>Thời gian</TableHead>
              <TableHead>Người dùng</TableHead>
              <TableHead>Hành động</TableHead>
              <TableHead>Loại</TableHead>
              <TableHead>Entity ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-mono text-xs">{formatDateTime(l.createdAt)}</TableCell>
                <TableCell>{l.user?.fullName ?? '—'}</TableCell>
                <TableCell>{l.action}</TableCell>
                <TableCell>{l.entityType}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{l.entityId.slice(0, 12)}...</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Pagination
          basePath="/quan-tri/audit-log"
          page={meta.page}
          pageCount={meta.pageCount}
          pageSize={meta.pageSize}
          total={meta.total}
          from={meta.from}
          to={meta.to}
          itemLabel="mục"
        />
      </Card>
    </div>
  );
}
