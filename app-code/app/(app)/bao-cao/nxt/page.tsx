import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { validateRequest, getUserWarehouses } from '@/lib/auth/lucia';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { formatNumber } from '@/lib/utils';
import { runNxtReport, type NxtFilters } from '@/lib/domain/nxt-report';

export const dynamic = 'force-dynamic';

type SearchParams = {
  preset?: string;
  month?: string;
  from?: string;
  to?: string;
  warehouseId?: string;
  q?: string;
  brand?: string;
  stockState?: string;
  activeOnly?: string;
  sort?: string;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export default async function NxtReportPage({ searchParams }: { searchParams: SearchParams }) {
  const { user } = await validateRequest();
  if (!user) redirect('/login');

  const warehouses = user.role === 'ADMIN'
    ? await prisma.warehouse.findMany({ where: { active: true }, orderBy: { code: 'asc' } })
    : await getUserWarehouses(user.id).then(async (ids) =>
        prisma.warehouse.findMany({ where: { id: { in: ids.map((w) => w.id) }, active: true }, orderBy: { code: 'asc' } })
      );
  const userWhIds = warehouses.map((w) => w.id);

  const filters: NxtFilters = {
    preset: (searchParams.preset as any) || 'month',
    month: searchParams.month,
    from: searchParams.from,
    to: searchParams.to,
    warehouseId: searchParams.warehouseId,
    q: searchParams.q,
    brand: searchParams.brand,
    stockState: (searchParams.stockState as any) || 'all',
    activeOnly: (searchParams.activeOnly as any) || '1',
    sort: (searchParams.sort as any) || 'sku'
  };

  const result = await runNxtReport(filters, userWhIds);

  // Build export URL from all current searchParams
  const exportQs = new URLSearchParams();
  Object.entries(searchParams).forEach(([k, v]) => { if (v) exportQs.set(k, v); });
  const exportHref = `/api/reports/nxt.xlsx?${exportQs.toString()}`;

  const preset = filters.preset ?? 'month';
  const showCustom = preset === 'custom';
  const activeCount = Object.values(searchParams).filter(Boolean).length;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Báo cáo Nhập – Xuất – Tồn</h1>
          <p className="text-sm text-muted-foreground mt-1">Kỳ: {result.period.label}</p>
        </div>
        <div className="flex gap-2">
          {activeCount > 0 && (
            <Button variant="outline" asChild>
              <Link href="/bao-cao/nxt"><RotateCcw className="w-4 h-4" />Xoá lọc</Link>
            </Button>
          )}
          <Button asChild>
            <a href={exportHref}><Download className="w-4 h-4" />Xuất Excel</a>
          </Button>
        </div>
      </div>

      <Card>
        <form className="p-4 space-y-4 border-b">
          {/* Row 1: kỳ + kho */}
          <div className="grid md:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Kỳ báo cáo</label>
              <select
                name="preset"
                defaultValue={preset}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="month">Tháng này</option>
                <option value="quarter">Quý này</option>
                <option value="year">Năm này</option>
                <option value="custom">Tuỳ chọn (từ - đến)</option>
              </select>
            </div>

            {preset === 'month' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Tháng (nếu khác tháng hiện tại)</label>
                <input
                  type="month"
                  name="month"
                  defaultValue={searchParams.month ?? ''}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                />
              </div>
            )}

            {showCustom && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Từ ngày</label>
                  <input
                    type="date"
                    name="from"
                    defaultValue={searchParams.from ?? firstOfMonth()}
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Đến ngày</label>
                  <input
                    type="date"
                    name="to"
                    defaultValue={searchParams.to ?? today()}
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Kho</label>
              <select
                name="warehouseId"
                defaultValue={searchParams.warehouseId ?? 'ALL'}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="ALL">Tất cả các kho</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.code} · {w.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 2: search + brand + stock state + sort */}
          <div className="grid md:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Tìm SKU / thương hiệu / size / mã gai</label>
              <input
                type="search"
                name="q"
                defaultValue={searchParams.q ?? ''}
                placeholder="Gõ để tìm..."
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Thương hiệu</label>
              <select
                name="brand"
                defaultValue={searchParams.brand ?? 'ALL'}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="ALL">Tất cả thương hiệu</option>
                {result.brands.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Trạng thái tồn</label>
              <select
                name="stockState"
                defaultValue={searchParams.stockState ?? 'all'}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="all">Tất cả</option>
                <option value="ok">Đủ tồn (≥ ngưỡng)</option>
                <option value="low">Sắp hết (dưới ngưỡng)</option>
                <option value="out">Hết hàng (≤ 0)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Sắp xếp</label>
              <select
                name="sort"
                defaultValue={searchParams.sort ?? 'sku'}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="sku">Theo mã hàng (A→Z)</option>
                <option value="inbound">Nhập nhiều nhất</option>
                <option value="outbound">Xuất nhiều nhất</option>
                <option value="closing">Tồn cao nhất</option>
              </select>
            </div>
          </div>

          {/* Row 3: activeOnly + submit */}
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                name="activeOnly"
                value="1"
                defaultChecked={(searchParams.activeOnly ?? '1') === '1'}
              />
              Chỉ hiển thị SP có hoạt động trong kỳ
            </label>
            <div className="flex-1" />
            <Button type="submit">Áp dụng lọc</Button>
          </div>
        </form>

        <div className="grid grid-cols-2 md:grid-cols-4 divide-x border-b text-sm">
          <div className="p-4">
            <div className="text-muted-foreground text-xs">Số SKU</div>
            <div className="font-mono text-xl font-bold mt-1">{result.rows.length}</div>
          </div>
          <div className="p-4">
            <div className="text-muted-foreground text-xs">Tổng nhập</div>
            <div className="font-mono text-xl font-bold mt-1 text-success">{formatNumber(result.totals.inbound)}</div>
          </div>
          <div className="p-4">
            <div className="text-muted-foreground text-xs">Tổng xuất</div>
            <div className="font-mono text-xl font-bold mt-1 text-danger">{formatNumber(result.totals.outbound)}</div>
          </div>
          <div className="p-4">
            <div className="text-muted-foreground text-xs">Tồn cuối kỳ</div>
            <div className="font-mono text-xl font-bold mt-1 text-primary">{formatNumber(result.totals.closing)}</div>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">TT</TableHead>
              <TableHead>Mã hàng</TableHead>
              <TableHead>Thương hiệu</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Mã gai</TableHead>
              <TableHead className="text-right">Nhập</TableHead>
              <TableHead className="text-right">Xuất</TableHead>
              <TableHead className="text-right">Tồn cuối kỳ</TableHead>
              <TableHead className="text-center">Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="bg-primary-soft font-semibold">
              <TableCell colSpan={5}>Tổng cộng</TableCell>
              <TableCell className="text-right font-mono">{formatNumber(result.totals.inbound)}</TableCell>
              <TableCell className="text-right font-mono">{formatNumber(result.totals.outbound)}</TableCell>
              <TableCell className="text-right font-mono">{formatNumber(result.totals.closing)}</TableCell>
              <TableCell></TableCell>
            </TableRow>
            {result.rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-sm text-muted-foreground">
                  Không có dữ liệu phù hợp. Thử bỏ bớt điều kiện lọc.
                </TableCell>
              </TableRow>
            )}
            {result.rows.map((r, i) => {
              const st = r.closing <= 0 ? 'out' : r.closing < r.lowStockThreshold ? 'low' : 'ok';
              return (
                <TableRow key={r.sku}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="font-mono">{r.sku}</TableCell>
                  <TableCell>{r.brand}</TableCell>
                  <TableCell>{r.size}</TableCell>
                  <TableCell>{r.pattern}</TableCell>
                  <TableCell className="text-right font-mono text-success">{formatNumber(r.inbound)}</TableCell>
                  <TableCell className="text-right font-mono text-danger">{formatNumber(r.outbound)}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{formatNumber(r.closing)}</TableCell>
                  <TableCell className="text-center">
                    {st === 'out' && <span className="badge badge-danger">Hết</span>}
                    {st === 'low' && <span className="badge badge-warning">Sắp hết</span>}
                    {st === 'ok' && <span className="badge badge-success">Đủ</span>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
