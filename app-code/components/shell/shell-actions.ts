'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { lucia } from '@/lib/auth/lucia';

export async function logoutAction() {
  const sessionId = cookies().get(lucia.sessionCookieName)?.value ?? null;
  if (sessionId) await lucia.invalidateSession(sessionId);
  const blank = lucia.createBlankSessionCookie();
  cookies().set(blank.name, blank.value, blank.attributes);
  redirect('/login');
}
