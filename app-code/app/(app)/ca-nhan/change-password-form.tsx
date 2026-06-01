'use client';
import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { changePassword } from './actions';

export function ChangePasswordForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { push } = useToast();

  async function action(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const r = await changePassword(fd);
      if (r.error) setError(r.error);
      else {
        push({ variant: 'success', message: 'Đã đổi mật khẩu.' });
        (document.getElementById('change-password-form') as HTMLFormElement)?.reset();
      }
    });
  }

  return (
    <form id="change-password-form" action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="currentPassword">Mật khẩu hiện tại</Label>
        <Input id="currentPassword" name="currentPassword" type="password" required autoComplete="current-password" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="newPassword">Mật khẩu mới (≥ 6 ký tự)</Label>
        <Input id="newPassword" name="newPassword" type="password" required minLength={6} autoComplete="new-password" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Nhập lại mật khẩu mới</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" required minLength={6} autoComplete="new-password" />
      </div>
      {error && <div role="alert" className="text-sm text-danger-strong bg-danger-soft rounded-md p-3">{error}</div>}
      <Button type="submit" disabled={pending}>{pending ? 'Đang lưu...' : 'Đổi mật khẩu'}</Button>
    </form>
  );
}
