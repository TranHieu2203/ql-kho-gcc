import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Prisma, Product } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { validateRequest, getUserWarehouses } from '@/lib/auth/lucia';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatNumber } from '@/lib/utils';
import { CheckCircle2, AlertTriangle, XCircle, RotateCcw, Search } from 'lucide-react';
import { Pagination } from '@/components/ui/pagination';
import { parsePaging, pageMeta } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

type StockState = 'all' | 'instock' | 'low' | 'out' | 'negative';
const STOCK_STATES: StockState[] = ['all', 'instock', 'low', 'out', 'negative'];

type SearchParams = {
  q?: string;
  warehouseId?: string;
  brand?: string;
  size?: string;
  stockState?: string;
  page?: string;
  pageSize?: string;
};

function matchesState(total: number, threshold: number, state: StockState): boolean {
  switch (state) {
    case 'instock': return total > 0;
    case 'low': return total > 0 && total < threshold;
    case 'out': return total <= 0;
    case 'negative': return total < 0;
    default: return true;
  }
}

const fieldCls = 'h-9 w-full rounded-md border bg-background px-3 text-sm';
const labelCls = 'text-xs font-medium text-muted-foreground';

export default async function StockPage({ searchParams }: { searchParams: SearchParams }) {
  const { user } = await validateRequest();
  if (!user) redirect('/login');
  const q = (searchParams.q ?? '').trim();
  const brand = searchParams.brand && searchParams.brand !== 'ALL' ? searchParams.brand : undefined;
  const size = searchParams.size && searchParams.size !== 'ALL' ? searchParams.size : undefined;
  const stockState: StockState = STOCK_STATES.includes(searchParams.stockState as StockState)
    ? (searchParams.stockState as StockState)
    : 'all';

  const allWarehouses = user.role === 'ADMIN'
    ? await prisma.warehouse.findMany({ where: { active: true }, orderBy: { code: 'asc' } })
    : await getUserWarehouses(user.id).then(async (ids) =>
        prisma.warehouse.findMany({ where: { id: { in: ids.map((w) => w.id) }, active: true }, orderBy: { code: 'asc' } })
      );
  // Lọc theo kho: chỉ hiện cột + tính tồn của kho được chọn (kho phải nằm trong danh sách được phép)
  const selectedWh = allWarehouses.find((w) => w.id === searchParams.warehouseId);
  const warehouses = selectedWh ? [selectedWh] : allWarehouses;
  const whIds = warehouses.map((w) => w.id);

  const where: Prisma.ProductWhereInput = {
    active: true,
    ...(brand ? { brand } : {}),
    ...(size ? { size } : {}),
    ...(q
      ? {
          OR: [
            { sku: { contains: q } },
            { fullName: { contains: q } },
            { brand: { contains: q } },
            { size: { contains: q } },
            { pattern: { contains: q } }
          ]
        }
      : {})
  };

  // Danh sách thương hiệu / size cho dropdown (từ SP đang hoạt động, không phụ thuộc bộ lọc hiện tại)
  const [brandRows, sizeRows] = await Promise.all([
    prisma.product.findMany({ where: { active: true }, select: { brand: true }, distinct: ['brand'], orderBy: { brand: 'asc' } }),
    prisma.product.findMany({ where: { active: true }, select: { size: true }, distinct: ['size'], orderBy: { size: 'asc' } })
  ]);

  const paging = parsePaging(searchParams);
  let total: number;
  let meta: ReturnType<typeof pageMeta>;
  let products: Product[];
  const stockMap = new Map<string, number>();

  if (stockState === 'all') {
    total = await prisma.product.count({ where });
    meta = pageMeta(total, paging);
    products = await prisma.product.findMany({
      where,
      orderBy: { sku: 'asc' },
      skip: (meta.page - 1) * meta.pageSize,
      take: meta.pageSize
    });
    // Chỉ tính tồn cho các sản phẩm đang hiển thị trên trang này
    const movements = await prisma.stockMovement.groupBy({
      by: ['warehouseId', 'productId'],
      where: { warehouseId: { in: whIds }, productId: { in: products.map((p) => p.id) } },
      _sum: { qtyDelta: true }
    });
    for (const m of movements) stockMap.set(`${m.warehouseId}|${m.productId}`, m._sum.qtyDelta ?? 0);
  } else {
    // Lọc theo trạng thái tồn cần biết tồn của mọi SP khớp điều kiện → tính toàn bộ rồi mới phân trang.
    const candidates = await prisma.product.findMany({
      where,
      orderBy: { sku: 'asc' },
      select: { id: true, lowStockThreshold: true }
    });
    const movements = await prisma.stockMovement.groupBy({
      by: ['warehouseId', 'productId'],
      where: { warehouseId: { in: whIds } },
      _sum: { qtyDelta: true }
    });
    const totals = new Map<string, number>();
    for (const m of movements) {
      const v = m._sum.qtyDelta ?? 0;
      stockMap.set(`${m.warehouseId}|${m.productId}`, v);
      totals.set(m.productId, (totals.get(m.productId) ?? 0) + v);
    }
    const matched = candidates.filter((p) => matchesState(totals.get(p.id) ?? 0, p.lowStockThreshold, stockState));
    total = matched.length;
    meta = pageMeta(total, paging);
    const pageIds = matched.slice((meta.page - 1) * meta.pageSize, meta.page * meta.pageSize).map((p) => p.id);
    products = await prisma.product.findMany({ where: { id: { in: pageIds } }, orderBy: { sku: 'asc' } });
  }

  const filterParams = {
    q: q || undefined,
    warehouseId: selectedWh?.id,
    brand,
    size,
    stockState: stockState !== 'all' ? stockState : undefined
  };
  const activeCount = Object.values(filterParams).filter(Boolean).length;

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 md:h-full md:min-h-0 md:overflow-y-auto">
      <div>
        <h1 className="text-2xl font-bold">Tồn kho hiện tại</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {total} sản phẩm · {selectedWh ? `kho ${selectedWh.code}` : `${warehouses.length} kho`}
        </p>
      </div>

      <Card className="flex flex-col md:flex-1 md:overflow-hidden md:min-h-[320px]">
        <form action="/ton-kho" className="p-4 border-b flex-shrink-0 space-y-3">
          {searchParams.pageSize && <input type="hidden" name="pageSize" value={searchParams.pageSize} />}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="space-y-1.5 col-span-2 md:col-span-1">
              <label className={labelCls} htmlFor="f-q">Tìm SKU / tên / thương hiệu / size</label>
              <input id="f-q" type="search" name="q" defaultValue={q} placeholder="Gõ để tìm..." className={fieldCls} />
            </div>
            <div className="space-y-1.5 col-span-2 md:col-span-1">
              <label className={labelCls} htmlFor="f-wh">Kho</label>
              <select id="f-wh" name="warehouseId" defaultValue={selectedWh?.id ?? 'ALL'} className={fieldCls}>
                <option value="ALL">Tất cả các kho</option>
                {allWarehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.code} · {w.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={labelCls} htmlFor="f-brand">Thương hiệu</label>
              <select id="f-brand" name="brand" defaultValue={brand ?? 'ALL'} className={fieldCls}>
                <option value="ALL">Tất cả</option>
                {brandRows.map((b) => (
                  <option key={b.brand} value={b.brand}>{b.brand}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={labelCls} htmlFor="f-size">Size</label>
              <select id="f-size" name="size" defaultValue={size ?? 'ALL'} className={fieldCls}>
                <option value="ALL">Tất cả</option>
                {sizeRows.map((r) => (
                  <option key={r.size} value={r.size}>{r.size}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 col-span-2 md:col-span-1">
              <label className={labelCls} htmlFor="f-state">Trạng thái tồn</label>
              <select id="f-state" name="stockState" defaultValue={stockState} className={fieldCls}>
                <option value="all">Tất cả</option>
                <option value="instock">Còn hàng (&gt; 0)</option>
                <option value="low">Sắp hết (dưới ngưỡng)</option>
                <option value="out">Hết hàng (≤ 0)</option>
                <option value="negative">Tồn âm (&lt; 0)</option>
              </select>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 flex-wrap">
            {activeCount > 0 && (
              <Button variant="outline" asChild>
                <Link href="/ton-kho"><RotateCcw className="w-4 h-4" />Xoá lọc</Link>
              </Button>
            )}
            <Button type="submit"><Search className="w-4 h-4" />Áp dụng lọc</Button>
          </div>
        </form>
        <Table containerClassName="md:flex-1 md:min-h-0">
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
            {products.length === 0 && (
              <TableRow>
                <TableCell colSpan={warehouses.length + 6} className="text-center py-8 text-sm text-muted-foreground">
                  {activeCount > 0 ? 'Không có sản phẩm phù hợp. Thử bỏ bớt điều kiện lọc.' : 'Chưa có sản phẩm nào.'}
                </TableCell>
              </TableRow>
            )}
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
                      <TableCell key={w.id} className={`text-right font-mono${v < 0 ? ' text-danger' : ''}`}>{v}</TableCell>
                    );
                  })}
                  <TableCell className={`text-right font-mono font-bold${totalForProduct < 0 ? ' text-danger' : ''}`}>{formatNumber(totalForProduct)}</TableCell>
                  <TableCell>
                    {totalForProduct <= 0 ? (
                      <span className="badge badge-danger"><XCircle className="w-3.5 h-3.5" />{totalForProduct < 0 ? 'Tồn âm' : 'Hết hàng'}</span>
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
          params={filterParams}
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
