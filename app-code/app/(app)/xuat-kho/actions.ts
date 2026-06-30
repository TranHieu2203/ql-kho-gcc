'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { requireUser, assertCanAccessWarehouse } from '@/lib/auth/lucia';
import { createInboundOutbound, OverstockError, simulateBackdateOutbound, computeStock } from '@/lib/domain/receipts';
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
  customerAddress: z.string().max(512).optional(),
  customerPhone: z.string().max(64).optional(),
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
        customerAddress: parsed.data.customerAddress ?? null,
        customerPhone: parsed.data.customerPhone ?? null,
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

// ---------------------------------------------------------------------------
// UPDATE OUTBOUND RECEIPT
// Strategy: thay thế — xoá lines + movements cũ trong 1 transaction, dựng lại
// theo payload mới. Mã phiếu giữ nguyên. Tồn tự động được tính lại vì
// computeStock() đã sum tất cả StockMovement, và ta đã xoá cái cũ + thêm cái mới.
// ---------------------------------------------------------------------------
const updatePayloadSchema = z.object({
  warehouseId: z.string().min(1),
  date: z.string().min(1),
  customerOrPartner: z.string().max(256).optional(),
  customerAddress: z.string().max(512).optional(),
  customerPhone: z.string().max(64).optional(),
  note: z.string().max(500).optional(),
  lines: z.array(lineSchema).min(1).max(200),
  forceBackdate: z.boolean().optional(),
  forceOverstock: z.boolean().optional()
});

export async function updateOutboundReceipt(receiptId: string, payload: unknown) {
  const user = await requireUser();
  const parsed = updatePayloadSchema.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Dữ liệu không hợp lệ.' };

  const original = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: { lines: true, movements: true }
  });
  if (!original) return { error: 'Không tìm thấy phiếu.' };
  if (original.type !== 'OUTBOUND') return { error: 'Chỉ phiếu xuất mới sửa được theo cách này.' };

  // Quyền với kho cũ + kho mới (nếu thay đổi)
  try {
    await assertCanAccessWarehouse(user.id, original.warehouseId, user.role);
    if (parsed.data.warehouseId !== original.warehouseId) {
      await assertCanAccessWarehouse(user.id, parsed.data.warehouseId, user.role);
    }
  } catch {
    return { error: 'Bạn không có quyền với kho liên quan.' };
  }

  const newDate = new Date(parsed.data.date);

  // Mô phỏng backdate: tạm thời "xoá" delta cũ rồi simulate phiếu mới
  // Cách đơn giản & đúng: tính tồn ngay-trước-khi-replace, kiểm tra phiếu mới có gây âm không.
  // - Với cùng (warehouseId, productId, ngày) → quy đổi: tồn-effective = computeStock - oldDelta
  // - Sau đó simulateBackdateOutbound trên virtual stock này.
  // Trong thực tế đơn giản hơn: chạy 1 lần block-check trên (warehouse hiện tại) sau khi đảo movements cũ.

  if (!parsed.data.forceBackdate) {
    // Build effective movements: real - this receipt's old movements
    const oldDeltaByProduct = new Map<string, number>();
    for (const m of original.movements) {
      const key = `${m.warehouseId}|${m.productId}`;
      oldDeltaByProduct.set(key, (oldDeltaByProduct.get(key) ?? 0) + m.qtyDelta);
    }

    // Effective check: cho từng line mới, tính tồn = stock_hiện_tại - old_delta_cùng_pp_cùng_kho - new_qty
    const issues: { sku: string; productName: string; firstNegativeDate: Date; minStock: number }[] = [];

    for (const ln of parsed.data.lines) {
      const cur = await computeStock(prisma, parsed.data.warehouseId, ln.productId);
      const k = `${parsed.data.warehouseId}|${ln.productId}`;
      const adjBack = oldDeltaByProduct.get(k) ?? 0; // âm vì OUTBOUND cũ
      // Khôi phục tồn (trừ old delta vì delta âm → cộng ngược)
      const effectiveStock = cur - adjBack;
      if (effectiveStock - ln.quantity < 0) {
        const p = await prisma.product.findUnique({ where: { id: ln.productId } });
        issues.push({
          sku: p?.sku ?? ln.productId,
          productName: p?.fullName ?? '',
          firstNegativeDate: newDate,
          minStock: effectiveStock - ln.quantity
        });
      }
    }

    if (issues.length > 0) {
      const policy = await getOverstockPolicy();
      if (policy === 'block' && !parsed.data.forceOverstock) {
        if (user.role !== 'ADMIN') {
          return {
            error:
              `Sửa phiếu sẽ làm tồn âm:\n` +
              issues.map((i) => `• ${i.sku}: âm xuống ${i.minStock}`).join('\n') +
              '\nĐổi chính sách sang "Cảnh báo" trong Cấu hình hoặc tăng tồn trước.'
          };
        }
        return {
          backdateWarning:
            `Sửa phiếu sẽ làm tồn ÂM:\n` +
            issues.map((i) => `• ${i.sku}: âm xuống ${i.minStock}`).join('\n') +
            '\nBạn là quản trị viên — vẫn lưu?'
        };
      }
      // warn mode hoặc admin force: cho phép tiếp tục (sẽ lưu warning vào audit)
    }
  }

  // Snapshot trước khi sửa (for audit)
  const before = {
    code: original.code,
    warehouseId: original.warehouseId,
    date: original.date,
    customerOrPartner: original.customerOrPartner,
    customerAddress: original.customerAddress,
    customerPhone: original.customerPhone,
    note: original.note,
    lines: original.lines.map((l) => ({ productId: l.productId, unit: l.unit, quantity: l.quantity, lineNote: l.lineNote }))
  };

  try {
    await prisma.$transaction(async (tx) => {
      // Xoá lines + movements cũ
      await tx.stockMovement.deleteMany({ where: { sourceId: receiptId } });
      await tx.receiptLine.deleteMany({ where: { receiptId } });

      // Cập nhật metadata phiếu
      await tx.receipt.update({
        where: { id: receiptId },
        data: {
          warehouseId: parsed.data.warehouseId,
          date: newDate,
          customerOrPartner: parsed.data.customerOrPartner ?? null,
          customerAddress: parsed.data.customerAddress ?? null,
          customerPhone: parsed.data.customerPhone ?? null,
          note: parsed.data.note ?? null,
          version: { increment: 1 }
        }
      });

      // Tạo lại lines + movements
      for (const ln of parsed.data.lines) {
        await tx.receiptLine.create({
          data: {
            receiptId,
            productId: ln.productId,
            unit: ln.unit,
            quantity: ln.quantity,
            lineNote: ln.lineNote ?? null
          }
        });
        await tx.stockMovement.create({
          data: {
            warehouseId: parsed.data.warehouseId,
            productId: ln.productId,
            unit: ln.unit,
            qtyDelta: -ln.quantity, // OUTBOUND
            source: 'RECEIPT',
            sourceId: receiptId,
            occurredAt: newDate
          }
        });
      }
    });
  } catch (e: any) {
    return { error: 'Lưu thất bại: ' + (e?.message ?? 'unknown') };
  }

  await audit({
    userId: user.id,
    action: 'update',
    entityType: 'Receipt',
    entityId: receiptId,
    before,
    after: {
      code: original.code,
      warehouseId: parsed.data.warehouseId,
      date: parsed.data.date,
      customerOrPartner: parsed.data.customerOrPartner,
      customerAddress: parsed.data.customerAddress,
      customerPhone: parsed.data.customerPhone,
      note: parsed.data.note,
      lines: parsed.data.lines
    }
  });

  revalidatePath('/xuat-kho');
  revalidatePath(`/xuat-kho/${receiptId}`);
  revalidatePath('/ton-kho');
  revalidatePath('/tong-quan');
  revalidatePath('/bao-cao/nxt');
  return { ok: true, receiptId, receiptCode: original.code };
}
