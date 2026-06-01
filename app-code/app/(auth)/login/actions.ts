'use server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { lucia } from '@/lib/auth/lucia';
import { verifyPassword } from '@/lib/auth/password';
import { checkLoginRateLimit, bumpLoginAttempt, clearLoginAttempt } from '@/lib/security/rate-limit';
import { getRequestMeta } from '@/lib/security/request-meta';

const schema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(128)
});

export async function login(formData: FormData) {
  const parsed = schema.safeParse({
    username: formData.get('username'),
    password: formData.get('password')
  });
  if (!parsed.success) return { error: 'Dữ liệu nhập không hợp lệ.' };

  const { ipAddress, userAgent } = getRequestMeta();
  const ipKey = ipAddress ?? 'unknown';

  // H3: rate limit by both username + IP
  const rl = checkLoginRateLimit(parsed.data.username, ipKey);
  if (rl.blocked) {
    await prisma.auditLog.create({
      data: {
        userId: null,
        action: 'login_blocked',
        entityType: 'User',
        entityId: parsed.data.username.toLowerCase().slice(0, 64),
        ipAddress,
        userAgent
      }
    });
    return { error: rl.message };
  }

  const user = await prisma.user.findUnique({ where: { username: parsed.data.username } });
  if (!user || !user.active) {
    bumpLoginAttempt(parsed.data.username, ipKey);
    await prisma.auditLog.create({
      data: {
        userId: null,
        action: 'login_fail',
        entityType: 'User',
        entityId: parsed.data.username.toLowerCase().slice(0, 64),
        ipAddress,
        userAgent,
        after: JSON.stringify({ reason: user ? 'inactive' : 'unknown_user' })
      }
    });
    return { error: 'Tên đăng nhập hoặc mật khẩu không đúng.' };
  }

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) {
    bumpLoginAttempt(parsed.data.username, ipKey);
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'login_fail',
        entityType: 'User',
        entityId: user.id,
        ipAddress,
        userAgent,
        after: JSON.stringify({ reason: 'wrong_password' })
      }
    });
    return { error: 'Tên đăng nhập hoặc mật khẩu không đúng.' };
  }

  clearLoginAttempt(parsed.data.username);
  const session = await lucia.createSession(user.id, {});
  const sessionCookie = lucia.createSessionCookie(session.id);
  cookies().set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'login',
      entityType: 'User',
      entityId: user.id,
      ipAddress,
      userAgent
    }
  });

  redirect('/tong-quan');
}

export async function logout() {
  const sessionCookieName = lucia.sessionCookieName;
  const sessionId = cookies().get(sessionCookieName)?.value ?? null;
  let userId: string | null = null;
  if (sessionId) {
    const { session } = await lucia.validateSession(sessionId);
    userId = session?.userId ?? null;
    await lucia.invalidateSession(sessionId);
  }
  const blank = lucia.createBlankSessionCookie();
  cookies().set(blank.name, blank.value, blank.attributes);

  if (userId) {
    const { ipAddress, userAgent } = getRequestMeta();
    await prisma.auditLog.create({
      data: { userId, action: 'logout', entityType: 'User', entityId: userId, ipAddress, userAgent }
    });
  }

  redirect('/login');
}
