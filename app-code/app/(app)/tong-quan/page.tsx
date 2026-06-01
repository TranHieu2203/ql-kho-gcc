import { prisma } from '@/lib/db/prisma';
import { validateRequest } from '@/lib/auth/lucia';
import { redirect } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Package, ArrowDownToLine, ArrowUpFromLine, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { formatDateTime, formatNumber } from '@/lib/utils';

export default async function DashboardPage() {
  const { user } = await validateRequest();
  if (!user) redirect('/login');

  // Sum totals across all warehouses user has access to
  const linkedWh = user.role === 'ADMIN'
    ? await prisma.warehouse.findMany({ where: { active: true }, select: { id: true } })
    : await prisma.userWarehouse.findMany({ where: { userId: user.id }, select: { warehouseId: true } }).then(r => r.map(x => ({ id: x.warehouseId })));
  const whIds = linkedWh.map(w => 'id' in w ? w.id : '');

  const productCount = await prisma.product.count({ where: { active: true } });
  const movements = await prisma.stockMovement.findMany({
    where: { warehouseId: { in: whIds } },
    select: { productId: true, qtyDelta: true, warehouseId: true }
  });

  // Compute stock per (warehouse, product)
  const stockMap = new Map<string, number>();
  for (const m of movements) {
    const k = `${m.warehouseId}|${m.productId}`;
    stockMap.set(k, (stockMap.get(k) ?? 0) + m.qtyDelta);
  }
  const totalStock = Array.from(stockMap.values()).reduce((a, b) => a + b, 0);

  // Low stock count: products where total stock across all wh is below threshold
  const products = await prisma.product.findMany({ where: { active: true } });
  const productStockTotal = new Map<string, number>();
  for (const [k, v] of stockMap.entries()) {
    const [, pid] = k.split('|');
    productStockTotal.set(pid, (productStockTotal.get(pid) ?? 0) + v);
  }
  let lowStockCount = 0;
  for (const p of products) {
    const s = productStockTotal.get(p.id) ?? 0;
    if (s < p.lowStockThreshold) lowStockCount++;
  }

  // Recent receipts
  const recent = await prisma.receipt.findMany({
    where: { warehouseId: { in: whIds } },
    orderBy: { createdAt: 'desc' },
    take: 8,
    include: {
      lines: { include: { product: true }, take: 1 },
      warehouse: true,
      createdBy: { select: { fullName: true } }
    }
  });

  // Monthly inbound total
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const monthlyInbound = await prisma.receiptLine.aggregate({
    _sum: { quantity: true },
    where: {
      receipt: {
        type: 'INBOUND',
        warehouseId: { in: whIds },
        date: { gte: startOfMonth }
      }
    }
  });

  const metrics = [
    { label: 'Tổng SKU', value: formatNumber(productCount), icon: Package, href: '/danh-muc' },
    { label: 'Tổng tồn (Bộ)', value: formatNumber(totalStock), icon: ArrowDownToLine, href: '/ton-kho' },
    { label: 'Nhập tháng này', value: formatNumber(monthlyInbound._sum.quantity ?? 0), icon: ArrowDownToLine, href: '/nhap-kho' },
    { label: 'Tồn dưới ngưỡng', value: formatNumber(lowStockCount), icon: AlertTriangle, href: '/ton-kho', warning: lowStockCount > 0 }
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tổng quan</h1>
          <p className="text-sm text-muted-foreground mt-1">Xin chào, {user.fullName}.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <Link key={m.label} href={m.href}>
            <Card className="hover:border-primary transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground font-normal">{m.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold mono ${m.warning ? 'text-warning-strong' : ''}`}>{m.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hoạt động gần đây</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Chưa có phiếu nào. <Link href="/nhap-kho/tao" className="text-primary font-medium">Tạo phiếu nhập đầu tiên →</Link>
            </div>
          ) : (
            <div className="divide-y">
              {recent.map((r) => (
                <Link
                  key={r.id}
                  href={`/${r.type === 'INBOUND' ? 'nhap-kho' : r.type === 'OUTBOUND' ? 'xuat-kho' : 'chuyen-kho'}/${r.id}`}
                  className="flex items-center gap-3 py-3 hover:bg-muted/40 -mx-2 px-2 rounded-md"
                >
                  <div className={`w-9 h-9 rounded-md grid place-items-center ${r.type === 'INBOUND' ? 'bg-success-soft text-success-strong' : r.type === 'OUTBOUND' ? 'bg-danger-soft text-danger-strong' : 'bg-primary-soft text-primary'}`}>
                    {r.type === 'INBOUND' ? <ArrowDownToLine className="w-4 h-4" /> : r.type === 'OUTBOUND' ? <ArrowUpFromLine className="w-4 h-4" /> : <ArrowDownToLine className="w-4 h-4 rotate-45" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">
                      <span className="font-mono font-medium">{r.code}</span>
                      <span className="mx-2 text-muted-foreground">·</span>
                      <span>{r.warehouse.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.createdBy.fullName} · {formatDateTime(r.createdAt)}
                      {r.lines[0] && (
                        <> · {r.lines[0].product.sku} ({r.lines[0].quantity} {r.lines[0].unit === 'BO' ? 'Bộ' : 'Chiếc'})</>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
