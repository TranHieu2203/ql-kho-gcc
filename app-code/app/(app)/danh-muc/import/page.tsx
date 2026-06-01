import { redirect } from 'next/navigation';
import { validateRequest } from '@/lib/auth/lucia';
import { prisma } from '@/lib/db/prisma';
import { ImportWizard } from './import-wizard';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ImportPage() {
  const { user } = await validateRequest();
  if (!user || user.role !== 'ADMIN') redirect('/danh-muc');
  const warehouses = await prisma.warehouse.findMany({ where: { active: true }, orderBy: { code: 'asc' } });

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <Link href="/danh-muc" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ChevronLeft className="w-4 h-4" />Quay lại danh mục
      </Link>
      <h1 className="text-2xl font-bold mb-1">Import dữ liệu từ Excel</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Nạp danh mục sản phẩm + lịch sử phiếu nhập/xuất từ file Excel cũ (định dạng theo file mẫu THEO DÕI TỒN KHO LỐP).
      </p>
      <ImportWizard warehouses={warehouses} />
    </div>
  );
}
