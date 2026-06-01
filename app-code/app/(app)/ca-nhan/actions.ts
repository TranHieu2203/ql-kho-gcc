'use server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { requireUser } from '@/lib/auth/lucia';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { audit } from '@/lib/security/audit';

const schema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z
      .string()
      .min(8, 'Mật khẩu mới tối thiểu 8 ký tự')
      .max(128)
      .refine((p) => /[A-Za-z]/.test(p), 'Phải có ít nhất 1 chữ cái')
      .refine((p) => /\d/.test(p), 'Phải có ít nhất 1 chữ số'),
    confirmPassword: z.string().min(6).max(128)
  })
  .refine((d) => d.newPassword === d.confirmPassword, { message: 'Mật khẩu xác nhận không khớp.' });

export async function changePassword(fd: FormData) {
  const me = await requireUser();
  const parsed = schema.safeParse({
    currentPassword: fd.get('currentPassword'),
    newPassword: fd.get('newPassword'),
    confirmPassword: fd.get('confirmPassword')
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? 'Dữ liệu không hợp lệ' };

  const user = await prisma.user.findUnique({ where: { id: me.id } });
  if (!user) return { error: 'Không tìm thấy tài khoản.' };

  const ok = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!ok) return { error: 'Mật khẩu hiện tại không đúng.' };

  const newHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({ where: { id: me.id }, data: { passwordHash: newHash } });
  await audit({ userId: me.id, action: 'change_password', entityType: 'User', entityId: me.id });
  return { ok: true };
}
