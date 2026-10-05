'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { requireUser, assertCanAccessWarehouse } from '@/lib/auth/lucia';
import { createInboundOutbound, OverstockError, simulateReceiptReplace, diffReceiptStock } from '@/lib/domain/receipts';
import { formatDate } from '@/lib/utils';
import { audit } from '@/lib/security/audit';

const lineSchema = z.object({
  productId: z.string().min(1),
  unit: z.enum(['BO', 'CHIEC']),
  quantity: z.number().int().min(1).max(9999),
  lineNote: z.string().max(500).optional()
});

const payloadSchema = z.object({
  type: z.literal('INBOUND'),
  warehouseId: z.string().min(1),
  date: z.string().min(1),
  customerOrPartner: z.string().max(256).optional(),  // Tên nhà cung cấp
  customerAddress: z.string().max(512).optional(),    // Địa chỉ NCC
  customerPhone: z.string().max(64).optional(),       // ĐT NCC
  note: z.string().max(500).optional(),
  lines: z.array(lineSchema).min(1).max(200),
  clientRequestId: z.string().optional()
});

export async function createInboundReceipt(payload: unknown) {
  const user = await requireUser();
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Dữ liệu không hợp lệ.' };

  try {
    await assertCanAccessWarehouse(user.id, parsed.data.warehouseId, user.role);
  } catch {
    return { error: 'Bạn không có quyền với kho này.' };
  }

  try {
    const { receipt, deduped } = await createInboundOutbound(
      {
        type: 'INBOUND',
        warehouseId: parsed.data.warehouseId,
        date: new Date(parsed.data.date),
        customerOrPartner: parsed.data.customerOrPartner ?? null,
        customerAddress: parsed.data.customerAddress ?? null,
        customerPhone: parsed.data.customerPhone ?? null,
        note: parsed.data.note ?? null,
        lines: parsed.data.lines,
        createdById: user.id,
        clientRequestId: parsed.data.clientRequestId ?? null
      },
      'warn'
    );

    if (!deduped) {
      await audit({ userId: user.id, action: 'create', entityType: 'Receipt', entityId: receipt.id, after: { code: receipt.code, type: 'INBOUND' } });
    }

    revalidatePath('/nhap-kho');
    revalidatePath('/tong-quan');
    revalidatePath('/ton-kho');
    return { ok: true, receiptId: receipt.id, receiptCode: receipt.code };
  } catch (e: any) {
    if (e instanceof OverstockError) return { error: 'Lỗi không hợp lệ cho phiếu nhập.' };
    return { error: e?.message ?? 'Đã xảy ra lỗi.' };
  }
}

// ---------------------------------------------------------------------------
// UPDATE INBOUND RECEIPT
// Cùng chiến lược với phiếu xuất: xoá lines + movements cũ, dựng lại theo
// payload mới trong 1 transaction. Mã phiếu giữ nguyên, version +1.
// Tồn tự cân đối lại vì computeStock() sum toàn bộ StockMovement.
//
// Khác phiếu xuất: GIẢM số lượng nhập / đổi kho / đổi ngày nhập về sau có thể
// làm tồn âm tại các phiếu xuất đã dùng hàng này → mô phỏng toàn bộ timeline.
// Nhân viên kho bị chặn; admin được xác nhận để ghi đè.
// ---------------------------------------------------------------------------
const updatePayloadSchema = z.object({
  warehouseId: z.string().min(1),
  date: z.string().min(1),
  customerOrPartner: z.string().max(256).optional(),
  customerAddress: z.string().max(512).optional(),
  customerPhone: z.string().max(64).optional(),
  note: z.string().max(500).optional(),
  lines: z.array(lineSchema).min(1).max(200),
  expectedVersion: z.number().int().optional(),
  forceBackdate: z.boolean().optional()
});

class VersionConflictError extends Error {}

export async function updateInboundReceipt(receiptId: string, payload: unknown) {
  const user = await requireUser();
  const parsed = updatePayloadSchema.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Dữ liệu không hợp lệ.' };
  const data = parsed.data;

  const original = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: { lines: true, movements: true }
  });
  if (!original) return { error: 'Không tìm thấy phiếu.' };
  if (original.type !== 'INBOUND') return { error: 'Chỉ phiếu nhập mới sửa được theo cách này.' };
  if (data.expectedVersion != null && data.expectedVersion !== original.version) {
    return { error: 'Phiếu đã được người khác sửa trong lúc bạn đang chỉnh. Hãy tải lại trang và sửa lại.' };
  }

  try {
    await assertCanAccessWarehouse(user.id, original.warehouseId, user.role);
    if (data.warehouseId !== original.warehouseId) {
      await assertCanAccessWarehouse(user.id, data.warehouseId, user.role);
    }
  } catch {
    return { error: 'Bạn không có quyền với kho liên quan.' };
  }

  const newDate = new Date(data.date);
  if (Number.isNaN(newDate.getTime())) return { error: 'Ngày không hợp lệ.' };

  const issues = await simulateReceiptReplace({
    receiptId,
    warehouseId: data.warehouseId,
    date: newDate,
    sign: 1,
    lines: data.lines
  });
  if (issues.length > 0 && !data.forceBackdate) {
    const list = issues.map((i) => `• ${i.sku}: âm xuống ${i.minStock} (từ ${formatDate(i.firstNegativeDate)})`).join('\n');
    if (user.role !== 'ADMIN') {
      return {
        error:
          `Sửa phiếu nhập sẽ làm tồn ÂM vì hàng đã được xuất/chuyển đi:\n${list}\n` +
          'Chỉ quản trị viên mới có thể ghi đè. Khuyến nghị: tạo phiếu điều chỉnh thay vì giảm phiếu nhập.'
      };
    }
    return { backdateWarning: `Sửa phiếu nhập sẽ làm tồn ÂM:\n${list}\nBạn là quản trị viên — vẫn lưu?` };
  }
  if (issues.length > 0 && user.role !== 'ADMIN') {
    return { error: 'Chỉ quản trị viên mới có thể ghi đè cảnh báo tồn âm.' };
  }

  const stockDiff = diffReceiptStock(original.movements, { warehouseId: data.warehouseId, sign: 1, lines: data.lines });

  try {
    await prisma.$transaction(async (tx) => {
      // Khoá lạc quan: chỉ cập nhật nếu version chưa đổi kể từ lúc đọc
      const bumped = await tx.receipt.updateMany({
        where: { id: receiptId, version: original.version },
        data: {
          warehouseId: data.warehouseId,
          date: newDate,
          customerOrPartner: data.customerOrPartner ?? null,
          customerAddress: data.customerAddress ?? null,
          customerPhone: data.customerPhone ?? null,
          note: data.note ?? null,
          version: { increment: 1 }
        }
      });
      if (bumped.count === 0) throw new VersionConflictError();

      await tx.stockMovement.deleteMany({ where: { sourceId: receiptId } });
      await tx.receiptLine.deleteMany({ where: { receiptId } });

      for (const ln of data.lines) {
        await tx.receiptLine.create({
          data: { receiptId, productId: ln.productId, unit: ln.unit, quantity: ln.quantity, lineNote: ln.lineNote ?? null }
        });
        await tx.stockMovement.create({
          data: {
            warehouseId: data.warehouseId,
            productId: ln.productId,
            unit: ln.unit,
            qtyDelta: ln.quantity, // INBOUND
            source: 'RECEIPT',
            sourceId: receiptId,
            occurredAt: newDate
          }
        });
      }
    });
  } catch (e: any) {
    if (e instanceof VersionConflictError) {
      return { error: 'Phiếu đã được người khác sửa trong lúc bạn đang chỉnh. Hãy tải lại trang và sửa lại.' };
    }
    return { error: 'Lưu thất bại: ' + (e?.message ?? 'unknown') };
  }

  const snapshotLines = (ls: { productId: string; unit: string; quantity: number; lineNote?: string | null }[]) =>
    ls.map((l) => ({ productId: l.productId, unit: l.unit, quantity: l.quantity, lineNote: l.lineNote ?? null }));

  await audit({
    userId: user.id,
    action: 'update',
    entityType: 'Receipt',
    entityId: receiptId,
    before: {
      code: original.code,
      type: 'INBOUND',
      version: original.version,
      warehouseId: original.warehouseId,
      date: original.date,
      customerOrPartner: original.customerOrPartner,
      customerAddress: original.customerAddress,
      customerPhone: original.customerPhone,
      note: original.note,
      lines: snapshotLines(original.lines)
    },
    after: {
      code: original.code,
      type: 'INBOUND',
      version: original.version + 1,
      warehouseId: data.warehouseId,
      date: newDate,
      customerOrPartner: data.customerOrPartner ?? null,
      customerAddress: data.customerAddress ?? null,
      customerPhone: data.customerPhone ?? null,
      note: data.note ?? null,
      lines: snapshotLines(data.lines),
      stockDiff,
      ...(issues.length > 0 ? { negativeStockOverride: issues } : {})
    }
  });

  revalidatePath('/nhap-kho');
  revalidatePath(`/nhap-kho/${receiptId}`);
  revalidatePath('/ton-kho');
  revalidatePath('/tong-quan');
  revalidatePath('/bao-cao/nxt');
  return { ok: true, receiptId, receiptCode: original.code };
}
