'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { requireAdmin } from '@/lib/auth/lucia';
import { audit } from '@/lib/security/audit';
import { computeStock, getNextReceiptSequence } from '@/lib/domain/receipts';
import { generateReceiptCode } from '@/lib/utils';

const lineSchema = z.object({
  productId: z.string().min(1),
  unit: z.enum(['BO', 'CHIEC']),
  newQty: z.number().int().min(0).max(999999),
  reason: z.string().trim().min(3, 'Lý do tối thiểu 3 ký tự').max(500)
});

const adjustSchema = z.object({
  warehouseId: z.string().min(1, 'Chưa chọn kho'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày không hợp lệ'),
  note: z.string().trim().max(500).optional(),
  lines: z.array(lineSchema).min(1, 'Cần ít nhất 1 dòng')
});

export async function adjustStock(payload: unknown) {
  const me = await requireAdmin();
  const parsed = adjustSchema.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Dữ liệu không hợp lệ' };

  const { warehouseId, date, note, lines } = parsed.data;

  const wh = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
  if (!wh || !wh.active) return { error: 'Kho không tồn tại hoặc đã bị vô hiệu hoá.' };

  const dateObj = new Date(date + 'T00:00:00.000Z');

  const productIds = lines.map((l) => l.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  const productMap = new Map(products.map((p) => [p.id, p]));
  for (const ln of lines) {
    if (!productMap.has(ln.productId)) return { error: `Sản phẩm ${ln.productId} không tồn tại.` };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const adjustments: { sku: string; before: number; after: number; delta: number }[] = [];

      const seq = await getNextReceiptSequence(tx, 'ADJUSTMENT', dateObj.getFullYear());
      const code = generateReceiptCode('ADJUSTMENT', seq, dateObj.getFullYear());

      const reasonsCombined = lines.map((l) => `${productMap.get(l.productId)!.sku}: ${l.reason}`).join(' | ');
      const fullNote = [note, reasonsCombined].filter(Boolean).join(' — ');

      const receipt = await tx.receipt.create({
        data: {
          code,
          type: 'ADJUSTMENT',
          status: 'CONFIRMED',
          warehouseId,
          date: dateObj,
          note: fullNote.slice(0, 1000),
          createdById: me.id,
          confirmedAt: new Date(),
          lines: {
            create: lines.map((l) => ({
              productId: l.productId,
              unit: l.unit,
              quantity: l.newQty,
              lineNote: l.reason
            }))
          }
        }
      });

      for (const ln of lines) {
        const before = await computeStock(tx, warehouseId, ln.productId);
        const delta = ln.newQty - before;
        if (delta !== 0) {
          await tx.stockMovement.create({
            data: {
              warehouseId,
              productId: ln.productId,
              unit: ln.unit,
              qtyDelta: delta,
              source: 'ADJUSTMENT',
              sourceId: receipt.id,
              occurredAt: dateObj
            }
          });
        }
        adjustments.push({
          sku: productMap.get(ln.productId)!.sku,
          before,
          after: ln.newQty,
          delta
        });
      }

      return { receiptId: receipt.id, receiptCode: receipt.code, adjustments };
    });

    await audit({
      userId: me.id,
      action: 'adjust',
      entityType: 'StockAdjustment',
      entityId: result.receiptId,
      after: {
        receiptCode: result.receiptCode,
        warehouseId,
        warehouseCode: wh.code,
        date,
        adjustments: result.adjustments
      }
    });

    revalidatePath('/ton-kho');
    revalidatePath('/quan-tri/sua-ton');
    return { ok: true, receiptCode: result.receiptCode, adjustments: result.adjustments };
  } catch (e: any) {
    return { error: 'Không lưu được điều chỉnh: ' + (e?.message ?? 'unknown') };
  }
}

/**
 * Trả về tồn hiện tại của 1 (kho, sản phẩm). Dùng cho client preflight.
 */
export async function getCurrentStockServer(warehouseId: string, productId: string) {
  await requireAdmin();
  if (!warehouseId || !productId) return { error: 'Thiếu thông tin.' };
  const qty = await computeStock(prisma, warehouseId, productId);
  return { ok: true, qty };
}
