'use client';
import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { createProduct, updateProduct } from './actions';

type Product = {
  id: string;
  sku: string;
  fullName: string;
  brand: string;
  size: string;
  pattern: string;
  defaultUnit: string;
  lowStockThreshold: number;
};

export function ProductForm({ initial }: { initial?: Product }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function action(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const result = initial ? await updateProduct(initial.id, fd) : await createProduct(fd);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={action} className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="sku">Mã SKU <span className="text-danger">*</span></Label>
          <Input id="sku" name="sku" defaultValue={initial?.sku} className="font-mono" required maxLength={64} />
          <p className="text-xs text-muted-foreground">VD: GD639 1100R20 18PR</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Tên đầy đủ <span className="text-danger">*</span></Label>
          <Input id="fullName" name="fullName" defaultValue={initial?.fullName} required maxLength={256} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="brand">Thương hiệu <span className="text-danger">*</span></Label>
          <Input id="brand" name="brand" defaultValue={initial?.brand} required maxLength={64} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="size">Kích thước (Size) <span className="text-danger">*</span></Label>
          <Input id="size" name="size" defaultValue={initial?.size} required maxLength={64} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pattern">Mã gai (Pattern) <span className="text-danger">*</span></Label>
          <Input id="pattern" name="pattern" defaultValue={initial?.pattern} required maxLength={64} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="defaultUnit">Đơn vị tính <span className="text-danger">*</span></Label>
          <select
            id="defaultUnit"
            name="defaultUnit"
            defaultValue={initial?.defaultUnit ?? 'BO'}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            required
          >
            <option value="BO">Bộ</option>
            <option value="CHIEC">Chiếc</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lowStockThreshold">Ngưỡng tồn thấp</Label>
          <Input
            id="lowStockThreshold"
            name="lowStockThreshold"
            type="number"
            min={0}
            max={99999}
            defaultValue={initial?.lowStockThreshold ?? 10}
          />
        </div>
      </div>

      {error && (
        <div role="alert" className="text-sm text-danger-strong bg-danger-soft rounded-md p-3">{error}</div>
      )}

      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" disabled={pending}>{pending ? 'Đang lưu...' : initial ? 'Cập nhật' : 'Tạo sản phẩm'}</Button>
        <Button type="button" variant="ghost" onClick={() => history.back()}>Huỷ</Button>
      </div>
    </form>
  );
}
