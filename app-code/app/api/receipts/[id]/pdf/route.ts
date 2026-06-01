import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { validateRequest, assertCanAccessWarehouse } from '@/lib/auth/lucia';
import { renderReceiptPdf } from '@/components/pdf/receipt-pdf';

export const runtime = 'nodejs';

function sanitizeFilename(s: string): string {
  return s.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 64);
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user } = await validateRequest();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const r = await prisma.receipt.findUnique({
    where: { id: params.id },
    include: {
      warehouse: true,
      fromWarehouse: true,
      toWarehouse: true,
      lines: { include: { product: true } },
      createdBy: true
    }
  });
  if (!r) return new NextResponse('Not Found', { status: 404 });

  // H1 Fix: enforce warehouse permission. Cho TRANSFER phải có quyền ÍT NHẤT 1 trong 2 kho.
  try {
    if (r.type === 'TRANSFER' && r.fromWarehouseId && r.toWarehouseId) {
      let allowed = false;
      try {
        await assertCanAccessWarehouse(user.id, r.fromWarehouseId, user.role);
        allowed = true;
      } catch {}
      if (!allowed) {
        await assertCanAccessWarehouse(user.id, r.toWarehouseId, user.role);
      }
    } else {
      await assertCanAccessWarehouse(user.id, r.warehouseId, user.role);
    }
  } catch {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const buffer = await renderReceiptPdf({
    code: r.code,
    type: r.type,
    date: r.date,
    warehouseName: r.warehouse.name,
    fromWarehouseName: r.fromWarehouse?.name,
    toWarehouseName: r.toWarehouse?.name,
    customerOrPartner: r.customerOrPartner,
    note: r.note,
    createdByName: r.createdBy.fullName,
    status: r.status,
    lines: r.lines.map((l) => ({
      sku: l.product.sku,
      productName: l.product.fullName,
      unit: l.unit,
      quantity: l.quantity,
      lineNote: l.lineNote
    }))
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${sanitizeFilename(r.code)}.pdf"`
    }
  });
}
