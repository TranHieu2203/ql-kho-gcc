import Link from 'next/link';
import { redirect } from 'next/navigation';
import { validateRequest } from '@/lib/auth/lucia';
import { LoginForm } from './login-form';

export default async function LoginPage() {
  const { user } = await validateRequest();
  if (user) redirect('/tong-quan');

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary text-primary-foreground font-bold text-xl mb-3">
            QL
          </div>
          <h1 className="text-2xl font-bold">QL Kho Lốp</h1>
          <p className="text-sm text-muted-foreground mt-1">Quản lý kho lốp xe</p>
        </div>
        <div className="bg-card border rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Đăng nhập</h2>
          <LoginForm />
        </div>
        <p className="text-center text-xs text-muted-foreground mt-6">
          Chưa có tài khoản? Liên hệ quản trị viên.
        </p>
      </div>
    </div>
  );
}
