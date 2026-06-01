import { Lucia } from 'lucia';
import { PrismaAdapter } from '@lucia-auth/adapter-prisma';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { prisma } from '@/lib/db/prisma';
import type { Session, User } from 'lucia';

const adapter = new PrismaAdapter(prisma.session, prisma.user);

export const lucia = new Lucia(adapter, {
  sessionCookie: {
    expires: false,
    attributes: {
      secure: process.env.NODE_ENV === 'production'
    }
  },
  getUserAttributes: (attributes) => {
    return {
      username: attributes.username,
      fullName: attributes.fullName,
      role: attributes.role,
      active: attributes.active
    };
  }
});

declare module 'lucia' {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: {
      username: string;
      fullName: string;
      role: string;
      active: boolean;
    };
  }
}

export const validateRequest = cache(
  async (): Promise<{ user: User; session: Session } | { user: null; session: null }> => {
    const sessionId = cookies().get(lucia.sessionCookieName)?.value ?? null;
    if (!sessionId) {
      return { user: null, session: null };
    }

    const result = await lucia.validateSession(sessionId);
    try {
      if (result.session && result.session.fresh) {
        const sessionCookie = lucia.createSessionCookie(result.session.id);
        cookies().set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
      }
      if (!result.session) {
        const sessionCookie = lucia.createBlankSessionCookie();
        cookies().set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
      }
    } catch {
      // swallow cookie set errors in RSC where it's read-only
    }
    return result;
  }
);

export async function requireUser() {
  const { user } = await validateRequest();
  if (!user) throw new Error('UNAUTHORIZED');
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== 'ADMIN') throw new Error('FORBIDDEN');
  return user;
}

export async function getUserWarehouses(userId: string): Promise<{ id: string; code: string; name: string }[]> {
  const links = await prisma.userWarehouse.findMany({
    where: { userId },
    include: { warehouse: true }
  });
  return links
    .filter((l) => l.warehouse.active)
    .map((l) => ({ id: l.warehouse.id, code: l.warehouse.code, name: l.warehouse.name }));
}

export async function assertCanAccessWarehouse(userId: string, warehouseId: string, role: string) {
  if (role === 'ADMIN') return; // admin có quyền tất cả
  const link = await prisma.userWarehouse.findUnique({
    where: { userId_warehouseId: { userId, warehouseId } }
  });
  if (!link) throw new Error('FORBIDDEN_WAREHOUSE');
}
