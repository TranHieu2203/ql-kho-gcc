import { redirect } from 'next/navigation';
import { validateRequest } from '@/lib/auth/lucia';

export default async function RootPage() {
  const { user } = await validateRequest();
  if (user) redirect('/tong-quan');
  redirect('/login');
}
