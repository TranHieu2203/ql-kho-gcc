'use client';
import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { createUser, updateUser } from './actions';

type Wh = { id: string; code: string; name: string };
type U = { id: string; username: string; fullName: string; role: string; active: boolean; warehouseLinks: { warehouseId: string }[] };

export function UserForm({ warehouses, initial }: { warehouses: Wh[]; initial?: U }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [role, setRole] = useState(initial?.role ?? 'WAREHOUSE_STAFF');

  async function action(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const r = initial ? await updateUser(initial.id, fd) : await createUser(fd);
      if (r?.error) setError(r.error);
    });
  }

  const initialWh = new Set(initial?.warehouseLinks.map((l) => l.warehouseId) ?? []);

  return (
    <form action={action} className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="username">Tên đăng nhập <span className="text-danger">*</span></Label>
          <Input id="username" name="username" defaultValue={initial?.username} required disabled={!!initial} className="font-mono" />
          {initial && <p className="text-xs text-muted-foreground">Không thể đổi tên đăng nhập sau khi tạo.</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Họ tên <span className="text-danger">*</span></Label>
          <Input id="fullName" name="fullName" defaultValue={initial?.fullName} required maxLength={128} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Mật khẩu {initial ? '(để trống nếu không đổi)' : <span className="text-danger">*</span>}</Label>
          <Input id="password" name="password" type="password" required={!initial} minLength={6} autoComplete="new-password" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="role">Vai trò <span className="text-danger">*</span></Label>
          <select
            id="role"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="WAREHOUSE_STAFF">Thủ kho</option>
            <option value="ADMIN">Quản trị</option>
          </select>
        </div>
      </div>

      {role !== 'ADMIN' && (
        <div className="space-y-2">
          <Label>Kho được phép thao tác</Label>
          <div className="border rounded-md divide-y">
            {warehouses.length === 0 && (
              <div className="p-3 text-sm text-muted-foreground">Chưa có kho nào. Tạo kho trước.</div>
            )}
            {warehouses.map((w) => (
              <label key={w.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/40">
                <input
                  type="checkbox"
                  name="warehouseIds"
                  value={w.id}
                  defaultChecked={initialWh.has(w.id)}
                  className="h-4 w-4"
                />
                <span className="text-sm font-mono">{w.code}</span>
                <span className="text-sm text-muted-foreground">— {w.name}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Quản trị viên có quyền tất cả kho — không cần gán.</p>
        </div>
      )}

      {initial && (
        <label className="flex items-center gap-2">
          <input type="checkbox" name="active" defaultChecked={initial.active} className="h-4 w-4" />
          <span className="text-sm">Tài khoản đang hoạt động</span>
        </label>
      )}

      {error && <div role="alert" className="text-sm text-danger-strong bg-danger-soft rounded-md p-3">{error}</div>}

      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" disabled={pending}>{pending ? 'Đang lưu...' : initial ? 'Cập nhật' : 'Tạo người dùng'}</Button>
        <Button type="button" variant="ghost" onClick={() => history.back()}>Huỷ</Button>
      </div>
    </form>
  );
}
