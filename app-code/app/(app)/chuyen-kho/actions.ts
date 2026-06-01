'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { requireUser, assertCanAccessWarehouse } from '@/lib/auth/lucia';
import { createTransfer, confirmTransferArrival, OverstockError } from '@/lib/domain/receipts';
import { audit } from '@/lib/security/audit';

const lineSchema = z.object({
  productId: z.string().min(1),
  unit: z.enum(['BO', 'CHIEC']),
  quantity: z.number().int().min(1).max(9999),
  lineNote: z.string().max(500).optional()
});

const payloadSchema = z.object({
  type: z.literal('TRANSFER'),
  warehouseId: z.string().min(1),   // from
  toWarehouseId: z.string().min(1),
  date: z.string().min(1),
  note: z.string().max(500).optional(),
  lines: z.array(lineSchema).min(1).max(200),
  clientRequestId: z.string().optional()
});

export async function createTransferReceipt(payload: unknown) {
  const user = await requireUser();
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Dữ liệu không hợp lệ.' };

  if (parsed.data.warehouseId === parsed.data.toWarehouseId) {
    return { error: 'Kho nguồn và kho đến phải khác nhau.' };
  }

  try {
    await assertCanAccessWarehouse(user.id, parsed.data.warehouseId, user.role);
    await assertCanAccessWarehouse(user.id, parsed.data.toWarehouseId, user.role);
  } catch {
    return { error: 'Bạn không có quyền với 1 trong 2 kho. Liên hệ admin để được cấp.' };
  }

  try {
    const { receipt, deduped } = await createTransfer({
      type: 'TRANSFER',
      warehouseId: parsed.data.warehouseId,
      fromWarehouseId: parsed.data.warehouseId,
      toWarehouseId: parsed.data.toWarehouseId,
      date: new Date(parsed.data.date),
      note: parsed.data.note ?? null,
      lines: parsed.data.lines,
      createdById: user.id,
      clientRequestId: parsed.data.clientRequestId ?? null
    });
    if (!deduped) {
      await audit({ userId: user.id, action: 'create', entityType: 'Receipt', entityId: receipt.id, after: { code: receipt.code, type: 'TRANSFER' } });
    }
    revalidatePath('/chuyen-kho');
    revalidatePath('/ton-kho');
    return { ok: true, receiptId: receipt.id, receiptCode: receipt.code };
  } catch (e: any) {
    if (e instanceof OverstockError) {
      return { error: `Tồn kho nguồn không đủ (còn ${e.currentStock}, cần ${e.requested}).` };
    }
    if (e?.message === 'FROM_TO_SAME') return { error: 'Kho nguồn và kho đến phải khác nhau.' };
    return { error: e?.message ?? 'Đã xảy ra lỗi.' };
  }
}

export async function confirmArrival(receiptId: string) {
  const user = await requireUser();
  const r = await prisma.receipt.findUnique({ where: { id: receiptId } });
  if (!r || r.type !== 'TRANSFER' || r.status !== 'IN_TRANSIT' || !r.toWarehouseId) {
    return { error: 'Phiếu chuyển kho không ở trạng thái hợp lệ để xác nhận.' };
  }
  try {
    await assertCanAccessWarehouse(user.id, r.toWarehouseId, user.role);
  } catch {
    return { error: 'Bạn không có quyền xác nhận tại kho đến.' };
  }
  await confirmTransferArrival(receiptId);
  await audit({ userId: user.id, action: 'confirm_arrival', entityType: 'Receipt', entityId: receiptId });
  revalidatePath('/chuyen-kho');
  revalidatePath('/ton-kho');
  return { ok: true };
}
