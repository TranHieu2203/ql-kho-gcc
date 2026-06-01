'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { requireAdmin } from '@/lib/auth/lucia';
import { hashPassword } from '@/lib/auth/password';
import { audit } from '@/lib/security/audit';

const passwordSchema = z
  .string()
  .min(8, 'Mật khẩu tối thiểu 8 ký tự')
  .max(128)
  .refine((p) => /[A-Za-z]/.test(p), 'Phải có ít nhất 1 chữ cái')
  .refine((p) => /\d/.test(p), 'Phải có ít nhất 1 chữ số');

const createSchema = z.object({
  username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9._-]+$/, 'Chỉ ký tự a-z, A-Z, 0-9, ._-'),
  fullName: z.string().min(1).max(128),
  password: passwordSchema,
  role: z.enum(['ADMIN', 'WAREHOUSE_STAFF']),
  warehouseIds: z.array(z.string()).default([])
});

const updateSchema = z.object({
  fullName: z.string().min(1).max(128),
  password: passwordSchema.optional().or(z.literal('').transform(() => undefined)),
  role: z.enum(['ADMIN', 'WAREHOUSE_STAFF']),
  warehouseIds: z.array(z.string()).default([]),
  active: z.coerce.boolean()
});

function parseWarehouseIds(fd: FormData): string[] {
  return fd.getAll('warehouseIds').map(String).filter(Boolean);
}

export async function createUser(fd: FormData) {
  const me = await requireAdmin();
  const parsed = createSchema.safeParse({
    username: fd.get('username'),
    fullName: fd.get('fullName'),
    password: fd.get('password'),
    role: fd.get('role'),
    warehouseIds: parseWarehouseIds(fd)
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Dữ liệu không hợp lệ' };

  const hash = await hashPassword(parsed.data.password);
  try {
    const created = await prisma.user.create({
      data: {
        username: parsed.data.username,
        fullName: parsed.data.fullName,
        passwordHash: hash,
        role: parsed.data.role,
        warehouseLinks:
          parsed.data.role === 'ADMIN'
            ? undefined
            : { create: parsed.data.warehouseIds.map((wid) => ({ warehouseId: wid })) }
      }
    });
    await audit({
      userId: me.id,
      action: 'create',
      entityType: 'User',
      entityId: created.id,
      after: { username: created.username, role: created.role, fullName: created.fullName }
    });
    revalidatePath('/quan-tri/nguoi-dung');
    redirect('/quan-tri/nguoi-dung');
  } catch (e: any) {
    if (e?.code === 'P2002') return { error: 'Tên đăng nhập đã tồn tại.' };
    throw e;
  }
}

export async function updateUser(id: string, fd: FormData) {
  const me = await requireAdmin();
  const parsed = updateSchema.safeParse({
    fullName: fd.get('fullName'),
    password: fd.get('password') || undefined,
    role: fd.get('role'),
    warehouseIds: parseWarehouseIds(fd),
    active: fd.get('active') === 'on'
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Dữ liệu không hợp lệ' };

  // Block: cannot remove last active admin
  if (parsed.data.role !== 'ADMIN' || !parsed.data.active) {
    const target = await prisma.user.findUnique({ where: { id } });
    if (target?.role === 'ADMIN' && target.active) {
      const otherActiveAdmins = await prisma.user.count({
        where: { role: 'ADMIN', active: true, id: { not: id } }
      });
      if (otherActiveAdmins === 0) {
        return { error: 'Phải có ít nhất 1 quản trị viên hoạt động khác trước khi đổi vai trò / vô hiệu tài khoản này.' };
      }
    }
  }

  const data: any = {
    fullName: parsed.data.fullName,
    role: parsed.data.role,
    active: parsed.data.active
  };
  if (parsed.data.password) {
    data.passwordHash = await hashPassword(parsed.data.password);
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data });
    // Reset warehouse links
    await tx.userWarehouse.deleteMany({ where: { userId: id } });
    if (parsed.data.role !== 'ADMIN' && parsed.data.warehouseIds.length > 0) {
      await tx.userWarehouse.createMany({
        data: parsed.data.warehouseIds.map((wid) => ({ userId: id, warehouseId: wid }))
      });
    }
  });

  await audit({
    userId: me.id,
    action: 'update',
    entityType: 'User',
    entityId: id,
    after: { fullName: parsed.data.fullName, role: parsed.data.role, active: parsed.data.active, passwordChanged: !!parsed.data.password }
  });
  revalidatePath('/quan-tri/nguoi-dung');
  redirect('/quan-tri/nguoi-dung');
}
