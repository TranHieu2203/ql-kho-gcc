import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { prisma } from '@/lib/db/prisma';
import { validateRequest, getUserWarehouses } from '@/lib/auth/lucia';
import { ReceiptForm } from '@/components/forms/receipt-form';
import { createInboundReceipt } from '../actions';

export default async function NewInboundPage() {
  const { user } = await validateRequest();
  if (!user) redirect('/login');

  const warehouses = user.role === 'ADMIN'
    ? await prisma.warehouse.findMany({ where: { active: true }, orderBy: { code: 'asc' } })
    : await getUserWarehouses(user.id);
  const products = await prisma.product.findMany({ where: { active: true }, orderBy: { sku: 'asc' } });

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <Link href="/nhap-kho" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ChevronLeft className="w-4 h-4" />Quay lại danh sách
      </Link>
      <h1 className="text-2xl font-bold mb-6">Tạo phiếu nhập</h1>
      <ReceiptForm
        type="INBOUND"
        products={products}
        warehouses={warehouses}
        action={createInboundReceipt}
      />
    </div>
  );
}
