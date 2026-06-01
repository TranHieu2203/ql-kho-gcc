'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { requireAdmin } from '@/lib/auth/lucia';
import { audit } from '@/lib/security/audit';

/**
 * Phạm vi xoá:
 *  - movements:   chỉ xoá StockMovement + ReceiptLine + Receipt (về 0 tồn)
 *  - products:    movements + Product (mọi sản phẩm)
 *  - warehouses:  movements + Product + Warehouse + UserWarehouse
 *  - all:         như trên + xoá người dùng (trừ chính ADMIN đang đăng nhập) + cấu hình backup + audit cũ
 */
type Scope = 'movements' | 'products' | 'warehouses' | 'all';

const CONFIRM_TEXT = 'XOA DU LIEU';

const schema = z.object({
  scope: z.enum(['movements', 'products', 'warehouses', 'all']),
  confirm: z.string(),
  password: z.string().min(1, 'Nhập mật khẩu admin')
});

export async function clearData(payload: unknown) {
  const me = await requireAdmin();
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Dữ liệu không hợp lệ' };

  const { scope, confirm, password } = parsed.data;

  if (confirm.trim() !== CONFIRM_TEXT) {
    return { error: `Phải gõ chính xác cụm "${CONFIRM_TEXT}" để xác nhận.` };
  }

  // Verify password lần nữa (defense-in-depth chống nhầm tay)
  const meRow = await prisma.user.findUnique({ where: { id: me.id } });
  if (!meRow) return { error: 'Phiên đăng nhập không hợp lệ.' };
  const { verifyPassword } = await import('@/lib/auth/password');
  const ok = await verifyPassword(password, meRow.passwordHash);
  if (!ok) return { error: 'Mật khẩu không đúng.' };

  // Counts trước khi xoá (để audit log)
  const before = await getCountsServer();

  try {
    await prisma.$transaction(async (tx) => {
      // Luôn xoá movements + lines + receipts (về 0 tồn)
      await tx.stockMovement.deleteMany({});
      await tx.receiptLine.deleteMany({});
      await tx.receipt.deleteMany({});

      if (scope === 'products' || scope === 'warehouses' || scope === 'all') {
        await tx.product.deleteMany({});
      }
      if (scope === 'warehouses' || scope === 'all') {
        await tx.userWarehouse.deleteMany({});
        await tx.warehouse.deleteMany({});
      }
      if (scope === 'all') {
        // Giữ lại ADMIN đang đăng nhập, xoá tất cả user khác + session của họ
        await tx.session.deleteMany({ where: { userId: { not: me.id } } });
        await tx.user.deleteMany({ where: { id: { not: me.id } } });

        // Xoá cấu hình backup + audit log cũ (nhưng giữ entry của lần xoá này — audit() sẽ tạo sau commit)
        await tx.setting.deleteMany({});
        // KHÔNG xoá audit log — giữ lịch sử để có dấu vết. Người dùng nếu muốn xoá phải vào DB trực tiếp.
      }
    }, { timeout: 30_000 });
  } catch (e: any) {
    return { error: 'Xoá thất bại: ' + (e?.message ?? 'unknown') };
  }

  const after = await getCountsServer();

  await audit({
    userId: me.id,
    action: 'clear-data',
    entityType: 'System',
    entityId: 'data',
    before,
    after: { ...after, scope }
  });

  revalidatePath('/quan-tri/xoa-du-lieu');
  revalidatePath('/ton-kho');
  revalidatePath('/nhap-kho');
  revalidatePath('/xuat-kho');
  revalidatePath('/chuyen-kho');
  revalidatePath('/danh-muc');
  revalidatePath('/bao-cao/nxt');
  revalidatePath('/tong-quan');

  return { ok: true, before, after };
}

export async function getCountsServer() {
  await requireAdmin();
  const [movements, receipts, receiptLines, products, warehouses, users, sessions, audits, settings] = await Promise.all([
    prisma.stockMovement.count(),
    prisma.receipt.count(),
    prisma.receiptLine.count(),
    prisma.product.count(),
    prisma.warehouse.count(),
    prisma.user.count(),
    prisma.session.count(),
    prisma.auditLog.count(),
    prisma.setting.count()
  ]);
  return { movements, receipts, receiptLines, products, warehouses, users, sessions, audits, settings };
}
