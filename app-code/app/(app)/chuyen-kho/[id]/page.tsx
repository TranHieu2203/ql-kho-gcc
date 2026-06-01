import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { prisma } from '@/lib/db/prisma';
import { validateRequest, assertCanAccessWarehouse } from '@/lib/auth/lucia';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate, formatDateTime, formatNumber } from '@/lib/utils';
import { ConfirmArrivalButton } from './confirm-button';
import { ReceiptActions } from '@/components/receipts/receipt-actions';

export default async function TransferDetailPage({ params }: { params: { id: string } }) {
  const { user } = await validateRequest();
  if (!user) notFound();
  const r = await prisma.receipt.findUnique({
    where: { id: params.id },
    include: {
      fromWarehouse: true,
      toWarehouse: true,
      lines: { include: { product: true } },
      createdBy: { select: { fullName: true } }
    }
  });
  if (!r || r.type !== 'TRANSFER') notFound();

  let canConfirm = false;
  if (r.status === 'IN_TRANSIT' && r.toWarehouseId) {
    try {
      await assertCanAccessWarehouse(user.id, r.toWarehouseId, user.role);
      canConfirm = true;
    } catch {}
  }

  const totalQty = r.lines.reduce((s, l) => s + l.quantity, 0);

  return (
    <div className="p-4 md:p-6 max-w-4xl space-y-4">
      <Link href="/chuyen-kho" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="w-4 h-4" />Quay lại
      </Link>
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-mono">{r.code}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Phiếu chuyển kho · {r.fromWarehouse?.name} → {r.toWarehouse?.name}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canConfirm && <ConfirmArrivalButton receiptId={r.id} />}
          <ReceiptActions receiptId={r.id} receiptCode={r.code} type="TRANSFER" isAdmin={user?.role === 'ADMIN'} />
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Thông tin chung</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-y-2 gap-x-6 text-sm">
          <div><span className="text-muted-foreground">Từ kho:</span> <span className="ml-2">{r.fromWarehouse?.name}</span></div>
          <div><span className="text-muted-foreground">Đến kho:</span> <span className="ml-2">{r.toWarehouse?.name}</span></div>
          <div><span className="text-muted-foreground">Ngày tạo:</span> <span className="ml-2">{formatDate(r.date)}</span></div>
          <div>
            <span className="text-muted-foreground">Trạng thái:</span>{' '}
            {r.status === 'IN_TRANSIT' ? (
              <span className="badge badge-warning ml-2">Đang đi</span>
            ) : r.status === 'CONFIRMED' ? (
              <span className="badge badge-success ml-2">Hoàn tất</span>
            ) : (
              <span className="badge badge-neutral ml-2">{r.status}</span>
            )}
          </div>
          <div><span className="text-muted-foreground">Người tạo:</span> <span className="ml-2">{r.createdBy.fullName}</span></div>
          <div><span className="text-muted-foreground">Tạo lúc:</span> <span className="ml-2">{formatDateTime(r.createdAt)}</span></div>
          {r.confirmedAt && <div><span className="text-muted-foreground">Xác nhận lúc:</span> <span className="ml-2">{formatDateTime(r.confirmedAt)}</span></div>}
          {r.note && <div className="md:col-span-2"><span className="text-muted-foreground">Ghi chú:</span> <span className="ml-2">{r.note}</span></div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Sản phẩm ({r.lines.length} dòng · {formatNumber(totalQty)} tổng SL)</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Tên</TableHead>
                <TableHead>ĐVT</TableHead>
                <TableHead className="text-right">Số lượng</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-mono">{l.product.sku}</TableCell>
                  <TableCell>{l.product.fullName}</TableCell>
                  <TableCell>{l.unit === 'BO' ? 'Bộ' : 'Chiếc'}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{formatNumber(l.quantity)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
