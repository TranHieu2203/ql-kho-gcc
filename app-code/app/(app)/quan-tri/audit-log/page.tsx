import Link from 'next/link';
import { redirect } from 'next/navigation';
import { validateRequest } from '@/lib/auth/lucia';
import { prisma } from '@/lib/db/prisma';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronLeft } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AuditLogPage() {
  const { user } = await validateRequest();
  if (!user || user.role !== 'ADMIN') redirect('/tong-quan');

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { user: { select: { username: true, fullName: true } } }
  });

  return (
    <div className="p-4 md:p-6 space-y-4">
      <Link href="/quan-tri" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="w-4 h-4" />Quay lại
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Audit log</h1>
        <p className="text-sm text-muted-foreground mt-1">Hiển thị 200 mục mới nhất</p>
      </div>
      <Card>
        <Table>
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
      </Card>
    </div>
  );
}
