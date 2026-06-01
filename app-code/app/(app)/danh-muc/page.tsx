import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import { Button } from '@/components/ui/button';
import { Plus, FileUp } from 'lucide-react';
import { validateRequest } from '@/lib/auth/lucia';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { ProductRowActions } from './row-actions';

export const dynamic = 'force-dynamic';

export default async function CatalogPage({ searchParams }: { searchParams: { q?: string } }) {
  const { user } = await validateRequest();
  const q = (searchParams.q ?? '').trim();
  const products = await prisma.product.findMany({
    where: q
      ? {
          OR: [
            { sku: { contains: q } },
            { fullName: { contains: q } },
            { brand: { contains: q } },
            { size: { contains: q } },
            { pattern: { contains: q } }
          ]
        }
      : undefined,
    orderBy: { createdAt: 'desc' }
  });

  // Compute total stock per product (across all warehouses)
  const movements = await prisma.stockMovement.findMany({
    select: { productId: true, qtyDelta: true }
  });
  const stockMap = new Map<string, number>();
  for (const m of movements) stockMap.set(m.productId, (stockMap.get(m.productId) ?? 0) + m.qtyDelta);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Danh mục sản phẩm</h1>
          <p className="text-sm text-muted-foreground mt-1">{products.length} sản phẩm</p>
        </div>
        <div className="flex gap-2">
          {user?.role === 'ADMIN' && (
            <Button asChild variant="outline">
              <Link href="/danh-muc/import"><FileUp className="w-4 h-4" />Import Excel</Link>
            </Button>
          )}
          <Button asChild>
            <Link href="/danh-muc/them"><Plus className="w-4 h-4" />Thêm sản phẩm</Link>
          </Button>
        </div>
      </div>

      <Card>
        <div className="p-4 border-b">
          <form>
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Tìm theo SKU / thương hiệu / size / mã gai..."
              className="w-full max-w-md h-9 px-3 rounded-md border bg-background text-sm"
            />
          </form>
        </div>
        {products.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="text-sm text-muted-foreground mb-4">Chưa có sản phẩm nào.</div>
            <Button asChild>
              <Link href="/danh-muc/them">Tạo sản phẩm đầu tiên</Link>
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã SKU</TableHead>
                <TableHead>Tên đầy đủ</TableHead>
                <TableHead>Thương hiệu</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Mã gai</TableHead>
                <TableHead>ĐVT</TableHead>
                <TableHead className="text-right">Tồn tổng</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => {
                const stock = stockMap.get(p.id) ?? 0;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono font-medium">{p.sku}</TableCell>
                    <TableCell>{p.fullName}</TableCell>
                    <TableCell>{p.brand}</TableCell>
                    <TableCell>{p.size}</TableCell>
                    <TableCell>{p.pattern}</TableCell>
                    <TableCell>{p.defaultUnit === 'BO' ? 'Bộ' : 'Chiếc'}</TableCell>
                    <TableCell className="text-right font-mono">{stock}</TableCell>
                    <TableCell>
                      {p.active ? (
                        <span className="badge badge-success">Hoạt động</span>
                      ) : (
                        <span className="badge badge-neutral">Vô hiệu</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <ProductRowActions productId={p.id} active={p.active} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
