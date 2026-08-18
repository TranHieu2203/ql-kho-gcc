import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import { Button } from '@/components/ui/button';
import { Plus, FileUp, Ban, Download } from 'lucide-react';
import { validateRequest } from '@/lib/auth/lucia';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { parsePaging, pageMeta } from '@/lib/pagination';
import { formatNumber } from '@/lib/utils';
import { ProductRowActions } from './row-actions';

export const dynamic = 'force-dynamic';

type StatusFilter = 'dang-ap-dung' | 'ngung-ap-dung' | 'tat-ca';

type SearchParams = { q?: string; trangThai?: string; page?: string; pageSize?: string };

export default async function CatalogPage({ searchParams }: { searchParams: SearchParams }) {
  const { user } = await validateRequest();
  const isAdmin = user?.role === 'ADMIN';
  const q = (searchParams.q ?? '').trim();

  // Mặt hàng ngừng áp dụng bị ẩn hoàn toàn với người dùng thường.
  const requested = (searchParams.trangThai ?? 'dang-ap-dung') as StatusFilter;
  const status: StatusFilter = isAdmin && (requested === 'ngung-ap-dung' || requested === 'tat-ca')
    ? requested
    : 'dang-ap-dung';

  const searchWhere = q
    ? {
        OR: [
          { sku: { contains: q } },
          { fullName: { contains: q } },
          { brand: { contains: q } },
          { size: { contains: q } },
          { pattern: { contains: q } }
        ]
      }
    : {};

  const statusWhere =
    status === 'dang-ap-dung' ? { active: true } : status === 'ngung-ap-dung' ? { active: false } : {};

  const where = { ...statusWhere, ...searchWhere };
  const paging = parsePaging(searchParams);

  const total = await prisma.product.count({ where });
  const meta = pageMeta(total, paging);

  const [products, activeCount, inactiveCount] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (meta.page - 1) * meta.pageSize,
      take: meta.pageSize
    }),
    prisma.product.count({ where: { active: true } }),
    prisma.product.count({ where: { active: false } })
  ]);

  // Tồn + số tham chiếu, chỉ tính cho các sản phẩm đang hiển thị trên trang này
  const pageProductIds = products.map((p) => p.id);
  const [stockGroups, lineGroups] = await Promise.all([
    prisma.stockMovement.groupBy({
      by: ['productId'],
      where: { productId: { in: pageProductIds } },
      _sum: { qtyDelta: true },
      _count: { _all: true }
    }),
    prisma.receiptLine.groupBy({
      by: ['productId'],
      where: { productId: { in: pageProductIds } },
      _count: { _all: true }
    })
  ]);

  const stockMap = new Map<string, number>();
  const usageMap = new Map<string, number>();
  for (const g of stockGroups) {
    stockMap.set(g.productId, g._sum.qtyDelta ?? 0);
    usageMap.set(g.productId, g._count._all);
  }
  for (const g of lineGroups) {
    usageMap.set(g.productId, (usageMap.get(g.productId) ?? 0) + g._count._all);
  }

  const tabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'dang-ap-dung', label: 'Đang áp dụng', count: activeCount },
    { key: 'ngung-ap-dung', label: 'Ngừng áp dụng', count: inactiveCount },
    { key: 'tat-ca', label: 'Tất cả', count: activeCount + inactiveCount }
  ];

  function tabHref(key: StatusFilter) {
    const sp = new URLSearchParams();
    if (q) sp.set('q', q);
    if (key !== 'dang-ap-dung') sp.set('trangThai', key);
    const qs = sp.toString();
    return qs ? `/danh-muc?${qs}` : '/danh-muc';
  }

  // Export không phân trang: xuất toàn bộ kết quả khớp bộ lọc hiện tại
  const exportSp = new URLSearchParams();
  if (q) exportSp.set('q', q);
  if (status !== 'dang-ap-dung') exportSp.set('trangThai', status);
  const exportHref = `/api/reports/danh-muc.xlsx?${exportSp.toString()}`;

  return (
    <div className="h-full min-h-0 flex flex-col gap-4 overflow-y-auto p-4 md:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Danh mục sản phẩm</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total} sản phẩm
            {isAdmin && status === 'dang-ap-dung' && inactiveCount > 0 && (
              <> · {inactiveCount} đang ngừng áp dụng</>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <a href={exportHref}><Download className="w-4 h-4" />Xuất Excel</a>
          </Button>
          {isAdmin && (
            <Button asChild variant="outline">
              <Link href="/danh-muc/import"><FileUp className="w-4 h-4" />Import Excel</Link>
            </Button>
          )}
          <Button asChild>
            <Link href="/danh-muc/them"><Plus className="w-4 h-4" />Thêm sản phẩm</Link>
          </Button>
        </div>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden min-h-[260px]">
        <div className="p-4 border-b space-y-3 flex-shrink-0">
          <form>
            {status !== 'dang-ap-dung' && <input type="hidden" name="trangThai" value={status} />}
            {searchParams.pageSize && <input type="hidden" name="pageSize" value={searchParams.pageSize} />}
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Tìm theo SKU / thương hiệu / size / mã gai..."
              className="w-full max-w-md h-9 px-3 rounded-md border bg-background text-sm"
            />
          </form>

          {isAdmin && (
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Lọc theo trạng thái áp dụng">
              {tabs.map((t) => (
                <Link
                  key={t.key}
                  href={tabHref(t.key)}
                  role="tab"
                  aria-selected={status === t.key}
                  className={
                    status === t.key
                      ? 'inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium bg-primary text-primary-foreground'
                      : 'inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium border hover:bg-muted'
                  }
                >
                  {t.label}
                  <span className="opacity-70">({t.count})</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {status === 'ngung-ap-dung' && (
          <div className="px-4 py-2.5 text-xs text-muted-foreground border-b bg-muted/40 flex items-start gap-2 flex-shrink-0">
            <Ban className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>
              Các mặt hàng dưới đây đã ẩn khỏi tồn kho, ô chọn sản phẩm khi lập phiếu, điều chỉnh tồn và báo cáo NXT.
              Lịch sử nhập xuất cũ vẫn còn — dùng &ldquo;Áp dụng lại&rdquo; để đưa trở lại sử dụng.
            </span>
          </div>
        )}

        {products.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="text-sm text-muted-foreground mb-4">
              {q
                ? 'Không tìm thấy sản phẩm phù hợp.'
                : status === 'ngung-ap-dung'
                  ? 'Không có mặt hàng nào đang ngừng áp dụng.'
                  : 'Chưa có sản phẩm nào.'}
            </div>
            {!q && status !== 'ngung-ap-dung' && (
              <Button asChild>
                <Link href="/danh-muc/them">Tạo sản phẩm đầu tiên</Link>
              </Button>
            )}
          </div>
        ) : (
          <Table containerClassName="flex-1 min-h-0">
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
                  <TableRow key={p.id} className={p.active ? undefined : 'opacity-60'}>
                    <TableCell className="font-mono font-medium">
                      <Link href={`/ton-kho/${encodeURIComponent(p.sku)}`} className="text-primary hover:underline">
                        {p.sku}
                      </Link>
                    </TableCell>
                    <TableCell>{p.fullName}</TableCell>
                    <TableCell>{p.brand}</TableCell>
                    <TableCell>{p.size}</TableCell>
                    <TableCell>{p.pattern}</TableCell>
                    <TableCell>{p.defaultUnit === 'BO' ? 'Bộ' : 'Chiếc'}</TableCell>
                    <TableCell className="text-right font-mono">{formatNumber(stock)}</TableCell>
                    <TableCell>
                      {p.active ? (
                        <span className="badge badge-success">Hoạt động</span>
                      ) : (
                        <span className="badge badge-neutral">Ngừng áp dụng</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <ProductRowActions
                        productId={p.id}
                        sku={p.sku}
                        active={p.active}
                        isAdmin={isAdmin}
                        usageCount={usageMap.get(p.id) ?? 0}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        <Pagination
          basePath="/danh-muc"
          params={{ q: q || undefined, trangThai: status !== 'dang-ap-dung' ? status : undefined }}
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
