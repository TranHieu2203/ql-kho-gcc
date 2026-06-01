'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { requireUser, assertCanAccessWarehouse } from '@/lib/auth/lucia';
import { audit } from '@/lib/security/audit';

/**
 * Delete a receipt.
 * For INBOUND: check cascade — if there's any OUTBOUND/TRANSFER that depended on this stock, return warning.
 *   Admin can force-cascade; non-admin gets blocked.
 *
 * Tồn kho được điều chỉnh bằng cách xoá StockMovement cùng sourceId.
 */
export async function deleteReceipt(receiptId: string, forceCascade = false) {
  const user = await requireUser();
  const r = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: { lines: true, movements: true }
  });
  if (!r) return { error: 'Không tìm thấy phiếu.' };

  try {
    await assertCanAccessWarehouse(user.id, r.warehouseId, user.role);
  } catch {
    return { error: 'Bạn không có quyền với phiếu này.' };
  }

  // Cascade check for INBOUND
  if (r.type === 'INBOUND') {
    // For each product in this receipt, check if total stock will go negative after deletion
    const productIds = Array.from(new Set(r.lines.map((l) => l.productId)));
    const cascadeIssues: string[] = [];
    for (const productId of productIds) {
      // Sum of all qtyDelta for (warehouse, product), MINUS the contribution of this receipt's movements
      const all = await prisma.stockMovement.aggregate({
        _sum: { qtyDelta: true },
        where: { warehouseId: r.warehouseId, productId }
      });
      const thisReceiptDelta = r.movements
        .filter((m) => m.productId === productId)
        .reduce((s, m) => s + m.qtyDelta, 0);
      const remainingAfterDelete = (all._sum.qtyDelta ?? 0) - thisReceiptDelta;
      if (remainingAfterDelete < 0) {
        const p = await prisma.product.findUnique({ where: { id: productId } });
        cascadeIssues.push(`${p?.sku ?? productId}: tồn sẽ âm ${remainingAfterDelete}`);
      }
    }
    if (cascadeIssues.length > 0 && !forceCascade) {
      return {
        cascadeWarning: `Phiếu nhập này đã được dùng cho ${cascadeIssues.length} sản phẩm khác. Xoá sẽ làm tồn không hợp lệ:\n• ${cascadeIssues.join('\n• ')}\n\nKhuyến nghị: tạo phiếu xuất điều chỉnh thay vì xoá.`
      };
    }
    if (cascadeIssues.length > 0 && forceCascade && user.role !== 'ADMIN') {
      return { error: 'Chỉ admin mới có thể xoá khi có cascade.' };
    }
  }

  // For TRANSFER: if status=CONFIRMED, both warehouses' movements need to be reversed
  // For OUTBOUND: simply reverse the movement

  await prisma.$transaction(async (tx) => {
    // Delete StockMovements first (cascade via sourceId)
    await tx.stockMovement.deleteMany({ where: { sourceId: receiptId } });
    // Delete ReceiptLines (cascade on Receipt delete handles this, but explicit is fine)
    await tx.receiptLine.deleteMany({ where: { receiptId } });
    // Delete the Receipt
    await tx.receipt.delete({ where: { id: receiptId } });
  });

  await audit({
    userId: user.id,
    action: 'delete',
    entityType: 'Receipt',
    entityId: receiptId,
    before: { code: r.code, type: r.type, status: r.status, warehouseId: r.warehouseId }
  });

  revalidatePath('/nhap-kho');
  revalidatePath('/xuat-kho');
  revalidatePath('/chuyen-kho');
  revalidatePath('/ton-kho');
  revalidatePath('/tong-quan');
  revalidatePath('/bao-cao/nxt');

  return { ok: true };
}
