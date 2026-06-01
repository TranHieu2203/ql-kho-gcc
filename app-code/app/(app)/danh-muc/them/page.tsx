import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { ProductForm } from '../product-form';

export default function NewProductPage() {
  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <Link href="/danh-muc" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ChevronLeft className="w-4 h-4" />Quay lại danh mục
      </Link>
      <h1 className="text-2xl font-bold mb-1">Thêm sản phẩm</h1>
      <p className="text-sm text-muted-foreground mb-6">Tạo SKU mới trong danh mục.</p>
      <ProductForm />
    </div>
  );
}
