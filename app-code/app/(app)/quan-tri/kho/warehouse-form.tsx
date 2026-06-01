'use client';
import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { createWarehouse, updateWarehouse, archiveWarehouse } from './actions';
import { useToast } from '@/components/ui/toast';

type Wh = { id: string; code: string; name: string; address: string | null; active: boolean };

export function WarehouseForm({ initial }: { initial?: Wh }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { push } = useToast();

  async function action(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const r = initial ? await updateWarehouse(initial.id, fd) : await createWarehouse(fd);
      if (r?.error) setError(r.error);
    });
  }

  async function onArchive() {
    if (!initial) return;
    startTransition(async () => {
      const r = await archiveWarehouse(initial.id);
      if (r.error) push({ variant: 'danger', message: r.error });
      else push({ variant: 'success', message: r.message ?? 'Đã cập nhật.' });
    });
  }

  return (
    <form action={action} className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="code">Mã kho <span className="text-danger">*</span></Label>
          <Input id="code" name="code" defaultValue={initial?.code} className="font-mono uppercase" required maxLength={32} placeholder="VD: WH-HN" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name">Tên kho <span className="text-danger">*</span></Label>
          <Input id="name" name="name" defaultValue={initial?.name} required maxLength={128} />
        </div>
        <div className="md:col-span-2 space-y-1.5">
          <Label htmlFor="address">Địa chỉ</Label>
          <Input id="address" name="address" defaultValue={initial?.address ?? ''} maxLength={256} />
        </div>
      </div>

      {error && <div role="alert" className="text-sm text-danger-strong bg-danger-soft rounded-md p-3">{error}</div>}

      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" disabled={pending}>{pending ? 'Đang lưu...' : initial ? 'Cập nhật' : 'Tạo kho'}</Button>
        <Button type="button" variant="ghost" onClick={() => history.back()}>Huỷ</Button>
        {initial && (
          <Button type="button" variant="outline" className="ml-auto" onClick={onArchive} disabled={pending}>
            {initial.active ? 'Vô hiệu hoá' : 'Kích hoạt'}
          </Button>
        )}
      </div>
    </form>
  );
}
