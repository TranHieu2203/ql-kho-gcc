import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { validateRequest, getUserWarehouses } from '@/lib/auth/lucia';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatNumber } from '@/lib/utils';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { Pagination } from '@/components/ui/pagination';
import { parsePaging, pageMeta } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

type SearchParams = { q?: string; page?: string; pageSize?: string };

export default async function StockPage({ searchParams }: { searchParams: SearchParams }) {
  const { user } = await validateRequest();
  if (!user) redirect('/login');
  const q = (searchParams.q ?? '').trim();

  const warehouses = user.role === 'ADMIN'
    ? await prisma.warehouse.findMany({ where: { active: true }, orderBy: { code: 'asc' } })
    : await getUserWarehouses(user.id).then(async (ids) =>
        prisma.warehouse.findMany({ where: { id: { in: ids.map((w) => w.id) }, active: true }, orderBy: { code: 'asc' } })
      );

  const where = q
    ? {
        active: true,
        OR: [
          { sku: { contains: q } },
          { brand: { contains: q } },
          { size: { contains: q } },
          { pattern: { contains: q } }
        ]
      }
    : { active: true };

  const paging = parsePaging(searchParams);
  const total = await prisma.product.count({ where });
  const meta = pageMeta(total, paging);

  const products = await prisma.product.findMany({
    where,
    orderBy: { sku: 'asc' },
    skip: (meta.page - 1) * meta.pageSize,
    take: meta.pageSize
  });

  const whIds = warehouses.map((w) => w.id);
  // Chỉ tính tồn cho các sản phẩm đang hiển thị trên trang này
  const movements = await prisma.stockMovement.groupBy({
    by: ['warehouseId', 'productId'],
    where: { warehouseId: { in: whIds }, productId: { in: products.map((p) => p.id) } },
    _sum: { qtyDelta: true }
  });

  const stockMap = new Map<string, number>();
  for (const m of movements) {
    stockMap.set(`${m.warehouseId}|${m.productId}`, m._sum.qtyDelta ?? 0);
  }

  return (
    <div className="h-full min-h-0 flex flex-col gap-4 overflow-y-auto p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Tồn kho hiện tại</h1>
        <p className="text-sm text-muted-foreground mt-1">{total} sản phẩm · {warehouses.length} kho</p>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden min-h-[260px]">
        <div className="p-4 border-b flex-shrink-0">
          <form>
            {searchParams.pageSize && <input type="hidden" name="pageSize" value={searchParams.pageSize} />}
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Tìm theo SKU / thương hiệu / size..."
              className="w-full max-w-md h-9 px-3 rounded-md border bg-background text-sm"
            />
          </form>
        </div>
        <Table containerClassName="flex-1 min-h-0">
          <TableHeader>
            <TableRow>
              <TableHead>Mã hàng</TableHead>
              <TableHead>Thương hiệu</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Mã gai</TableHead>
              {warehouses.map((w) => (
                <TableHead key={w.id} className="text-right">{w.code}</TableHead>
              ))}
              <TableHead className="text-right">Tổng</TableHead>
              <TableHead>Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => {
              let totalForProduct = 0;
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-mono">
                    <Link href={`/ton-kho/${encodeURIComponent(p.sku)}`} className="text-primary hover:underline">{p.sku}</Link>
                  </TableCell>
                  <TableCell>{p.brand}</TableCell>
                  <TableCell>{p.size}</TableCell>
                  <TableCell>{p.pattern}</TableCell>
                  {warehouses.map((w) => {
                    const v = stockMap.get(`${w.id}|${p.id}`) ?? 0;
                    totalForProduct += v;
                    return (
                      <TableCell key={w.id} className="text-right font-mono">{v}</TableCell>
                    );
                  })}
                  <TableCell className="text-right font-mono font-bold">{formatNumber(totalForProduct)}</TableCell>
                  <TableCell>
                    {totalForProduct === 0 ? (
                      <span className="badge badge-danger"><XCircle className="w-3.5 h-3.5" />Hết hàng</span>
                    ) : totalForProduct < p.lowStockThreshold ? (
                      <span className="badge badge-warning"><AlertTriangle className="w-3.5 h-3.5" />Sắp hết</span>
                    ) : (
                      <span className="badge badge-success"><CheckCircle2 className="w-3.5 h-3.5" />Đủ tồn</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <Pagination
          basePath="/ton-kho"
          params={{ q: q || undefined }}
          page={meta.page}
          pageCount={meta.pageCount}
          pageSize={meta.pageSize}
          total={meta.total}
          from={meta.from}
          to={meta.to}
          itemLabel="sản phẩm"
        />
      </Card>
    </div>
  );
}
