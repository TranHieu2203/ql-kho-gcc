import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  ChevronLeft,
  ArrowDownToLine,
  ArrowUpFromLine,
  Repeat,
  Download,
  RotateCcw,
  Ban
} from 'lucide-react';
import { prisma } from '@/lib/db/prisma';
import { validateRequest, getUserWarehouses } from '@/lib/auth/lucia';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { formatDate, formatNumber } from '@/lib/utils';
import {
  runProductHistory,
  type KindFilter,
  type MovementKind,
  type ProductHistoryFilters
} from '@/lib/domain/product-history';

export const dynamic = 'force-dynamic';

type SearchParams = {
  preset?: string;
  month?: string;
  from?: string;
  to?: string;
  warehouseId?: string;
  kind?: string;
  page?: string;
  pageSize?: string;
};

const KIND_OPTIONS: { value: KindFilter; label: string }[] = [
  { value: 'ALL', label: 'Tất cả loại' },
  { value: 'INBOUND', label: 'Nhập kho' },
  { value: 'OUTBOUND', label: 'Xuất kho' },
  { value: 'TRANSFER', label: 'Chuyển kho' },
  { value: 'ADJUSTMENT', label: 'Điều chỉnh tồn' },
  { value: 'INITIAL_IMPORT', label: 'Tồn đầu kỳ (import)' }
];

function KindBadge({ kind }: { kind: MovementKind }) {
  switch (kind) {
    case 'INBOUND':
      return <span className="badge badge-success"><ArrowDownToLine className="w-3 h-3" />Nhập</span>;
    case 'OUTBOUND':
      return <span className="badge badge-danger"><ArrowUpFromLine className="w-3 h-3" />Xuất</span>;
    case 'TRANSFER_IN':
      return <span className="badge badge-info"><Repeat className="w-3 h-3" />Chuyển đến</span>;
    case 'TRANSFER_OUT':
      return <span className="badge badge-info"><Repeat className="w-3 h-3" />Chuyển đi</span>;
    case 'ADJUSTMENT':
      return <span className="badge badge-warning">Điều chỉnh</span>;
    case 'INITIAL_IMPORT':
      return <span className="badge badge-neutral">Tồn đầu</span>;
  }
}

/** ADJUSTMENT và INITIAL_IMPORT không có trang chi tiết phiếu. */
function receiptHref(kind: MovementKind, receiptId: string): string | null {
  if (kind === 'INBOUND') return `/nhap-kho/${receiptId}`;
  if (kind === 'OUTBOUND') return `/xuat-kho/${receiptId}`;
  if (kind === 'TRANSFER_IN' || kind === 'TRANSFER_OUT') return `/chuyen-kho/${receiptId}`;
  return null;
}

export default async function StockDetailPage({
  params,
  searchParams
}: {
  params: { sku: string };
  searchParams: SearchParams;
}) {
  const { user } = await validateRequest();
  if (!user) redirect('/login');

  const sku = decodeURIComponent(params.sku);
  const product = await prisma.product.findUnique({ where: { sku } });
  if (!product) notFound();
  // Mặt hàng ngừng áp dụng chỉ admin xem được
  if (!product.active && user.role !== 'ADMIN') notFound();

  const warehouses =
    user.role === 'ADMIN'
      ? await prisma.warehouse.findMany({ where: { active: true }, orderBy: { code: 'asc' } })
      : await getUserWarehouses(user.id).then((ids) =>
          prisma.warehouse.findMany({
            where: { id: { in: ids.map((w) => w.id) }, active: true },
            orderBy: { code: 'asc' }
          })
        );
  const userWhIds = warehouses.map((w) => w.id);

  const filters: ProductHistoryFilters = {
    preset: (searchParams.preset as any) || 'all',
    month: searchParams.month,
    from: searchParams.from,
    to: searchParams.to,
    warehouseId: searchParams.warehouseId,
    kind: (searchParams.kind as KindFilter) || 'ALL',
    page: Number(searchParams.page) || 1,
    pageSize: Number(searchParams.pageSize) || 50
  };

  const history = await runProductHistory(product.id, filters, userWhIds);

  // Tồn hiện tại theo từng kho (không phụ thuộc bộ lọc kỳ)
  const stockGroups = await prisma.stockMovement.groupBy({
    by: ['warehouseId'],
    where: { productId: product.id, warehouseId: { in: userWhIds } },
    _sum: { qtyDelta: true }
  });
  const stockByWh = new Map(stockGroups.map((g) => [g.warehouseId, g._sum.qtyDelta ?? 0]));
  const totalStock = Array.from(stockByWh.values()).reduce((a, b) => a + b, 0);

  const preset = filters.preset ?? 'all';
  const kind = filters.kind ?? 'ALL';
  const hasFilters =
    preset !== 'all' || kind !== 'ALL' || Boolean(searchParams.warehouseId && searchParams.warehouseId !== 'ALL');

  function buildQs(overrides: Record<string, string | number | undefined>): string {
    const sp = new URLSearchParams();
    const base: Record<string, string | undefined> = {
      preset: searchParams.preset,
      month: searchParams.month,
      from: searchParams.from,
      to: searchParams.to,
      warehouseId: searchParams.warehouseId,
      kind: searchParams.kind,
      page: searchParams.page,
      pageSize: searchParams.pageSize
    };
    for (const [k, v] of Object.entries({ ...base, ...overrides })) {
      if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
    }
    return sp.toString();
  }

  const exportHref = `/api/reports/lich-su-hang.xlsx?${buildQs({ sku, page: undefined, pageSize: undefined })}`;

  const summary = [
    { label: 'Tồn đầu kỳ', value: history.totals.opening, tone: '' },
    { label: 'Tổng nhập', value: history.totals.inbound, tone: 'text-success-strong' },
    { label: 'Tổng xuất', value: history.totals.outbound, tone: 'text-danger-strong' },
    { label: 'Tồn cuối kỳ', value: history.totals.closing, tone: 'text-primary' }
  ];

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 md:h-full md:min-h-0 md:overflow-y-auto max-w-7xl">
      <Link href="/ton-kho" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground flex-shrink-0">
        <ChevronLeft className="w-4 h-4" />Quay lại tồn kho
      </Link>
      <div className="flex items-start justify-between gap-4 flex-wrap flex-shrink-0">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold font-mono flex items-center gap-2">
            {product.sku}
            {!product.active && (
              <span className="badge badge-neutral font-sans text-xs"><Ban className="w-3 h-3" />Ngừng áp dụng</span>
            )}
          </h1>
          {/* Thông tin sản phẩm gồn một dòng để dành chỗ cho bảng lịch sử */}
          <p className="text-sm text-muted-foreground mt-1">
            {product.fullName}
            <span className="mx-1.5">·</span>{product.brand}
            <span className="mx-1.5">·</span>{product.size}
            <span className="mx-1.5">·</span>{product.pattern}
            <span className="mx-1.5">·</span>ĐVT {product.defaultUnit === 'BO' ? 'Bộ' : 'Chiếc'}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/danh-muc/${product.id}`}>Sửa thông tin</Link>
        </Button>
      </div>

      {/* Tồn hiện tại theo kho — dạng chip, không chiếm chiều cao như bảng */}
      <div className="flex flex-wrap items-center gap-2 text-sm flex-shrink-0">
        <span className="text-muted-foreground">Tồn hiện tại:</span>
        {warehouses.map((w) => (
          <span key={w.id} className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border bg-card">
            <span className="text-muted-foreground text-xs font-mono">{w.code}</span>
            <span className="font-mono font-semibold">{formatNumber(stockByWh.get(w.id) ?? 0)}</span>
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-primary-soft border border-primary/20">
          <span className="text-xs">Tổng</span>
          <span className="font-mono font-bold">{formatNumber(totalStock)}</span>
        </span>
      </div>

      <Card className="flex flex-col md:flex-1 md:overflow-hidden md:min-h-[480px]">
        <CardHeader className="flex-row items-center justify-between gap-4 flex-wrap space-y-0 flex-shrink-0">
          <CardTitle>Lịch sử nhập xuất</CardTitle>
          <div className="flex gap-2">
            {hasFilters && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/ton-kho/${encodeURIComponent(sku)}`}><RotateCcw className="w-4 h-4" />Xoá lọc</Link>
              </Button>
            )}
            <Button asChild size="sm">
              <a href={exportHref}><Download className="w-4 h-4" />Xuất Excel</a>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0 flex flex-col md:flex-1 md:min-h-0">
          {/* Bộ lọc */}
          <form className="p-4 grid md:grid-cols-4 gap-3 border-y bg-muted/20 flex-shrink-0">
            <div className="space-y-1.5">
              <label htmlFor="f-preset" className="text-xs font-medium text-muted-foreground">Kỳ</label>
              <select
                id="f-preset"
                name="preset"
                defaultValue={preset}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="all">Toàn bộ thời gian</option>
                <option value="month">Tháng này</option>
                <option value="quarter">Quý này</option>
                <option value="year">Năm này</option>
                <option value="custom">Tuỳ chọn (từ - đến)</option>
              </select>
            </div>

            {preset === 'month' && (
              <div className="space-y-1.5">
                <label htmlFor="f-month" className="text-xs font-medium text-muted-foreground">Tháng cụ thể</label>
                <input
                  id="f-month"
                  type="month"
                  name="month"
                  defaultValue={searchParams.month ?? ''}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                />
              </div>
            )}

            {preset === 'custom' && (
              <>
                <div className="space-y-1.5">
                  <label htmlFor="f-from" className="text-xs font-medium text-muted-foreground">Từ ngày</label>
                  <input
                    id="f-from"
                    type="date"
                    name="from"
                    defaultValue={searchParams.from ?? ''}
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="f-to" className="text-xs font-medium text-muted-foreground">Đến ngày</label>
                  <input
                    id="f-to"
                    type="date"
                    name="to"
                    defaultValue={searchParams.to ?? ''}
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <label htmlFor="f-wh" className="text-xs font-medium text-muted-foreground">Kho</label>
              <select
                id="f-wh"
                name="warehouseId"
                defaultValue={searchParams.warehouseId ?? 'ALL'}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="ALL">Tất cả kho</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="f-kind" className="text-xs font-medium text-muted-foreground">Loại giao dịch</label>
              <select
                id="f-kind"
                name="kind"
                defaultValue={kind}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {KIND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <Button type="submit" className="w-full md:w-auto">Áp dụng</Button>
            </div>
          </form>

          {/* Tổng kết kỳ */}
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 border-b flex-shrink-0">
            {summary.map((s) => (
              <div key={s.label} className="p-4">
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className={`text-xl font-bold font-mono mt-1 ${s.tone}`}>{formatNumber(s.value)}</div>
              </div>
            ))}
          </div>
          <div className="px-4 py-2 text-xs text-muted-foreground border-b flex-shrink-0">
            Kỳ: <span className="font-medium text-foreground">{history.period.label}</span> ·{' '}
            {history.totalRows} giao dịch
            {kind !== 'ALL' && <> (đã lọc loại — số liệu tổng kết vẫn tính trên toàn kỳ)</>} · Tồn luỹ kế tính trên phạm
            vi kho đang lọc
          </div>

          {history.rows.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              Không có giao dịch nào khớp bộ lọc.
            </div>
          ) : (
            <Table containerClassName="md:flex-1 md:min-h-0">
                <TableHeader>
                  <TableRow>
                    <TableHead>Ngày</TableHead>
                    <TableHead>Kho</TableHead>
                    <TableHead>Phiếu</TableHead>
                    <TableHead>Loại</TableHead>
                    <TableHead>Khách hàng / Đối tác</TableHead>
                    <TableHead className="text-right">Nhập</TableHead>
                    <TableHead className="text-right">Xuất</TableHead>
                    <TableHead className="text-right">Tồn sau GD</TableHead>
                    <TableHead>ĐVT</TableHead>
                    <TableHead>Người tạo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.rows.map((r) => {
                    const href = r.receiptId ? receiptHref(r.kind, r.receiptId) : null;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs font-mono whitespace-nowrap">{formatDate(r.occurredAt)}</TableCell>
                        <TableCell className="whitespace-nowrap">{r.warehouseCode}</TableCell>
                        <TableCell className="font-mono text-xs whitespace-nowrap">
                          {r.receiptCode ? (
                            href ? (
                              <Link href={href} className="text-primary hover:underline">{r.receiptCode}</Link>
                            ) : (
                              <span>{r.receiptCode}</span>
                            )
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell><KindBadge kind={r.kind} /></TableCell>
                        <TableCell className="max-w-[220px] truncate" title={r.partner ?? ''}>
                          {r.partner ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right font-mono text-success-strong">
                          {r.qtyIn ? formatNumber(r.qtyIn) : ''}
                        </TableCell>
                        <TableCell className="text-right font-mono text-danger-strong">
                          {r.qtyOut ? formatNumber(r.qtyOut) : ''}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">{formatNumber(r.balanceAfter)}</TableCell>
                        <TableCell>{r.unit === 'BO' ? 'Bộ' : 'Chiếc'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate" title={r.createdByName ?? ''}>
                          {r.createdByName ?? '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
            </Table>
          )}

          <Pagination
            basePath={`/ton-kho/${encodeURIComponent(sku)}`}
            params={{
              preset: searchParams.preset,
              month: searchParams.month,
              from: searchParams.from,
              to: searchParams.to,
              warehouseId: searchParams.warehouseId,
              kind: searchParams.kind
            }}
            page={history.page}
            pageCount={history.pageCount}
            pageSize={history.pageSize}
            total={history.totalRows}
            from={history.totalRows === 0 ? 0 : (history.page - 1) * history.pageSize + 1}
            to={Math.min(history.page * history.pageSize, history.totalRows)}
            itemLabel="giao dịch"
          />
        </CardContent>
      </Card>
    </div>
  );
}
