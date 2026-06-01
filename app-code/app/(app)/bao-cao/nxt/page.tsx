import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import { validateRequest, getUserWarehouses } from '@/lib/auth/lucia';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';

function parseMonth(value: string | undefined): { from: Date; to: Date; label: string } {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [y, m] = value.split('-').map(Number);
    year = y;
    month = m;
  }
  const from = new Date(year, month - 1, 1, 0, 0, 0);
  const to = new Date(year, month, 1, 0, 0, 0);
  return { from, to, label: `Tháng ${String(month).padStart(2, '0')}/${year}` };
}

export default async function NxtReportPage({ searchParams }: { searchParams: { month?: string; warehouseId?: string } }) {
  const { user } = await validateRequest();
  if (!user) redirect('/login');
  const { from, to, label } = parseMonth(searchParams.month);

  const warehouses = user.role === 'ADMIN'
    ? await prisma.warehouse.findMany({ where: { active: true }, orderBy: { code: 'asc' } })
    : await getUserWarehouses(user.id).then(async (ids) =>
        prisma.warehouse.findMany({ where: { id: { in: ids.map((w) => w.id) }, active: true }, orderBy: { code: 'asc' } })
      );

  const selectedWh = searchParams.warehouseId && searchParams.warehouseId !== 'ALL'
    ? [searchParams.warehouseId]
    : warehouses.map((w) => w.id);

  const products = await prisma.product.findMany({ where: { active: true }, orderBy: { sku: 'asc' } });

  // For each product compute: inbound (in period), outbound (in period), closing stock (all-time up to `to`)
  const periodMovements = await prisma.stockMovement.findMany({
    where: {
      warehouseId: { in: selectedWh },
      occurredAt: { gte: from, lt: to }
    }
  });
  const allMovements = await prisma.stockMovement.findMany({
    where: {
      warehouseId: { in: selectedWh },
      occurredAt: { lt: to }
    }
  });

  type Row = { sku: string; brand: string; size: string; pattern: string; inbound: number; outbound: number; closing: number };
  const rowMap = new Map<string, Row>();
  for (const p of products) rowMap.set(p.id, { sku: p.sku, brand: p.brand, size: p.size, pattern: p.pattern, inbound: 0, outbound: 0, closing: 0 });

  for (const m of periodMovements) {
    const r = rowMap.get(m.productId);
    if (!r) continue;
    if (m.qtyDelta > 0) r.inbound += m.qtyDelta;
    else r.outbound += -m.qtyDelta;
  }
  for (const m of allMovements) {
    const r = rowMap.get(m.productId);
    if (!r) continue;
    r.closing += m.qtyDelta;
  }

  const rows = Array.from(rowMap.values()).filter((r) => r.inbound + r.outbound + r.closing !== 0);
  const totals = rows.reduce(
    (acc, r) => ({ inbound: acc.inbound + r.inbound, outbound: acc.outbound + r.outbound, closing: acc.closing + r.closing }),
    { inbound: 0, outbound: 0, closing: 0 }
  );

  const exportHref = `/api/reports/nxt.xlsx?month=${searchParams.month ?? ''}&warehouseId=${searchParams.warehouseId ?? 'ALL'}`;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Báo cáo Nhập – Xuất – Tồn</h1>
          <p className="text-sm text-muted-foreground mt-1">Kỳ: {label}</p>
        </div>
        <Button asChild>
          <a href={exportHref}><Download className="w-4 h-4" />Xuất Excel</a>
        </Button>
      </div>

      <Card>
        <form className="p-4 grid md:grid-cols-3 gap-4 border-b">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Tháng</label>
            <input
              type="month"
              name="month"
              defaultValue={searchParams.month ?? `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}`}
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Kho</label>
            <select name="warehouseId" defaultValue={searchParams.warehouseId ?? 'ALL'} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
              <option value="ALL">Tất cả các kho</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full md:w-auto">Áp dụng</Button>
          </div>
        </form>

        <div className="grid grid-cols-2 md:grid-cols-4 divide-x border-b text-sm">
          <div className="p-4">
            <div className="text-muted-foreground text-xs">Số SKU</div>
            <div className="font-mono text-xl font-bold mt-1">{rows.length}</div>
          </div>
          <div className="p-4">
            <div className="text-muted-foreground text-xs">Tổng nhập</div>
            <div className="font-mono text-xl font-bold mt-1 text-success">{formatNumber(totals.inbound)}</div>
          </div>
          <div className="p-4">
            <div className="text-muted-foreground text-xs">Tổng xuất</div>
            <div className="font-mono text-xl font-bold mt-1 text-danger">{formatNumber(totals.outbound)}</div>
          </div>
          <div className="p-4">
            <div className="text-muted-foreground text-xs">Tồn cuối kỳ</div>
            <div className="font-mono text-xl font-bold mt-1 text-primary">{formatNumber(totals.closing)}</div>
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
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="bg-primary-soft font-semibold">
              <TableCell colSpan={5}>Tổng cộng</TableCell>
              <TableCell className="text-right font-mono">{formatNumber(totals.inbound)}</TableCell>
              <TableCell className="text-right font-mono">{formatNumber(totals.outbound)}</TableCell>
              <TableCell className="text-right font-mono">{formatNumber(totals.closing)}</TableCell>
            </TableRow>
            {rows.map((r, i) => (
              <TableRow key={r.sku}>
                <TableCell>{i + 1}</TableCell>
                <TableCell className="font-mono">{r.sku}</TableCell>
                <TableCell>{r.brand}</TableCell>
                <TableCell>{r.size}</TableCell>
                <TableCell>{r.pattern}</TableCell>
                <TableCell className="text-right font-mono">{formatNumber(r.inbound)}</TableCell>
                <TableCell className="text-right font-mono">{formatNumber(r.outbound)}</TableCell>
                <TableCell className="text-right font-mono font-semibold">{formatNumber(r.closing)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
