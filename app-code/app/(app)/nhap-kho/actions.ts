'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { requireUser, assertCanAccessWarehouse } from '@/lib/auth/lucia';
import { createInboundOutbound, OverstockError } from '@/lib/domain/receipts';
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
  customerOrPartner: z.string().max(256).optional(),
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
