'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { requireUser } from '@/lib/auth/lucia';
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
    revalidatePath('/danh-muc');
    redirect(`/danh-muc`);
  } catch (e: any) {
    if (e?.code === 'P2002') return { error: 'SKU đã tồn tại.' };
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
    revalidatePath('/danh-muc');
    redirect('/danh-muc');
  } catch (e: any) {
    if (e?.code === 'P2002') return { error: 'SKU đã tồn tại.' };
    throw e;
  }
}

export async function toggleProductActive(id: string) {
  const user = await requireUser();
  const p = await prisma.product.findUnique({ where: { id } });
  if (!p) return { error: 'Không tìm thấy sản phẩm.' };
  const updated = await prisma.product.update({ where: { id }, data: { active: !p.active } });
  await audit({
    userId: user.id,
    action: updated.active ? 'activate' : 'deactivate',
    entityType: 'Product',
    entityId: id,
    before: { active: p.active },
    after: { active: updated.active }
  });
  revalidatePath('/danh-muc');
  return { message: updated.active ? 'Đã kích hoạt sản phẩm.' : 'Đã vô hiệu hoá sản phẩm.' };
}
