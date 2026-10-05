import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { prisma } from '@/lib/db/prisma';
import { validateRequest, getUserWarehouses } from '@/lib/auth/lucia';
import { EditInboundClient } from './edit-client';

export const dynamic = 'force-dynamic';

export default async function EditInboundPage({ params }: { params: { id: string } }) {
  const { user } = await validateRequest();
  if (!user) redirect('/login');

  const r = await prisma.receipt.findUnique({
    where: { id: params.id },
    include: { lines: true }
  });
  if (!r || r.type !== 'INBOUND') notFound();

  // Permission: WAREHOUSE_STAFF chỉ sửa khi có quyền với kho. ADMIN luôn được.
  if (user.role !== 'ADMIN') {
    const link = await prisma.userWarehouse.findUnique({
      where: { userId_warehouseId: { userId: user.id, warehouseId: r.warehouseId } }
    });
    if (!link) redirect('/nhap-kho');
  }

  const warehouses = user.role === 'ADMIN'
    ? await prisma.warehouse.findMany({ where: { active: true }, orderBy: { code: 'asc' } })
    : await getUserWarehouses(user.id);
  // Gồm cả mặt hàng đã ngừng áp dụng nhưng đang có trên phiếu, để dòng cũ không bị mất khi sửa.
  const products = await prisma.product.findMany({
    where: { OR: [{ active: true }, { id: { in: r.lines.map((l) => l.productId) } }] },
    orderBy: { sku: 'asc' }
  });

  const initial = {
    warehouseId: r.warehouseId,
    date: r.date.toISOString().slice(0, 10),
    customerOrPartner: r.customerOrPartner,
    customerAddress: r.customerAddress,
    customerPhone: r.customerPhone,
    note: r.note,
    lines: r.lines.map((l) => ({
      productId: l.productId,
      unit: l.unit as 'BO' | 'CHIEC',
      quantity: l.quantity,
      lineNote: l.lineNote ?? undefined
    }))
  };

  return (
    <div className="h-full overflow-auto">
      <div className="p-4 md:p-6 max-w-5xl">
      <Link href={`/nhap-kho/${r.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ChevronLeft className="w-4 h-4" />Quay lại chi tiết phiếu
      </Link>
      <h1 className="text-2xl font-bold mb-2">Sửa phiếu nhập <span className="font-mono text-primary">{r.code}</span></h1>
      <p className="text-sm text-muted-foreground mb-6">
        Khi bạn lưu, hệ thống sẽ xoá các bút toán tồn cũ của phiếu này và ghi lại theo dữ liệu mới — tồn kho được <strong>tự động cân đối lại</strong>.
        Nếu việc giảm số lượng làm tồn âm (hàng đã xuất đi), hệ thống sẽ chặn hoặc yêu cầu quản trị viên xác nhận.
        Mọi thay đổi được ghi vào lịch sử phiếu.
      </p>
      <EditInboundClient
        receiptId={r.id}
        version={r.version}
        products={products as any}
        warehouses={warehouses}
        initial={initial}
      />
      </div>
    </div>
  );
}
