import { redirect } from 'next/navigation';
import { validateRequest } from '@/lib/auth/lucia';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChangePasswordForm } from './change-password-form';

export default async function ProfilePage() {
  const { user } = await validateRequest();
  if (!user) redirect('/login');

  return (
    <div className="p-4 md:p-6 max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Hồ sơ cá nhân</h1>
      <Card>
        <CardHeader>
          <CardTitle>Thông tin tài khoản</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div><span className="text-muted-foreground">Tên đăng nhập:</span> <span className="font-mono ml-2">{user.username}</span></div>
          <div><span className="text-muted-foreground">Họ tên:</span> <span className="ml-2">{user.fullName}</span></div>
          <div><span className="text-muted-foreground">Vai trò:</span> <span className="ml-2">{user.role === 'ADMIN' ? 'Quản trị' : 'Thủ kho'}</span></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Đổi mật khẩu</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
