'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { requireUser, assertCanAccessWarehouse } from '@/lib/auth/lucia';
import { createInboundOutbound, OverstockError, simulateBackdateOutbound } from '@/lib/domain/receipts';
import { formatDate } from '@/lib/utils';
import { audit } from '@/lib/security/audit';

const lineSchema = z.object({
  productId: z.string().min(1),
  unit: z.enum(['BO', 'CHIEC']),
  quantity: z.number().int().min(1).max(9999),
  lineNote: z.string().max(500).optional()
});

const payloadSchema = z.object({
  type: z.literal('OUTBOUND'),
  warehouseId: z.string().min(1),
  date: z.string().min(1),
  customerOrPartner: z.string().max(256).optional(),
  note: z.string().max(500).optional(),
  lines: z.array(lineSchema).min(1).max(200),
  clientRequestId: z.string().optional(),
  forceBackdate: z.boolean().optional()
});

async function getOverstockPolicy(): Promise<'warn' | 'block'> {
  const s = await prisma.setting.findUnique({ where: { key: 'out_overstock_policy' } });
  return s?.value === 'block' ? 'block' : 'warn';
}

export async function createOutboundReceipt(payload: unknown) {
  const user = await requireUser();
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Dữ liệu không hợp lệ.' };

  try {
    await assertCanAccessWarehouse(user.id, parsed.data.warehouseId, user.role);
  } catch {
    return { error: 'Bạn không có quyền với kho này.' };
  }

  // Backdate simulation
  if (!parsed.data.forceBackdate) {
    const issues = await simulateBackdateOutbound(
      parsed.data.warehouseId,
      new Date(parsed.data.date),
      parsed.data.lines
    );
    if (issues.length > 0) {
      // Only admin can override
      if (user.role !== 'ADMIN') {
        return {
          error:
            `Phiếu xuất ngày ${formatDate(parsed.data.date)} sẽ làm tồn ÂM tại thời điểm trong quá khứ:\n` +
            issues.map((i) => `• ${i.sku}: âm xuống ${i.minStock} (từ ${formatDate(i.firstNegativeDate)})`).join('\n') +
            '\nChỉ quản trị viên mới có thể ghi đè cảnh báo này.'
        };
      }
      return {
        backdateWarning:
          `Backdate phiếu sẽ làm tồn ÂM ở 1 hay nhiều thời điểm:\n` +
          issues.map((i) => `• ${i.sku}: âm xuống ${i.minStock} (từ ${formatDate(i.firstNegativeDate)})`).join('\n') +
          '\nBạn là quản trị viên — vẫn lưu phiếu?'
      };
    }
  }

  const policy = await getOverstockPolicy();
  try {
    const { receipt, deduped } = await createInboundOutbound(
      {
        type: 'OUTBOUND',
        warehouseId: parsed.data.warehouseId,
        date: new Date(parsed.data.date),
        customerOrPartner: parsed.data.customerOrPartner ?? null,
        note: parsed.data.note ?? null,
        lines: parsed.data.lines,
        createdById: user.id,
        clientRequestId: parsed.data.clientRequestId ?? null
      },
      policy
    );
    if (!deduped) {
      await audit({ userId: user.id, action: 'create', entityType: 'Receipt', entityId: receipt.id, after: { code: receipt.code, type: 'OUTBOUND' } });
    }
    revalidatePath('/xuat-kho');
    revalidatePath('/tong-quan');
    revalidatePath('/ton-kho');
    return { ok: true, receiptId: receipt.id, receiptCode: receipt.code };
  } catch (e: any) {
    if (e instanceof OverstockError) {
      return { error: `Không đủ tồn cho 1 sản phẩm (còn ${e.currentStock}, cần ${e.requested}). Đổi sang chế độ "Cảnh báo" trong Cấu hình nếu muốn cho phép xuất quá tồn.` };
    }
    return { error: e?.message ?? 'Đã xảy ra lỗi.' };
  }
}
