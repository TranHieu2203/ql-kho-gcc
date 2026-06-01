import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { prisma } from '@/lib/db/prisma';
import { validateRequest } from '@/lib/auth/lucia';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ReceiptActions } from '@/components/receipts/receipt-actions';
import { formatDate, formatDateTime, formatNumber } from '@/lib/utils';

export default async function OutboundDetailPage({ params }: { params: { id: string } }) {
  const { user } = await validateRequest();
  const r = await prisma.receipt.findUnique({
    where: { id: params.id },
    include: {
      warehouse: true,
      lines: { include: { product: true } },
      createdBy: { select: { fullName: true } }
    }
  });
  if (!r || r.type !== 'OUTBOUND') notFound();
  const totalQty = r.lines.reduce((s, l) => s + l.quantity, 0);

  return (
    <div className="p-4 md:p-6 max-w-4xl space-y-4">
      <Link href="/xuat-kho" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="w-4 h-4" />Quay lại
      </Link>
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold font-mono">{r.code}</h1>
          <p className="text-sm text-muted-foreground mt-1">Phiếu xuất · {r.warehouse.name} · {formatDate(r.date)}</p>
        </div>
        <ReceiptActions receiptId={r.id} receiptCode={r.code} type="OUTBOUND" isAdmin={user?.role === 'ADMIN'} />
      </div>
      <Card>
        <CardHeader><CardTitle>Thông tin chung</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-y-2 gap-x-6 text-sm">
          <div><span className="text-muted-foreground">Kho:</span> <span className="ml-2">{r.warehouse.name}</span></div>
          <div><span className="text-muted-foreground">Ngày:</span> <span className="ml-2">{formatDate(r.date)}</span></div>
          <div><span className="text-muted-foreground">Khách hàng:</span> <span className="ml-2">{r.customerOrPartner ?? '—'}</span></div>
          <div><span className="text-muted-foreground">Người tạo:</span> <span className="ml-2">{r.createdBy.fullName}</span></div>
          <div className="md:col-span-2"><span className="text-muted-foreground">Tạo lúc:</span> <span className="ml-2">{formatDateTime(r.createdAt)}</span></div>
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
                <TableHead>Ghi chú</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-mono">{l.product.sku}</TableCell>
                  <TableCell>{l.product.fullName}</TableCell>
                  <TableCell>{l.unit === 'BO' ? 'Bộ' : 'Chiếc'}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{formatNumber(l.quantity)}</TableCell>
                  <TableCell className="text-muted-foreground">{l.lineNote ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
