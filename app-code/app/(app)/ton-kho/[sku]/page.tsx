import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronLeft, ArrowDownToLine, ArrowUpFromLine, Repeat } from 'lucide-react';
import { prisma } from '@/lib/db/prisma';
import { validateRequest, getUserWarehouses } from '@/lib/auth/lucia';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate, formatDateTime, formatNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function StockDetailPage({ params }: { params: { sku: string } }) {
  const { user } = await validateRequest();
  if (!user) redirect('/login');

  const sku = decodeURIComponent(params.sku);
  const product = await prisma.product.findUnique({ where: { sku } });
  if (!product) notFound();

  const warehouses = user.role === 'ADMIN'
    ? await prisma.warehouse.findMany({ where: { active: true }, orderBy: { code: 'asc' } })
    : await getUserWarehouses(user.id).then((ids) =>
        prisma.warehouse.findMany({ where: { id: { in: ids.map((w) => w.id) }, active: true }, orderBy: { code: 'asc' } })
      );

  const movements = await prisma.stockMovement.findMany({
    where: { productId: product.id, warehouseId: { in: warehouses.map((w) => w.id) } },
    orderBy: { occurredAt: 'desc' },
    take: 200,
    include: {
      warehouse: { select: { name: true, code: true } },
      receipt: { select: { code: true, type: true, id: true } }
    }
  });

  // Per-warehouse current stock
  const stockByWh = new Map<string, number>();
  const allMovementsForStock = await prisma.stockMovement.findMany({
    where: { productId: product.id, warehouseId: { in: warehouses.map((w) => w.id) } },
    select: { warehouseId: true, qtyDelta: true }
  });
  for (const m of allMovementsForStock) {
    stockByWh.set(m.warehouseId, (stockByWh.get(m.warehouseId) ?? 0) + m.qtyDelta);
  }
  const totalStock = Array.from(stockByWh.values()).reduce((a, b) => a + b, 0);

  return (
    <div className="p-4 md:p-6 max-w-5xl space-y-4">
      <Link href="/ton-kho" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="w-4 h-4" />Quay lại tồn kho
      </Link>
      <div>
        <h1 className="text-2xl font-bold font-mono">{product.sku}</h1>
        <p className="text-sm text-muted-foreground mt-1">{product.fullName}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tổng quan</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-4 gap-y-2 gap-x-6 text-sm">
          <div><span className="text-muted-foreground">Thương hiệu:</span> <div className="font-medium mt-0.5">{product.brand}</div></div>
          <div><span className="text-muted-foreground">Size:</span> <div className="font-medium mt-0.5">{product.size}</div></div>
          <div><span className="text-muted-foreground">Mã gai:</span> <div className="font-medium mt-0.5">{product.pattern}</div></div>
          <div><span className="text-muted-foreground">ĐVT mặc định:</span> <div className="font-medium mt-0.5">{product.defaultUnit === 'BO' ? 'Bộ' : 'Chiếc'}</div></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tồn kho theo kho</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kho</TableHead>
                <TableHead>Mã kho</TableHead>
                <TableHead className="text-right">Tồn hiện tại</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {warehouses.map((w) => {
                const v = stockByWh.get(w.id) ?? 0;
                return (
                  <TableRow key={w.id}>
                    <TableCell>{w.name}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">{w.code}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{formatNumber(v)}</TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="bg-primary-soft font-semibold">
                <TableCell colSpan={2}>Tổng</TableCell>
                <TableCell className="text-right font-mono">{formatNumber(totalStock)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lịch sử biến động ({movements.length} mục)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {movements.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">Chưa có biến động nào.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Kho</TableHead>
                  <TableHead>Phiếu</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead className="text-right">+/-</TableHead>
                  <TableHead>ĐVT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs font-mono">{formatDateTime(m.occurredAt)}</TableCell>
                    <TableCell>{m.warehouse.name}</TableCell>
                    <TableCell>
                      {m.receipt ? (
                        <Link
                          href={`/${m.receipt.type === 'INBOUND' ? 'nhap-kho' : m.receipt.type === 'OUTBOUND' ? 'xuat-kho' : 'chuyen-kho'}/${m.receipt.id}`}
                          className="font-mono text-primary hover:underline"
                        >
                          {m.receipt.code}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {m.receipt?.type === 'INBOUND' && (
                        <span className="badge badge-success"><ArrowDownToLine className="w-3 h-3" />Nhập</span>
                      )}
                      {m.receipt?.type === 'OUTBOUND' && (
                        <span className="badge badge-danger"><ArrowUpFromLine className="w-3 h-3" />Xuất</span>
                      )}
                      {m.receipt?.type === 'TRANSFER' && (
                        <span className="badge badge-info"><Repeat className="w-3 h-3" />Chuyển</span>
                      )}
                      {m.source === 'INITIAL_IMPORT' && !m.receipt && (
                        <span className="badge badge-neutral">Tồn đầu kỳ</span>
                      )}
                      {m.source === 'ADJUSTMENT' && !m.receipt && (
                        <span className="badge badge-warning">Điều chỉnh</span>
                      )}
                    </TableCell>
                    <TableCell className={`text-right font-mono font-semibold ${m.qtyDelta > 0 ? 'text-success-strong' : 'text-danger-strong'}`}>
                      {m.qtyDelta > 0 ? '+' : ''}{m.qtyDelta}
                    </TableCell>
                    <TableCell>{m.unit === 'BO' ? 'Bộ' : 'Chiếc'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
