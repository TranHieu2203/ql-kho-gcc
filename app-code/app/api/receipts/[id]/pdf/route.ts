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

  // Load company info + display code prefix from settings (for OUTBOUND header)
  const settingKeys = ['company_name', 'company_address', 'company_bank', 'company_phone', 'outbound_receipt_prefix'];
  const settings = await prisma.setting.findMany({ where: { key: { in: settingKeys } } });
  const settingMap = Object.fromEntries(settings.map((s) => [s.key, s.value]));

  // Build display code: nếu OUTBOUND + có prefix → tạo mã PXYYMMDD-NNN dạng ngắn
  let displayCode: string | undefined;
  if (r.type === 'OUTBOUND' && settingMap.outbound_receipt_prefix) {
    const dd = String(r.date.getDate()).padStart(2, '0');
    const mm = String(r.date.getMonth() + 1).padStart(2, '0');
    const yy = String(r.date.getFullYear()).slice(-2);
    // Lấy seq từ mã gốc OUT-YYYY-NNNN
    const m = r.code.match(/(\d+)$/);
    const seq = m ? m[1].padStart(2, '0').slice(-2) : '01';
    displayCode = `${settingMap.outbound_receipt_prefix}${dd}${mm}${yy}${seq === '00' ? '' : ''}`;
    // Format chính: PXddmmyy (8 ký tự + prefix) — phù hợp ví dụ PX080526
    displayCode = `${settingMap.outbound_receipt_prefix}${dd}${mm}${yy}`;
  }

  const buffer = await renderReceiptPdf({
    code: r.code,
    type: r.type,
    date: r.date,
    warehouseName: r.warehouse.name,
    fromWarehouseName: r.fromWarehouse?.name,
    toWarehouseName: r.toWarehouse?.name,
    customerOrPartner: r.customerOrPartner,
    customerAddress: r.customerAddress,
    customerPhone: r.customerPhone,
    note: r.note,
    createdByName: r.createdBy.fullName,
    status: r.status,
    lines: r.lines.map((l) => ({
      sku: l.product.sku,
      productName: l.product.fullName,
      unit: l.unit,
      quantity: l.quantity,
      lineNote: l.lineNote
    })),
    company: {
      name: settingMap.company_name,
      address: settingMap.company_address,
      bank: settingMap.company_bank,
      phone: settingMap.company_phone
    },
    displayCode
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${sanitizeFilename(r.code)}.pdf"`
    }
  });
}
