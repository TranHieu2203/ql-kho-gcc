'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { requireAdmin } from '@/lib/auth/lucia';
import { audit } from '@/lib/security/audit';

const schema = z.object({
  code: z.string().min(1).max(32).regex(/^[A-Z0-9_-]+$/, 'Chỉ A-Z, 0-9, _, -'),
  name: z.string().min(1).max(128),
  address: z.string().max(256).optional().default('')
});

export async function createWarehouse(fd: FormData) {
  const user = await requireAdmin();
  const parsed = schema.safeParse({
    code: String(fd.get('code') ?? '').toUpperCase().trim(),
    name: fd.get('name'),
    address: fd.get('address') ?? ''
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Dữ liệu không hợp lệ' };

  try {
    const wh = await prisma.warehouse.create({ data: parsed.data });
    await audit({ userId: user.id, action: 'create', entityType: 'Warehouse', entityId: wh.id, after: wh });
    revalidatePath('/quan-tri/kho');
    redirect('/quan-tri/kho');
  } catch (e: any) {
    if (e?.code === 'P2002') return { error: 'Mã kho đã tồn tại.' };
    throw e;
  }
}

export async function updateWarehouse(id: string, fd: FormData) {
  const user = await requireAdmin();
  const parsed = schema.safeParse({
    code: String(fd.get('code') ?? '').toUpperCase().trim(),
    name: fd.get('name'),
    address: fd.get('address') ?? ''
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Dữ liệu không hợp lệ' };

  const before = await prisma.warehouse.findUnique({ where: { id } });
  try {
    const wh = await prisma.warehouse.update({ where: { id }, data: parsed.data });
    await audit({ userId: user.id, action: 'update', entityType: 'Warehouse', entityId: id, before, after: wh });
    revalidatePath('/quan-tri/kho');
    redirect('/quan-tri/kho');
  } catch (e: any) {
    if (e?.code === 'P2002') return { error: 'Mã kho đã tồn tại.' };
    throw e;
  }
}

export async function archiveWarehouse(id: string) {
  const user = await requireAdmin();
  const wh = await prisma.warehouse.findUnique({
    where: { id },
    include: { _count: { select: { receipts: true } } }
  });
  if (!wh) return { error: 'Không tìm thấy kho.' };
  const updated = await prisma.warehouse.update({ where: { id }, data: { active: !wh.active } });
  await audit({
    userId: user.id,
    action: updated.active ? 'activate' : 'archive',
    entityType: 'Warehouse',
    entityId: id,
    before: { active: wh.active },
    after: { active: updated.active }
  });
  revalidatePath('/quan-tri/kho');
  return { message: updated.active ? 'Đã kích hoạt kho.' : 'Đã vô hiệu hoá kho.' };
}
