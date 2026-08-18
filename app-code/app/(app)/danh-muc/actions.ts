'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { requireUser, requireAdmin } from '@/lib/auth/lucia';
import { audit } from '@/lib/security/audit';

const productSchema = z.object({
  sku: z.string().min(1, 'Bắt buộc').max(64),
  fullName: z.string().min(1, 'Bắt buộc').max(256),
  brand: z.string().min(1, 'Bắt buộc').max(64),
  size: z.string().min(1, 'Bắt buộc').max(64),
  pattern: z.string().min(1, 'Bắt buộc').max(64),
  defaultUnit: z.enum(['BO', 'CHIEC']),
  lowStockThreshold: z.coerce.number().int().min(0).max(99999)
});

/** Các trang cần làm mới sau khi danh mục thay đổi. */
function revalidateCatalog() {
  revalidatePath('/danh-muc');
  revalidatePath('/ton-kho');
  revalidatePath('/tong-quan');
  revalidatePath('/bao-cao/nxt');
}

export async function createProduct(formData: FormData) {
  const user = await requireUser();
  const parsed = productSchema.safeParse({
    sku: formData.get('sku'),
    fullName: formData.get('fullName'),
    brand: formData.get('brand'),
    size: formData.get('size'),
    pattern: formData.get('pattern'),
    defaultUnit: formData.get('defaultUnit'),
    lowStockThreshold: formData.get('lowStockThreshold')
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Dữ liệu không hợp lệ' };

  try {
    const product = await prisma.product.create({ data: parsed.data });
    await audit({ userId: user.id, action: 'create', entityType: 'Product', entityId: product.id, after: product });
    revalidateCatalog();
    redirect(`/danh-muc`);
  } catch (e: any) {
    if (e?.code === 'P2002') {
      const existing = await prisma.product.findUnique({ where: { sku: parsed.data.sku } });
      if (existing && !existing.active) {
        return { error: `SKU "${parsed.data.sku}" đang ở trạng thái Ngừng áp dụng. Nhờ admin áp dụng lại thay vì tạo mới.` };
      }
      return { error: 'SKU đã tồn tại.' };
    }
    throw e;
  }
}

export async function updateProduct(id: string, formData: FormData) {
  const user = await requireUser();
  const parsed = productSchema.safeParse({
    sku: formData.get('sku'),
    fullName: formData.get('fullName'),
    brand: formData.get('brand'),
    size: formData.get('size'),
    pattern: formData.get('pattern'),
    defaultUnit: formData.get('defaultUnit'),
    lowStockThreshold: formData.get('lowStockThreshold')
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Dữ liệu không hợp lệ' };

  const before = await prisma.product.findUnique({ where: { id } });
  try {
    const product = await prisma.product.update({ where: { id }, data: parsed.data });
    await audit({ userId: user.id, action: 'update', entityType: 'Product', entityId: product.id, before, after: product });
    revalidateCatalog();
    redirect('/danh-muc');
  } catch (e: any) {
    if (e?.code === 'P2002') return { error: 'SKU đã tồn tại.' };
    throw e;
  }
}

/**
 * Ngừng áp dụng một mặt hàng ("xoá" ở mức nghiệp vụ).
 * Mặt hàng biến mất khỏi danh mục, tồn kho, combobox phiếu, sửa tồn và báo cáo NXT.
 * Dữ liệu phiếu cũ giữ nguyên; chỉ ADMIN thực hiện và khôi phục được.
 */
export async function discontinueProduct(id: string) {
  const user = await requireAdmin();
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p) return { error: 'Không tìm thấy sản phẩm.' };
  if (!p.active) return { error: 'Sản phẩm đã ở trạng thái Ngừng áp dụng.' };

  await prisma.product.update({ where: { id }, data: { active: false } });
  await audit({
    userId: user.id,
    action: 'discontinue',
    entityType: 'Product',
    entityId: id,
    before: { sku: p.sku, active: true },
    after: { sku: p.sku, active: false }
  });
  revalidateCatalog();
  return { ok: true, message: `Đã ngừng áp dụng "${p.sku}". Mặt hàng đã ẩn khỏi mọi chức năng.` };
}

/** Áp dụng lại mặt hàng đã ngừng — chỉ ADMIN. */
export async function restoreProduct(id: string) {
  const user = await requireAdmin();
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p) return { error: 'Không tìm thấy sản phẩm.' };
  if (p.active) return { error: 'Sản phẩm đang được áp dụng.' };

  await prisma.product.update({ where: { id }, data: { active: true } });
  await audit({
    userId: user.id,
    action: 'restore',
    entityType: 'Product',
    entityId: id,
    before: { sku: p.sku, active: false },
    after: { sku: p.sku, active: true }
  });
  revalidateCatalog();
  return { ok: true, message: `Đã áp dụng lại "${p.sku}".` };
}

/**
 * Xoá vĩnh viễn khỏi CSDL — chỉ ADMIN và chỉ khi mặt hàng CHƯA phát sinh
 * bất kỳ dòng phiếu / biến động tồn nào (ví dụ tạo nhầm, trùng SKU).
 * Mặt hàng đã có lịch sử thì phải dùng Ngừng áp dụng để không phá hỏng phiếu cũ.
 */
export async function deleteProductPermanently(id: string, confirmSku: string) {
  const user = await requireAdmin();
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p) return { error: 'Không tìm thấy sản phẩm.' };

  if (confirmSku.trim() !== p.sku) {
    return { error: 'Mã SKU xác nhận không khớp.' };
  }

  const [lineCount, movementCount] = await Promise.all([
    prisma.receiptLine.count({ where: { productId: id } }),
    prisma.stockMovement.count({ where: { productId: id } })
  ]);
  if (lineCount > 0 || movementCount > 0) {
    return {
      error: `Không xoá vĩnh viễn được: "${p.sku}" đã có ${lineCount} dòng phiếu và ${movementCount} biến động tồn. Hãy dùng "Ngừng áp dụng".`
    };
  }

  await prisma.product.delete({ where: { id } });
  await audit({
    userId: user.id,
    action: 'delete',
    entityType: 'Product',
    entityId: id,
    before: { sku: p.sku, fullName: p.fullName, brand: p.brand, size: p.size, pattern: p.pattern }
  });
  revalidateCatalog();
  return { ok: true, message: `Đã xoá vĩnh viễn "${p.sku}".` };
}
