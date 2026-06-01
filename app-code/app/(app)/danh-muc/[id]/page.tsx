import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { prisma } from '@/lib/db/prisma';
import { ProductForm } from '../product-form';

export default async function EditProductPage({ params }: { params: { id: string } }) {
  const p = await prisma.product.findUnique({ where: { id: params.id } });
  if (!p) notFound();
  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <Link href="/danh-muc" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ChevronLeft className="w-4 h-4" />Quay lại danh mục
      </Link>
      <h1 className="text-2xl font-bold mb-1">Sửa sản phẩm</h1>
      <p className="text-sm text-muted-foreground mb-6 font-mono">{p.sku}</p>
      <ProductForm initial={p} />
    </div>
  );
}
