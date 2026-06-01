import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { validateRequest } from '@/lib/auth/lucia';
import { prisma } from '@/lib/db/prisma';
import { UserForm } from '../user-form';

export default async function EditUserPage({ params }: { params: { id: string } }) {
  const { user } = await validateRequest();
  if (!user || user.role !== 'ADMIN') redirect('/tong-quan');
  const target = await prisma.user.findUnique({
    where: { id: params.id },
    include: { warehouseLinks: { select: { warehouseId: true } } }
  });
  if (!target) notFound();
  const warehouses = await prisma.warehouse.findMany({ where: { active: true }, orderBy: { code: 'asc' } });

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <Link href="/quan-tri/nguoi-dung" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ChevronLeft className="w-4 h-4" />Quay lại
      </Link>
      <h1 className="text-2xl font-bold mb-1">Sửa người dùng</h1>
      <p className="text-sm text-muted-foreground mb-6 font-mono">@{target.username}</p>
      <UserForm warehouses={warehouses} initial={target} />
    </div>
  );
}
