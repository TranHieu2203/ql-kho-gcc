'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { updateSettings } from './actions';

export function SettingsForm({ settings }: { settings: Record<string, string> }) {
  const [pending, startTransition] = useTransition();
  const { push } = useToast();

  async function action(fd: FormData) {
    startTransition(async () => {
      const r = await updateSettings(fd);
      if (r?.error) push({ variant: 'danger', message: r.error });
      else push({ variant: 'success', message: 'Đã lưu cấu hình.' });
    });
  }

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <div className="text-sm font-medium">Chính sách xuất quá tồn</div>
        <div className="space-y-2">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="out_overstock_policy"
              value="warn"
              defaultChecked={(settings.out_overstock_policy ?? 'warn') === 'warn'}
              className="mt-1"
            />
            <div>
              <div className="text-sm font-medium">Cảnh báo (cho phép xuất)</div>
              <div className="text-xs text-muted-foreground">Hệ thống cảnh báo nhưng vẫn lưu phiếu khi xuất quá tồn.</div>
            </div>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="out_overstock_policy"
              value="block"
              defaultChecked={settings.out_overstock_policy === 'block'}
              className="mt-1"
            />
            <div>
              <div className="text-sm font-medium">Chặn cứng</div>
              <div className="text-xs text-muted-foreground">Từ chối lưu phiếu xuất nếu vượt tồn hiện tại.</div>
            </div>
          </label>
        </div>
      </div>

      <Button type="submit" disabled={pending}>{pending ? 'Đang lưu...' : 'Lưu cấu hình'}</Button>
    </form>
  );
}
