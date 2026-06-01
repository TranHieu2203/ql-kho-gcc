import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { validateRequest } from '@/lib/auth/lucia';
import { prisma } from '@/lib/db/prisma';
import { WarehouseForm } from '../warehouse-form';

export default async function EditWarehousePage({ params }: { params: { id: string } }) {
  const { user } = await validateRequest();
  if (!user || user.role !== 'ADMIN') redirect('/tong-quan');
  const wh = await prisma.warehouse.findUnique({ where: { id: params.id } });
  if (!wh) notFound();

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <Link href="/quan-tri/kho" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ChevronLeft className="w-4 h-4" />Quay lại
      </Link>
      <h1 className="text-2xl font-bold mb-1">Sửa kho</h1>
      <p className="text-sm text-muted-foreground mb-6 font-mono">{wh.code}</p>
      <WarehouseForm initial={wh} />
    </div>
  );
}
